"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processPDF = processPDF;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const CHUNK_SIZE = 1000; // characters per chunk
const CHUNK_OVERLAP = 200; // overlap between chunks
async function processPDF(filePath, filename) {
    const dataBuffer = fs_1.default.readFileSync(filePath);
    const pdfData = await (0, pdf_parse_1.default)(dataBuffer);
    const text = pdfData.text;
    const totalPages = pdfData.numpages;
    // Split text into chunks with page information
    const chunks = [];
    let currentPage = 1;
    let startIndex = 0;
    // Simple page splitting - in production, use better PDF parsing
    const textByPage = text.split(/\f/); // Form feed character
    let globalIndex = 0;
    for (let pageNum = 0; pageNum < textByPage.length; pageNum++) {
        const pageText = textByPage[pageNum];
        const pageLength = pageText.length;
        // Split page into chunks
        for (let i = 0; i < pageText.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
            const chunkText = pageText.slice(i, i + CHUNK_SIZE);
            if (chunkText.trim().length > 0) {
                chunks.push({
                    id: (0, uuid_1.v4)(),
                    text: chunkText,
                    page: pageNum + 1,
                    startIndex: globalIndex + i,
                    endIndex: globalIndex + Math.min(i + CHUNK_SIZE, pageLength),
                });
            }
        }
        globalIndex += pageLength;
    }
    const pdfId = (0, uuid_1.v4)();
    return {
        id: pdfId,
        filename,
        text,
        chunks,
        totalPages,
    };
}
