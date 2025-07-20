#!/usr/bin/env node

import { config } from 'dotenv';
import { agentSearch } from '../app/lib/agent-search.js';

// Load environment variables
config({ path: '.env.local' });

async function testUltraFastExa() {
  console.log('⚡ Testing Ultra-Fast Exa Search Integration\n');

  // Test a query that should trigger Exa search (not in cache)
  const testQuery = 'latest quantum computing developments 2024';
  
  console.log(`🔍 Testing query: "${testQuery}"`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  
  try {
    const result = await agentSearch(testQuery, 'test-user-123');
    const duration = Date.now() - startTime;
    
    console.log(`✅ Search completed in ${duration}ms`);
    console.log(`📊 Source: ${result.source}`);
    console.log(`💾 Cached: ${result.cached}`);
    console.log(`🎯 Total Time: ${result.performance.totalTime}ms`);
    console.log(`🔧 Exa Time: ${result.performance.exaTime}ms`);
    console.log(`🧠 HelixDB Time: ${result.performance.helixdbTime}ms`);
    
    console.log('\n📋 Tool Usage:');
    result.toolUsage.forEach((usage, index) => {
      const status = usage.success ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${usage.tool}.${usage.action} (${usage.duration}ms)`);
    });
    
    console.log(`\n💬 Answer (first 200 chars):`);
    console.log(`   ${result.answer.substring(0, 200)}...`);
    
    console.log(`\n🤔 Reasoning: ${result.reasoning}`);
    
    // Check if ultra-fast search was used
    const ultraFastUsed = result.toolUsage.some(usage => 
      usage.tool === 'Exa' && usage.action === 'ultraFastWebSearch'
    );
    
    if (ultraFastUsed) {
      console.log('\n🎉 SUCCESS: Ultra-fast Exa search was used!');
    } else {
      console.log('\n⚠️  NOTE: Ultra-fast Exa search was not used (likely cached)');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testUltraFastExa().catch(console.error); 