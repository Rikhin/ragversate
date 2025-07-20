import OpenAI from 'openai';

export async function generateFollowUpQuestions(query: string): Promise<string[]> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate 3-5 relevant follow-up questions based on the user query. Make them specific and actionable.'
        },
        {
          role: 'user',
          content: `Based on this query: "${query}", generate follow-up questions.`
        }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const content = response.choices[0]?.message?.content || '';
    const questions = content
      .split('\n')
      .map(q => q.replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 0)
      .slice(0, 5);

    return questions.length > 0 ? questions : [
      'What specific aspect would you like to know more about?',
      'Would you like me to search for related information?',
      'Is there anything else you\'d like to explore on this topic?'
    ];
  } catch (error) {
    console.warn('Failed to generate follow-up questions:', error);
    return [
      'What specific aspect would you like to know more about?',
      'Would you like me to search for related information?',
      'Is there anything else you\'d like to explore on this topic?'
    ];
  }
} 