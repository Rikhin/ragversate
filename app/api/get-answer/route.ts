import Exa from 'exa-js';
import { NextRequest, NextResponse } from 'next/server';
import { helixDB } from '@/app/lib/helixdb';
import { optimizedSupermemoryService } from '@/app/lib/supermemory-optimized';
import { fastWebSearch } from '@/app/lib/fast-web-search';
import crypto from 'crypto';
import { logApiCall, logCacheHit, logError, logInfo } from '@/app/lib/logging';

// Initialize Exa client (OpenAI is handled by fast web search service)
const exa = new Exa(process.env.EXA_API_KEY);

// API response cache for common queries
const responseCache = new Map<string, { data: any; timestamp: number }>();
const RESPONSE_CACHE_TTL = 300000; // 5 minutes

function hashInput(input: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

// Check if response is cached
function getCachedResponse(query: string, userId?: string): any | null {
  const cacheKey = hashInput({ query, userId });
  const cached = responseCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < RESPONSE_CACHE_TTL) {
    return cached.data;
  }
  return null;
}

// Cache response
function cacheResponse(query: string, userId: string | undefined, data: any): void {
  const cacheKey = hashInput({ query, userId });
  responseCache.set(cacheKey, { data, timestamp: Date.now() });
}

// Tool definitions for the agent - Optimized for maximum accuracy
const tools = [
  {
    type: "function" as const,
    function: {
      name: "search_knowledge_base",
      description: "CRITICAL FIRST STEP: Search the local knowledge base (HelixDB) for existing, verified entities. This is fast, free, and contains pre-verified information. ALWAYS start here for every query to check for existing knowledge before using external sources.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The exact search query to look for in the knowledge base. Use the user's original query or a slightly optimized version that maintains the core intent."
          },
          limit: {
            type: "number",
            description: "Number of results to return. Use 5-10 results: 5 for simple queries, 8-10 for complex queries requiring comprehensive coverage."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "web_search",
      description: "Perform a web search using Exa neural search when knowledge base is insufficient. Use for: current/recent information, verification of facts, expanding on partial knowledge base matches, or when no knowledge base results exist. Choose search type and result count based on query complexity.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optimized search query for web search engines. Remove conversational elements (who is, tell me about) and focus on key terms. For example: 'Jeff Bezos Amazon founder' instead of 'Who is Jeff Bezos?'"
          },
          num_results: {
            type: "number",
            description: "Number of search results to get. Simple queries: 3-5, Complex queries: 5-8, Controversial topics: 6-8 for balanced perspective."
          },
          search_type: {
            type: "string",
            enum: ["neural", "keyword"],
            description: "Search type selection: 'neural' for semantic understanding and context (recommended for most queries), 'keyword' for exact phrase matching and precise fact-finding."
          },
          use_autoprompt: {
            type: "boolean",
            description: "Use Exa's autoprompt feature for better query understanding. Enable for complex queries, disable for simple fact-checking."
          },
          include_domains: {
            type: "array",
            items: { type: "string" },
            description: "Optional: Include specific domains for authoritative sources (e.g., ['wikipedia.org', 'forbes.com']). Use sparingly for maximum diversity."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "extract_content",
      description: "Extract detailed content from web search results when comprehensive information is needed. Use after web_search to get full context, verify facts, and gather detailed information that search snippets don't provide.",
      parameters: {
        type: "object",
        properties: {
          result_ids: {
            type: "array",
            items: { type: "string" },
            description: "Array of result IDs from web_search to extract content from. Include all relevant results for comprehensive coverage."
          },
          max_chars_per_result: {
            type: "number",
            description: "Maximum characters to extract per result. Use 2000-3000 for comprehensive coverage, 1500-2000 for standard coverage, 1000-1500 for quick fact-checking."
          },
          include_images: {
            type: "boolean",
            description: "Include image data in extraction. Enable for visual content analysis, disable for text-only processing."
          }
        },
        required: ["result_ids"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "store_entity",
      description: "Store verified, accurate entities in the knowledge base for future queries. Only store information that has been verified through reliable sources. This improves future response speed and accuracy.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Exact, verified name of the entity. Use full names for people (e.g., 'Jeffrey Preston Bezos' not just 'Jeff Bezos' when appropriate)."
          },
          description: {
            type: "string",
            description: "Comprehensive, accurate description of the entity. Include key facts, achievements, current status, and relevant context. Ensure all information is verified and factual."
          },
          category: {
            type: "string",
            enum: ["person", "organization", "place", "concept", "other"],
            description: "Accurate categorization of the entity. 'person' for individuals, 'organization' for companies/institutions, 'place' for locations, 'concept' for ideas/theories, 'other' for miscellaneous entities."
          },
          source_query: {
            type: "string",
            description: "The original user query that led to the discovery of this entity. This helps with future search relevance."
          }
        },
        required: ["name", "description", "category", "source_query"]
      }
    }
  }
];

