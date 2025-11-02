import OpenAI from 'openai';
import { searchSimilarChunks } from './vectorStore';
import { PDFChunk } from './pdfProcessor';

let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required. Make sure .env file exists and contains OPENAI_API_KEY=sk-your-key-here');
    }
    openai = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openai;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  response: string;
  citations: Array<{
    page: number;
    text: string;
  }>;
}

export async function generateChatResponse(
  pdfId: string,
  query: string,
  conversationHistory: ChatMessage[] = []
): Promise<ChatResponse> {
  const similarChunks = await searchSimilarChunks(pdfId, query, 5);
  
  if (similarChunks.length === 0) {
    return {
      response: "I couldn't find relevant information in the PDF to answer your question. Please make sure the PDF has been processed and try again.",
      citations: [],
    };
  }
  
  const context = similarChunks
    .map((item, index) => `[${index + 1}] Page ${item.chunk.page}: ${item.chunk.text.substring(0, 500)}...`)
    .join('\n\n');
  
  const systemPrompt = `You are a helpful assistant that answers questions about PDF documents. Use the provided context to answer questions accurately. When referencing information, cite the page numbers from the context. Keep responses concise and efficient.`;
  
  const contextMessage = `Context from PDF:
${context}

User Question: ${query}

Please answer the question using the context above. Include page citations in your response when referencing specific information.`;
  
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-5),
    { role: 'user', content: contextMessage },
  ];
  
  const client = getOpenAIClient();
  let completion;
  try {
    completion = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages as any,
      temperature: 0.7,
      max_tokens: 500,
    });
  } catch (error: any) {
    if (error.status === 429) {
      throw new Error('OpenAI API quota exceeded. Please check your billing and add credits at https://platform.openai.com/account/billing');
    }
    if (error.status === 401) {
      throw new Error('OpenAI API key is invalid. Please check your API key in .env file');
    }
    throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
  }
  
  const response = completion.choices[0].message?.content || 'Sorry, I could not generate a response.';
  
  const citations: Array<{ page: number; text: string }> = [];
  const uniquePages = new Set<number>();
  
  const pageRegex = /page\s+(\d+)/gi;
  let match;
  while ((match = pageRegex.exec(response)) !== null) {
    const pageNum = parseInt(match[1]);
    if (!uniquePages.has(pageNum)) {
      uniquePages.add(pageNum);
      const chunk = similarChunks.find(item => item.chunk.page === pageNum);
      if (chunk) {
        citations.push({
          page: pageNum,
          text: chunk.chunk.text.substring(0, 200),
        });
      }
    }
  }
  
  if (citations.length === 0 && similarChunks.length > 0) {
    similarChunks.slice(0, 3).forEach(item => {
      if (!uniquePages.has(item.chunk.page)) {
        uniquePages.add(item.chunk.page);
        citations.push({
          page: item.chunk.page,
          text: item.chunk.text.substring(0, 200),
        });
      }
    });
  }
  
  return {
    response,
    citations: citations.sort((a, b) => a.page - b.page),
  };
}

