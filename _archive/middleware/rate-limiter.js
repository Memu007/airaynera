// Rate Limiter Simple pero Efectivo
const rateLimit = new Map();

const LIMITS = {
    api: { max: 100, window: 60000 }, // 100 req/min
    whatsapp: { max: 30, window: 60000 }, // 30 msg/min
    auth: { max: 5, window: 300000 } // 5 intentos/5min
};

function createRateLimiter(type = 'api') {
    const config = LIMITS[type] || LIMITS.api;
    
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!rateLimit.has(key)) {
            rateLimit.set(key, { count: 0, resetTime: now + config.window });
        }
        
        const limit = rateLimit.get(key);
        
        // Reset si pasó la ventana
        if (now > limit.resetTime) {
            limit.count = 0;
            limit.resetTime = now + config.window;
        }
        
        limit.count++;
        
        if (limit.count > config.max) {
            return res.status(429).json({ 
                error: 'Demasiadas solicitudes',
                retryAfter: Math.ceil((limit.resetTime - now) / 1000)
            });
        }
        
        next();
    };
}

// Limpiar mapa cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimit.entries()) {
        if (now > value.resetTime + 300000) {
            rateLimit.delete(key);
        }
    }
}, 300000);

module.exports = { createRateLimiter };
