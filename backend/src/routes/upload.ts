import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { processPDF } from '../utils/pdfProcessor';
import { storeVectors } from '../utils/vectorStore';

const router = express.Router();

const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

const processedPDFs: Map<string, any> = new Map();

router.post('/', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const filename = req.file.originalname;
    
    console.log(`Processing PDF: ${filename}`);
    
    const processedPDF = await processPDF(filePath, filename);
    
    await storeVectors(processedPDF.id, processedPDF.chunks);
    
    processedPDFs.set(processedPDF.id, processedPDF);
    
    res.json({
      pdfId: processedPDF.id,
      filename: processedPDF.filename,
      totalPages: processedPDF.totalPages,
      url: `/uploads/${req.file.filename}`,
    });
  } catch (error: any) {
    console.error('Error processing PDF:', error);
    
    if (error.message && error.message.includes('quota')) {
      return res.status(402).json({ 
        error: 'OpenAI API quota exceeded. Please add credits at https://platform.openai.com/account/billing',
        type: 'QUOTA_EXCEEDED'
      });
    }
    
    if (error.message && error.message.includes('OpenAI API')) {
      return res.status(500).json({ 
        error: error.message,
        type: 'OPENAI_ERROR'
      });
    }
    
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

export { router as uploadRouter };

