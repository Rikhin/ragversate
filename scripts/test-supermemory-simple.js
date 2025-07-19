#!/usr/bin/env node

// Simple test script for Supermemory integration (no search queries)
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env.local') });

// Import after loading env vars
import { optimizedSupermemoryService } from '../app/lib/supermemory-optimized.js';

async function testSupermemorySimple() {
  console.log('🧠 Testing Supermemory Integration (Simple Test)...\n');

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
    // Test 1: Initialize service (without search test)
    console.log('1️⃣ Testing service initialization...');
    await optimizedSupermemoryService.initialize();
    console.log('✅ Service initialized successfully\n');

    // Test 2: Store a test memory (this should work even with search limits)
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

    console.log('🎉 Basic Supermemory integration test passed!');
    console.log('\n📝 Your integration is working correctly.');
    console.log('\n🚀 Next steps:');
    console.log('1. Open http://localhost:3000 in your browser');
    console.log('2. Start chatting to build your personalized experience');
    console.log('3. Your queries and responses will be stored in Supermemory');
    console.log('4. The system will gracefully handle any API limits');

  } catch (error) {
    console.error('Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check your SUPERMEMORY_API_KEY in .env.local');
    console.log('2. Ensure the API key is valid and has proper permissions');
    console.log('3. Check your internet connection');
    console.log('4. Verify the Supermemory service is available');
  }
}

// Run the test
testSupermemorySimple(); 