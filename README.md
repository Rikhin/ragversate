# ragchat

Your intelligent entity search and knowledge retrieval system powered by GPT-4 function calling, HelixDB vector database, and Exa neural search.

## 🚀 Features

- **Context Engine**: Cursor-style reactive understanding with immediate responses
- **GPT-4 Function Calling**: Dynamic tool selection and execution
- **HelixDB Integration**: Persistent vector database with semantic search
- **Exa Neural Search**: Fallback web search with intelligent caching
- **Supermemory Integration**: Personalized user context and learning
- **Real-time Tool Usage**: Live monitoring of agent tool execution
- **Intelligent Caching**: Persistent knowledge base that grows with usage
- **Pattern Recognition**: Semantic query matching for ultra-fast responses
- **Conversation Flow Tracking**: Context-aware responses that learn from interactions

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, OpenAI GPT-4, Exa Search API
- **Database**: HelixDB (vector database)
- **Memory**: Supermemory API for user context
- **Deployment**: Vercel-ready

## 📦 Installation

```bash
# Clone the repository
git clone <repository-url>
cd ragchat

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Start the development server
npm run dev
```

## 🔧 Environment Variables

Create a `.env.local` file with the following variables:

```env
OPENAI_API_KEY=your_openai_api_key
EXA_API_KEY=your_exa_api_key
SUPERMEMORY_API_KEY=your_supermemory_api_key
```

## 🚀 Usage

1. **Start the application**: `npm run dev`
2. **Visit**: http://localhost:3000
3. **Click "Begin"**: Optimizes the system and warms the cache
4. **Search**: Ask questions and watch the AI agent work in real-time
5. **Test the system**: `npm run test:full` - Comprehensive system test

## 📊 Performance

- **Cached queries**: 0ms response time
- **New queries**: ~2-3 seconds (web search + summarization)
- **Pattern recognition**: Semantic matching for similar queries
- **Persistent caching**: Knowledge base survives server restarts

## 🧠 How It Works

1. **Context Engine Analysis**: Immediate understanding of query intent and context
2. **Reactive Response**: Instant answers when context is sufficient (0ms responses)
3. **Query Processing**: Enhanced search with contextual understanding
4. **HelixDB Search**: Checks for cached knowledge with context awareness
5. **Pattern Recognition**: Matches semantically similar queries
6. **Web Search Fallback**: Uses Exa if no cached results
7. **GPT-4 Summarization**: Creates concise, accurate summaries
8. **Intelligent Caching**: Stores results in HelixDB for future use
9. **Context Learning**: Updates understanding for future interactions
10. **Live Tool Monitoring**: Shows real-time tool usage

## 🔍 API Endpoints

- `GET /api/health` - System health check
- `POST /api/get-answer` - Main search endpoint with context engine
- `POST /api/context` - Context engine API (analyze, reactive, summary)
- `POST /api/optimize` - System optimization
- `GET /search` - Search interface

## 📈 Monitoring

- **Real-time tool usage**: Browser console shows detailed logs
- **Context engine analysis**: Live context understanding and predictions
- **Performance metrics**: Response times and cache hits
- **System health**: HelixDB connection and cache status
- **User analytics**: Query patterns and optimization insights
- **Context tracking**: Conversation flow and learning progress

## 🎯 Key Benefits

- **Instant Responses**: Cached queries return immediately
- **Context-Aware**: Understands conversation flow and user intent
- **Reactive Understanding**: Cursor-style immediate responses from context
- **Growing Intelligence**: Knowledge base expands with usage
- **Pattern Learning**: Recognizes and optimizes for common queries
- **Enterprise Performance**: Production-ready with robust error handling
- **User-Friendly**: Simple interface with powerful capabilities

## 🚀 Deployment

The application is ready for deployment on Vercel:

```bash
# Deploy to Vercel
vercel --prod
```

## 📝 License

MIT License - see LICENSE file for details.

---

**ragchat** - Your intelligent search companion that learns and grows with every query! 🧠✨
