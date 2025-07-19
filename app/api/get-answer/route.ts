import OpenAI from 'openai';
import Exa from 'exa-js';
import { NextRequest, NextResponse } from 'next/server';
import { helixDB } from '@/app/lib/helixdb';
import { supermemoryService } from '@/app/lib/supermemory';
import { intelligentAgent } from '@/app/lib/intelligent-agent';

// Start agent's proactive learning on API startup
intelligentAgent.startProactiveLearning();

// Initialize OpenAI and Exa clients
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const exa = new Exa(process.env.EXA_API_KEY);

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

// Tool implementations
async function searchKnowledgeBase(query: string, limit: number = 5) {
  console.log(`🔍 Searching knowledge base for: "${query}" (limit: ${limit})`);
  
  // Use semantic search for better results
  const result = await helixDB.semanticSearch(query, limit);
  
  // Also try graph traversal for related entities
  if (result.entities.length > 0) {
    const graphResult = await helixDB.traverseGraph(result.entities[0].name, 1, 3);
    const relatedEntities = graphResult.entities.filter(e => 
      !result.entities.some(existing => existing.id === e.id)
    );
    result.entities.push(...relatedEntities.slice(0, 2));
  }
  
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
  console.log(`🌐 Web searching for: "${query}" (${numResults} results, ${searchType}, autoprompt: ${useAutoprompt})`);
  
  // Optimize query for better results
  const optimizedQuery = optimizeSearchQuery(query);
  
  const searchOptions: {
    numResults: number;
    type: "neural" | "keyword";
    useAutoprompt?: boolean;
    includeDomains?: string[];
  } = { 
    numResults: Math.min(numResults, 10), // Cap at 10
    type: searchType as "neural" | "keyword",
    useAutoprompt: useAutoprompt
  };
  
  // Add domain filtering if specified
  if (includeDomains && includeDomains.length > 0) {
    searchOptions.includeDomains = includeDomains;
  }
  
  const response = await exa.search(optimizedQuery, searchOptions);
  const results = response.results || [];
  
  // Automatically extract and cache entities from search results
  if (results.length > 0) {
    try {
      console.log('📄 Extracting content for automatic caching...');
      const contentResponse = await exa.getContents(results.map(r => r.id));
      
      // Extract entities from the content with improved prompt
      const entityExtractionResponse = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo-0125', // Use fastest model for entity extraction
        messages: [
          { 
            role: 'system', 
            content: `Extract all relevant entities from the provided text. Focus on entities that directly relate to the search query. Return a JSON object with an "entities" array: {"entities": [{"name": "entity name", "description": "brief description (max 150 words)", "category": "person|organization|place|concept|other"}]}. 

IMPORTANT GUIDELINES:
- For person names, use the most recognizable form (e.g., "Jeff Bezos" not "Jeffrey Preston Bezos")
- Focus on entities mentioned in the search query or closely related
- Ensure descriptions are factual and verified
- Avoid duplicates and variations of the same entity
- Prioritize entities that are central to the search topic` 
          }, 
          { 
            role: 'user', 
            content: `Search query: "${query}"\n\nText content:\n${contentResponse.results.map(r => r.text.substring(0, 1000)).join('\n\n---\n\n')}` 
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 300, // Reduced for speed
        temperature: 0.3
      });

      const entityData = entityExtractionResponse.choices[0].message.content;
      if (entityData) {
        try {
          const parsed = JSON.parse(entityData);
          const entities = parsed.entities || parsed;
          if (Array.isArray(entities)) {
            console.log(`💾 Auto-caching ${entities.length} entities from web search...`);
            
            // Normalize and deduplicate entities before storing
            const normalizedEntities = new Map();
            
            for (const entity of entities) {
              if (entity.name && entity.description) {
                // Normalize the name for deduplication
                const normalizedName = entity.name.trim();
                const key = `${normalizedName.toLowerCase()}_${entity.category || 'other'}`;
                
                // Only keep the first occurrence of each entity
                if (!normalizedEntities.has(key)) {
                  normalizedEntities.set(key, entity);
                } else {
                  console.log(`🔄 Skipping duplicate entity: ${entity.name}`);
                }
              }
            }
            
            // Store unique entities in HelixDB
            for (const entity of normalizedEntities.values()) {
              try {
                await helixDB.createEntity({
                  name: entity.name,
                  category: entity.category || 'other',
                  source_query: query,
                  description: entity.description
                });
                console.log(`✅ Cached: ${entity.name}`);
              } catch (error) {
                console.log(`⚠️ Failed to cache ${entity.name}:`, error instanceof Error ? error.message : 'Unknown error');
              }
            }
          }
        } catch (parseError) {
          console.log('⚠️ Failed to parse entity extraction response:', parseError);
        }
      }
    } catch (extractionError) {
      console.log('⚠️ Failed to extract content for caching:', extractionError);
    }
  }
  
  return {
    results: results,
    total: results.length
  };
}

