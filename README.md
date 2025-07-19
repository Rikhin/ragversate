# RAGversate

A powerful RAG (Retrieval-Augmented Generation) application built with Next.js, HelixDB, and OpenAI that provides intelligent entity search and knowledge retrieval.

## Features

- 🔍 **Intelligent Entity Search**: Find information about people, organizations, places, and concepts
- 🧠 **Knowledge Base**: Persistent storage using HelixDB graph-vector database
- 🌐 **Live Web Search**: Real-time information retrieval when knowledge base doesn't have answers
- 📊 **Vector Similarity**: Advanced semantic search using embeddings
- 🎯 **Smart Query Optimization**: AI-powered query refinement for better search results
- 💾 **Caching**: Automatic storage of search results for future queries
- 🧠 **Personalized Memory**: User-specific query history and context using Supermemory
- 💡 **Smart Suggestions**: AI-powered query suggestions based on user history
- 🎯 **Context-Aware Responses**: Personalized responses based on user preferences and past interactions

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Database**: HelixDB (Graph-Vector Database)
- **AI**: OpenAI GPT-4o, text-embedding-3-small
- **Search**: Exa (Neural Search API)
- **Memory**: Supermemory (Personalized Memory API)
- **Styling**: Tailwind CSS

## Prerequisites

- Node.js 18+ 
- HelixDB CLI
- OpenAI API Key
- Exa API Key
- Supermemory API Key (for personalized features)

## Quick Start

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd ragversate
npm install
```

### 2. Set Environment Variables

Create a `.env.local` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
EXA_API_KEY=your_exa_api_key_here
SUPERMEMORY_API_KEY=your_supermemory_api_key_here
```

Or run the automated setup:
```bash
npm run setup:supermemory
```

### 3. Setup HelixDB

Run the automated setup script:

```bash
npm run setup:helixdb
```

Or manually:

```bash
# Install HelixCLI
curl -sSL https://install.helix-db.com | bash

# Add to PATH
echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$HOME/.zshrc"
source ~/.zshrc

# Install HelixDB runtime
helix install

# Validate schema and queries
helix check

# Deploy instance
helix deploy
```

### 4. Setup Supermemory (Optional but Recommended)

For personalized features like query suggestions and user memory:

```bash
npm run setup:supermemory
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## How It Works

### Architecture

1. **Query Processing**: User queries are optimized using GPT-4o for better search results
2. **Knowledge Base Search**: HelixDB performs vector similarity search on stored entities
3. **Live Web Search**: If no match found, Exa performs neural web search
4. **Entity Extraction**: AI extracts relevant entities from search results
5. **Storage**: New entities are stored in HelixDB with embeddings for future queries

### Data Flow

```
User Query → Query Optimization → HelixDB Search → Live Web Search → Entity Extraction → Storage → Response
```

### Personalization Flow

```
User Query → User Context Analysis → Query Suggestions → Personalized Response → Memory Storage → Future Context
```

### HelixDB Schema

The application uses a graph-vector database with the following structure:

- **Entity Nodes**: Store information about people, organizations, places, etc.
- **Embedding Vectors**: Store semantic representations for similarity search
- **Relationships**: Connect entities and their embeddings

## API Endpoints

### POST `/api/get-answer`

Processes user queries and returns entity information.

**Request:**
```json
{
  "query": "Who is Elon Musk?"
}
```

**Response:**
```json
{
  "name": "Elon Musk",
  "description": "CEO of Tesla and SpaceX",
  "category": "person",
  "source": "helixdb",
  "confidence": "high"
}
```

## HelixDB Management

### Useful Commands

```bash
# List all instances
helix instances

# Visualize the graph
helix visualize <instance-id>

# Stop an instance
helix stop <instance-id>

# Delete an instance
helix delete <instance-id>

# Redeploy an instance
helix redeploy <instance-id>
```

### Configuration

The HelixDB configuration is in `helixdb-cfg/config.hx.json`:

- **Vector Configs**: HNSW parameters for similarity search
- **Database Configs**: Size limits and embedding model settings
- **Graph Configs**: Secondary indices and visualization settings

## Development

### Project Structure

```
ragversate/
├── app/
│   ├── api/
│   │   └── get-answer/
│   │       └── route.ts          # Main API endpoint
│   ├── lib/
│   │   └── helixdb.ts            # HelixDB service
│   └── page.tsx                  # Frontend UI
├── helixdb-cfg/
│   ├── schema.hx                 # Database schema
│   ├── source.hx                 # HelixQL queries
│   └── config.hx.json            # Configuration
└── scripts/
    └── setup-helixdb.sh          # Setup script
```

### Adding New Features

1. **New Entity Types**: Update `helixdb-cfg/schema.hx`
2. **New Queries**: Add to `helixdb-cfg/source.hx`
3. **API Changes**: Modify `app/api/get-answer/route.ts`
4. **UI Updates**: Edit `app/page.tsx`

### Testing

```bash
# Run linting
npm run lint

# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

### Common Issues

1. **HelixDB Connection Failed**
   - Ensure HelixDB instance is running: `helix instances`
   - Restart instance: `helix restart <instance-id>`

2. **Schema Validation Errors**
   - Check `helixdb-cfg/schema.hx` syntax
   - Run `helix check` to validate

3. **API Key Errors**
   - Verify environment variables are set correctly
   - Check API key permissions and quotas

4. **Search Not Working**
   - Ensure Exa API key is valid
   - Check OpenAI API key and quota

### Debug Mode

Enable detailed logging by setting:

```env
DEBUG=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the troubleshooting section
- Review HelixDB documentation
- Open an issue on GitHub
