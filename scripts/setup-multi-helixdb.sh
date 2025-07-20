#!/bin/bash

# Setup script for multiple HelixDB instances
# This script will deploy all HelixDB instances for different search modes

echo "🚀 Setting up multiple HelixDB instances..."

# Function to deploy a HelixDB instance
deploy_instance() {
    local mode=$1
    local port=$2
    local config_dir="helixdb-cfg/$mode"
    
    echo "📦 Deploying $mode instance on port $port..."
    
    # Check if config directory exists
    if [ ! -d "$config_dir" ]; then
        echo "❌ Config directory $config_dir not found!"
        return 1
    fi
    
    # Deploy the instance
    cd "$config_dir"
    helix deploy --port "$port" &
    cd - > /dev/null
    
    echo "✅ $mode instance deployed on port $port"
}

# Deploy all instances
echo "🔧 Deploying General Search instance..."
deploy_instance "general" 6969

echo "🔧 Deploying Summer Programs instance..."
deploy_instance "summer-programs" 6970

echo "🔧 Deploying Mentors instance..."
deploy_instance "mentors" 6971

echo "🔧 Deploying Scholarships instance..."
deploy_instance "scholarships" 6972

echo ""
echo "🎉 All HelixDB instances deployed!"
echo ""
echo "📋 Instance Summary:"
echo "  • General Search: http://localhost:6969"
echo "  • Summer Programs: http://localhost:6970"
echo "  • Mentors: http://localhost:6971"
echo "  • Scholarships: http://localhost:6972"
echo ""
echo "💡 To stop all instances, run: pkill -f 'helix deploy'"
echo "💡 To check instance status, run: lsof -i :6969-6972" 