const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { validateMessage } = require('../middleware/validation');
const Message = require('../models/message');
const whatsappService = require('../services/whatsapp');
const aiService = require('../services/ai');

// Send a message
router.post('/',
    auth.verifyToken,
    validateMessage.create,
    asyncHandler(async (req, res) => {
        const { content, recipientId, type, metadata } = req.body;

        // Create message in database
        const message = await Message.create({
            content,
            type,
            metadata,
            sender: req.user.id,
            recipient: recipientId
        });

        // Send message via WhatsApp
        await whatsappService.sendMessage(recipientId, content);

        // Analyze message for crisis indicators
        const analysis = await aiService.analyzeMessage(content);
        
        if (analysis.crisisDetected) {
            message.crisisDetected = true;
            message.crisisData = {
                severity: analysis.severity,
                confidence: analysis.confidence,
                keywords: analysis.keywords,
                context: analysis.context,
                detectedAt: new Date()
            };
            await message.save();

            // Generate crisis response
            const response = await aiService.generateResponse(content, analysis.context);
            await whatsappService.sendMessage(recipientId, response);
        }

        res.status(201).json({
            message: 'Message sent successfully',
            data: message
        });
    })
);

// Get message history
router.get('/',
    auth.verifyToken,
    asyncHandler(async (req, res) => {
        const { recipientId, limit = 50, before } = req.query;
        const query = {
            $or: [
                { sender: req.user.id, recipient: recipientId },
                { sender: recipientId, recipient: req.user.id }
            ]
        };

        if (before) {
            query.createdAt = { $lt: new Date(before) };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('sender', 'name')
            .populate('recipient', 'name');

        res.json({
            messages: messages.reverse()
        });
    })
);

// Get message by ID
router.get('/:id',
    auth.verifyToken,
    asyncHandler(async (req, res) => {
        const message = await Message.findById(req.params.id)
            .populate('sender', 'name')
            .populate('recipient', 'name');

        if (!message) {
            throw new Error('Message not found');
        }

        // Check if user is authorized to view the message
        if (message.sender._id.toString() !== req.user.id && 
            message.recipient._id.toString() !== req.user.id) {
            throw new Error('Unauthorized');
        }

        res.json({
            message
        });
    })
);

// Get conversation summary
router.get('/:recipientId/summary',
    auth.verifyToken,
    asyncHandler(async (req, res) => {
        const messages = await Message.find({
            $or: [
                { sender: req.user.id, recipient: req.params.recipientId },
                { sender: req.params.recipientId, recipient: req.user.id }
            ]
        })
        .sort({ createdAt: 1 })
        .populate('sender', 'name')
        .populate('recipient', 'name');

        const summary = await aiService.summarizeConversation(messages);

        res.json({
            summary
        });
    })
);

module.exports = router; 