// Tool implementations - Simplified since we use direct HelixDB calls
async function searchKnowledgeBase(query: string, limit: number = 5) {
  console.log(`🔍 Searching knowledge base for: "${query}" (limit: ${limit})`);
  
  // Use semantic search for better results
  const result = await helixDB.semanticSearch(query, limit);
  
  return {
    found: result.entities.length > 0,
    entities: result.entities,
    total: result.total
  };
}

async function webSearch(
  query: string, 
  numResults: number = 5, 
  searchType: string = "neural",
  useAutoprompt: boolean = true,
  includeDomains?: string[]
) {
  console.log(`⚡ Fast web searching for: "${query}" (${numResults} results, ${searchType}, autoprompt: ${useAutoprompt})`);
  
  try {
    // Use the fast web search service for optimized performance
    const result = await fastWebSearch.search(query, {
      numResults,
      searchType: searchType as 'neural' | 'keyword',
      useAutoprompt,
      includeDomains,
      enableEntityCaching: true,
      enableParallelProcessing: true
    });

          // Convert to the expected format for backward compatibility
      return {
        results: result.entities.map(entity => ({
          id: entity.name || `entity-${Date.now()}`, // Ensure ID is never empty
          title: entity.name,
          text: entity.description,
          url: entity.url
        })).filter(result => result.id && result.id.trim().length > 0), // Filter out empty results
        total: result.total,
        summary: result.summary,
        followUpQuestions: result.followUpQuestions,
        confidence: result.confidence
      };
  } catch (error) {
    console.error('Fast web search failed, falling back to original:', error);
    
    // Fallback to original implementation if fast search fails
    const optimizedQuery = query.replace(/^(who is|what is|tell me about|who was|what are|how is)/i, '').replace(/\?/g, '').trim();
  
  const searchOptions: {
    numResults: number;
    type: "neural" | "keyword";
    useAutoprompt?: boolean;
    includeDomains?: string[];
  } = { 
      numResults: Math.min(numResults, 10),
    type: searchType as "neural" | "keyword",
    useAutoprompt: useAutoprompt
  };
  
  if (includeDomains && includeDomains.length > 0) {
    searchOptions.includeDomains = includeDomains;
  }
  
  const response = await exa.search(optimizedQuery, searchOptions);
    return {
      results: response.results || [],
      total: response.results?.length || 0
    };
  }
}

// Removed unused functions: optimizeSearchQuery, extractContent, storeEntity, cachedOpenAICompletion, cachedEntityExtraction
// These are now handled by the fast web search service and direct HelixDB calls

