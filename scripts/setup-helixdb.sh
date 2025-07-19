#!/bin/bash

# HelixDB Setup Script for RAGversate
echo "🚀 Setting up HelixDB for RAGversate..."

# Check if HelixCLI is installed
if ! command -v helix &> /dev/null; then
    echo "❌ HelixCLI is not installed. Installing now..."
    curl -sSL https://install.helix-db.com | bash
    
    # Add to PATH
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
    source ~/.zshrc
    
    echo "✅ HelixCLI installed successfully"
else
    echo "✅ HelixCLI is already installed"
fi

# Check if HelixDB is installed
if ! helix --version &> /dev/null; then
    echo "❌ HelixDB runtime is not installed. Installing now..."
    helix install
    echo "✅ HelixDB runtime installed successfully"
else
    echo "✅ HelixDB runtime is already installed"
fi

# Navigate to project directory
cd "$(dirname "$0")/.."

# Check if helixdb-cfg directory exists
if [ ! -d "helixdb-cfg" ]; then
    echo "❌ helixdb-cfg directory not found. Creating it..."
    mkdir -p helixdb-cfg
fi

# Check if schema and queries exist
if [ ! -f "helixdb-cfg/schema.hx" ]; then
    echo "❌ schema.hx not found. Please ensure the schema file exists."
    exit 1
fi

if [ ! -f "helixdb-cfg/source.hx" ]; then
    echo "❌ source.hx not found. Please ensure the queries file exists."
    exit 1
fi

# Validate schema and queries
echo "🔍 Validating HelixDB schema and queries..."
if helix check; then
    echo "✅ Schema and queries validated successfully"
else
    echo "❌ Schema and queries validation failed"
    exit 1
fi

# Deploy HelixDB instance
echo "🚀 Deploying HelixDB instance..."
if helix deploy; then
    echo "✅ HelixDB instance deployed successfully"
    echo "📊 Instance is running on http://localhost:6969"
else
    echo "❌ Failed to deploy HelixDB instance"
    exit 1
fi

# List instances
echo "📋 Current HelixDB instances:"
helix instances

echo ""
echo "🎉 HelixDB setup complete!"
echo ""
echo "Next steps:"
echo "1. Make sure your environment variables are set:"
echo "   - OPENAI_API_KEY"
echo "   - EXA_API_KEY"
echo ""
echo "2. Start your Next.js development server:"
echo "   npm run dev"
echo ""
echo "3. Test the application by asking about entities"
echo ""
echo "Useful commands:"
echo "  helix instances          - List all instances"
echo "  helix visualize <id>     - Visualize the graph"
echo "  helix stop <id>          - Stop an instance"
echo "  helix delete <id>        - Delete an instance" 