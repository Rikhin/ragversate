#!/usr/bin/env node

import { config } from 'dotenv';
import { neuralKnowledgeCompressor } from '../app/lib/neural-knowledge-compressor.js';

// Load environment variables
config({ path: '.env.local' });

async function testNeuralCompression() {
  console.log('🧠 Testing Neural Knowledge Compression System\n');

  // Simulate learning from search results
  console.log('📚 Phase 1: Learning from search results...');
  console.log('='.repeat(60));

  const searchResults = [
    {
      name: 'Quantum Computing',
      description: 'Quantum computing uses quantum mechanical phenomena to process information in ways classical computers cannot.'
    },
    {
      name: 'Qubits',
      description: 'Qubits are the basic units of quantum information, analogous to bits in classical computing.'
    },
    {
      name: 'Superposition',
      description: 'Quantum superposition allows qubits to exist in multiple states simultaneously.'
    }
  ];

  const answer = 'Quantum computing is a revolutionary technology that uses quantum mechanical phenomena like superposition and entanglement to process information. Unlike classical computers that use bits (0 or 1), quantum computers use qubits that can exist in multiple states simultaneously, enabling exponentially faster processing for certain problems.';

  await neuralKnowledgeCompressor.learnFromSearch(
    'What is quantum computing?',
    searchResults,
    answer
  );

  console.log('\n📊 Phase 2: Testing neural response generation...');
  console.log('='.repeat(60));

  // Test similar queries that should trigger neural responses
  const testQueries = [
    'How does quantum computing work?',
    'What are qubits in quantum computing?',
    'Explain quantum superposition',
    'What makes quantum computers different?'
  ];

  for (const query of testQueries) {
    console.log(`\n🔍 Testing: "${query}"`);
    
    const startTime = Date.now();
    const response = await neuralKnowledgeCompressor.generateNeuralResponse(query);
    const duration = Date.now() - startTime;
    
    if (response) {
      console.log(`✅ Neural Response (${duration}ms):`);
      console.log(`   Confidence: ${response.confidence}`);
      console.log(`   Source: ${response.source}`);
      console.log(`   Answer: ${response.answer.substring(0, 150)}...`);
      console.log(`   Reasoning: ${response.reasoning.substring(0, 100)}...`);
      console.log(`   Patterns: ${response.patterns.join(', ')}`);
    } else {
      console.log(`❌ No neural response generated (${duration}ms)`);
    }
  }

  console.log('\n📈 Phase 3: System Statistics...');
  console.log('='.repeat(60));

  const stats = neuralKnowledgeCompressor.getStats();
  console.log(`Knowledge Count: ${stats.knowledgeCount}`);
  console.log(`Pattern Count: ${stats.patternCount}`);
  console.log(`Total Knowledge: ${stats.totalKnowledge}`);

  console.log('\n🎉 Neural Knowledge Compression Test Completed!');
  console.log('\n💡 Key Benefits:');
  console.log('   • Instant responses for learned patterns');
  console.log('   • ChatGPT-like reasoning capabilities');
  console.log('   • Reduced search latency');
  console.log('   • Contextual understanding');
  console.log('   • Pattern-based knowledge compression');
}

// Run the test
testNeuralCompression().catch(console.error); 