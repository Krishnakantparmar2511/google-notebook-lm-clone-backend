import pdf from 'pdf-parse';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export interface PDFChunk {
  id: string;
  text: string;
  page: number;
  startIndex: number;
  endIndex: number;
}

export interface ProcessedPDF {
  id: string;
  filename: string;
  text: string;
  chunks: PDFChunk[];
  totalPages: number;
}

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export async function processPDF(filePath: string, filename: string): Promise<ProcessedPDF> {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  
  const text = pdfData.text;
  const totalPages = pdfData.numpages;
  
  const chunks: PDFChunk[] = [];
  let currentPage = 1;
  let startIndex = 0;
  
  const textByPage = text.split(/\f/);
  
  let globalIndex = 0;
  
  for (let pageNum = 0; pageNum < textByPage.length; pageNum++) {
    const pageText = textByPage[pageNum];
    const pageLength = pageText.length;
    
    for (let i = 0; i < pageText.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const chunkText = pageText.slice(i, i + CHUNK_SIZE);
      if (chunkText.trim().length > 0) {
        chunks.push({
          id: uuidv4(),
          text: chunkText,
          page: pageNum + 1,
          startIndex: globalIndex + i,
          endIndex: globalIndex + Math.min(i + CHUNK_SIZE, pageLength),
        });
      }
    }
    
    globalIndex += pageLength;
  }
  
  const pdfId = uuidv4();
  
  return {
    id: pdfId,
    filename,
    text,
    chunks,
    totalPages,
  };
}

