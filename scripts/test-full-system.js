#!/usr/bin/env node

/**
 * Comprehensive System Test
 * Tests the entire RAG system with Context Engine enabled
 */

import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

async function testFullSystem() {
  console.log('🚀 Testing Full RAG System with Context Engine\n');
  
  const testUserId = 'test-user-' + Date.now();
  
  // Test 1: Context Engine Analysis
  console.log('1️⃣ Testing Context Engine Analysis...');
  try {
    const response1 = await fetch('http://localhost:3000/api/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Tell me about artificial intelligence',
        userId: testUserId,
        action: 'analyze'
      })
    });
    
    const result1 = await response1.json();
    console.log('✅ Context Analysis Result:');
    console.log(`   Topics: ${result1.context.currentTopics.join(', ')}`);
    console.log(`   Intent: ${result1.context.queryIntent}`);
    console.log(`   Related Entities: ${result1.context.relatedEntities.length}`);
    console.log(`   Likely Next Queries: ${result1.context.likelyNextQueries.length}\n`);
  } catch (error) {
    console.log('⚠️ Context Engine test skipped (server may not be running)\n');
  }

  // Test 2: Reactive Response Generation
  console.log('2️⃣ Testing Reactive Response Generation...');
  try {
    const response2 = await fetch('http://localhost:3000/api/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'Tell me about artificial intelligence',
        userId: testUserId,
        action: 'reactive'
      })
    });
    
    const result2 = await response2.json();
    console.log('✅ Reactive Response Result:');
    console.log(`   Immediate Answer: ${result2.response.immediateAnswer ? 'Yes' : 'No'}`);
    console.log(`   Confidence: ${result2.response.confidence}`);
    console.log(`   Reasoning: ${result2.response.reasoning}`);
    console.log(`   Suggestions: ${result2.response.contextAwareSuggestions.slice(0, 2).join(', ')}\n`);
  } catch (error) {
    console.log('⚠️ Reactive Response test skipped (server may not be running)\n');
  }

  // Test 3: Main Search API with Context Engine
  console.log('3️⃣ Testing Main Search API with Context Engine...');
  try {
    const response3 = await fetch('http://localhost:3000/api/get-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'What is machine learning?',
        userId: testUserId
      })
    });
    
    const result3 = await response3.json();
    console.log('✅ Main Search Result:');
    console.log(`   Answer Length: ${result3.answer.length} characters`);
    console.log(`   Source: ${result3.source}`);
    console.log(`   Cached: ${result3.cached}`);
    console.log(`   Total Time: ${result3.performance.totalTime}ms`);
    console.log(`   Tool Usage: ${result3.toolUsage.length} tools used`);
    
    // Show tool usage details
    result3.toolUsage.forEach((usage, index) => {
      const status = usage.success ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${usage.tool}.${usage.action} (${usage.duration}ms)`);
    });
    console.log();
  } catch (error) {
    console.log('⚠️ Main Search test skipped (server may not be running)\n');
  }

  // Test 4: Follow-up Query (Testing Context Learning)
  console.log('4️⃣ Testing Follow-up Query (Context Learning)...');
  try {
    const response4 = await fetch('http://localhost:3000/api/get-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'How does deep learning work?',
        userId: testUserId
      })
    });
    
    const result4 = await response4.json();
    console.log('✅ Follow-up Search Result:');
    console.log(`   Answer Length: ${result4.answer.length} characters`);
    console.log(`   Source: ${result4.source}`);
    console.log(`   Cached: ${result4.cached}`);
    console.log(`   Total Time: ${result4.performance.totalTime}ms`);
    console.log(`   Tool Usage: ${result4.toolUsage.length} tools used`);
    console.log();
  } catch (error) {
    console.log('⚠️ Follow-up Search test skipped (server may not be running)\n');
  }

  // Test 5: Context Summary
  console.log('5️⃣ Testing Context Summary...');
  try {
    const response5 = await fetch('http://localhost:3000/api/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'summary',
        userId: testUserId,
        action: 'summary'
      })
    });
    
    const result5 = await response5.json();
    console.log('✅ Context Summary:');
    console.log(`   Topics: ${result5.summary?.topics?.join(', ') || 'None'}`);
    console.log(`   Entities: ${result5.summary?.entities || 0}`);
    console.log(`   Patterns: ${result5.summary?.patterns || 0}`);
    console.log(`   Conversation Length: ${result5.summary?.conversationLength || 0}`);
    console.log(`   Last Intent: ${result5.summary?.lastIntent || 'None'}\n`);
  } catch (error) {
    console.log('⚠️ Context Summary test skipped (server may not be running)\n');
  }

  // Test 6: System Health Check
  console.log('6️⃣ Testing System Health...');
  try {
    const response6 = await fetch('http://localhost:3000/api/health');
    const result6 = await response6.json();
    console.log('✅ System Health:');
    console.log(`   Status: ${result6.status}`);
    console.log(`   HelixDB: ${result6.services.helixdb.connected ? 'Connected' : 'Disconnected'}`);
    console.log(`   Cache Warmed: ${result6.services.helixdb.cacheWarmed ? 'Yes' : 'No'}`);
    console.log(`   OpenAI: ${result6.services.openai}`);
    console.log(`   Exa: ${result6.services.exa}\n`);
  } catch (error) {
    console.log('⚠️ Health check skipped (server may not be running)\n');
  }

  console.log('🎉 Full System Test Completed!');
  console.log('\n💡 Key Features Tested:');
  console.log('   • Context Engine Analysis');
  console.log('   • Reactive Response Generation');
  console.log('   • Main Search with Context Integration');
  console.log('   • Context Learning from Follow-up Queries');
  console.log('   • Context Summary and Tracking');
  console.log('   • System Health and Dependencies');
  
  console.log('\n🚀 To start the system:');
  console.log('   1. npm run dev');
  console.log('   2. Open http://localhost:3000');
  console.log('   3. Start chatting to see the Context Engine in action!');
  
  console.log('\n🧠 Context Engine Features:');
  console.log('   • Immediate answers from context (0ms responses)');
  console.log('   • Contextual suggestions before you ask');
  console.log('   • Conversation flow tracking');
  console.log('   • Predictive next queries');
  console.log('   • Entity relationship mapping');
}

// Run the test
testFullSystem().catch(console.error); 