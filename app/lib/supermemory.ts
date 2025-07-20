import Supermemory from 'supermemory';

const client = new Supermemory({
  apiKey: process.env['SUPERMEMORY_API_KEY'],
});

export async function addFeedbackMemory({ userId, content, quality, speed, comments }: {
  userId: string;
  content: string;
  quality: string;
  speed: string;
  comments?: string;
}) {
  try {
    return await client.memory.create({
      content,
      userId,
      metadata: { type: 'feedback', quality, speed, comments },
      containerTags: [userId, 'feedback']
    });
  } catch (e) {
    console.error('Supermemory addFeedbackMemory error:', e);
    throw e;
  }
}

export async function addSessionContextMemory({ userId, content, contextType, metadata }: {
  userId: string;
  content: string;
  contextType?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await client.memory.create({
      content,
      userId,
      metadata: { type: 'session_context', contextType, ...metadata },
      containerTags: [userId, 'session_context']
    });
  } catch (e) {
    console.error('Supermemory addSessionContextMemory error:', e);
    throw e;
  }
}

export async function searchMemories({ userId, query, tags, limit = 10 }: {
  userId: string;
  query: string;
  tags?: string[];
  limit?: number;
}) {
  try {
    return await client.search.execute({
      q: query,
      userId,
      containerTags: [userId, ...(tags || [])],
      limit
    });
  } catch (e) {
    console.error('Supermemory searchMemories error:', e);
    throw e;
  }
}

export async function listMemories({ userId, tags, limit = 100 }: {
  userId: string;
  tags?: string[];
  limit?: number;
}) {
  try {
    return await client.memory.list({
      containerTags: [userId, ...(tags || [])],
      limit
    });
  } catch (e) {
    console.error('Supermemory listMemories error:', e);
    throw e;
  }
} 