// Optimize search query for better results
function optimizeSearchQuery(query: string): string {
  // Remove conversational elements
  let optimized = query
    .replace(/^(who is|what is|tell me about|who was|what are|how is)/i, '')
    .replace(/\?/g, '')
    .trim();
  
  // Add context for better results
  if (optimized.length < 3) {
    optimized = query; // Keep original if too short
  }
  
  // Add quotes for exact name matching when appropriate
  const namePattern = /^[A-Z][a-z]+ [A-Z][a-z]+$/;
  if (namePattern.test(optimized)) {
    optimized = `"${optimized}"`;
  }
  
  return optimized;
}

async function extractContent(
  resultIds: string[], 
  maxCharsPerResult: number = 2000,
  includeImages: boolean = false
) {
  console.log(`📄 Extracting content from ${resultIds.length} results (max ${maxCharsPerResult} chars each)`);
  
  const contentResponse = await exa.getContents(resultIds, {
    text: { maxCharacters: maxCharsPerResult },
    includeImages: includeImages
  });
  
  return {
    contents: contentResponse.results,
    total: contentResponse.results.length
  };
}

async function storeEntity(name: string, description: string, category: string, sourceQuery: string) {
  console.log(`💾 Storing entity: ${name} (${category})`);
  
  try {
    const entity = await helixDB.createEntity({
      name: name,
      category: category,
      source_query: sourceQuery,
      description: description
    });
    
    return {
      success: true,
      entity: entity
    };
  } catch (error) {
    console.error('Failed to store entity:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function POST(req: NextRequest) {
    const { query, userId } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return NextResponse.json({ 
            error: 'Query is required and must be a non-empty string.' 
        }, { status: 400 });
    }

    // Generate userId if not provided (for backward compatibility)
    const finalUserId = userId || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        console.log('🤖 Agent processing query:', query);

        // FIRST: Check HelixDB cache for high-confidence matches
        console.log('🔍 Checking global HelixDB cache first...');
        const cachedResults = await searchKnowledgeBase(query, 10);
        
        // If we have high-confidence cached results, return them directly
        if (cachedResults.found && cachedResults.entities.length >= 2) {
            const highConfidenceEntities = cachedResults.entities.filter(entity => {
                const nameLower = entity.name.toLowerCase();
                const queryLower = query.toLowerCase();
                const descriptionLower = entity.description.toLowerCase();
                
                // High confidence: exact name match or name contains query
                return nameLower === queryLower || 
                       nameLower.includes(queryLower) || 
                       queryLower.includes(nameLower) ||
                       descriptionLower.includes(queryLower);
            });
            
            if (highConfidenceEntities.length >= 1) {
                console.log(`🎯 Found ${highConfidenceEntities.length} high-confidence cached entities - returning directly from HelixDB!`);
                
                // Generate response directly from cached data without OpenAI
                const cachedResponse = generateResponseFromCache(query, highConfidenceEntities);
                
                // Create streaming response with cached data
                const encoder = new TextEncoder();
                const stream = new ReadableStream({
                    async start(controller) {
                        try {
                            // Send metadata indicating cache hit
                            const metadata = {
                                source: 'helixdb_cache',
                                confidence: 'high',
                                entities_found: highConfidenceEntities.length,
                                tools_used: ['search_knowledge_base']
                            };
                            
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`));

                            // Stream the cached response
                            const words = cachedResponse.split(' ');
                            for (let i = 0; i < words.length; i++) {
                                const word = words[i];
                                const isLastWord = i === words.length - 1;
                                
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'content',
                                    data: word + (isLastWord ? '' : ' ')
                                })}\n`));
                                
                                // Small delay for natural streaming effect
                                await new Promise(resolve => setTimeout(resolve, 20)); // Faster for cached results
                            }

                            // Generate follow-up suggestions from cached data
                            const followUpSuggestions = generateFollowUpFromCache(query, highConfidenceEntities);
                            if (followUpSuggestions.length > 0) {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                                    type: 'followUpSuggestions',
                                    suggestions: followUpSuggestions
                                })}\n`));
                            }

                            // Send completion signal
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                            controller.close();
                        } catch (error) {
                            console.error('Streaming error:', error);
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: 'Error streaming cached response' })}\n\n`));
                            controller.close();
                        }
                    }
                });

                return new Response(stream, {
                    headers: {
                        'Content-Type': 'text/plain; charset=utf-8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                });
            }
        }

        // If no high-confidence cache hit, proceed with agent-based approach
        console.log('🔄 No high-confidence cache hit, proceeding with agent-based search...');

        // Agent system prompt - Optimized for 100% accuracy and perfection
        const systemPrompt = `You are an expert RAG (Retrieval-Augmented Generation) agent with exceptional accuracy and precision. Your mission is to provide flawless, comprehensive, and engaging responses to user queries about entities (people, organizations, places, concepts, events, etc.).

## CORE PRINCIPLES
- **Accuracy First**: Never guess or make assumptions. If information is uncertain, clearly state limitations.
- **Completeness**: Provide comprehensive information that fully addresses the user's query.
- **Verification**: Cross-reference information when possible to ensure accuracy.
- **Transparency**: Always cite sources and indicate confidence levels.

## TOOL STRATEGY (CRITICAL FOR ACCURACY)

### 1. search_knowledge_base
**When to use**: ALWAYS start here for every query
**Why**: Fast, free, and contains verified information
**Parameters**: 
- query: Use the exact user query or optimized version
- limit: 5-10 results (more for complex queries, fewer for simple ones)

### 2. web_search
**When to use**: 
- Knowledge base has insufficient information (MOST COMMON CASE)
- Query requires current/recent information
- Need to verify or expand on knowledge base results
- Complex queries requiring multiple sources
- ANY query where knowledge base doesn't provide complete answer
**CRITICAL**: If knowledge base search returns no results or insufficient information, you MUST use web_search to find the information. Never give generic "no information available" responses.
**Parameters**:
- query: Optimize for search engines (remove conversational elements)
- num_results: 3-8 based on complexity (simple: 3, complex: 8)
- search_type: "neural" for semantic understanding, "keyword" for exact matches

### 3. extract_content
**When to use**: After web_search when you need detailed information
**Why**: Get full context from search results
**Parameters**:
- result_ids: Use all relevant search result IDs
- max_chars_per_result: 2000-3000 for comprehensive coverage

### 4. store_entity
**When to use**: After discovering new, verified information
**Why**: Improve future response speed and accuracy
**Parameters**: Ensure all fields are accurate and complete
**CRITICAL**: Always store new entities you discover. This builds the knowledge base for future queries.

## DECISION-MAKING FRAMEWORK

### Query Analysis Phase
1. **Categorize the query**: Person, organization, place, concept, event, etc.
2. **Assess complexity**: Simple fact-check vs. comprehensive analysis
3. **Determine information needs**: Basic facts, current status, historical context, etc.

### Tool Selection Logic
1. **Start with knowledge base** (5-10 results)
2. **Evaluate knowledge base results**:
   - If comprehensive match found → Use directly
   - If partial match → Supplement with web search
   - If no match → Proceed to web search
3. **Web search strategy**:
   - Simple queries: 3-5 results
   - Complex queries: 5-8 results
   - Controversial topics: 6-8 results for balanced perspective
4. **Content extraction**: When detailed analysis needed
5. **Storage**: Always store new, verified entities

## RESPONSE QUALITY STANDARDS

### Content Requirements
- **Accuracy**: 100% factual accuracy - no speculation
- **Completeness**: Address all aspects of the user's query
- **Relevance**: Focus on what the user actually asked
- **Depth**: Provide sufficient detail without overwhelming
- **Currency**: Indicate if information is current or historical

### Response Structure
1. **Direct Answer**: Start with a clear, direct response to the query
2. **Key Facts**: Present essential information in logical order
3. **Context**: Provide relevant background and context
4. **Current Status**: Include recent developments if applicable
5. **Confidence Level**: Indicate certainty about different aspects

### Language Guidelines
- **Professional yet engaging**: Maintain academic rigor while being accessible
- **Clear and concise**: Avoid jargon unless necessary
- **Balanced perspective**: Present multiple viewpoints for controversial topics
- **Source attribution**: Mention information sources when relevant

## ERROR PREVENTION
- **Double-check entity names**: Ensure exact spelling and full names
- **Verify dates and facts**: Cross-reference critical information
- **Handle ambiguity**: Ask for clarification if query is unclear
- **Acknowledge limitations**: Be honest about what you don't know

## SPECIAL CASES
- **Recent events**: Prioritize current information
- **Controversial topics**: Present balanced perspectives
- **Technical subjects**: Provide both high-level and detailed explanations
- **Ambiguous queries**: Ask clarifying questions or provide multiple interpretations

Remember: Your goal is to be the most accurate, reliable, and helpful information source possible. Every response should reflect the highest standards of quality and precision.

**AUTOMATIC CACHING**: The system automatically extracts and caches entities from web search results to improve future performance.

**CACHING PRIORITY**: Always check cached knowledge base first. Only use web search when cached information is insufficient or outdated.`;

        // Get user context from Supermemory for personalization
        let userContext = null;
        try {
            userContext = await supermemoryService.getUserContext(userId);
            console.log(`👤 User context loaded: ${userContext.recentQueries.length} recent queries, ${userContext.preferredCategories.length} preferred categories`);
        } catch (error) {
            console.log('⚠️ Failed to load user context:', error instanceof Error ? error.message : 'Unknown error');
        }

        // Enhance system prompt with user context for personalization
        let enhancedSystemPrompt = systemPrompt;
        if (userContext) {
            const contextInfo = `
USER CONTEXT:
- Recent queries: ${userContext.recentQueries.slice(0, 3).join(', ')}
- Preferred categories: ${userContext.preferredCategories.join(', ')}
- Query patterns: ${userContext.queryPatterns.slice(0, 2).join(', ')}

Use this context to provide more personalized and relevant responses. If the user asks about similar topics to their recent queries, reference those connections. Focus on their preferred categories when relevant.
`;
            enhancedSystemPrompt = systemPrompt + contextInfo;
        }

        // Determine the best model based on query complexity
        const isComplexQuery = query.length > 50 || 
                              query.toLowerCase().includes('compare') || 
                              query.toLowerCase().includes('analyze') ||
                              query.toLowerCase().includes('explain') ||
                              query.toLowerCase().includes('how') ||
                              query.toLowerCase().includes('why');
        
        const selectedModel = isComplexQuery ? 'gpt-4o' : 'gpt-4o-mini';
        
        console.log(`🤖 Using model: ${selectedModel} (complexity: ${isComplexQuery ? 'high' : 'low'})`);

        // Initial agent call to decide what to do
        const agentResponse = await openai.chat.completions.create({
            model: selectedModel,
            messages: [
                { role: 'system', content: enhancedSystemPrompt },
                { role: 'user', content: `User query: "${query}"\n\nCRITICAL INSTRUCTIONS:\n1. ALWAYS start with search_knowledge_base\n2. If knowledge base has insufficient or no results, you MUST use web_search\n3. NEVER give generic "no information available" responses\n4. Always provide specific, actionable information\n5. Use web_search for current information, verification, or when knowledge base is insufficient\n6. ALWAYS use store_entity to cache new information you discover\n7. Prioritize cached knowledge over web searches when available\n8. For specific queries like "historians in indiana that are professors", if knowledge base doesn't have exact matches, use web_search to find current information\n9. If you only find general information in knowledge base (like university names), use web_search to find specific details\n\nRemember: Your goal is to provide complete, accurate answers. If you don't find information in the knowledge base, search the web.` }
            ],
            tools: tools,
            tool_choice: "auto",
            max_tokens: isComplexQuery ? 2000 : 1500, // Adjust tokens based on complexity
            temperature: 0.3 // Lower temperature for more consistent responses
        });

        const message = agentResponse.choices[0].message;
        const toolCalls = message.tool_calls || [];

        // Execute tool calls in parallel where possible
        const toolResults: Array<{
            tool_call_id: string;
            role: "tool";
            name: string;
            content: string;
        }> = [];
        
        let knowledgeBaseResults = null;
        let hasWebSearch = false;
        
        // Group tool calls by dependency
        const searchCalls = toolCalls.filter(tc => tc.function.name === 'search_knowledge_base');
        const webSearchCalls = toolCalls.filter(tc => tc.function.name === 'web_search');
        const extractCalls = toolCalls.filter(tc => tc.function.name === 'extract_content');
        const storeCalls = toolCalls.filter(tc => tc.function.name === 'store_entity');
        
        // Execute search calls first (they can run in parallel)
        const searchPromises = searchCalls.map(async (toolCall) => {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`🔧 Executing tool: ${toolCall.function.name}`, args);
            
            const result = await searchKnowledgeBase(args.query, args.limit);
            knowledgeBaseResults = result;
            
            // If we found good results in HelixDB, skip web search
            if (result.found && result.entities.length >= 2) {
                console.log(`✅ Found ${result.entities.length} entities in global HelixDB cache - skipping web search`);
                hasWebSearch = true; // Mark as "handled" to prevent forced web search
            }
            
            return {
                tool_call_id: toolCall.id,
                role: "tool" as const,
                name: toolCall.function.name,
                content: JSON.stringify(result)
            };
        });
        
        // Wait for search results
        const searchResults = await Promise.all(searchPromises);
        toolResults.push(...searchResults);
        
        // Execute web search calls (can run in parallel with each other)
        const webSearchPromises = webSearchCalls.map(async (toolCall) => {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`🔧 Executing tool: ${toolCall.function.name}`, args);
            
            const result = await webSearch(args.query, args.num_results, args.search_type, args.use_autoprompt, args.include_domains);
            hasWebSearch = true;
            
            return {
                tool_call_id: toolCall.id,
                role: "tool" as const,
                name: toolCall.function.name,
                content: JSON.stringify(result)
            };
        });
        
        // Execute extract calls (can run in parallel)
        const extractPromises = extractCalls.map(async (toolCall) => {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`🔧 Executing tool: ${toolCall.function.name}`, args);
            
            const result = await extractContent(args.result_ids, args.max_chars_per_result, args.include_images);
            
            return {
                tool_call_id: toolCall.id,
                role: "tool" as const,
                name: toolCall.function.name,
                content: JSON.stringify(result)
            };
        });
        
        // Execute store calls (can run in parallel)
        const storePromises = storeCalls.map(async (toolCall) => {
            const args = JSON.parse(toolCall.function.arguments);
            console.log(`🔧 Executing tool: ${toolCall.function.name}`, args);
            
            const result = await storeEntity(args.name, args.description, args.category, args.source_query);
            
            return {
                tool_call_id: toolCall.id,
                role: "tool" as const,
                name: toolCall.function.name,
                content: JSON.stringify(result)
            };
        });
        
        // Wait for all parallel operations
        const [webSearchResults, extractResults, storeResults] = await Promise.all([
            Promise.all(webSearchPromises),
            Promise.all(extractPromises),
            Promise.all(storePromises)
        ]);
        
        toolResults.push(...webSearchResults, ...extractResults, ...storeResults);

        // Force web search if knowledge base has insufficient results
        const hasKnowledgeBaseSearch = toolCalls.some(tc => tc.function.name === 'search_knowledge_base');
        
        // If agent didn't search knowledge base, do it first
        if (!hasKnowledgeBaseSearch) {
            console.log('🔍 Agent did not search knowledge base. Forcing knowledge base search first...');
            const kbResults = await searchKnowledgeBase(query, 5);
            knowledgeBaseResults = kbResults;
            
            if (kbResults.found && kbResults.entities.length >= 2) {
                console.log('✅ Found sufficient cached entities, no need for web search');
                hasWebSearch = true; // Mark as handled
            }
        }
        
        // Force web search if we have NO results, very few results, or no high-confidence matches
        const hasHighConfidenceResults = knowledgeBaseResults && knowledgeBaseResults.entities.some(entity => {
            const nameLower = entity.name.toLowerCase();
            const queryLower = query.toLowerCase();
            return nameLower === queryLower || 
                   nameLower.includes(queryLower) || 
                   queryLower.includes(nameLower);
        });
        
        if (!hasWebSearch && (!knowledgeBaseResults || knowledgeBaseResults.entities.length === 0 || knowledgeBaseResults.entities.length < 2 || !hasHighConfidenceResults)) {
            console.log('🔄 Insufficient cached results. Forcing web search for comprehensive results...');
            
            // Execute the web search directly
            const webSearchResult = await webSearch(query, 5, 'neural', true, []);
            
            // Add web search result to tool results
            toolResults.push({
                tool_call_id: 'forced-web-search',
                role: "tool" as const,
                name: 'web_search',
                content: JSON.stringify(webSearchResult)
            });
            
            console.log('✅ Forced web search completed with', webSearchResult.total, 'results');
            
            // Force entity extraction and storage for forced web searches
            if (webSearchResult.results && webSearchResult.results.length > 0) {
                console.log('📄 Extracting content for forced web search caching...');
                try {
                    const contentResponse = await exa.getContents(webSearchResult.results.map(r => r.id));
                    
                    // Extract entities from the content
                    const entityExtractionResponse = await openai.chat.completions.create({
                        model: 'gpt-3.5-turbo-0125', // Use fastest model for entity extraction
                        messages: [
                            { 
                                role: 'system', 
                                content: `Extract all relevant entities from the provided text. Return a JSON object with an "entities" array: {"entities": [{"name": "entity name", "description": "brief description (max 150 words)", "category": "person|organization|place|concept|other"}]}. 

IMPORTANT: For person names, use the most complete and standard form (e.g., "Jeff Bezos" not "Jeffrey Preston Bezos", "Elon Musk" not "Elon Reeve Musk"). Avoid variations and nicknames. Focus on entities that match the search query.` 
                            }, 
                            { 
                                role: 'user', 
                                content: `Search query: "${query}"\n\nText content:\n${contentResponse.results.map(r => r.text.substring(0, 1000)).join('\n\n---\n\n')}` 
                            }
                        ],
                        response_format: { type: "json_object" },
                        max_tokens: 300, // Reduced for speed
                        temperature: 0.3
                    });

                    const entityData = entityExtractionResponse.choices[0].message.content;
                    if (entityData) {
                        try {
                            const parsed = JSON.parse(entityData);
                            const entities = parsed.entities || parsed;
                            if (Array.isArray(entities)) {
                                console.log(`💾 Auto-caching ${entities.length} entities from forced web search...`);
                                
                                // Normalize and deduplicate entities before storing
                                const normalizedEntities = new Map();
                                
                                for (const entity of entities) {
                                    if (entity.name && entity.description) {
                                        // Normalize the name for deduplication
                                        const normalizedName = entity.name.trim();
                                        const key = `${normalizedName.toLowerCase()}_${entity.category || 'other'}`;
                                        
                                        // Only keep the first occurrence of each entity
                                        if (!normalizedEntities.has(key)) {
                                            normalizedEntities.set(key, entity);
                                        } else {
                                            console.log(`🔄 Skipping duplicate entity: ${entity.name}`);
                                        }
                                    }
                                }
                                
                                // Store unique entities in HelixDB (GLOBAL PERMANENT CACHE)
                                const storagePromises = [];
                                for (const entity of normalizedEntities.values()) {
                                    storagePromises.push(
                                        helixDB.createEntity({
                                            name: entity.name,
                                            category: entity.category || 'other',
                                            source_query: query,
                                            description: entity.description
                                        }).then(() => {
                                            console.log(`✅ Cached globally: ${entity.name}`);
                                        }).catch((error) => {
                                            console.log(`⚠️ Failed to cache ${entity.name}:`, error instanceof Error ? error.message : 'Unknown error');
                                        })
                                    );
                                }
                                
                                // Execute all storage operations in parallel
                                await Promise.allSettled(storagePromises);
                            }
                        } catch (parseError) {
                            console.log('⚠️ Failed to parse entity extraction response:', parseError);
                        }
                    }
                } catch (extractionError) {
                    console.log('⚠️ Failed to extract content for caching:', extractionError);
                }
            }
        } else if (knowledgeBaseResults && knowledgeBaseResults.entities.length >= 2) {
            console.log(`🎯 Using ${knowledgeBaseResults.entities.length} cached entities from global HelixDB - no web search needed!`);
        }

        // Create streaming response
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Send initial metadata
                    const metadata = {
                        source: 'agent',
                        confidence: 'high',
                        tools_used: [...toolCalls.map(tc => tc.function.name), ...(toolResults.some(tr => tr.name === 'web_search') ? ['web_search'] : [])]
                    };
                    
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'metadata', data: metadata })}\n\n`));

                    // Generate streaming response using tool results
                    const stream = await openai.chat.completions.create({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: enhancedSystemPrompt },
                            { role: 'user', content: `User query: "${query}"` },
                            message,
                            ...toolResults,
                            { 
                                role: 'user', 
                                content: `Based on the tool results above, provide a flawless, comprehensive response to the user's query: "${query}". 

