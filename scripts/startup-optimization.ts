#!/usr/bin/env tsx

import { config } from 'dotenv';
import { helixDB } from '../app/lib/helixdb';
import { contextEngine } from '../app/lib/context-engine';
import { optimizedSupermemoryService } from '../app/lib/supermemory-optimized';
import { logger } from '../app/lib/logging';

// Load environment variables
config({ path: '.env.local' });

async function optimizeStartup() {
  console.log('🚀 Starting system optimization...');
  const startTime = Date.now();

  try {
    // 1. Pre-warm HelixDB cache
    console.log('🔥 Pre-warming HelixDB cache...');
    const helixStart = Date.now();
    await helixDB.connect();
    // Trigger cache warming by doing a search
    await helixDB.semanticSearch('test', 1);
    const helixTime = Date.now() - helixStart;
    console.log(`✅ HelixDB warmed in ${helixTime}ms`);

    // 2. Initialize Context Engine graph
    console.log('🧠 Initializing Context Engine graph...');
    const contextStart = Date.now();
    // The Context Engine will initialize its graph automatically
    // We just need to trigger the first analysis
    await contextEngine.analyzeContext('test query', 'startup_user');
    const contextTime = Date.now() - contextStart;
    console.log(`✅ Context Engine initialized in ${contextTime}ms`);

    // 3. Initialize Supermemory service
    console.log('💾 Initializing Supermemory service...');
    const supermemoryStart = Date.now();
    await optimizedSupermemoryService.initialize();
    const supermemoryTime = Date.now() - supermemoryStart;
    console.log(`✅ Supermemory initialized in ${supermemoryTime}ms`);

    // 4. Test a quick search to ensure everything is working
    console.log('🧪 Testing system components...');
    const testStart = Date.now();
    
    // Test HelixDB
    const testResult = await helixDB.semanticSearch('test', 1);
    console.log(`✅ HelixDB test: ${testResult.entities.length} entities found`);
    
    // Test Context Engine
    const contextTest = await contextEngine.generateReactiveResponse('test', 'startup_user');
    console.log(`✅ Context Engine test: confidence ${contextTest?.confidence || 0}`);
    
    const testTime = Date.now() - testStart;
    console.log(`✅ System test completed in ${testTime}ms`);

    const totalTime = Date.now() - startTime;
    console.log(`\n🎉 Startup optimization completed in ${totalTime}ms!`);
    console.log('📊 Performance breakdown:');
    console.log(`   HelixDB: ${helixTime}ms`);
    console.log(`   Context Engine: ${contextTime}ms`);
    console.log(`   Supermemory: ${supermemoryTime}ms`);
    console.log(`   System Test: ${testTime}ms`);
    console.log(`   Total: ${totalTime}ms`);
    
    logger.log('info', 'Startup optimization completed', {
      totalTime,
      helixTime,
      contextTime,
      supermemoryTime,
      testTime
    });

  } catch (error) {
    console.error('❌ Startup optimization failed:', error);
    logger.log('error', 'Startup optimization failed', { error: (error as Error).message });
  }
}

// Run optimization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  optimizeStartup().then(() => {
    console.log('✅ Startup optimization script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Startup optimization script failed:', error);
    process.exit(1);
  });
}

export { optimizeStartup }; 