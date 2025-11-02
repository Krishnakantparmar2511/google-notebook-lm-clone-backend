"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChatResponse = generateChatResponse;
const openai_1 = __importDefault(require("openai"));
const vectorStore_1 = require("./vectorStore");
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
async function generateChatResponse(pdfId, query, conversationHistory = []) {
    // Search for relevant chunks
    const similarChunks = await (0, vectorStore_1.searchSimilarChunks)(pdfId, query, 5);
    if (similarChunks.length === 0) {
        return {
            response: "I couldn't find relevant information in the PDF to answer your question. Please make sure the PDF has been processed and try again.",
            citations: [],
        };
    }
    // Build context from relevant chunks
    const context = similarChunks
        .map((item, index) => `[${index + 1}] Page ${item.chunk.page}: ${item.chunk.text.substring(0, 500)}...`)
        .join('\n\n');
    // Build system prompt
    const systemPrompt = `You are a helpful assistant that answers questions about PDF documents. Use the provided context to answer questions accurately. When referencing information, cite the page numbers from the context. Keep responses concise and efficient.`;
    // Build user message with context
    const contextMessage = `Context from PDF:
${context}

User Question: ${query}

Please answer the question using the context above. Include page citations in your response when referencing specific information.`;
    // Prepare messages
    const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-5), // Keep last 5 messages for context
        { role: 'user', content: contextMessage },
    ];
    // Generate response
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500,
    });
    const response = completion.choices[0].message?.content || 'Sorry, I could not generate a response.';
    // Extract citations from response and match with chunks
    const citations = [];
    const uniquePages = new Set();
    // Find page references in response
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
    // If no page references found, use pages from top chunks
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
