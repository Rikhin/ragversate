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
import { supermemoryService } from '../app/lib/supermemory.js';

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
    await supermemoryService.initialize();
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

    const memoryId = await supermemoryService.storeUserMemory(
      testUserId,
      testQuery,
      testResponse,
      testEntities
    );
    console.log('✅ Memory stored successfully with ID:', memoryId, '\n');

    // Test 3: Get query suggestions
    console.log('3️⃣ Testing query suggestions...');
    const suggestions = await supermemoryService.getQuerySuggestions(testUserId, 'Elon', 3);
    console.log('✅ Query suggestions:', suggestions.length, 'found');
    suggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. "${s.query}" (relevance: ${s.relevance.toFixed(2)})`);
    });
    console.log();

    // Test 4: Get user context
    console.log('4️⃣ Testing user context...');
    const context = await supermemoryService.getUserContext(testUserId);
    console.log('✅ User context retrieved:');
    console.log('   - Recent queries:', context.recentQueries.length);
    console.log('   - Interests:', context.interests.length);
    console.log('   - Preferred categories:', context.preferredCategories);
    console.log();

    // Test 5: Test personalized suggestions
    console.log('5️⃣ Testing personalized suggestions...');
    const personalizedSuggestions = await supermemoryService.getPersonalizedSuggestions(
      testUserId, 
      'What should I learn next?'
    );
    console.log('✅ Personalized suggestions:', personalizedSuggestions.length, 'found');
    personalizedSuggestions.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s}`);
    });
    console.log();

    // Test 6: Search user knowledge
    console.log('6️⃣ Testing user knowledge search...');
    const userKnowledge = await supermemoryService.searchUserKnowledge(testUserId, 'Tesla', 3);
    console.log('✅ User knowledge search:', userKnowledge.length, 'results found');
    userKnowledge.forEach((result, i) => {
      console.log(`   ${i + 1}. Score: ${result.score.toFixed(2)}, Query: "${result.query}"`);
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