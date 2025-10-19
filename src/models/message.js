const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    content: {
        type: String,
        required: [true, 'Message content is required'],
        trim: true
    },
    type: {
        type: String,
        enum: ['text', 'image', 'document'],
        default: 'text'
    },
    metadata: {
        fileName: String,
        fileType: String,
        fileSize: Number,
        mimeType: String
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },
    crisisDetected: {
        type: Boolean,
        default: false
    },
    crisisData: {
        severity: Number,
        confidence: Number,
        keywords: [String],
        context: String,
        detectedAt: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
messageSchema.index({ sender: 1, recipient: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ crisisDetected: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message; 