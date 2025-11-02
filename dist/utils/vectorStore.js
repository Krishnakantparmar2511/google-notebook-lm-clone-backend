"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
exports.storeVectors = storeVectors;
exports.searchSimilarChunks = searchSimilarChunks;
exports.getVectorsForPDF = getVectorsForPDF;
const openai_1 = __importDefault(require("openai"));
// Lazy initialization to ensure dotenv is loaded first
let openai = null;
function getOpenAIClient() {
    if (!openai) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required. Make sure .env file exists and contains OPENAI_API_KEY=sk-your-key-here');
        }
        openai = new openai_1.default({
            apiKey: apiKey,
        });
    }
    return openai;
}
const vectorStore = new Map();
async function generateEmbedding(text) {
    const client = getOpenAIClient();
    const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    });
    return response.data[0].embedding;
}
async function storeVectors(pdfId, chunks) {
    const vectors = [];
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
async function searchSimilarChunks(pdfId, query, topK = 5) {
    const queryEmbedding = await generateEmbedding(query);
    const vectors = vectorStore.get(pdfId) || [];
    // Calculate cosine similarity
    const similarities = vectors.map((doc) => {
        const score = cosineSimilarity(queryEmbedding, doc.embedding);
        return {
            chunk: doc.chunk,
            score,
        };
    });
    // Sort by similarity and return top K
    similarities.sort((a, b) => b.score - a.score);
    return similarities.slice(0, topK);
}
function cosineSimilarity(a, b) {
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
function getVectorsForPDF(pdfId) {
    return vectorStore.get(pdfId) || [];
}
