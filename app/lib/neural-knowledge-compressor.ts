import OpenAI from 'openai';
import { helixDB } from './helixdb';

// Neural Knowledge Compression System
// Learns patterns and relationships from search data to enable ChatGPT-like reasoning

export interface CompressedKnowledge {
  concept: string;
  relationships: string[];
  patterns: string[];
  reasoning: string[];
  confidence: number;
  lastUpdated: number;
}

export interface KnowledgePattern {
  query: string;
  entities: string[];
  relationships: string[];
  reasoning: string;
  confidence: number;
}

export interface NeuralResponse {
  answer: string;
  reasoning: string;
  confidence: number;
  source: 'neural' | 'search' | 'hybrid';
  patterns: string[];
}

// Define a type guard for analysis
function isAnalysis(obj: unknown): obj is { confidence?: number; concepts?: string[]; relationships?: unknown[]; reasoning?: string[] } {
  return typeof obj === 'object' && obj !== null;
}

class NeuralKnowledgeCompressor {
  private openai: OpenAI;
  private knowledgeCache = new Map<string, CompressedKnowledge>();
  private patternCache = new Map<string, KnowledgePattern[]>();
  private readonly CACHE_TTL = 86400000; // 24 hours

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // Learn from search results and compress knowledge
  async learnFromSearch(query: string, searchResults: unknown[], answer: string): Promise<void> {
    try {
      console.log('🧠 [NEURAL] Learning from search results...');
      
      // Extract entities and relationships
      const entities = searchResults.map(r => r.name || r.title).filter(Boolean);
      const descriptions = searchResults.map(r => r.description || r.text).filter(Boolean);
      
      // Analyze patterns and relationships
      const analysis = await this.analyzePatterns(query, entities, descriptions, answer);
      
      // Compress knowledge into neural representations
      const compressed = await this.compressKnowledge(query, analysis);
      
      // Store compressed knowledge
      this.storeCompressedKnowledge(query, compressed);
      
      // Update pattern cache
      this.updatePatternCache(query, analysis);
      
      console.log('✅ [NEURAL] Knowledge compressed and stored');
      
    } catch (error) {
      console.warn('⚠️ [NEURAL] Failed to learn from search:', error);
    }
  }

  // Generate neural response using compressed knowledge
  async generateNeuralResponse(query: string): Promise<NeuralResponse | null> {
    try {
      console.log('🧠 [NEURAL] Generating neural response...');
      
      // Find relevant compressed knowledge
      const relevantKnowledge = this.findRelevantKnowledge(query);
      
      if (relevantKnowledge.length === 0) {
        return null; // No relevant knowledge found
      }
      
      // Generate response using neural patterns
      const response = await this.generateFromPatterns(query, relevantKnowledge);
      
      console.log('✅ [NEURAL] Neural response generated');
      return response;
      
    } catch (error) {
      console.warn('⚠️ [NEURAL] Failed to generate neural response:', error);
      return null;
    }
  }

