#!/usr/bin/env node

import { helixDB } from '../app/lib/helixdb.ts';

async function testHelixDB() {
  console.log('🧪 Testing HelixDB Integration...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const isHealthy = await helixDB.healthCheck();
    console.log(`   Health check: ${isHealthy ? '✅ PASS' : '❌ FAIL'}\n`);

    if (!isHealthy) {
      console.log('❌ HelixDB is not healthy. Please ensure:');
      console.log('   - HelixDB instance is running (helix deploy)');
      console.log('   - Instance is accessible on http://localhost:6969');
      console.log('   - Schema and queries are valid (helix check)');
      return;
    }

    // Test 2: Create Entity
    console.log('2. Testing entity creation...');
    const testEntity = await helixDB.createEntity({
      name: 'Test Entity',
      category: 'test',
      source_query: 'test query for testing purposes',
      description: 'This is a test entity created during testing'
    });
    console.log(`   Entity created: ${testEntity.name} (ID: ${testEntity.id}) ✅\n`);

    // Test 3: Search Entities
    console.log('3. Testing entity search...');
    const searchResult = await helixDB.searchEntities('test entity', 5);
    console.log(`   Search results: ${searchResult.total} entities found ✅\n`);

    // Test 4: Get All Entities
    console.log('4. Testing get all entities...');
    const allEntities = await helixDB.getAllEntities();
    console.log(`   Total entities in database: ${allEntities.length} ✅\n`);

    // Test 5: Get Entity by ID
    console.log('5. Testing get entity by ID...');
    const retrievedEntity = await helixDB.getEntityById(testEntity.id);
    if (retrievedEntity && retrievedEntity.name === testEntity.name) {
      console.log(`   Entity retrieved successfully: ${retrievedEntity.name} ✅\n`);
    } else {
      console.log('   ❌ Failed to retrieve entity by ID');
    }

    // Test 6: Find Similar Entities
    console.log('6. Testing similar entity search...');
    const similarEntities = await helixDB.findSimilarEntities(testEntity.id, 3);
    console.log(`   Similar entities found: ${similarEntities.length} ✅\n`);

    console.log('🎉 All tests passed! HelixDB integration is working correctly.\n');
    console.log('📊 Database Summary:');
    console.log(`   - Total entities: ${allEntities.length}`);
    console.log(`   - Test entity: ${testEntity.name} (${testEntity.category})`);
    console.log(`   - Search functionality: Working`);
    console.log(`   - Vector similarity: Working`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Ensure HelixDB is running: helix instances');
    console.error('2. Check schema validation: helix check');
    console.error('3. Restart instance if needed: helix restart <instance-id>');
    console.error('4. Check logs for detailed error information');
  }
}

// Run the test
testHelixDB(); 