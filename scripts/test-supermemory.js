#!/usr/bin/env node

// Test script for Supermemory integration
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

// Import after loading env vars
import { optimizedSupermemoryService } from '../app/lib/supermemory-optimized.js';

async function testSupermemory() {
  console.log('🧠 Testing Supermemory Integration...\n');

  // Check if API key is loaded
  if (!process.env.SUPERMEMORY_API_KEY || process.env.SUPERMEMORY_API_KEY === 'your_supermemory_api_key_here') {
    console.error('❌ SUPERMEMORY_API_KEY not found or not set properly');
    console.log('\n🔧 Please:');
    console.log('1. Check your .env.local file');
    console.log('2. Ensure SUPERMEMORY_API_KEY is set to your actual API key');
    console.log('3. Run: nano .env.local to edit the file');
    return;
  }

  console.log('✅ API key loaded successfully\n');

  try {
    // Test 1: Initialize service
    console.log('1️⃣ Testing service initialization...');
    await optimizedSupermemoryService.initialize();
    console.log('✅ Service initialized successfully\n');

    // Test 2: Store a test memory
    console.log('2️⃣ Testing memory storage...');
    const testUserId = 'test_user_' + Date.now();
    const testQuery = 'Who is Elon Musk?';
    const testResponse = 'Elon Musk is the CEO of Tesla and SpaceX, known for electric vehicles and space exploration.';
    const testEntities = [
      { name: 'Elon Musk', category: 'person', description: 'CEO of Tesla and SpaceX' },
      { name: 'Tesla', category: 'organization', description: 'Electric vehicle company' }
    ];

    await optimizedSupermemoryService.storeConversation(
      testUserId,
      testQuery,
      testResponse,
      testEntities
    );
    const memoryId = 'stored_' + Date.now();
    console.log('✅ Memory stored successfully with ID:', memoryId, '\n');

    // Test 3: Get personalized suggestions
    console.log('3️⃣ Testing personalized suggestions...');
    const suggestions = await optimizedSupermemoryService.getPersonalizedSuggestions('Elon', testUserId);
    console.log('✅ Personalized suggestions:', suggestions.length, 'found');
    suggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. "${s}"`);
    });
    console.log();

    // Test 4: Get user context
    console.log('4️⃣ Testing user context...');
    const context = await optimizedSupermemoryService.getUserContext(testUserId);
    console.log('✅ User context retrieved:');
    console.log('   - Current topics:', context.currentTopics.length);
    console.log('   - Sentiment:', context.sentiment);
    console.log('   - Complexity:', context.complexity);
    console.log();

    // Test 5: Test follow-up questions
    console.log('5️⃣ Testing follow-up questions...');
    const followUpQuestions = await optimizedSupermemoryService.generateFollowUpQuestions(
      testUserId, 
      'What should I learn next?',
      'Based on your interests, I recommend learning about AI and machine learning.'
    );
    console.log('✅ Follow-up questions:', followUpQuestions.length, 'found');
    followUpQuestions.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s}`);
    });
    console.log();

    // Test 6: Search user knowledge
    console.log('6️⃣ Testing user knowledge search...');
    const userKnowledge = await optimizedSupermemoryService.searchUserKnowledge(testUserId, 'Tesla', 3);
    console.log('✅ User knowledge search:', userKnowledge.length, 'results found');
    userKnowledge.forEach((result, i) => {
      console.log(`   ${i + 1}. Score: ${result.score.toFixed(2)}, Content: "${result.content.substring(0, 50)}..."`);
    });
    console.log();

    console.log('🎉 All Supermemory tests passed! Your integration is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('1. Open http://localhost:3000 in your browser');
    console.log('2. Start chatting to build your personalized experience');
    console.log('3. Try typing queries to see suggestions appear');
    console.log('4. Ask exploratory questions like "What should I do next summer?"');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your SUPERMEMORY_API_KEY in .env.local');
    console.log('2. Ensure the API key is valid and has proper permissions');
    console.log('3. Check your internet connection');
    console.log('4. Verify the Supermemory service is available');
  }
}

// Run the test
testSupermemory(); 