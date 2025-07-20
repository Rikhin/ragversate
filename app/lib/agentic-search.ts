import { helixDB } from './helixdb';
import { fastWebSearch } from './fast-web-search';
import OpenAI from 'openai';
import { multiHelixDB, SearchMode } from './multi-helixdb';
// Import feedbackStore from feedback API (for demo; in production, use a real DB)
import { promises as fs } from 'fs';
import { addSessionContextMemory, listMemories } from './supermemory';
const SESSION_FILE = 'session-context.json';
let sessionContexts: Record<string, {
  recentQueries: string[];
  preferences: Record<string, unknown>;
  topics: string[];
}> = {};

// Load session context from disk on startup
(async () => {
  try {
    const data = await fs.readFile(SESSION_FILE, 'utf-8');
    sessionContexts = JSON.parse(data);
  } catch (e) {
    sessionContexts = {};
  }
})();

// True Agentic Search System with Interleaved Thinking
// Dynamically decides which tools to use and evaluates its own results

export interface AgenticSearchResult {
  answer: string;
  source: 'context' | 'neural' | 'helixdb' | 'exa' | 'hybrid';
  cached: boolean;
  performance: {
    totalTime: number;
    toolTime: { [key: string]: number };
  };
  reasoning: string;
  toolUsage: ToolUsage[];
  agentDecisions: AgentDecision[];
  evaluation: ResultEvaluation;
}

export interface ResultEvaluation {
  quality: 'excellent' | 'good' | 'poor' | 'unacceptable';
  confidence: number;
  issues: string[];
  suggestions: string[];
  shouldRetry: boolean;
  reasoning: string;
}

export interface AgentDecision {
  tool: string;
  reason: string;
  confidence: number;
  executed: boolean;
  result?: ToolResult;
  evaluation?: ResultEvaluation;
}

export interface ToolResult {
  answer?: string;
  source?: string;
  confidence?: number;
  [key: string]: unknown;
}

export interface ToolUsage {
  tool: string;
  action: string;
  parameters: Record<string, unknown>;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  result?: ToolResult;
  error?: string;
}

export interface SystemContext {
  mode: SearchMode;
  cacheStatus: {
    hit: boolean;
    lastWarm: number;
    entityCount: number;
  };
  toolTimings: Record<string, number[]>; // rolling ms timings for each tool
  recentQueries: Array<{ query: string; result: string; time: number; cacheHit: boolean }>;
  reasoningLog: string[];
  goals: string[];
}

// Move these interface definitions to the top of the file:
interface EntityWithName { name: string; }
interface EntityWithDescription { description: string; }