  // Analyze patterns in search results
  private async analyzePatterns(query: string, entities: string[], descriptions: string[], answer: string): Promise<unknown> {
    const prompt = `
Analyze the following search results and extract patterns, relationships, and reasoning:

Query: "${query}"
Entities: ${entities.join(', ')}
Descriptions: ${descriptions.slice(0, 3).join('\n')}
Answer: ${answer}

Extract:
1. Key concepts and their relationships
2. Reasoning patterns used
3. Inferred knowledge that could apply to similar queries
4. Confidence level in the patterns

Format as JSON with keys: concepts, relationships, reasoning, confidence
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a knowledge pattern analyzer. Extract meaningful patterns and relationships from search results.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 500
    });

    try {
      return JSON.parse(response.choices[0].message.content || '{}');
    } catch {
      return { concepts: [], relationships: [], reasoning: [], confidence: 0.5 };
    }
  }

  // Compress knowledge into neural representations
  private async compressKnowledge(query: string, analysis: unknown): Promise<CompressedKnowledge> {
    const prompt = `
Compress the following knowledge into a neural representation that can be used for reasoning:

Query: "${query}"
Analysis: ${JSON.stringify(analysis)}

Create a compressed knowledge representation that includes:
1. Core concept
2. Key relationships
3. Reasoning patterns
4. Confidence level

This should be reusable for similar queries and enable reasoning without re-searching.
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a knowledge compression expert. Create compact, reusable knowledge representations.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 300
    });

    const content = response.choices[0].message.content || '';
    
    return {
      concept: this.extractConcept(content),
      relationships: this.extractRelationships(content),
      patterns: this.extractPatterns(content),
      reasoning: this.extractReasoning(content),
      confidence: isAnalysis(analysis) ? analysis.confidence || 0.5 : 0.5,
      lastUpdated: Date.now()
    };
  }

  // Generate response from neural patterns
  private async generateFromPatterns(query: string, knowledge: CompressedKnowledge[]): Promise<NeuralResponse> {
    const prompt = `
Generate a response using the following compressed knowledge patterns:

Query: "${query}"

Relevant Knowledge:
${knowledge.map(k => `
Concept: ${k.concept}
Relationships: ${k.relationships.join(', ')}
Patterns: ${k.patterns.join(', ')}
Reasoning: ${k.reasoning.join(', ')}
Confidence: ${k.confidence}
`).join('\n')}

Generate a natural, contextual response that:
1. Uses the compressed knowledge patterns
2. Applies reasoning chains
3. Provides a confident, accurate answer
4. Explains the reasoning used

Format as JSON with keys: answer, reasoning, confidence, patterns
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a neural reasoning system. Generate responses using compressed knowledge patterns.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 400
    });

    try {
      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        answer: result.answer || 'Unable to generate neural response.',
        reasoning: result.reasoning || 'No reasoning available.',
        confidence: result.confidence || 0.5,
        source: 'neural',
        patterns: result.patterns || []
      };
    } catch {
      return {
        answer: 'Unable to generate neural response.',
        reasoning: 'Pattern parsing failed.',
        confidence: 0.1,
        source: 'neural',
        patterns: []
      };
    }
  }

  // Find relevant compressed knowledge for a query
  private findRelevantKnowledge(query: string): CompressedKnowledge[] {
    const relevant: CompressedKnowledge[] = [];
    
    for (const [key, knowledge] of this.knowledgeCache.entries()) {
      // Check if knowledge is still valid
      if (Date.now() - knowledge.lastUpdated > this.CACHE_TTL) {
        this.knowledgeCache.delete(key);
        continue;
      }
      
      // Simple relevance check (could be enhanced with embeddings)
      const relevance = this.calculateRelevance(query, knowledge);
      if (relevance > 0.3) { // 30% relevance threshold
        relevant.push(knowledge);
      }
    }
    
    // Sort by relevance and confidence
    return relevant.sort((a, b) => {
      const relevanceA = this.calculateRelevance(query, a);
      const relevanceB = this.calculateRelevance(query, b);
      return (relevanceB * b.confidence) - (relevanceA * a.confidence);
    }).slice(0, 3); // Top 3 most relevant
  }

  // Calculate relevance between query and knowledge
  private calculateRelevance(query: string, knowledge: CompressedKnowledge): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const conceptWords = knowledge.concept.toLowerCase().split(/\s+/);
    const relationshipWords = knowledge.relationships.join(' ').toLowerCase().split(/\s+/);
    
    let matches = 0;
    const totalWords = queryWords.length;
    
    for (const word of queryWords) {
      if (conceptWords.includes(word) || relationshipWords.includes(word)) {
        matches++;
      }
    }
    
    return matches / totalWords;
  }

  // Store compressed knowledge
  private storeCompressedKnowledge(query: string, knowledge: CompressedKnowledge): void {
    const key = this.generateKnowledgeKey(query);
    this.knowledgeCache.set(key, knowledge);
    
    // Also store in HelixDB for persistence
    this.storeInHelixDB(query, knowledge);
  }

  // Store in HelixDB for persistence
  private async storeInHelixDB(query: string, knowledge: CompressedKnowledge): Promise<void> {
    try {
      await helixDB.createEntityWithDeduplication({
        name: `neural_knowledge_${query}`,
        category: 'neural_knowledge',
        source_query: query,
        description: JSON.stringify(knowledge)
      });
    } catch (error) {
      console.warn('⚠️ [NEURAL] Failed to store in HelixDB:', error);
    }
  }

  // Update pattern cache
  private updatePatternCache(query: string, analysis: unknown): void {
    const pattern: KnowledgePattern = {
      query,
      entities: isAnalysis(analysis) ? analysis.concepts || [] : [],
      relationships: isAnalysis(analysis) ? analysis.relationships || [] : [],
      reasoning: isAnalysis(analysis) ? analysis.reasoning || [] : [],
      confidence: isAnalysis(analysis) ? analysis.confidence || 0.5 : 0.5
    };
    
    const key = this.generatePatternKey(query);
    const patterns = this.patternCache.get(key) || [];
    patterns.push(pattern);
    
    // Keep only recent patterns
    if (patterns.length > 10) {
      patterns.shift();
    }
    
    this.patternCache.set(key, patterns);
  }

  // Helper methods for extracting information
  private extractConcept(content: string): string {
    const match = content.match(/concept[:\s]+([^\n,]+)/i);
    return match ? match[1].trim() : 'Unknown concept';
  }

  private extractRelationships(content: string): string[] {
    const match = content.match(/relationships[:\s]+([^\n]+)/i);
    if (!match) return [];
    return match[1].split(',').map(r => r.trim()).filter(Boolean);
  }

  private extractPatterns(content: string): string[] {
    const match = content.match(/patterns[:\s]+([^\n]+)/i);
    if (!match) return [];
    return match[1].split(',').map(p => p.trim()).filter(Boolean);
  }

  private extractReasoning(content: string): string[] {
    const match = content.match(/reasoning[:\s]+([^\n]+)/i);
    if (!match) return [];
    return match[1].split(',').map(r => r.trim()).filter(Boolean);
  }

  private generateKnowledgeKey(query: string): string {
    return Buffer.from(query.toLowerCase()).toString('base64').substring(0, 32);
  }

  private generatePatternKey(query: string): string {
    return Buffer.from(query.toLowerCase()).toString('base64').substring(0, 32);
  }

  // Get statistics
  getStats() {
    return {
      knowledgeCount: this.knowledgeCache.size,
      patternCount: this.patternCache.size,
      totalKnowledge: Array.from(this.knowledgeCache.values()).length
    };
  }

  // Clear old knowledge
  cleanup(): void {
    const now = Date.now();
    for (const [key, knowledge] of this.knowledgeCache.entries()) {
      if (now - knowledge.lastUpdated > this.CACHE_TTL) {
        this.knowledgeCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const neuralKnowledgeCompressor = new NeuralKnowledgeCompressor(); 