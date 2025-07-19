#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { helixDB } from '../app/lib/helixdb';

// Load environment variables
config({ path: '.env.local' });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Type definitions
interface CSVRow {
  URL?: string;
  Title?: string;
  Company?: string;
  'Job Title'?: string;
  'Field of Study (Result)'?: string;
  'Professional Summary (Result)'?: string;
  'Current State (Result)'?: string;
  'Work Email (Result)'?: string;
  [key: string]: any;
}

interface CleanedData {
  name: string;
  company: string;
  jobTitle: string;
  fieldOfStudy: string;
  professionalSummary: string;
  currentState: string;
  workEmail: string;
  url: string;
  rawData: CSVRow;
}

interface ValidatedEntity {
  name: string;
  description: string;
  category: string;
  source_query: string;
  confidence: string;
  originalData: CleanedData;
}

// Track processed entities to avoid duplicates
const processedEntities = new Set<string>();
const entityCache = new Map<string, any>();

// Configuration
const CONFIG = {
  maxEntitiesPerFile: 50, // Limit to prevent overwhelming the system
  minDescriptionLength: 50,
  maxDescriptionLength: 500,
  batchSize: 10, // Process in batches to avoid rate limits
  delayBetweenBatches: 1000, // 1 second delay between batches
};

// Entity categories for researchers
const RESEARCHER_CATEGORIES = {
  'person': 'person',
  'organization': 'organization',
  'institution': 'organization',
  'company': 'organization',
  'university': 'organization',
  'institute': 'organization',
  'center': 'organization',
  'laboratory': 'organization',
  'department': 'organization'
};

/**
 * Clean and normalize entity data
 */
function cleanEntityData(row: CSVRow): CleanedData | null {
  const name = row.Title?.trim() || row['Professional Summary (Result)']?.split(' ').slice(0, 2).join(' ') || 'Unknown';
  const company = row.Company?.trim() || '';
  const jobTitle = row['Job Title']?.trim() || '';
  const fieldOfStudy = row['Field of Study (Result)']?.trim() || '';
  const professionalSummary = row['Professional Summary (Result)']?.trim() || '';
  const currentState = row['Current State (Result)']?.trim() || '';
  const workEmail = row['Work Email (Result)']?.trim() || '';
  const url = row.URL?.trim() || '';

  // Skip if no meaningful data
  if (!name || name === 'Unknown' || name.length < 2) {
    return null;
  }

  return {
    name,
    company,
    jobTitle,
    fieldOfStudy,
    professionalSummary,
    currentState,
    workEmail,
    url,
    rawData: row
  };
}

/**
 * Determine entity category based on data
 */
function determineCategory(cleanedData: CleanedData): string {
  // If it's clearly a person (has job title, professional summary)
  if (cleanedData.jobTitle && cleanedData.professionalSummary) {
    return 'person';
  }
  
  // If it's clearly an organization (company name, no personal details)
  if (cleanedData.company && !cleanedData.jobTitle && !cleanedData.professionalSummary) {
    return 'organization';
  }
  
  // Default to person for researchers
  return 'person';
}

/**
 * Generate a comprehensive description for the entity
 */
function generateDescription(cleanedData: CleanedData): string {
  const parts = [];
  
  if (cleanedData.jobTitle) {
    parts.push(cleanedData.jobTitle);
  }
  
  if (cleanedData.company) {
    parts.push(`at ${cleanedData.company}`);
  }
  
  if (cleanedData.fieldOfStudy) {
    parts.push(`specializing in ${cleanedData.fieldOfStudy}`);
  }
  
  if (cleanedData.currentState) {
    parts.push(`based in ${cleanedData.currentState}`);
  }
  
  if (cleanedData.professionalSummary) {
    // Truncate professional summary if too long
    const summary = cleanedData.professionalSummary.length > 200 
      ? cleanedData.professionalSummary.substring(0, 200) + '...'
      : cleanedData.professionalSummary;
    parts.push(summary);
  }
  
  return parts.join('. ');
}

/**
 * Use AI to validate and enhance entity data
 */
