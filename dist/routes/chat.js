"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatRouter = void 0;
const express_1 = __importDefault(require("express"));
const chatService_1 = require("../utils/chatService");
const router = express_1.default.Router();
exports.chatRouter = router;
router.post('/:pdfId', async (req, res) => {
    try {
        const { pdfId } = req.params;
        const { message, conversationHistory = [] } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        const response = await (0, chatService_1.generateChatResponse)(pdfId, message, conversationHistory);
        res.json(response);
    }
    catch (error) {
        console.error('Error generating chat response:', error);
        res.status(500).json({ error: error.message || 'Failed to generate response' });
    }
});
