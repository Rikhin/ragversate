#!/bin/bash

# Supermemory Setup Script for RAGversate
echo "🧠 Setting up Supermemory for personalized chat..."

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local file..."
    cat > .env.local << EOF
# Supermemory API Key
# Get your API key from: https://console.supermemory.ai
SUPERMEMORY_API_KEY=your_supermemory_api_key_here

# Existing API Keys (keep these)
OPENAI_API_KEY=your_openai_api_key_here
EXA_API_KEY=your_exa_api_key_here
EOF
    echo "✅ Created .env.local file"
else
    echo "✅ .env.local file already exists"
fi

# Check if Supermemory API key is set
if grep -q "SUPERMEMORY_API_KEY=your_supermemory_api_key_here" .env.local; then
    echo ""
    echo "⚠️  IMPORTANT: You need to set up your Supermemory API key!"
    echo ""
    echo "1. Go to https://console.supermemory.ai"
    echo "2. Sign up or log in to get your API key"
    echo "3. Replace 'your_supermemory_api_key_here' in .env.local with your actual API key"
    echo ""
    echo "Example:"
    echo "SUPERMEMORY_API_KEY=sm_abc123def456..."
    echo ""
else
    echo "✅ Supermemory API key appears to be configured"
fi

echo ""
echo "🎉 Supermemory setup complete!"
echo ""
echo "Features now available:"
echo "• Personalized query suggestions"
echo "• User-specific memory storage"
echo "• Context-aware responses"
echo "• Query history and preferences"
echo ""
echo "Next steps:"
echo "1. Add your Supermemory API key to .env.local"
echo "2. Restart your development server: npm run dev"
echo "3. Start chatting to build your personalized experience!" 