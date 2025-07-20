#!/usr/bin/env node

import { agenticSearchSystem } from '../app/lib/agentic-search';

async function testAgenticBehavior() {
  console.log('🤖 Testing Agentic System Behavior\n');
  console.log('='.repeat(60));

  const testCases = [
    {
      query: 'What is quantum computing?',
      expectedBehavior: 'Should prioritize helixdb_search for factual definition',
      expectedSource: 'helixdb'
    },
    {
      query: 'latest AI developments 2024',
      expectedBehavior: 'Should prioritize exa_search for current events',
      expectedSource: 'exa'
    },
    {
      query: 'How does machine learning work?',
      expectedBehavior: 'Should try neural_compression for conceptual explanation',
      expectedSource: 'neural'
    },
    {
      query: 'What is artificial intelligence?',
      expectedBehavior: 'Should use pattern_matching for common patterns',
      expectedSource: 'pattern_matching'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: "${testCase.query}"`);
    console.log(`Expected: ${testCase.expectedBehavior}`);
    console.log(`Expected Source: ${testCase.expectedSource}`);
    console.log('-'.repeat(40));

    try {
      const startTime = Date.now();
      const result = await agenticSearchSystem.search(testCase.query, 'test-user');
      const duration = Date.now() - startTime;

      console.log(`✅ Result: ${result.source}`);
      console.log(`⏱️  Duration: ${duration}ms`);
      console.log(`🧠 Agent Decisions: ${result.agentDecisions.length}`);
      
      if (result.agentDecisions.length > 0) {
        console.log('   Tool Sequence:');
        result.agentDecisions.forEach((decision, index) => {
          const status = decision.executed ? '✅' : '⏭️';
          console.log(`   ${index + 1}. ${status} ${decision.tool} (${decision.confidence}) - ${decision.reason}`);
        });
      }

      console.log(`📊 Tool Usage: ${result.toolUsage.length} tools used`);
      result.toolUsage.forEach((usage, index) => {
        const status = usage.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${usage.tool}.${usage.action} (${usage.duration}ms)`);
      });

      // Verify agentic behavior
      const isAgentic = result.agentDecisions.length > 0;
      const earlyStopping = result.toolUsage.length < 5; // Should stop before using all tools
      const correctSource = result.source === testCase.expectedSource;

      console.log(`\n🎯 Agentic Behavior Analysis:`);
      console.log(`   Intelligent Planning: ${isAgentic ? '✅' : '❌'}`);
      console.log(`   Early Stopping: ${earlyStopping ? '✅' : '❌'}`);
      console.log(`   Correct Source: ${correctSource ? '✅' : '❌'}`);

      if (isAgentic && earlyStopping) {
        console.log('   🎉 AGENTIC BEHAVIOR CONFIRMED!');
      } else {
        console.log('   ⚠️  May be falling back to rigid pipeline');
      }

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }

    console.log('\n' + '='.repeat(60));
  }

  console.log('\n📊 Summary:');
  console.log('The agentic system should:');
  console.log('1. Plan tool usage intelligently based on query type');
  console.log('2. Stop early when it finds a good answer');
  console.log('3. Use different strategies for different query types');
  console.log('4. Provide detailed reasoning for tool selection');
}

testAgenticBehavior().catch(console.error); 