const express = require('express');
const mercadopago = require('../config/mercadopago');
const router = express.Router();

// Crear preferencia de pago
router.post('/create-preference', async (req, res) => {
    try {
        const { planType = 'mensual', userEmail, userName } = req.body;
        
        // Planes disponibles
        const plans = {
            mensual: {
                title: 'AIRA - Suscripción Mensual',
                unit_price: 15000, // $15.000 ARS
                quantity: 1,
                currency_id: 'ARS'
            },
            anual: {
                title: 'AIRA - Suscripción Anual (20% descuento)',
                unit_price: 144000, // $144.000 ARS
                quantity: 1,
                currency_id: 'ARS'
            }
        };
        
        // Crear la preferencia
        const preference = {
            items: [plans[planType]],
            
            payer: {
                name: userName || '',
                email: userEmail || ''
            },
            
            back_urls: {
                success: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-success`,
                failure: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-failure`,
                pending: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-pending`
            },
            
            auto_return: 'approved',
            
            payment_methods: {
                installments: 12, // Permitir hasta 12 cuotas
                default_installments: 1
            },
            
            statement_descriptor: "AIRA MEDICAL",
            
            metadata: {
                user_email: userEmail,
                plan_type: planType,
                timestamp: new Date().toISOString()
            }
        };
        
        const response = await mercadopago.preferences.create(preference);
        
        res.json({
            id: response.body.id,
            init_point: response.body.init_point,
            sandbox_init_point: response.body.sandbox_init_point
        });
        
    } catch (error) {
        console.error('Error creating payment preference:', error);
        res.status(500).json({ 
            error: 'Error al crear la preferencia de pago',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Webhook para recibir notificaciones de pago
router.post('/webhook', async (req, res) => {
    try {
        const payment = req.query;
        
        if (payment.type === 'payment') {
            const paymentId = payment['data.id'];
            
            // Obtener información del pago
            const paymentInfo = await mercadopago.payment.findById(paymentId);
            
            console.log('Payment received:', {
                id: paymentInfo.body.id,
                status: paymentInfo.body.status,
                email: paymentInfo.body.payer.email,
                amount: paymentInfo.body.transaction_amount
            });
            
            // Aquí activarías la cuenta del usuario según el estado del pago
            if (paymentInfo.body.status === 'approved') {
                // TODO: Activar cuenta del usuario
                console.log('Payment approved! Activate user account for:', paymentInfo.body.payer.email);
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Verificar estado de un pago
router.get('/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await mercadopago.payment.findById(paymentId);
        
        res.json({
            status: payment.body.status,
            status_detail: payment.body.status_detail,
            amount: payment.body.transaction_amount
        });
    } catch (error) {
        res.status(404).json({ error: 'Pago no encontrado' });
    }
});

module.exports = router;
const mercadopago = require('../config/mercadopago');
const router = express.Router();

// Crear preferencia de pago
router.post('/create-preference', async (req, res) => {
    try {
        const { planType = 'mensual', userEmail, userName } = req.body;
        
        // Planes disponibles
        const plans = {
            mensual: {
                title: 'AIRA - Suscripción Mensual',
                unit_price: 15000, // $15.000 ARS
                quantity: 1,
                currency_id: 'ARS'
            },
            anual: {
                title: 'AIRA - Suscripción Anual (20% descuento)',
                unit_price: 144000, // $144.000 ARS
                quantity: 1,
                currency_id: 'ARS'
            }
        };
        
        // Crear la preferencia
        const preference = {
            items: [plans[planType]],
            
            payer: {
                name: userName || '',
                email: userEmail || ''
            },
            
            back_urls: {
                success: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-success`,
                failure: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-failure`,
                pending: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-pending`
            },
            
            auto_return: 'approved',
            
            payment_methods: {
                installments: 12, // Permitir hasta 12 cuotas
                default_installments: 1
            },
            
            statement_descriptor: "AIRA MEDICAL",
            
            metadata: {
                user_email: userEmail,
                plan_type: planType,
                timestamp: new Date().toISOString()
            }
        };
        
        const response = await mercadopago.preferences.create(preference);
        
        res.json({
            id: response.body.id,
            init_point: response.body.init_point,
            sandbox_init_point: response.body.sandbox_init_point
        });
        
    } catch (error) {
        console.error('Error creating payment preference:', error);
        res.status(500).json({ 
            error: 'Error al crear la preferencia de pago',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Webhook para recibir notificaciones de pago
router.post('/webhook', async (req, res) => {
    try {
        const payment = req.query;
        
        if (payment.type === 'payment') {
            const paymentId = payment['data.id'];
            
            // Obtener información del pago
            const paymentInfo = await mercadopago.payment.findById(paymentId);
            
            console.log('Payment received:', {
                id: paymentInfo.body.id,
                status: paymentInfo.body.status,
                email: paymentInfo.body.payer.email,
                amount: paymentInfo.body.transaction_amount
            });
            
            // Aquí activarías la cuenta del usuario según el estado del pago
            if (paymentInfo.body.status === 'approved') {
                // TODO: Activar cuenta del usuario
                console.log('Payment approved! Activate user account for:', paymentInfo.body.payer.email);
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Verificar estado de un pago
router.get('/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await mercadopago.payment.findById(paymentId);
        
        res.json({
            status: payment.body.status,
            status_detail: payment.body.status_detail,
            amount: payment.body.transaction_amount
        });
    } catch (error) {
        res.status(404).json({ error: 'Pago no encontrado' });
    }
});

module.exports = router;
const mercadopago = require('../config/mercadopago');
const router = express.Router();

// Crear preferencia de pago
router.post('/create-preference', async (req, res) => {
    try {
        const { planType = 'mensual', userEmail, userName } = req.body;
        
        // Planes disponibles
        const plans = {
            mensual: {
                title: 'AIRA - Suscripción Mensual',
                unit_price: 15000, // $15.000 ARS
                quantity: 1,
                currency_id: 'ARS'
            },
            anual: {
                title: 'AIRA - Suscripción Anual (20% descuento)',
                unit_price: 144000, // $144.000 ARS
                quantity: 1,
                currency_id: 'ARS'
            }
        };
        
        // Crear la preferencia
        const preference = {
            items: [plans[planType]],
            
            payer: {
                name: userName || '',
                email: userEmail || ''
            },
            
            back_urls: {
                success: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-success`,
                failure: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-failure`,
                pending: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/payment-pending`
            },
            
            auto_return: 'approved',
            
            payment_methods: {
                installments: 12, // Permitir hasta 12 cuotas
                default_installments: 1
            },
            
            statement_descriptor: "AIRA MEDICAL",
            
            metadata: {
                user_email: userEmail,
                plan_type: planType,
                timestamp: new Date().toISOString()
            }
        };
        
        const response = await mercadopago.preferences.create(preference);
        
        res.json({
            id: response.body.id,
            init_point: response.body.init_point,
            sandbox_init_point: response.body.sandbox_init_point
        });
        
    } catch (error) {
        console.error('Error creating payment preference:', error);
        res.status(500).json({ 
            error: 'Error al crear la preferencia de pago',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Webhook para recibir notificaciones de pago
router.post('/webhook', async (req, res) => {
    try {
        const payment = req.query;
        
        if (payment.type === 'payment') {
            const paymentId = payment['data.id'];
            
            // Obtener información del pago
            const paymentInfo = await mercadopago.payment.findById(paymentId);
            
            console.log('Payment received:', {
                id: paymentInfo.body.id,
                status: paymentInfo.body.status,
                email: paymentInfo.body.payer.email,
                amount: paymentInfo.body.transaction_amount
            });
            
            // Aquí activarías la cuenta del usuario según el estado del pago
            if (paymentInfo.body.status === 'approved') {
                // TODO: Activar cuenta del usuario
                console.log('Payment approved! Activate user account for:', paymentInfo.body.payer.email);
            }
        }
        
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Verificar estado de un pago
router.get('/status/:paymentId', async (req, res) => {
    try {
        const { paymentId } = req.params;
        const payment = await mercadopago.payment.findById(paymentId);
        
        res.json({
            status: payment.body.status,
            status_detail: payment.body.status_detail,
            amount: payment.body.transaction_amount
        });
    } catch (error) {
        res.status(404).json({ error: 'Pago no encontrado' });
    }
});

module.exports = router;
