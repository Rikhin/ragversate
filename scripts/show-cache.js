#!/usr/bin/env node

import { helixDB } from '../app/lib/helixdb.ts';

async function showCache() {
  console.log('📊 Current HelixDB Cache Contents:\n');

  try {
    // Test connection
    const isHealthy = await helixDB.healthCheck();
    if (!isHealthy) {
      console.log('❌ HelixDB is not connected. Please ensure it\'s running.');
      return;
    }

    // Get all entities
    const result = await helixDB.getAllEntities();
    
    if (result.length === 0) {
      console.log('📭 Cache is empty - no entities stored yet.');
      return;
    }

    console.log(`✅ Found ${result.length} cached entities:\n`);

    result.forEach((entity, index) => {
      console.log(`${index + 1}. ${entity.name} (${entity.category})`);
      console.log(`   ID: ${entity.id}`);
      console.log(`   Source Query: "${entity.source_query}"`);
      console.log(`   Created: ${new Date(entity.created_at).toLocaleString()}`);
      console.log(`   Description: ${entity.description.substring(0, 100)}${entity.description.length > 100 ? '...' : ''}`);
      console.log('');
    });

    // Summary by category
    const categoryCount = result.reduce((acc, entity) => {
      acc[entity.category] = (acc[entity.category] || 0) + 1;
      return acc;
    }, {});

    console.log('📈 Summary by Category:');
    Object.entries(categoryCount).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} entities`);
    });

  } catch (error) {
    console.error('❌ Error accessing cache:', error.message);
  }
}

showCache(); 