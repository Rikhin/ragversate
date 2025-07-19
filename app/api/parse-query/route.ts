import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  const { query } = await req.json();

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at refining user queries for a semantic vector search engine. Your task is to convert the user query into a concise, clear natural language search string. Remove conversational filler and focus on the core intent. Return only the plain text string.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
    });

    const searchString = response.choices[0].message.content;

    if (searchString) {
      return new NextResponse(searchString, {
        headers: { 'Content-Type': 'text/plain' },
      });
    } else {
      return NextResponse.json(
        { error: 'Could not generate a search string from the query.' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request.' },
      { status: 500 }
    );
  }
} 