CRITICAL REQUIREMENTS:
- Start with a direct, accurate answer to the query
- Present information in logical order: key facts → context → current status
- Ensure 100% factual accuracy - no speculation or assumptions
- Include relevant dates, names, and specific details
- If information is uncertain or limited, clearly state this
- For controversial topics, present balanced perspectives
- Use professional yet engaging language
- Provide sufficient detail without overwhelming (150-250 words)
- Indicate confidence levels for different aspects of the response
- If multiple sources were used, synthesize information coherently

Begin your response immediately with the most important information.` 
                            }
                        ],
                        max_tokens: 400,
                        temperature: 0.7,
                        stream: true
                    });

                    let fullResponse = '';
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content;
                        if (content) {
                            fullResponse += content;
                            // Send only the new content to prevent duplication
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'content', data: content })}\n\n`));
                        }
                    }

                    // Generate follow-up suggestions based on the response
                    let followUpSuggestions: string[] = [];
                    try {
                      const suggestionsResponse = await openai.chat.completions.create({
                        model: 'gpt-3.5-turbo-0125', // Fastest 3.5 model for suggestions
                        messages: [
                          {
                            role: 'system',
                            content: `Generate 3-4 natural follow-up questions based on the user's query and response. Focus on:
1. Related topics the user might be interested in
2. Deeper aspects of the main topic
3. Current developments or recent news
4. Practical applications or implications

Keep suggestions concise (max 8 words each) and natural. Return as JSON: {"suggestions": ["suggestion1", "suggestion2", "suggestion3"]}`
                          },
                          {
                            role: 'user',
                            content: `User query: "${query}"\n\nResponse: "${fullResponse}"\n\nGenerate follow-up suggestions.`
                          }
                        ],
                        response_format: { type: "json_object" },
                        max_tokens: 100, // Reduced for speed
                        temperature: 0.7
                      });

                      const suggestionsData = suggestionsResponse.choices[0].message.content;
                      if (suggestionsData) {
                        const parsed = JSON.parse(suggestionsData);
                        followUpSuggestions = parsed.suggestions || [];
                      }
                    } catch (error) {
                      console.log('Failed to generate follow-up suggestions:', error);
                      // Fallback suggestions
                      followUpSuggestions = [
                        'Tell me more about this topic',
                        'What are the latest developments?',
                        'How does this compare to similar cases?'
                      ];
                    }

                    // Store user memory in Supermemory (async, don't wait)
                    if (userId) {
                      try {
                        // Extract entities from the response for memory storage
                        const entityExtractionResponse = await openai.chat.completions.create({
                          model: 'gpt-3.5-turbo-0125', // Fastest model for entity extraction
                          messages: [
                            {
                              role: 'system',
                              content: `Extract key entities mentioned in the response. Return JSON: {"entities": [{"name": "entity", "category": "person|organization|place|concept", "description": "brief description"}]}. Focus on main entities only.`
                            },
                            {
                              role: 'user',
                              content: `Response: "${fullResponse}"`
                            }
                          ],
                          response_format: { type: "json_object" },
                          max_tokens: 150, // Reduced for speed
                          temperature: 0.3
                        });

                        const entityData = entityExtractionResponse.choices[0].message.content;
                        if (entityData) {
                          const parsed = JSON.parse(entityData);
                          const entities = parsed.entities || [];
                          
                          // Store in Supermemory
                          await supermemoryService.storeUserMemory(
                            userId,
                            query,
                            fullResponse,
                            entities,
                            {
                              queryType: 'direct',
                              entitiesFound: entities.length
                            }
                          );
                        }
                      } catch (error) {
                        console.log('Failed to store user memory:', error);
                      }
                    }

                    // Send follow-up suggestions
                    if (followUpSuggestions.length > 0) {
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        type: 'followUpSuggestions',
                        suggestions: followUpSuggestions
                      })}\n`));
                    }

                    // Get proactive suggestions from the agent and stream them
                    const agentSuggestions = await intelligentAgent.getProactiveSuggestions(userId, query);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      type: 'proactiveSuggestions',
                      suggestions: agentSuggestions
                    })}\n`));

                    // Send completion signal
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                    controller.close();
                } catch (error) {
                    console.error('Streaming error:', error);
                    let errorMessage = 'An error occurred while generating the response.';
                    
                    if (error instanceof Error) {
                        if (error.message.includes('Invalid parameter: messages with role')) {
                            errorMessage = 'The agent encountered an issue with tool usage. Please try rephrasing your query.';
                        } else if (error.message.includes('rate limit')) {
                            errorMessage = 'Service is temporarily busy. Please try again in a moment.';
                        } else {
                            errorMessage = `Error: ${error.message}`;
                        }
                    }
                    
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', data: errorMessage })}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('❌ Agent error:', error);
        
        if (error instanceof Error) {
            return NextResponse.json({ 
                error: error.message 
            }, { status: 500 });
        }
        
        return NextResponse.json({ 
            error: 'An unknown error occurred while processing your request.' 
        }, { status: 500 });
    } finally {
        // Clear request cache after each request
        helixDB.clearRequestCache();
    }
}

