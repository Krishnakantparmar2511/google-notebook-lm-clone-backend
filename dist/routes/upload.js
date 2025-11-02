"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRouter = void 0;
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const pdfProcessor_1 = require("../utils/pdfProcessor");
const vectorStore_1 = require("../utils/vectorStore");
const router = express_1.default.Router();
exports.uploadRouter = router;
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        }
        else {
            cb(new Error('Only PDF files are allowed'));
        }
    },
});
// Store processed PDFs in memory (in production, use a database)
const processedPDFs = new Map();
router.post('/', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const filePath = req.file.path;
        const filename = req.file.originalname;
        console.log(`Processing PDF: ${filename}`);
        // Process PDF
        const processedPDF = await (0, pdfProcessor_1.processPDF)(filePath, filename);
        // Store vectors
        await (0, vectorStore_1.storeVectors)(processedPDF.id, processedPDF.chunks);
        // Store processed PDF metadata
        processedPDFs.set(processedPDF.id, processedPDF);
        res.json({
            pdfId: processedPDF.id,
            filename: processedPDF.filename,
            totalPages: processedPDF.totalPages,
            url: `/uploads/${req.file.filename}`,
        });
    }
    catch (error) {
        console.error('Error processing PDF:', error);
        res.status(500).json({ error: error.message || 'Failed to process PDF' });
    }
});
router.get('/:pdfId', (req, res) => {
    const { pdfId } = req.params;
    const pdf = processedPDFs.get(pdfId);
    if (!pdf) {
        return res.status(404).json({ error: 'PDF not found' });
    }
    res.json({
        pdfId: pdf.id,
        filename: pdf.filename,
        totalPages: pdf.totalPages,
    });
});
