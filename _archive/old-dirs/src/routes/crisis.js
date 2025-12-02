const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/error');
const { validateCrisis } = require('../middleware/validation');
const Message = require('../models/message');
const whatsappService = require('../services/whatsapp');
const aiService = require('../services/ai');
const logger = require('../utils/logger');

// Report a crisis situation
router.post('/report',
    auth.verifyToken,
    validateCrisis.report,
    asyncHandler(async (req, res) => {
        const { messageId, severity, confidence, keywords, context } = req.body;

        const message = await Message.findById(messageId);
        if (!message) {
            throw new Error('Message not found');
        }

        // Update message with crisis data
        message.crisisDetected = true;
        message.crisisData = {
            severity,
            confidence,
            keywords,
            context,
            detectedAt: new Date()
        };
        await message.save();

        // Generate crisis response
        const response = await aiService.generateResponse(
            message.content,
            context
        );

        // Send crisis response via WhatsApp
        await whatsappService.sendMessage(
            message.recipient.toString(),
            response
        );

        // Log crisis detection
        logger.warn('Crisis situation reported', {
            messageId,
            severity,
            confidence,
            keywords,
            professionalId: req.user.id
        });

        res.json({
            message: 'Crisis situation reported successfully',
            data: {
                messageId,
                response
            }
        });
    })
);

// Get crisis history
router.get('/history',
    auth.verifyToken,
    asyncHandler(async (req, res) => {
        const { startDate, endDate, severity } = req.query;
        const query = {
            crisisDetected: true
        };

        if (startDate || endDate) {
            query['crisisData.detectedAt'] = {};
            if (startDate) {
                query['crisisData.detectedAt'].$gte = new Date(startDate);
            }
            if (endDate) {
                query['crisisData.detectedAt'].$lte = new Date(endDate);
            }
        }

        if (severity) {
            query['crisisData.severity'] = { $gte: parseFloat(severity) };
        }

        const crises = await Message.find(query)
            .sort({ 'crisisData.detectedAt': -1 })
            .populate('sender', 'name')
            .populate('recipient', 'name');

        res.json({
            crises
        });
    })
);

// Get crisis statistics
router.get('/stats',
    auth.verifyToken,
    asyncHandler(async (req, res) => {
        const { startDate, endDate } = req.query;
        const match = {
            crisisDetected: true
        };

        if (startDate || endDate) {
            match['crisisData.detectedAt'] = {};
            if (startDate) {
                match['crisisData.detectedAt'].$gte = new Date(startDate);
            }
            if (endDate) {
                match['crisisData.detectedAt'].$lte = new Date(endDate);
            }
        }

        const stats = await Message.aggregate([
            { $match: match },
            {
                $group: {
                    _id: {
                        year: { $year: '$crisisData.detectedAt' },
                        month: { $month: '$crisisData.detectedAt' },
                        day: { $dayOfMonth: '$crisisData.detectedAt' }
                    },
                    count: { $sum: 1 },
                    avgSeverity: { $avg: '$crisisData.severity' },
                    avgConfidence: { $avg: '$crisisData.confidence' }
                }
            },
            {
                $sort: {
                    '_id.year': 1,
                    '_id.month': 1,
                    '_id.day': 1
                }
            }
        ]);

        res.json({
            stats
        });
    })
);

module.exports = router; 