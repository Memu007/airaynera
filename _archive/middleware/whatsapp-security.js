// Seguridad WhatsApp - Anti-injection y validación

const WHATSAPP_LIMITS = {
    maxMessageLength: 5000,
    maxMediaSize: 16 * 1024 * 1024, // 16MB
    allowedTypes: ['text', 'audio', 'image'],
    maxMessagesPerMinute: 30
};

// Sanitizar texto de WhatsApp
function sanitizeWhatsAppText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
        .slice(0, WHATSAPP_LIMITS.maxMessageLength)
        .replace(/[<>]/g, '') // Anti XSS
        .replace(/(\r\n|\n|\r){3,}/g, '\n\n') // Limitar saltos
        .replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u1E00-\u1EFF\n\r]/g, '') // Solo caracteres seguros
        .trim();
}

// Validar webhook de WhatsApp
function validateWhatsAppWebhook(req, res, next) {
    // Verificar token secreto
    const token = req.headers['x-webhook-token'] || req.query.hub_verify_token;
    const expectedToken = process.env.WHATSAPP_WEBHOOK_TOKEN || 'aira-webhook-2024';
    
    if (token !== expectedToken) {
        return res.status(403).json({ error: 'Token inválido' });
    }
    
    // Validar estructura del mensaje
    const { from, text, type } = req.body;
    
    if (!from || !type) {
        return res.status(400).json({ error: 'Mensaje inválido' });
    }
    
    if (!WHATSAPP_LIMITS.allowedTypes.includes(type)) {
        return res.status(400).json({ error: 'Tipo no soportado' });
    }
    
    // Sanitizar
    req.body.text = sanitizeWhatsAppText(text);
    req.body.from = from.replace(/[^\d+]/g, ''); // Solo números
    
    next();
}

// Protección contra prompt injection
function sanitizePrompt(prompt) {
    const blacklist = [
        'ignore previous',
        'disregard',
        'forget',
        'system prompt',
        'admin',
        'sudo',
        'execute',
        'eval',
        '<script',
        'javascript:'
    ];
    
    let clean = prompt.toLowerCase();
    for (const word of blacklist) {
        if (clean.includes(word)) {
            return 'Mensaje no permitido';
        }
    }
    
    return sanitizeWhatsAppText(prompt);
}

module.exports = {
    sanitizeWhatsAppText,
    validateWhatsAppWebhook,
    sanitizePrompt,
    WHATSAPP_LIMITS
};
