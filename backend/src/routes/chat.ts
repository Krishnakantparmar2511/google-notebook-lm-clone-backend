import express, { Request, Response } from 'express';
import { generateChatResponse } from '../utils/chatService';

const router = express.Router();

router.post('/:pdfId', async (req, res) => {
  try {
    const { pdfId } = req.params;
    const { message, conversationHistory = [] } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const response = await generateChatResponse(pdfId, message, conversationHistory);
    
    res.json(response);
  } catch (error: any) {
    console.error('Error generating chat response:', error);
    
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
    
    res.status(500).json({ error: error.message || 'Failed to generate response' });
  }
});

export { router as chatRouter };