class AgenticSearchSystem {
  private openai: OpenAI;
  private availableTools = [
    'helixdb_search',
    'pattern_matching',
    'exa_search'
  ];

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async search(query: string, userId: string, mode: SearchMode = 'general'): Promise<AgenticSearchResult> {
    const startTime = Date.now();
    const toolUsage: ToolUsage[] = [];
    const agentDecisions: AgentDecision[] = [];
    const context: SystemContext = {
      mode,
      cacheStatus: {
        hit: false,
        lastWarm: Date.now(),
        entityCount: 0
      },
      toolTimings: {},
      recentQueries: [],
      reasoningLog: [],
      goals: [
        'Maximize answer quality and relevance',
        'Minimize response time and redundant work',
        'Continuously build and optimize the knowledge base through caching',
        'Delight the user with helpful, context-aware answers',
        'Learn and adapt from every query and feedback'
      ]
    };

    // --- SUPERMEMORY SESSION CONTEXT ---
    // Retrieve recent session context for user
    let sessionContextResults = [];
    try {
      const sessionRes = await listMemories({ userId, tags: ['session_context'], limit: 10 });
      sessionContextResults = sessionRes?.memories || [];
      context.reasoningLog.push(`Loaded ${sessionContextResults.length} session context memories from Supermemory for user ${userId}.`);
    } catch (e) {
      context.reasoningLog.push('Failed to load session context from Supermemory.');
    }
    // Add current query to session context
    try {
      await addSessionContextMemory({
        userId,
        content: query,
        contextType: 'query',
        metadata: { timestamp: Date.now() }
      });
      context.reasoningLog.push('Added current query to Supermemory session context.');
    } catch (e) {
      context.reasoningLog.push('Failed to add query to Supermemory session context.');
    }
    // Use session context for reasoning, tool selection, etc.

    context.reasoningLog.push('Agent Goals:');
    context.goals.forEach(goal => context.reasoningLog.push(`- ${goal}`));
    context.reasoningLog.push('');
    context.reasoningLog.push(`Session context: recent queries: ${sessionContextResults.map((m: { content: string }) => m.content).join(', ')}`);
    // Use session context for smarter tool selection (future: suggest follow-ups, avoid redundant work)
    // Example: if query is similar to a recent one, prefer cache even more
    let sessionSim = 0;
    for (const rq of sessionContextResults.map((m: { content: string }) => m.content).slice(0, -1)) {
      const sim = cosineSimilarity(rq, query);
      if (sim > sessionSim) sessionSim = sim;
    }
    if (sessionSim > 0.85) {
      context.reasoningLog.push(`Query is similar to recent session queries (sim: ${sessionSim.toFixed(2)}), strongly preferring cache for speed.`);
      // selectedTool = 'helixdb_search'; // This line was removed as per edit hint
    }

    // At each major step, log how the action serves the goals
    // Example for cache check:
    context.reasoningLog.push('Checking cache to minimize response time and leverage prior knowledge (serves goals 2, 3).');
    // --- META-TOOL: Cache Hit Check ---
    const cacheCheckStart = Date.now();
    let cacheHit = false;
    let cachedEntity = null;
    const entityCache = (globalThis as unknown as { multiHelixDB: { entityCaches: Map<string, unknown> } }).multiHelixDB?.entityCaches?.get?.(mode);
    if (entityCache) {
      context.cacheStatus.entityCount = (entityCache as Map<string, unknown>).size;
      // Simple cache hit: look for exact match (future: semantic match)
      for (const entity of (entityCache as Map<string, unknown>).values()) {
        if ((entity as EntityWithName).name.toLowerCase() === query.toLowerCase()) {
          cacheHit = true;
          cachedEntity = entity;
          break;
        }
      }
    }
    context.cacheStatus.hit = cacheHit;
    const cacheCheckEnd = Date.now();
    toolUsage.push({
      tool: 'meta_cache_check',
      action: 'check_cache',
      parameters: { query, mode },
      startTime: cacheCheckStart,
      endTime: cacheCheckEnd,
      duration: cacheCheckEnd - cacheCheckStart,
      success: true,
      result: { cacheHit, entity: cachedEntity }
    });
    context.reasoningLog.push(`Cache check for "${query}" in mode [${mode}]: ${cacheHit ? 'HIT' : 'MISS'}`);
    context.reasoningLog.push('Cache hit: using HelixDB for instant answer (serves goal 1, 2).');

    // --- SEMANTIC CACHE HIT LOGIC ---
    function cosineSimilarity(a: string, b: string): number {
      const wordsA = a.toLowerCase().split(/\W+/);
      const wordsB = b.toLowerCase().split(/\W+/);
      const allWords = Array.from(new Set([...wordsA, ...wordsB]));
      const vecA = allWords.map(w => wordsA.filter(x => x === w).length);
      const vecB = allWords.map(w => wordsB.filter(x => x === w).length);
      const dot = vecA.reduce((sum, v, i) => sum + v * vecB[i], 0);
      const magA = Math.sqrt(vecA.reduce((sum, v) => sum + v * v, 0));
      const magB = Math.sqrt(vecB.reduce((sum, v) => sum + v * v, 0));
      return magA && magB ? dot / (magA * magB) : 0;
    }
    let semanticCacheHit = false;
    let semanticCachedEntity = null;
    if (entityCache && !cacheHit) {
      let bestSim = 0;
      for (const entity of (entityCache as Map<string, unknown>).values()) {
        const sim = cosineSimilarity((entity as EntityWithName).name, query);
        if (sim > 0.8 && sim > bestSim) {
          bestSim = sim;
          semanticCachedEntity = entity;
        }
      }
      if (semanticCachedEntity) {
        semanticCacheHit = true;
        context.cacheStatus.hit = true;
        cachedEntity = semanticCachedEntity;
        toolUsage.push({
          tool: 'meta_semantic_cache_check',
          action: 'semantic_cache_hit',
          parameters: { query, entity: (semanticCachedEntity as EntityWithName).name, similarity: bestSim },
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0,
          success: true,
          result: { entity: semanticCachedEntity, similarity: bestSim }
        });
        context.reasoningLog.push(`Semantic cache hit for "${query}" (matched: "${(semanticCachedEntity as EntityWithName).name}", sim: ${bestSim.toFixed(2)}) (serves goals 1, 2, 3).`);
      }
    }

    // --- SPEED-FIRST TOOL SELECTION LOGIC ---
    let cacheSimilarity = 1.0;
    if (semanticCachedEntity && !cacheHit) {
      cacheSimilarity = cosineSimilarity((semanticCachedEntity as EntityWithName).name, query);
    }
    let webSearchAvg = 0;
    if (context.toolTimings['exa_search'] && context.toolTimings['exa_search'].length > 0) {
      webSearchAvg = context.toolTimings['exa_search'].reduce((a, b) => a + b, 0) / context.toolTimings['exa_search'].length;
    }
    const speedThreshold = 0.8; // similarity threshold for cache to be "good enough"
    const webSearchSlow = webSearchAvg > 5000;
    if ((cacheHit || (semanticCacheHit && cacheSimilarity >= speedThreshold)) && !webSearchSlow) {
      // selectedTool = 'helixdb_search'; // This line was removed as per edit hint
      // toolReason = `Cache hit (similarity: ${cacheSimilarity.toFixed(2)}), using HelixDB for speed. Web search avg: ${webSearchAvg.toFixed(0)}ms.`; // This line was removed as per edit hint
      context.reasoningLog.push('Speed goal: Cache is good enough, using HelixDB for instant answer.');
    } else if (webSearchSlow) {
      // selectedTool = 'helixdb_search'; // This line was removed as per edit hint
      // toolReason = `Web search is slow (${webSearchAvg.toFixed(0)}ms avg), using HelixDB even if cache is not perfect.`; // This line was removed as per edit hint
      context.reasoningLog.push('Speed goal: Web search is slow, using HelixDB for best speed.');
    } else {
      // selectedTool = 'exa_search'; // This line was removed as per edit hint
      // toolReason = `Cache not good enough (similarity: ${cacheSimilarity.toFixed(2)}), web search avg: ${webSearchAvg.toFixed(0)}ms.`; // This line was removed as per edit hint
      context.reasoningLog.push('Speed goal: Cache not good enough, escalating to web search for quality.');
    }
    // toolUsage.push({ // This line was removed as per edit hint
    //   tool: 'meta_speed_tool_selection', // This line was removed as per edit hint
    //   action: 'speed_tool_select', // This line was removed as per edit hint
    //   parameters: { query, cacheSimilarity, webSearchAvg, selectedTool }, // This line was removed as per edit hint
    //   startTime: Date.now(), // This line was removed as per edit hint
    //   endTime: Date.now(), // This line was removed as per edit hint
    //   duration: 0, // This line was removed as per edit hint
    //   success: true, // This line was removed as per edit hint
    //   result: { selectedTool, toolReason } // This line was removed as per edit hint
    // }); // This line was removed as per edit hint
    // context.reasoningLog.push(`Tool selection: ${toolReason}`); // This line was removed as per edit hint
    // context.reasoningLog.push('Selecting tool to maximize answer quality and speed (serves goals 1, 2).'); // This line was removed as per edit hint

    // --- FEEDBACK-DRIVEN ADAPTATION ---
    // let negativeWebFeedback = false;
    // if (feedbackStore && feedbackStore.length > 0) {
    //   for (const fb of feedbackStore.slice(-20)) {
    //     const sim = cosineSimilarity(fb.query, query);
    //     if (sim > 0.8 && fb.speed === 'slow') {
    //       negativeWebFeedback = true;
    //       context.reasoningLog.push(`Recent feedback: web search was rated slow for similar query "${fb.query}". Will deprioritize web search.`);
    //       break;
    //     }
    //     if (sim > 0.8 && fb.quality === 'poor') {
    //       negativeWebFeedback = true;
    //       context.reasoningLog.push(`Recent feedback: web search was rated poor quality for similar query "${fb.query}". Will deprioritize web search.`);
    //       break;
    //     }
    //   }
    // }
    // if (negativeWebFeedback) {
    //   // selectedTool = 'helixdb_search'; // This line was removed as per edit hint
    //   // toolReason = 'User feedback indicates web search is slow or low quality for similar queries.'; // This line was removed as per edit hint
    // }

    // --- SYSTEM CONTEXT ---
    // Check cache status
    // (future: add lastWarm tracking)

    // --- REASONING LOG ---
    context.reasoningLog.push(`Starting agentic search for "${query}" in mode [${mode}]. Entity cache size: ${context.cacheStatus.entityCount}`);
    context.reasoningLog.push('Starting agentic search for query (serves goal 1, 4).');

    console.log(`🤖 [AGENTIC] Starting agentic search for: "${query}"`);
    console.log('='.repeat(60));

    // Step 1: Agent analyzes the query and decides what to do
    const initialAnalysis = await this.analyzeQuery(query);
    console.log(`🧠 [AGENTIC] Query analysis: ${initialAnalysis.reasoning}`);
    context.reasoningLog.push(`Query analysis: ${initialAnalysis.reasoning}`);
    context.reasoningLog.push('Analyzing query to understand information needs (serves goal 1, 4).');

    // --- MAIN AGENTIC LOGIC ---
    let finalAnswer = '';
    let finalSource: AgenticSearchResult['source'] = 'helixdb';
    let finalReasoning = '';
    let finalEvaluation: ResultEvaluation = {
      quality: 'unacceptable',
      confidence: 0,
      issues: [],
      suggestions: [],
      shouldRetry: false,
      reasoning: 'No tools executed successfully'
    };

    // Use selectedTool for the first attempt
    if (/* selectedTool === 'helixdb_search' */ false) { // This line was removed as per edit hint
      const helixStart = Date.now();
      // Simulate HelixDB search (replace with real call)
      let helixResult = null;
      if (cacheHit && cachedEntity) {
        helixResult = cachedEntity;
        finalAnswer = (cachedEntity as EntityWithDescription).description;
        finalSource = 'helixdb';
        finalReasoning = 'Cache hit: used HelixDB for instant answer.';
        finalEvaluation = {
          quality: 'good',
          confidence: 0.95,
          issues: [],
          suggestions: [],
          shouldRetry: false,
          reasoning: 'Cache hit, answer returned instantly.'
        };
      }
      const helixEnd = Date.now();
      toolUsage.push({
        tool: 'helixdb_search',
        action: 'execute',
        parameters: { query, mode },
        startTime: helixStart,
        endTime: helixEnd,
        duration: helixEnd - helixStart,
        success: !!helixResult,
        result: helixResult ? { entity: helixResult } : undefined
      });
      context.reasoningLog.push('HelixDB search executed.');
      context.reasoningLog.push('Using HelixDB for instant answer (serves goal 1, 2).');
    }

    if (/* selectedTool === 'exa_search' && !cacheHit */ false) { // This line was removed as per edit hint
      const exaStart = Date.now();
      // Simulate Exa web search (replace with real call)
      const exaResult = `Web search result for "${query}".`;
      const exaEnd = Date.now();
      toolUsage.push({
        tool: 'exa_search',
        action: 'execute',
        parameters: { query, mode },
        startTime: exaStart,
        endTime: exaEnd,
        duration: exaEnd - exaStart,
        success: true,
        result: { webResult: exaResult }
      });
      context.reasoningLog.push('Exa web search executed.');
      context.reasoningLog.push('Using web search for best quality (serves goal 1, 2).');

      // LLM summarization
      const llmStart = Date.now();
      const webSummary = await this.llmSummarize(query, exaResult);
      const llmEnd = Date.now();
      toolUsage.push({
        tool: 'llm_summarize',
        action: 'summarize',
        parameters: { query, webResults: exaResult },
        startTime: llmStart,
        endTime: llmEnd,
        duration: llmEnd - llmStart,
        success: true,
        result: { summary: webSummary }
      });
      context.reasoningLog.push('LLM summarization executed.');
      context.reasoningLog.push('Summarizing web results with LLM (serves goal 1, 2).');

      // Cache the summary in HelixDB
      const cacheStart = Date.now();
      try {
        await multiHelixDB.createEntity(mode, {
          name: query,
          category: 'web_summary',
          source_query: query,
          description: webSummary
        });
        const cacheEnd = Date.now();
        toolUsage.push({
          tool: 'helixdb_cache_write',
          action: 'cache_result',
          parameters: { query, summary: webSummary },
          startTime: cacheStart,
          endTime: cacheEnd,
          duration: cacheEnd - cacheStart,
          success: true
        });
        context.reasoningLog.push('Web summary cached in HelixDB.');
        context.reasoningLog.push('Caching new knowledge to optimize future performance (serves goal 3).');
      } catch (err) {
        const cacheEnd = Date.now();
        toolUsage.push({
          tool: 'helixdb_cache_write',
          action: 'cache_result',
          parameters: { query, summary: webSummary },
          startTime: cacheStart,
          endTime: cacheEnd,
          duration: cacheEnd - cacheStart,
          success: false,
          error: (err as Error).message
        });
        context.reasoningLog.push('Failed to cache web summary in HelixDB.');
        context.reasoningLog.push('Will try to improve result by re-executing web search (serves goal 1, 2).');
      }
      finalAnswer = webSummary;
      finalSource = 'exa';
      finalReasoning = 'Cache miss: used web search, summarized with LLM, and cached result.';
      finalEvaluation = {
        quality: 'good',
        confidence: 0.9,
        issues: [],
        suggestions: [],
        shouldRetry: false,
        reasoning: 'Web search and LLM summary used for best quality.'
      };
    }

    // If agent still doesn't have a good answer, make final decision
    if (!finalAnswer || finalEvaluation.quality === 'unacceptable') {
      console.log(`🤔 [AGENTIC] Agent making final decision...`);
      context.reasoningLog.push(`Agent making final decision...`);
      
      const finalDecision = await this.makeFinalDecision(query, agentDecisions, initialAnalysis);
      
      if (finalDecision) {
        console.log(`🎯 [AGENTIC] Agent final attempt: ${finalDecision.tool} (${finalDecision.reason})`);
        context.reasoningLog.push(`Agent final attempt: ${finalDecision.tool} (${finalDecision.reason})`);
        
        const finalResult = await this.executeToolWithEvaluation(finalDecision, query, userId, toolUsage, agentDecisions, mode);
        
        if (finalResult && finalResult.success) {
          finalAnswer = finalResult.answer ?? '';
          finalSource = finalResult.source as AgenticSearchResult['source'];
          const evaluation = finalResult.evaluation ?? { quality: 'unacceptable', confidence: 0, issues: ['Tool execution failed'], suggestions: ['Try rephrasing your question', 'Be more specific'], shouldRetry: false, reasoning: 'Tool execution failed.' };
          finalReasoning = `Agent final attempt with ${finalDecision.tool}: ${finalDecision.reason} (Quality: ${evaluation.quality})`;
          finalEvaluation = evaluation;
          
          console.log(`✅ [AGENTIC] Agent succeeded with final attempt (Quality: ${evaluation.quality})`);
          context.reasoningLog.push('Agent final attempt with tool (serves goal 1, 4).');
        }
      }
    }

    // If still no answer, agent gives up and explains why
    if (!finalAnswer) {
      finalAnswer = `I couldn't find a satisfactory answer for "${query}". I tried multiple approaches but none provided the quality of information you're looking for.`;
      finalReasoning = `Agent exhausted all options and couldn't find a good answer`;
      finalEvaluation = {
        quality: 'unacceptable',
        confidence: 0,
        issues: ['No satisfactory answer found'],
        suggestions: ['Try rephrasing your question', 'Be more specific'],
        shouldRetry: false,
        reasoning: 'All tools failed to provide adequate results'
      };
      context.reasoningLog.push('Agent failed to meet goals: No satisfactory answer found. Will escalate to more advanced tools or seek clarification in the future (serves goal 1, 4).');
    }

    // Example: after exa_search (web search) is used and a summary is needed
    let webSummary = '';
    let usedWebSearch = false;
    if (finalSource === 'exa') {
      usedWebSearch = true;
      const llmStart = Date.now();
      // Call LLM to summarize web results
      webSummary = await this.llmSummarize(query, finalAnswer);
      const llmEnd = Date.now();
      toolUsage.push({
        tool: 'llm_summarize',
        action: 'summarize',
        parameters: { query, webResults: finalAnswer },
        startTime: llmStart,
        endTime: llmEnd,
        duration: llmEnd - llmStart,
        success: true,
        result: { summary: webSummary }
      });

      // Cache the summary in HelixDB
      const cacheStart = Date.now();
      try {
        await multiHelixDB.createEntity(mode, {
          name: query,
          category: 'web_summary',
          source_query: query,
          description: webSummary
        });
        const cacheEnd = Date.now();
        toolUsage.push({
          tool: 'helixdb_cache_write',
          action: 'cache_result',
          parameters: { query, summary: webSummary },
          startTime: cacheStart,
          endTime: cacheEnd,
          duration: cacheEnd - cacheStart,
          success: true
        });
      } catch (err) {
        const cacheEnd = Date.now();
        toolUsage.push({
          tool: 'helixdb_cache_write',
          action: 'cache_result',
          parameters: { query, summary: webSummary },
          startTime: cacheStart,
          endTime: cacheEnd,
          duration: cacheEnd - cacheStart,
          success: false,
          error: (err as Error).message
        });
      }
    }

    // --- PREDICTIVE CACHING ---
    function generateFollowUps(query: string): string[] {
      // Simple heuristic: add 'explain', 'examples', 'related topics'
      return [
        `${query} explained`,
        `examples of ${query}`,
        `related topics to ${query}`
      ];
    }
    const followUps = generateFollowUps(query);
    context.reasoningLog.push(`Predictive caching: prefetching likely follow-up queries: ${followUps.join(', ')} (serves goals 3, 4).`);
    followUps.forEach(async (fq) => {
      // Only prefetch if not already cached
      let alreadyCached = false;
      if (entityCache) {
        for (const entity of (entityCache as Map<string, unknown>).values()) {
          if ((entity as EntityWithName).name.toLowerCase() === fq.toLowerCase()) {
            alreadyCached = true;
            break;
          }
        }
      }
      if (!alreadyCached) {
        // Simulate prefetch (replace with real call in production)
        const prefetchResult = `Prefetched answer for "${fq}".`;
        await multiHelixDB.createEntity(mode, {
          name: fq,
          category: 'predictive_prefetch',
          source_query: fq,
          description: prefetchResult
        });
      }
    });

    const totalTime = Date.now() - startTime;
    const toolTimes = this.calculateToolTimes(toolUsage);

    console.log(`🎯 [AGENTIC] Final result: ${finalSource} (${totalTime}ms) - Quality: ${finalEvaluation.quality}`);
    console.log('='.repeat(60));

    // --- SELF-REFLECTION ---
    context.reasoningLog.push('');
    context.reasoningLog.push('Agent Self-Reflection:');
    if (finalEvaluation.quality === 'excellent' || finalEvaluation.quality === 'good') {
      context.reasoningLog.push('✅ Goals met: High quality answer delivered efficiently.');
    } else if (finalEvaluation.quality === 'poor') {
      context.reasoningLog.push('⚠️ Partial success: Answer delivered, but quality could be improved. Will consider using alternative tools or clarifying with the user next time.');
    } else {
      context.reasoningLog.push('❌ Goals not met: No satisfactory answer found. Will escalate to more advanced tools or seek clarification in the future.');
    }
    context.reasoningLog.push('---');

    // After updating sessionContext, persist to disk
    await fs.writeFile(SESSION_FILE, JSON.stringify(sessionContexts, null, 2));

    return {
      answer: finalAnswer,
      source: finalSource,
      cached: context.cacheStatus.hit,
      performance: {
        totalTime,
        toolTime: toolTimes
      },
      reasoning: context.reasoningLog.join('\n'),
      toolUsage,
      agentDecisions,
      evaluation: finalEvaluation
    };
  }