// Simple rate limiter for API endpoints
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // Max 10 requests per minute

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(identifier);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  // Rate limiting
  const identifier = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(identifier)) {
    logError('rate_limit_exceeded', new Error('Rate limit exceeded'), { identifier });
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429 }
    );
  }

  const { query, userId } = await req.json();

  if (!query) {
    logError('invalid_request', new Error('Query is required'));
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  try {
    // Initialize Optimized Supermemory for this user session
    await optimizedSupermemoryService.initialize();
    
    // Get user context efficiently (cached)
    const userContext = await optimizedSupermemoryService.getUserContext(userId);
    
    // Check cache first
    const cachedResponse = getCachedResponse(query, userId);
    if (cachedResponse) {
      logCacheHit('api_response', true);
      logInfo('Cache hit for query', { query, userId });
      
      // Store this interaction efficiently
      await optimizedSupermemoryService.storeConversation(
        userId,
        query,
        cachedResponse.summary,
        cachedResponse.entities
      );
      
      // Generate personalized follow-up questions
      const followUpQuestions = await optimizedSupermemoryService.generateFollowUpQuestions(
        userId, 
        query, 
        cachedResponse.summary
      );
      
      // Get personalized suggestions
      const personalizedSuggestions = await optimizedSupermemoryService.getPersonalizedSuggestions(userId, query);
      
      const enhancedResponse = {
        ...cachedResponse,
        followUpQuestions,
        personalizedSuggestions,
        userContext: {
          currentTopics: userContext.currentTopics.slice(0, 3),
          recentEntities: userContext.recentEntities.slice(0, 2),
          sentiment: userContext.sentiment,
          complexity: userContext.complexity
        }
      };
      
      const duration = Date.now() - startTime;
      logApiCall('/api/get-answer', duration, true);
      return NextResponse.json(enhancedResponse);
    }
    
    logCacheHit('api_response', false);

    // Search knowledge base first
    const kbResult = await searchKnowledgeBase(query, 5);
    
    if (kbResult.found) {
      const summary = `Found ${kbResult.entities.length} relevant entities for "${query}": ${kbResult.entities.map(e => e.name).join(', ')}.`;
      
      // Store this successful interaction efficiently
      await optimizedSupermemoryService.storeConversation(
        userId,
        query,
        summary,
        kbResult.entities
      );
      
      // Generate personalized follow-up questions
      const followUpQuestions = await optimizedSupermemoryService.generateFollowUpQuestions(
        userId, 
        query, 
        summary
      );
      
      // Get personalized suggestions
      const personalizedSuggestions = await optimizedSupermemoryService.getPersonalizedSuggestions(userId, query);
      
      const response = {
        entities: kbResult.entities,
        source: 'helixdb',
        confidence: 'high',
        total: kbResult.total,
        summary: summary,
        followUpQuestions,
        personalizedSuggestions,
        userContext: {
          currentTopics: userContext.currentTopics.slice(0, 3),
          recentEntities: userContext.recentEntities.slice(0, 2),
          sentiment: userContext.sentiment,
          complexity: userContext.complexity
        }
      };
      
      // Cache the enhanced response
      cacheResponse(query, userId, response);
      
      const duration = Date.now() - startTime;
      logApiCall('/api/get-answer', duration, true);
      return NextResponse.json(response);
    }

    // If not found in cache, perform web search and generate summary
    logInfo('Cache miss, performing web search', { query });
    
    const webResult = await webSearch(query, 3, "neural", true);
    
    if (webResult.results && webResult.results.length > 0) {
      // Use the summary and follow-up questions already generated by fast web search
      const summary = webResult.summary || 'Information found for your query.';
      const followUpQuestions = webResult.followUpQuestions || [];

      // Store this web search interaction efficiently
      await optimizedSupermemoryService.storeConversation(
        userId,
        query,
        summary,
        webResult.results.slice(0, 3).map(r => ({
          name: r.title || 'Unknown',
          category: 'other',
          description: r.text?.substring(0, 200) || 'No description available'
        }))
      );
      
      // Generate additional personalized follow-up questions if needed
      const additionalFollowUpQuestions = await optimizedSupermemoryService.generateFollowUpQuestions(
        userId, 
        query, 
        summary
      );
      
      // Get personalized suggestions
      const personalizedSuggestions = await optimizedSupermemoryService.getPersonalizedSuggestions(userId, query);
      
      // Search user's personal knowledge for related information
      const userKnowledge = await optimizedSupermemoryService.searchUserKnowledge(userId, query, 2);
      
      const response = {
        entities: webResult.results.slice(0, 3).map(r => ({
          name: r.title || 'Unknown',
          description: r.text?.substring(0, 200) || 'No description available',
          category: 'other',
          source: 'web',
          url: r.url
        })),
        source: 'web',
        confidence: 'medium',
        total: webResult.results.length,
        summary: summary,
        followUpQuestions,
        personalizedSuggestions,
        userContext: {
          currentTopics: userContext.currentTopics.slice(0, 3),
          recentEntities: userContext.recentEntities.slice(0, 2),
          sentiment: userContext.sentiment,
          complexity: userContext.complexity
        },
        relatedUserKnowledge: userKnowledge.length > 0 ? userKnowledge.slice(0, 2) : undefined
      };
      
      // Cache the enhanced response
      cacheResponse(query, userId, response);
      
      const duration = Date.now() - startTime;
      logApiCall('/api/get-answer', duration, true);
      return NextResponse.json(response);
    } else {
      // No web results found, provide helpful response
      const summary = `I couldn't find specific information about "${query}". This might be a very specific or unusual query. Try rephrasing your question or searching for related terms.`;
      
      // Store this interaction efficiently (even failed searches are valuable)
      await optimizedSupermemoryService.storeConversation(
                            userId,
                            query,
        summary,
        []
      );
      
      // Get personalized suggestions for alternative queries
      const personalizedSuggestions = await optimizedSupermemoryService.getPersonalizedSuggestions(userId, query);
      
      const response = {
        entities: [],
        source: 'none',
        confidence: 'low',
        total: 0,
        summary: summary,
        personalizedSuggestions,
        userContext: {
          currentTopics: userContext.currentTopics.slice(0, 3),
          recentEntities: userContext.recentEntities.slice(0, 2),
          sentiment: userContext.sentiment,
          complexity: userContext.complexity
        }
      };
      
      const duration = Date.now() - startTime;
      logApiCall('/api/get-answer', duration, true);
      return NextResponse.json(response);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    logApiCall('/api/get-answer', duration, false);
    logError('api_error', error instanceof Error ? error : new Error(String(error)), { query, userId });
    
    // Provide graceful fallback response
    const fallbackResponse = {
      entities: [],
      source: 'error',
      confidence: 'low',
      total: 0,
      summary: `I encountered an issue while searching for "${query}". Please try again in a moment, or rephrase your question.`
    };
    
    return NextResponse.json(fallbackResponse, { status: 200 }); // Return 200 with fallback instead of 500
  }
}

// Removed unused helper functions: generateSummaryFromEntities, generateResponseFromCache, generateFollowUpFromCache
// These are now handled by the fast web search service and optimized supermemory service 