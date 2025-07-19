import { helixDB } from './helixdb';
import { fastWebSearch, FastSearchResult } from './fast-web-search';
import { optimizedSupermemoryService } from './supermemory-optimized';
import { contextEngine } from './context-engine';
import { logger } from './logging';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface AgentSearchResult {
  answer: string;
  source: 'helixdb' | 'exa';
  cached: boolean;
  performance: {
    helixdbTime: number;
    exaTime: number;
    totalTime: number;
  };
  reasoning: string;
  toolUsage: ToolUsage[];
}

export interface ToolUsage {
  tool: string;
  action: string;
  parameters: any;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  result?: any;
  error?: string;
}

// Enhanced query pattern learning with semantic matching
const queryPatterns = new Map<string, { originalQuery: string; entity: string; patterns: string[] }>();

function extractEntity(query: string): string {
  // Remove common question patterns to extract the core entity
  const cleaned = query
    .toLowerCase()
    .replace(/^(who is|what is|tell me about|who was|what are|how is|can you|please|explain|describe|give me information about)/i, '')
    .replace(/\?/g, '')
    .trim();
  
  return cleaned;
}

function generateQueryPatterns(query: string): string[] {
  const entity = extractEntity(query);
  const patterns = [
    entity,
    `who is ${entity}`,
    `what is ${entity}`,
    `tell me about ${entity}`,
    `explain ${entity}`,
    `describe ${entity}`,
    `information about ${entity}`,
    `${entity} information`,
    `who was ${entity}`,
    `what are ${entity}`
  ];
  
  return patterns.map(p => p.toLowerCase());
}

function findSimilarPattern(currentQuery: string): string | null {
  const currentEntity = extractEntity(currentQuery);
  const normalizedQuery = currentQuery.toLowerCase();
  
  // First, try exact entity match
  for (const [pattern, data] of queryPatterns.entries()) {
    if (data.entity === currentEntity) {
      logger.log('info', '🔄 Found exact entity match', { 
        currentQuery, 
        matchedEntity: data.entity,
        originalQuery: data.originalQuery 
      });
      return data.originalQuery;
    }
  }
  
  // Then try pattern matching
  for (const [pattern, data] of queryPatterns.entries()) {
    // Check if current query matches any of the stored patterns
    if (data.patterns.some(p => normalizedQuery.includes(p) || p.includes(normalizedQuery))) {
      logger.log('info', '🔄 Found pattern match', { 
        currentQuery, 
        matchedPattern: pattern,
        originalQuery: data.originalQuery 
      });
      return data.originalQuery;
    }
  }
  
  // Finally, try fuzzy entity matching
  for (const [pattern, data] of queryPatterns.entries()) {
    if (data.entity.includes(currentEntity) || currentEntity.includes(data.entity)) {
      logger.log('info', '🔄 Found fuzzy entity match', { 
        currentQuery, 
        currentEntity,
        matchedEntity: data.entity,
        originalQuery: data.originalQuery 
      });
      return data.originalQuery;
    }
  }
  
  return null;
}

