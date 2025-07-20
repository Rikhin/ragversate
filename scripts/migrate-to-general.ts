#!/usr/bin/env tsx

import { multiHelixDB } from '../app/lib/multi-helixdb';
import { Entity } from '../app/lib/multi-helixdb';

async function migrateDataToGeneral() {
  console.log('🔄 Starting data migration to General Search instance...');

  try {
    // Connect to the general instance
    await multiHelixDB.connect('general');
    console.log('✅ Connected to General Search instance');

    // Get all entities from the current database (port 6969)
    // This assumes the current data is still accessible
    const currentEntities = await multiHelixDB.getAllEntities('general');
    console.log(`📊 Found ${currentEntities.length} entities in current database`);

    if (currentEntities.length === 0) {
      console.log('ℹ️ No entities found to migrate');
      return;
    }

    // Create entities in the general instance
    let migratedCount = 0;
    let skippedCount = 0;

    for (const entity of currentEntities) {
      try {
        // Check if entity already exists
        const existing = await multiHelixDB.findExistingEntity('general', entity.name, entity.category);
        
        if (existing) {
          console.log(`⏭️ Skipping existing entity: ${entity.name}`);
          skippedCount++;
          continue;
        }

        // Create the entity
        await multiHelixDB.createEntity('general', {
          name: entity.name,
          category: entity.category,
          source_query: entity.source_query,
          description: entity.description
        });

        console.log(`✅ Migrated: ${entity.name}`);
        migratedCount++;
      } catch (error) {
        console.error(`❌ Failed to migrate entity ${entity.name}:`, error);
      }
    }

    console.log('');
    console.log('🎉 Migration completed!');
    console.log(`📈 Migrated: ${migratedCount} entities`);
    console.log(`⏭️ Skipped: ${skippedCount} entities (already existed)`);
    console.log(`📊 Total: ${migratedCount + skippedCount} entities processed`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateDataToGeneral().catch(console.error); 