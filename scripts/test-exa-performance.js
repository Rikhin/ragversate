#!/usr/bin/env node

import { config } from 'dotenv';
import { fastWebSearch } from '../app/lib/fast-web-search.ts';
import { ultraFastWebSearch } from '../app/lib/ultra-fast-web-search.ts';

// Load environment variables
config({ path: '.env.local' });

async function testExaPerformance() {
  console.log('🚀 Testing Exa Search Performance Comparison\n');

  const testQueries = [
    'Elon Musk',
    'artificial intelligence',
    'quantum computing',
    'machine learning',
    'blockchain technology'
  ];

  for (const query of testQueries) {
    console.log(`\n📊 Testing: "${query}"`);
    console.log('='.repeat(50));

    // Test old fast web search
    console.log('🔄 Testing OLD fast web search...');
    const oldStart = Date.now();
    try {
      const oldResult = await fastWebSearch.search(query, { 
        numResults: 3, 
        searchType: 'neural' 
      });
      const oldTime = Date.now() - oldStart;
      console.log(`✅ OLD: ${oldTime}ms - Summary: ${oldResult.summary.substring(0, 100)}...`);
    } catch (error) {
      const oldTime = Date.now() - oldStart;
      console.log(`❌ OLD: ${oldTime}ms - Failed: ${error.message}`);
    }

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test new ultra-fast web search
    console.log('⚡ Testing NEW ultra-fast web search...');
    const newStart = Date.now();
    try {
      const newResult = await ultraFastWebSearch.search(query, { 
        numResults: 2, 
        searchType: 'keyword',
        maxSummaryLength: 200
      });
      const newTime = Date.now() - newStart;
      console.log(`✅ NEW: ${newTime}ms - Summary: ${newResult.summary.substring(0, 100)}...`);
    } catch (error) {
      const newTime = Date.now() - newStart;
      console.log(`❌ NEW: ${newTime}ms - Failed: ${error.message}`);
    }

    console.log('---');
  }

  console.log('\n🎉 Performance test completed!');
}

// Run the test
testExaPerformance().catch(console.error); 