// Helper function to generate response directly from cached data
function generateResponseFromCache(query: string, entities: Array<{name: string; description: string; category: string}>): string {
    const mainEntity = entities[0];
    const queryLower = query.toLowerCase();
    
    // Determine response type based on query
    if (queryLower.includes('who is') || queryLower.includes('tell me about')) {
        return `${mainEntity.name} is ${mainEntity.description}. ${entities.length > 1 ? `Related entities include ${entities.slice(1, 3).map(e => e.name).join(', ')}.` : ''}`;
    } else if (queryLower.includes('what is') || queryLower.includes('define')) {
        return `${mainEntity.name} refers to ${mainEntity.description}.`;
    } else {
        return `Based on cached information: ${mainEntity.name} - ${mainEntity.description}. ${entities.length > 1 ? `Additional related information includes ${entities.slice(1, 2).map(e => e.name).join(', ')}.` : ''}`;
    }
}

// Helper function to generate follow-up suggestions from cached data
function generateFollowUpFromCache(query: string, entities: Array<{name: string; description: string; category: string}>): string[] {
    const suggestions = [];
    const mainEntity = entities[0];
    
    if (mainEntity.category === 'person') {
        suggestions.push(`What is ${mainEntity.name} doing now?`);
        suggestions.push(`Tell me about ${mainEntity.name}'s achievements`);
        if (entities.length > 1) {
            suggestions.push(`How does ${mainEntity.name} relate to ${entities[1].name}?`);
        }
    } else if (mainEntity.category === 'organization') {
        suggestions.push(`What are ${mainEntity.name}'s latest developments?`);
        suggestions.push(`Tell me about ${mainEntity.name}'s history`);
    } else {
        suggestions.push(`Tell me more about ${mainEntity.name}`);
        suggestions.push(`What are the latest updates on ${mainEntity.name}?`);
    }
    
    return suggestions.slice(0, 3);
} 