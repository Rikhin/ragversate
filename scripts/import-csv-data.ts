#!/usr/bin/env tsx

import { multiHelixDB, SearchMode } from '../app/lib/multi-helixdb';
import * as fs from 'fs';
import * as path from 'path';

interface CSVRow {
  [key: string]: string;
}

interface ImportConfig {
  mode: SearchMode;
  csvPath: string;
  nameColumn: string;
  descriptionColumn: string;
  categoryColumn?: string;
  sourceQueryColumn?: string;
  defaultCategory?: string;
}

async function importCSVData(config: ImportConfig) {
  console.log(`🔄 Importing CSV data for ${config.mode} mode...`);

  try {
    // Connect to the specified instance
    await multiHelixDB.connect(config.mode);
    console.log(`✅ Connected to ${config.mode} instance`);

    // Read CSV file
    if (!fs.existsSync(config.csvPath)) {
      throw new Error(`CSV file not found: ${config.csvPath}`);
    }

    const csvContent = fs.readFileSync(config.csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file is empty or has no data rows');
    }

    // Parse headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log(`📋 CSV headers: ${headers.join(', ')}`);

    // Validate required columns
    if (!headers.includes(config.nameColumn)) {
      throw new Error(`Required column '${config.nameColumn}' not found in CSV`);
    }
    if (!headers.includes(config.descriptionColumn)) {
      throw new Error(`Required column '${config.descriptionColumn}' not found in CSV`);
    }

    // Process data rows
    const dataRows = lines.slice(1);
    console.log(`📊 Processing ${dataRows.length} data rows...`);

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const line = dataRows[i];
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      
      if (values.length !== headers.length) {
        console.warn(`⚠️ Skipping row ${i + 2}: column count mismatch`);
        errorCount++;
        continue;
      }

      // Create row object
      const row: CSVRow = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });

      // Extract data
      const name = row[config.nameColumn];
      const description = row[config.descriptionColumn];
      const category = config.categoryColumn ? row[config.categoryColumn] : config.defaultCategory || config.mode;
      const sourceQuery = config.sourceQueryColumn ? row[config.sourceQueryColumn] : `Imported from ${config.mode} CSV`;

      if (!name || !description) {
        console.warn(`⚠️ Skipping row ${i + 2}: missing required data`);
        errorCount++;
        continue;
      }

      try {
        // Check if entity already exists
        const existing = await multiHelixDB.findExistingEntity(config.mode, name, category);
        
        if (existing) {
          console.log(`⏭️ Skipping existing entity: ${name}`);
          skippedCount++;
          continue;
        }

        // Create the entity
        await multiHelixDB.createEntity(config.mode, {
          name,
          category,
          source_query: sourceQuery,
          description
        });

        console.log(`✅ Imported: ${name}`);
        importedCount++;
      } catch (error) {
        console.error(`❌ Failed to import entity ${name}:`, error);
        errorCount++;
      }
    }

    console.log('');
    console.log(`🎉 Import completed for ${config.mode}!`);
    console.log(`📈 Imported: ${importedCount} entities`);
    console.log(`⏭️ Skipped: ${skippedCount} entities (already existed)`);
    console.log(`❌ Errors: ${errorCount} entities`);
    console.log(`📊 Total processed: ${dataRows.length} rows`);

  } catch (error) {
    console.error(`❌ Import failed for ${config.mode}:`, error);
    throw error;
  }
}

// Example usage function
async function importAllCSVData() {
  const importConfigs: ImportConfig[] = [
    {
      mode: 'summer-programs',
      csvPath: 'data/websets/summer-programs/summer_programs.csv',
      nameColumn: 'Program Name',
      descriptionColumn: 'Description',
      categoryColumn: 'Category',
      sourceQueryColumn: 'Source',
      defaultCategory: 'summer-program'
    },
    {
      mode: 'mentors',
      csvPath: 'data/websets/mentors/mentors.csv',
      nameColumn: 'Name',
      descriptionColumn: 'Bio',
      categoryColumn: 'Field',
      sourceQueryColumn: 'Institution',
      defaultCategory: 'mentor'
    },
    {
      mode: 'scholarships',
      csvPath: 'data/websets/scholarships/scholarships.csv',
      nameColumn: 'Scholarship Name',
      descriptionColumn: 'Description',
      categoryColumn: 'Category',
      sourceQueryColumn: 'Provider',
      defaultCategory: 'scholarship'
    }
  ];

  console.log('🚀 Starting CSV import for all modes...\n');

  for (const config of importConfigs) {
    try {
      await importCSVData(config);
      console.log('');
    } catch (error) {
      console.error(`Failed to import ${config.mode}:`, error);
    }
  }

  console.log('🎉 All CSV imports completed!');
}

// Export functions for use in other scripts
export { importCSVData, importAllCSVData };

// Run if called directly
if (require.main === module) {
  importAllCSVData().catch(console.error);
} 