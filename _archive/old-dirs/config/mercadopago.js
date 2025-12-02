const mercadopago = require('mercadopago');

// Security: MercadoPago configuration - NO hardcoded tokens allowed
// Must use MP_ACCESS_TOKEN environment variable for security
const mpAccessToken = process.env.MP_ACCESS_TOKEN;

if (!mpAccessToken) {
    console.warn('⚠️ MercadoPago disabled: MP_ACCESS_TOKEN environment variable is required');
    // Return a disabled mock to prevent crashes
    module.exports = {
        configure: () => {},
        preferences: {
            create: () => Promise.reject(new Error('MercadoPago not configured'))
        },
        payment: {
            create: () => Promise.reject(new Error('MercadoPago not configured'))
        }
    };
} else {
    // Configure MercadoPago securely with environment variable
    mercadopago.configure({
        access_token: mpAccessToken
    });
    console.log('✅ MercadoPago configured securely');
    module.exports = mercadopago;
}