async function validateEntityWithAI(cleanedData: CleanedData) {
  try {
    const prompt = `
You are an expert at validating and enhancing researcher profile data. Given the following researcher information, determine if this is a high-quality, meaningful entity that should be stored in a knowledge base.

Researcher Data:
- Name: ${cleanedData.name}
- Job Title: ${cleanedData.jobTitle || 'N/A'}
- Company: ${cleanedData.company || 'N/A'}
- Field of Study: ${cleanedData.fieldOfStudy || 'N/A'}
- Current State: ${cleanedData.currentState || 'N/A'}
- Professional Summary: ${cleanedData.professionalSummary || 'N/A'}

Return a JSON object with the following structure:
{
  "isValid": boolean,
  "reason": "brief explanation of why valid/invalid",
  "enhancedName": "best name to use",
  "enhancedDescription": "comprehensive description (max 300 words)",
  "category": "person|organization",
  "confidence": "high|medium|low"
}

Guidelines:
- Valid if: Real person with meaningful research role, clear professional identity
- Invalid if: Generic/placeholder data, missing key information, duplicate entries
- Focus on researchers, scientists, academics, and research leaders
- Ensure descriptions are factual and professional
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-0125',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.2,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No content received from OpenAI');
    }
    
    const result = JSON.parse(content);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`⚠️ AI validation failed for ${cleanedData.name}:`, errorMessage);
    // Fallback to basic validation
    return {
      isValid: cleanedData.name.length > 2 && cleanedData.professionalSummary.length > 20,
      reason: 'Fallback validation',
      enhancedName: cleanedData.name,
      enhancedDescription: generateDescription(cleanedData),
      category: determineCategory(cleanedData),
      confidence: 'medium'
    };
  }
}

/**
 * Check for duplicates
 */
function isDuplicate(entity: ValidatedEntity) {
  const key = `${entity.name.toLowerCase()}_${entity.category}`;
  return processedEntities.has(key);
}

/**
 * Process a single CSV file
 */
async function processCSVFile(filePath: string) {
  console.log(`📁 Processing: ${path.basename(filePath)}`);
  
  const results: CSVRow[] = [];
  const validEntities: ValidatedEntity[] = [];
  
  return new Promise<ValidatedEntity[]>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data: CSVRow) => results.push(data))
      .on('end', async () => {
        console.log(`   Found ${results.length} rows in ${path.basename(filePath)}`);
        
        // Process each row
        for (let i = 0; i < Math.min(results.length, CONFIG.maxEntitiesPerFile); i++) {
          const row = results[i];
          
          // Clean the data
          const cleanedData = cleanEntityData(row);
          if (!cleanedData) continue;
          
          // Check for duplicates
          if (isDuplicate(cleanedData as any)) {
            console.log(`   🔄 Skipping duplicate: ${cleanedData.name}`);
            continue;
          }
          
          // Validate with AI
          const validation = await validateEntityWithAI(cleanedData);
          
          if (validation.isValid && validation.confidence !== 'low') {
            const entity: ValidatedEntity = {
              name: validation.enhancedName,
              description: validation.enhancedDescription,
              category: validation.category,
              source_query: `csv_import_${path.basename(filePath)}`,
              confidence: validation.confidence,
              originalData: cleanedData
            };
            
            validEntities.push(entity);
            
            // Mark as processed
            const key = `${entity.name.toLowerCase()}_${entity.category}`;
            processedEntities.add(key);
            
            console.log(`   ✅ Validated: ${entity.name} (${validation.confidence} confidence)`);
          } else {
            console.log(`   ❌ Rejected: ${cleanedData.name} - ${validation.reason}`);
          }
          
          // Add delay to avoid rate limits
          if (i % CONFIG.batchSize === 0 && i > 0) {
            await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenBatches));
          }
        }
        
        console.log(`   📊 Valid entities: ${validEntities.length}/${results.length}`);
        resolve(validEntities);
      })
      .on('error', reject);
  });
}

/**
 * Store entities in HelixDB
 */
async function storeEntities(entities: ValidatedEntity[]) {
  console.log(`\n💾 Storing ${entities.length} entities in HelixDB...`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    
    try {
      await helixDB.createEntity({
        name: entity.name,
        category: entity.category,
        source_query: entity.source_query,
        description: entity.description
      });
      
      successCount++;
      console.log(`   ✅ Stored: ${entity.name}`);
      
      // Add delay between stores
      if (i % CONFIG.batchSize === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, CONFIG.delayBetweenBatches));
      }
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log(`   ❌ Failed to store ${entity.name}:`, errorMessage);
    }
  }
  
  console.log(`\n📈 Storage Summary:`);
  console.log(`   ✅ Successfully stored: ${successCount}`);
  console.log(`   ❌ Failed to store: ${errorCount}`);
  console.log(`   📊 Total processed: ${entities.length}`);
  
  return { successCount, errorCount, total: entities.length };
}

/**
 * Main import function
 */
async function importResearcherCSVs() {
  console.log('🚀 Starting smart CSV import for researcher websets...\n');
  
  try {
    // Check if HelixDB is available
    const isHealthy = await helixDB.healthCheck();
    if (!isHealthy) {
      console.log('❌ HelixDB is not available. Please ensure it is running.');
      return;
    }
    
    // Get all CSV files from data directory
    const dataDir = path.join(process.cwd(), 'data');
    const files = fs.readdirSync(dataDir)
      .filter(file => file.endsWith('.csv') && file.includes('webset'))
      .map(file => path.join(dataDir, file));
    
    if (files.length === 0) {
      console.log('❌ No webset CSV files found in data directory.');
      return;
    }
    
    console.log(`📁 Found ${files.length} webset CSV files:`);
    files.forEach(file => console.log(`   - ${path.basename(file)}`));
    console.log('');
    
    // Process each file
    const allEntities = [];
    
    for (const file of files) {
      try {
        const entities = await processCSVFile(file);
        allEntities.push(...entities);
        console.log(`   ✅ Completed: ${path.basename(file)}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`   ❌ Error processing ${path.basename(file)}:`, errorMessage);
      }
    }
    
    console.log(`\n📊 Total valid entities across all files: ${allEntities.length}`);
    
    if (allEntities.length > 0) {
      // Store all entities in HelixDB
      const storageResult = await storeEntities(allEntities);
      
      console.log('\n🎉 Import completed successfully!');
      console.log(`📈 Summary:`);
      console.log(`   - Files processed: ${files.length}`);
      console.log(`   - Total entities found: ${allEntities.length}`);
      console.log(`   - Successfully stored: ${storageResult.successCount}`);
      console.log(`   - Failed to store: ${storageResult.errorCount}`);
      
      // Show some examples of stored entities
      console.log('\n📋 Sample stored entities:');
      allEntities.slice(0, 5).forEach(entity => {
        console.log(`   • ${entity.name} (${entity.category})`);
      });
      
    } else {
      console.log('\n⚠️ No valid entities found to store.');
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Import failed:', errorMessage);
  }
}

// Run the import if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  importResearcherCSVs();
}

export { importResearcherCSVs }; 