export async function agentSearch(query: string, userId: string): Promise<AgentSearchResult> {
  const startTime = Date.now();
  const toolUsage: ToolUsage[] = [];
  
  const logToolUsage = (tool: string, action: string, parameters: Record<string, unknown>, startTime: number, success: boolean, result?: unknown, error?: string) => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const usage: ToolUsage = {
      tool,
      action,
      parameters,
      startTime,
      endTime,
      duration,
      success,
      result,
      error
    };
    
    toolUsage.push(usage);
    
    // Live logging
    const status = success ? '✅' : '❌';
    const resultPreview = result ? (typeof result === 'string' ? result.substring(0, 100) + '...' : JSON.stringify(result).substring(0, 100) + '...') : 'N/A';
    
    console.log(`${status} [${tool}] ${action} (${duration}ms)`);
    console.log(`   Parameters: ${JSON.stringify(parameters)}`);
    if (success) {
      console.log(`   Result: ${resultPreview}`);
    } else {
      console.log(`   Error: ${error}`);
    }
    console.log('---');
  };

  let helixdbTime = 0;
  let exaTime = 0;
  let reasoning = '';

  // 0. Context Engine Analysis (Cursor-style reactive understanding) - OPTIONAL
  const contextStart = Date.now();
  console.log('🧠 [TOOL] Starting Context Engine analysis...');
  
  try {
    const reactiveResponse = await contextEngine.generateReactiveResponse(query, userId);
    const contextTime = Date.now() - contextStart;
    
    if (reactiveResponse) {
      logToolUsage('ContextEngine', 'generateReactiveResponse', { query, userId }, contextStart, true, {
        immediateAnswer: !!reactiveResponse.immediateAnswer,
        suggestionsCount: reactiveResponse.contextAwareSuggestions.length,
        confidence: reactiveResponse.confidence
      });

      // If we have an immediate answer from context, return it
      if (reactiveResponse.immediateAnswer && reactiveResponse.confidence > 0.7) {
        reasoning = `Answered from context: ${reactiveResponse.reasoning}`;
        logger.log('info', '✅ Context Engine provided immediate answer', { 
          query, 
          confidence: reactiveResponse.confidence,
          contextTime 
        });
        
        return {
          answer: reactiveResponse.immediateAnswer,
          source: 'helixdb' as const, // Context comes from our knowledge base
          cached: true,
          performance: { helixdbTime: 0, exaTime: 0, totalTime: Date.now() - startTime },
          reasoning,
          toolUsage
        };
      }

      logger.log('info', '🧠 Context Engine analysis completed', { 
        query, 
        confidence: reactiveResponse.confidence,
        contextTime 
      });
    } else {
      logToolUsage('ContextEngine', 'generateReactiveResponse', { query, userId }, contextStart, true, {
        disabled: true,
        message: 'Context Engine is disabled or returned null'
      });
      logger.log('info', '🧠 Context Engine disabled or unavailable', { query });
    }
  } catch (error) {
    const contextTime = Date.now() - contextStart;
    logToolUsage('ContextEngine', 'generateReactiveResponse', { query, userId }, contextStart, false, undefined, (error as Error).message);
    logger.log('warn', 'Context Engine analysis failed', { error: (error as Error).message });
  }

  // 1. Try HelixDB (fuzzy match) - also check for similar patterns
  const helixStart = Date.now();
  console.log('🔍 [TOOL] Starting HelixDB semantic search...');
  
  try {
    const kbResult = await helixDB.semanticSearch(query, 1);
    helixdbTime = Date.now() - helixStart;
    
    logToolUsage('HelixDB', 'semanticSearch', { query, limit: 1 }, helixStart, true, {
      entitiesFound: kbResult.entities.length,
      firstEntity: kbResult.entities[0]?.name || 'none'
    });

    logger.log('info', '🔍 HelixDB search completed', { 
      query, 
      resultsFound: kbResult.entities.length, 
      helixdbTime 
    });

    if (kbResult.entities.length > 0 && kbResult.entities[0].description) {
      reasoning = `Found summary in HelixDB for query: "${query}".`;
      logger.log('info', '✅ Cache hit in HelixDB', { query, source: 'helixdb' });
      
      // Learn this query pattern
      const entity = extractEntity(query);
      const patterns = generateQueryPatterns(query);
      queryPatterns.set(query.toLowerCase(), { originalQuery: query, entity, patterns });
      
      return {
        answer: kbResult.entities[0].description,
        source: 'helixdb',
        cached: true,
        performance: { helixdbTime, exaTime: 0, totalTime: Date.now() - startTime },
        reasoning,
        toolUsage
      };
    }
  } catch (error) {
    helixdbTime = Date.now() - helixStart;
    logToolUsage('HelixDB', 'semanticSearch', { query, limit: 1 }, helixStart, false, undefined, error.message);
  }

  // 2. Check for similar query patterns using enhanced matching
  const patternStart = Date.now();
  console.log('🧠 [TOOL] Checking query patterns...');
  
  try {
    const similarQuery = findSimilarPattern(query);
    if (similarQuery) {
      // Try searching with the similar pattern
      const similarResult = await helixDB.semanticSearch(similarQuery, 1);
      const patternTime = Date.now() - patternStart;
      
      logToolUsage('PatternMatcher', 'findSimilarPattern', { query, similarQuery }, patternStart, true, {
        similarQuery,
        entitiesFound: similarResult.entities.length
      });

      if (similarResult.entities.length > 0 && similarResult.entities[0].description) {
        reasoning = `Found summary using similar query pattern: "${similarQuery}".`;
        return {
          answer: similarResult.entities[0].description,
          source: 'helixdb',
          cached: true,
          performance: { helixdbTime, exaTime: 0, totalTime: Date.now() - startTime },
          reasoning,
          toolUsage
        };
      }
    } else {
      logToolUsage('PatternMatcher', 'findSimilarPattern', { query }, patternStart, true, { similarQuery: null });
    }
  } catch (error) {
    logToolUsage('PatternMatcher', 'findSimilarPattern', { query }, patternStart, false, undefined, error.message);
  }

  // 3. If not found, search Exa
  reasoning = `No summary found in HelixDB for query: "${query}". Searching Exa...`;
  logger.log('info', '🌐 Searching Exa', { query });
  
  const exaStart = Date.now();
  console.log('⚡ [TOOL] Starting Exa web search...');
  
  try {
    const exaResult: FastSearchResult = await fastWebSearch.search(query, { numResults: 3, searchType: 'neural' });
    exaTime = Date.now() - exaStart;

    logToolUsage('Exa', 'webSearch', { query, numResults: 3, searchType: 'neural' }, exaStart, true, {
      entitiesFound: exaResult.entities.length,
      summaryLength: exaResult.summary?.length || 0
    });

    logger.log('info', '✅ Exa search completed', { 
      query, 
      entitiesFound: exaResult.entities.length, 
      exaTime 
    });

    // 4. Summarize Exa results using GPT-4o
    const gptStart = Date.now();
    console.log('🤖 [TOOL] Starting GPT-4o summarization...');
    
    let summary = '';
    try {
      const summaryPrompt = `Summarize the following web search results in a concise, natural language answer for the query: "${query}".\n\nResults:\n${exaResult.entities.map((r, i) => `${i+1}. ${r.name}: ${r.description || ''}`).join('\n')}`;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: summaryPrompt }
        ],
        temperature: 0.3,
        max_tokens: 256
      });
      summary = completion.choices[0].message.content?.trim() || '';
      
      logToolUsage('GPT-4o', 'summarize', { 
        query, 
        entitiesCount: exaResult.entities.length,
        promptLength: summaryPrompt.length 
      }, gptStart, true, {
        summaryLength: summary.length,
        tokensUsed: completion.usage?.total_tokens || 0
      });
      
      logger.log('info', '🤖 Summary generated', { query, summaryLength: summary.length });
    } catch (error) {
      logToolUsage('GPT-4o', 'summarize', { query, entitiesCount: exaResult.entities.length }, gptStart, false, undefined, error.message);
      logger.log('error', 'Failed to summarize Exa results', { error });
      summary = exaResult.summary || exaResult.entities.map(r => r.name).join('; ');
    }

    // 5. Cache summary in HelixDB
    const cacheStart = Date.now();
    console.log('💾 [TOOL] Caching summary in HelixDB...');
    
    try {
      await helixDB.createEntityWithDeduplication({
        name: query,
        category: 'summary',
        source_query: query,
        description: summary
      });
      reasoning += ' Cached summary in HelixDB.';
      
      logToolUsage('HelixDB', 'createEntityWithDeduplication', {
        name: query,
        category: 'summary',
        source_query: query,
        descriptionLength: summary.length
      }, cacheStart, true, { cached: true });
      
      logger.log('info', '💾 Cached summary in HelixDB', { query });
      
      // Learn this query pattern with enhanced pattern generation
      const entity = extractEntity(query);
      const patterns = generateQueryPatterns(query);
      queryPatterns.set(query.toLowerCase(), { originalQuery: query, entity, patterns });
      
      logger.log('info', '🧠 Learned query patterns', { 
        query, 
        entity, 
        patterns: patterns.slice(0, 3) // Log first 3 patterns for brevity
      });
      
    } catch (error) {
      logToolUsage('HelixDB', 'createEntityWithDeduplication', {
        name: query,
        category: 'summary',
        source_query: query
      }, cacheStart, false, undefined, error.message);
      logger.log('error', 'Failed to cache summary in HelixDB', { error });
      reasoning += ' Failed to cache summary.';
    }

    const finalResult: AgentSearchResult = {
      answer: summary,
      source: 'exa' as const,
      cached: false,
      performance: { helixdbTime, exaTime, totalTime: Date.now() - startTime },
      reasoning,
      toolUsage
    };

    // Update context with search results for future reactive responses (OPTIONAL)
    try {
      await contextEngine.updateContextWithResults(userId, query, {
        answer: summary,
        entities: exaResult.entities
      });
    } catch (error) {
      logger.log('warn', 'Failed to update context with results', { error: (error as Error).message });
    }

    return finalResult;
  } catch (error) {
    exaTime = Date.now() - exaStart;
    logToolUsage('Exa', 'webSearch', { query, numResults: 3, searchType: 'neural' }, exaStart, false, undefined, error.message);
    
    return {
      answer: 'Sorry, I encountered an error while searching for information.',
      source: 'exa',
      cached: false,
      performance: { helixdbTime, exaTime, totalTime: Date.now() - startTime },
      reasoning: `Error during web search: ${error.message}`,
      toolUsage
    };
  }
} 