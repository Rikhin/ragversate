#!/usr/bin/env node

import { config } from 'dotenv';
import { agentSearch } from '../app/lib/agent-search.js';
import { agenticSearchSystem } from '../app/lib/agentic-search.js';

// Load environment variables
config({ path: '.env.local' });

async function compareApproaches() {
  console.log('🤖 Comparing Rigid Pipeline vs Agentic Approach\n');

  const testQueries = [
    'What is quantum computing?',
    'Tell me about Elon Musk',
    'How does machine learning work?',
    'What are the latest developments in AI?'
  ];

  for (const query of testQueries) {
    console.log(`\n📊 Testing: "${query}"`);
    console.log('='.repeat(80));

    // Test 1: Rigid Pipeline (current approach)
    console.log('\n🔧 RIGID PIPELINE APPROACH:');
    console.log('-'.repeat(40));
    
    const pipelineStart = Date.now();
    try {
      const pipelineResult = await agentSearch(query, 'test-user');
      const pipelineTime = Date.now() - pipelineStart;
      
      console.log(`✅ Pipeline Result (${pipelineTime}ms):`);
      console.log(`   Source: ${pipelineResult.source}`);
      console.log(`   Cached: ${pipelineResult.cached}`);
      console.log(`   Total Time: ${pipelineResult.performance.totalTime}ms`);
      console.log(`   Answer: ${pipelineResult.answer.substring(0, 100)}...`);
      
      console.log('\n   Tool Usage (Fixed Order):');
      pipelineResult.toolUsage.forEach((usage, index) => {
        const status = usage.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${usage.tool}.${usage.action} (${usage.duration}ms)`);
      });
      
    } catch (error) {
      console.log(`❌ Pipeline failed: ${error.message}`);
    }

    // Test 2: Agentic Approach (new approach)
    console.log('\n🤖 AGENTIC APPROACH:');
    console.log('-'.repeat(40));
    
    const agenticStart = Date.now();
    try {
      const agenticResult = await agenticSearchSystem.search(query, 'test-user');
      const agenticTime = Date.now() - agenticStart;
      
      console.log(`✅ Agentic Result (${agenticTime}ms):`);
      console.log(`   Source: ${agenticResult.source}`);
      console.log(`   Cached: ${agenticResult.cached}`);
      console.log(`   Total Time: ${agenticResult.performance.totalTime}ms`);
      console.log(`   Answer: ${agenticResult.answer.substring(0, 100)}...`);
      console.log(`   Reasoning: ${agenticResult.reasoning}`);
      
      console.log('\n   Agent Decisions (Dynamic):');
      agenticResult.agentDecisions.forEach((decision, index) => {
        const status = decision.executed ? '✅' : '⏭️';
        console.log(`   ${index + 1}. ${status} ${decision.tool} (${decision.confidence}) - ${decision.reason}`);
      });
      
      console.log('\n   Tool Usage (Agent-Chosen):');
      agenticResult.toolUsage.forEach((usage, index) => {
        const status = usage.success ? '✅' : '❌';
        console.log(`   ${index + 1}. ${status} ${usage.tool}.${usage.action} (${usage.duration}ms)`);
      });
      
    } catch (error) {
      console.log(`❌ Agentic failed: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80));
  }

  console.log('\n🎯 KEY DIFFERENCES:');
  console.log('='.repeat(50));
  console.log('🔧 RIGID PIPELINE:');
  console.log('   • Fixed tool order every time');
  console.log('   • Runs all tools regardless of success');
  console.log('   • No dynamic decision making');
  console.log('   • Predictable but inefficient');
  
  console.log('\n🤖 AGENTIC APPROACH:');
  console.log('   • Dynamically chooses tools based on query');
  console.log('   • Stops when it finds a good answer');
  console.log('   • Adapts to different query types');
  console.log('   • More intelligent and efficient');
  
  console.log('\n💡 BENEFITS OF AGENTIC:');
  console.log('   • Faster responses (stops early)');
  console.log('   • Better tool selection');
  console.log('   • Adaptive behavior');
  console.log('   • More human-like reasoning');
}

// Run the comparison
compareApproaches().catch(console.error); 