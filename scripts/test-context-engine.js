#!/usr/bin/env node

/**
 * Test script for the Context Engine
 * Demonstrates Cursor-style reactive context understanding
 */

const testUserId = 'test-user-' + Date.now();

async function testContextEngine() {
  console.log('🧠 Testing Context Engine (Cursor-style reactive understanding)\n');
  
  // Test 1: Initial context analysis
  console.log('1️⃣ Testing initial context analysis...');
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

  // Test 2: Reactive response generation
  console.log('2️⃣ Testing reactive response generation...');
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

  // Test 3: Follow-up query (simulating conversation)
  console.log('3️⃣ Testing follow-up query (conversation flow)...');
  const response3 = await fetch('http://localhost:3000/api/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'How does machine learning work?',
      userId: testUserId,
      action: 'reactive'
    })
  });
  
  const result3 = await response3.json();
  console.log('✅ Follow-up Response Result:');
  console.log(`   Immediate Answer: ${result3.response.immediateAnswer ? 'Yes' : 'No'}`);
  console.log(`   Confidence: ${result3.response.confidence}`);
  console.log(`   Related Topics: ${result3.response.relatedTopics.slice(0, 3).join(', ')}\n`);

  // Test 4: Context summary
  console.log('4️⃣ Testing context summary...');
  const response4 = await fetch('http://localhost:3000/api/context', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'summary',
      userId: testUserId,
      action: 'summary'
    })
  });
  
  const result4 = await response4.json();
  console.log('✅ Context Summary:');
  console.log(`   Topics: ${result4.summary?.topics?.join(', ') || 'None'}`);
  console.log(`   Entities: ${result4.summary?.entities || 0}`);
  console.log(`   Patterns: ${result4.summary?.patterns || 0}`);
  console.log(`   Conversation Length: ${result4.summary?.conversationLength || 0}`);
  console.log(`   Last Intent: ${result4.summary?.lastIntent || 'None'}\n`);

  console.log('🎉 Context Engine test completed!');
  console.log('\n💡 Key Features Demonstrated:');
  console.log('   • Immediate context analysis');
  console.log('   • Reactive response generation');
  console.log('   • Conversation flow tracking');
  console.log('   • Predictive suggestions');
  console.log('   • Context-aware recommendations');
}

// Run the test
testContextEngine().catch(console.error); 