import OpenAI from 'openai';
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

interface VectorDocument {
  id: string;
  embedding: number[];
  chunk: PDFChunk;
  pdfId: string;
}

const vectorStore: Map<string, VectorDocument[]> = new Map();

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error: any) {
    if (error.status === 429) {
      throw new Error('OpenAI API quota exceeded. Please check your billing at https://platform.openai.com/account/billing');
    }
    if (error.status === 401) {
      throw new Error('OpenAI API key is invalid. Please check your API key in .env file');
    }
    throw new Error(`OpenAI API error: ${error.message || 'Unknown error'}`);
  }
}

export async function storeVectors(pdfId: string, chunks: PDFChunk[]): Promise<void> {
  const vectors: VectorDocument[] = [];
  
  for (const chunk of chunks) {
    const embedding = await generateEmbedding(chunk.text);
    vectors.push({
      id: chunk.id,
      embedding,
      chunk,
      pdfId,
    });
  }
  
  vectorStore.set(pdfId, vectors);
  console.log(`Stored ${vectors.length} vectors for PDF ${pdfId}`);
}

export async function searchSimilarChunks(
  pdfId: string,
  query: string,
  topK: number = 5
): Promise<Array<{ chunk: PDFChunk; score: number }>> {
  const queryEmbedding = await generateEmbedding(query);
  const vectors = vectorStore.get(pdfId) || [];
  
  const similarities = vectors.map((doc) => {
    const score = cosineSimilarity(queryEmbedding, doc.embedding);
    return {
      chunk: doc.chunk,
      score,
    };
  });
  
  similarities.sort((a, b) => b.score - a.score);
  return similarities.slice(0, topK);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function getVectorsForPDF(pdfId: string): VectorDocument[] {
  return vectorStore.get(pdfId) || [];
}

