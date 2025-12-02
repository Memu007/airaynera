const { OpenAI } = require('openai');
const config = require('../config/config');
const logger = require('../utils/logger');

class AIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: config.openai.apiKey
        });
    }

    async analyzeMessage(message) {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a mental health crisis detection AI. Analyze the following message for potential crisis indicators.
                        Consider:
                        1. Suicidal ideation
                        2. Self-harm
                        3. Panic attacks
                        4. Emergency situations
                        5. High levels of distress
                        
                        Respond with a JSON object containing:
                        {
                            "crisisDetected": boolean,
                            "severity": number (0-1),
                            "confidence": number (0-1),
                            "keywords": string[],
                            "context": string
                        }`
                    },
                    {
                        role: "user",
                        content: message
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            const analysis = JSON.parse(response.choices[0].message.content);

            logger.info('Message analysis completed', {
                crisisDetected: analysis.crisisDetected,
                severity: analysis.severity,
                confidence: analysis.confidence
            });

            return analysis;
        } catch (error) {
            logger.error('Error analyzing message', {
                error: error.message,
                message
            });
            throw error;
        }
    }

    async generateResponse(message, context) {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a mental health professional's AI assistant. Generate a supportive and professional response.
                        Consider:
                        1. The context of the conversation
                        2. The severity of the situation
                        3. Professional boundaries
                        4. Crisis intervention protocols
                        
                        Keep responses concise, empathetic, and actionable.`
                    },
                    {
                        role: "user",
                        content: `Context: ${context}\nMessage: ${message}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 200
            });

            const generatedResponse = response.choices[0].message.content;

            logger.info('Response generated successfully', {
                messageLength: message.length,
                responseLength: generatedResponse.length
            });

            return generatedResponse;
        } catch (error) {
            logger.error('Error generating response', {
                error: error.message,
                message,
                context
            });
            throw error;
        }
    }

    async summarizeConversation(messages) {
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a mental health professional's AI assistant. Create a concise summary of the conversation.
                        Include:
                        1. Key points discussed
                        2. Any concerns raised
                        3. Action items or recommendations
                        4. Crisis indicators (if any)
                        
                        Keep the summary professional and focused on relevant clinical information.`
                    },
                    {
                        role: "user",
                        content: JSON.stringify(messages)
                    }
                ],
                temperature: 0.5,
                max_tokens: 500
            });

            const summary = response.choices[0].message.content;

            logger.info('Conversation summarized successfully', {
                messageCount: messages.length,
                summaryLength: summary.length
            });

            return summary;
        } catch (error) {
            logger.error('Error summarizing conversation', {
                error: error.message,
                messageCount: messages.length
            });
            throw error;
        }
    }
}

module.exports = new AIService(); 