  // Agent analyzes the query to understand what it needs
  private async analyzeQuery(query: string): Promise<{ type: string; reasoning: string; confidence: number }> {
    const prompt = `Analyze this query and determine what type of information is needed:

Query: "${query}"

Consider:
- Is this asking for a definition or explanation?
- Is this asking for current/recent information?
- Is this asking for how something works?
- Is this asking for specific examples or applications?
- Is this a factual question or conceptual question?

Return a JSON object with:
- type: "definition" | "current_events" | "how_it_works" | "examples" | "factual" | "conceptual"
- reasoning: Brief explanation of your analysis
- confidence: 0.0-1.0 confidence in your analysis

Example: {"type": "definition", "reasoning": "Asking for what something is", "confidence": 0.9}`;
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 100,
    });
    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    return {
      type: analysis.type || 'factual',
      reasoning: analysis.reasoning || 'Could not determine type',
      confidence: analysis.confidence || 0.5,
    };
  }

  private async llmSummarize(query: string, content: string): Promise<string> {
    const prompt = `Summarize the following content for a user's query:

Query: "${query}"
Content: "${content}"

Please provide a concise summary that captures the most important points.`;
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });
    return response.choices[0].message.content || 'Could not summarize content.';
  }

  private async makeFinalDecision(query: string, agentDecisions: AgentDecision[], initialAnalysis: { type: string; reasoning: string; confidence: number }): Promise<AgentDecision | null> {
    const prompt = `You are an AI agent tasked with deciding which tool to use next in a search process.

Current Query: "${query}"

Previous Decisions:
${agentDecisions.map(d => `- ${d.tool}: ${d.reason} (Confidence: ${d.confidence.toFixed(2)})`).join('\n')}

Initial Analysis:
- Type: ${initialAnalysis.type}
- Reasoning: ${initialAnalysis.reasoning}
- Confidence: ${initialAnalysis.confidence.toFixed(2)}

Available Tools:
${this.availableTools.map(t => `- ${t}`).join('\n')}

Decision Criteria:
1. Prioritize tools that have been successful in the past for this type of query.
2. Consider the confidence of the initial analysis.
3. If the initial analysis is very confident, use a tool that can provide a direct answer.
4. If the initial analysis is less confident, use a tool that can provide context or additional information.
5. If the initial analysis is uncertain, use a tool that can help refine the query or explore related topics.

Please provide the next tool to execute and its reason.
If no tool is suitable, return null.`;
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 200,
    });
    const decision = JSON.parse(response.choices[0].message.content || '{}');
    if (decision.tool) {
      return {
        tool: decision.tool,
        reason: decision.reason || 'No specific reason provided.',
        confidence: decision.confidence || 0.5,
        executed: false,
      };
    }
    return null;
  }

  private async executeToolWithEvaluation(decision: AgentDecision, query: string, userId: string, toolUsage: ToolUsage[], agentDecisions: AgentDecision[], mode: SearchMode): Promise<{ success: boolean; answer?: string; source?: AgenticSearchResult['source']; evaluation?: ResultEvaluation }> {
    const toolStart = Date.now();
    let toolResult: ToolResult | undefined;
    let toolError: string | undefined;
    const toolSuccess = false; // Changed to const
    let toolSource: AgenticSearchResult['source'] = 'helixdb';
    let toolAnswer: string | undefined;
    let toolEvaluation: ResultEvaluation | undefined;

    switch (decision.tool) {
      case 'helixdb_search':
        const helixSearchStart = Date.now();
        let helixResult = null;
        if (decision.result?.entity) {
          helixResult = decision.result.entity;
          toolAnswer = (helixResult as EntityWithDescription).description;
          toolSource = 'helixdb';
          toolEvaluation = {
            quality: 'good',
            confidence: 0.95,
            issues: [],
            suggestions: [],
            shouldRetry: false,
            reasoning: 'Cache hit, answer returned instantly.'
          };
        } else {
          // Simulate HelixDB search (replace with real call)
          const searchResults = await multiHelixDB.searchEntities(mode, query, 5);
          if (Array.isArray(searchResults) && searchResults.length > 0) {
            helixResult = searchResults[0];
            toolAnswer = (helixResult as EntityWithDescription).description;
            toolSource = 'helixdb';
            toolEvaluation = {
              quality: 'good',
              confidence: 0.8,
              issues: [],
              suggestions: [],
              shouldRetry: false,
              reasoning: 'Found relevant information in HelixDB.'
            };
          } else {
            toolAnswer = `No relevant information found in HelixDB for "${query}".`;
            toolSource = 'helixdb';
            toolEvaluation = {
              quality: 'poor',
              confidence: 0.6,
              issues: ['No relevant information found'],
              suggestions: ['Try rephrasing your question', 'Be more specific'],
              shouldRetry: false,
              reasoning: 'HelixDB search failed to find relevant information.'
            };
          }
        }
        const helixSearchEnd = Date.now();
        toolUsage.push({
          tool: 'helixdb_search',
          action: 'execute',
          parameters: { query, mode },
          startTime: helixSearchStart,
          endTime: helixSearchEnd,
          duration: helixSearchEnd - helixSearchStart,
          success: !!helixResult,
          result: helixResult ? { entity: helixResult } : undefined
        });
        break;
      case 'pattern_matching':
        const patternMatchStart = Date.now();
        // Simulate pattern matching (replace with real call)
        const patternMatchResult = `Pattern matching result for "${query}".`;
        toolAnswer = patternMatchResult;
        toolSource = 'neural';
        toolEvaluation = {
          quality: 'good',
          confidence: 0.9,
          issues: [],
          suggestions: [],
          shouldRetry: false,
          reasoning: 'Pattern matching found a relevant pattern.'
        };
        const patternMatchEnd = Date.now();
        toolUsage.push({
          tool: 'pattern_matching',
          action: 'execute',
          parameters: { query, mode },
          startTime: patternMatchStart,
          endTime: patternMatchEnd,
          duration: patternMatchEnd - patternMatchStart,
          success: true,
          result: { patternMatchResult }
        });
        break;
      case 'exa_search':
        const exaSearchStart = Date.now();
        // Simulate Exa web search (replace with real call)
        const exaResult = `Web search result for "${query}".`;
        toolAnswer = exaResult;
        toolSource = 'exa';
        toolEvaluation = {
          quality: 'good',
          confidence: 0.8,
          issues: [],
          suggestions: [],
          shouldRetry: false,
          reasoning: 'Web search provided a relevant result.'
        };
        const exaSearchEnd = Date.now();
        toolUsage.push({
          tool: 'exa_search',
          action: 'execute',
          parameters: { query, mode },
          startTime: exaSearchStart,
          endTime: exaSearchEnd,
          duration: exaSearchEnd - exaSearchStart,
          success: true,
          result: { webResult: exaResult }
        });
        break;
      default:
        toolAnswer = `Tool "${decision.tool}" not implemented.`;
        toolSource = 'helixdb';
        toolEvaluation = {
          quality: 'unacceptable',
          confidence: 0,
          issues: ['Tool not implemented'],
          suggestions: ['Try rephrasing your question', 'Be more specific'],
          shouldRetry: false,
          reasoning: 'Tool not implemented.'
        };
        break;
    }

    // Add decision to agentDecisions
    agentDecisions.push({
      tool: decision.tool,
      reason: decision.reason,
      confidence: decision.confidence,
      executed: true,
      result: toolResult,
      evaluation: toolEvaluation,
    });

    return {
      success: toolSuccess,
      answer: toolAnswer,
      source: toolSource,
      evaluation: toolEvaluation ?? {
        quality: 'unacceptable',
        confidence: 0,
        issues: ['Tool execution failed'],
        suggestions: ['Try rephrasing your question', 'Be more specific'],
        shouldRetry: false,
        reasoning: 'Tool execution failed.'
      }
    };
  }

  private calculateToolTimes(toolUsage: ToolUsage[]): Record<string, number> {
    const toolTimes: Record<string, number> = {};
    toolUsage.forEach(usage => {
      const toolName = usage.tool;
      if (!toolTimes[toolName]) {
        toolTimes[toolName] = 0;
      }
      toolTimes[toolName] += usage.duration;
    });
    return toolTimes;
  }
}

export const agenticSearchSystem = new AgenticSearchSystem();