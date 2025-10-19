# Integración de MercadoPago en AIRA

## 1. Instalación

```bash
npm install mercadopago
```

## 2. Configuración Backend

```javascript
// config/mercadopago.js
const mercadopago = require('mercadopago');

mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN
});

module.exports = mercadopago;
```

## 3. Endpoint para crear preferencia de pago

```javascript
// routes/payment.js
const express = require('express');
const mercadopago = require('../config/mercadopago');
const router = express.Router();

router.post('/api/payment/create-preference', async (req, res) => {
    try {
        const { planType, userId } = req.body;
        
        // Configurar item según el plan
        const plans = {
            mensual: {
                title: 'AIRA - Plan Mensual',
                unit_price: 15000, // $15.000 ARS
                quantity: 1
            },
            anual: {
                title: 'AIRA - Plan Anual (20% OFF)',
                unit_price: 144000, // $144.000 ARS (12.000 x mes)
                quantity: 1
            }
        };
        
        const preference = {
            items: [plans[planType] || plans.mensual],
            payer: {
                email: req.body.email
            },
            back_urls: {
                success: 'https://tudominio.com/payment/success',
                failure: 'https://tudominio.com/payment/failure',
                pending: 'https://tudominio.com/payment/pending'
            },
            auto_return: 'approved',
            
            // Configurar medios de pago
            payment_methods: {
                excluded_payment_types: [
                    { id: 'ticket' } // Excluir pagos en efectivo si querés
                ],
                installments: 12, // Hasta 12 cuotas
                default_installments: 1
            },
            
            // Metadata para tracking
            metadata: {
                user_id: userId,
                plan_type: planType
            }
        };
        
        const response = await mercadopago.preferences.create(preference);
        
        res.json({
            preferenceId: response.body.id,
            initPoint: response.body.init_point // URL de pago
        });
        
    } catch (error) {
        console.error('Error creating preference:', error);
        res.status(500).json({ error: 'Error al crear preferencia de pago' });
    }
});

// Webhook para notificaciones de pago
router.post('/api/payment/webhook', async (req, res) => {
    const { type, data } = req.body;
    
    if (type === 'payment') {
        try {
            const payment = await mercadopago.payment.findById(data.id);
            
            if (payment.body.status === 'approved') {
                // Activar cuenta del usuario
                const userId = payment.body.metadata.user_id;
                await activateUserAccount(userId);
                
                // Enviar email de confirmación
                await sendWelcomeEmail(userId);
            }
            
            res.sendStatus(200);
        } catch (error) {
            console.error('Webhook error:', error);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(200);
    }
});

module.exports = router;
```

## 4. Frontend - Botón de pago

```html
<!-- En demopagina_funcional_backup.html -->
<script src="https://sdk.mercadopago.com/js/v2"></script>

<script>
async function processPaymentWithMP() {
    try {
        // Mostrar loading
        setLoading($('#paymentBtn')[0], true, 'Preparando pago...');
        
        // Crear preferencia en backend
        const response = await fetch('/api/payment/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planType: 'mensual',
                email: currentUser.email,
                userId: currentUser.id
            })
        });
        
        const { initPoint } = await response.json();
        
        // Redirigir a MercadoPago
        window.location.href = initPoint;
        
    } catch (error) {
        showNotification('Error al procesar el pago', 'error');
        setLoading($('#paymentBtn')[0], false);
    }
}

// O usar el Checkout Pro embebido
function initMercadoPagoCheckout(preferenceId) {
    const mp = new MercadoPago('TU_PUBLIC_KEY', {
        locale: 'es-AR'
    });
    
    mp.checkout({
        preference: {
            id: preferenceId
        },
        render: {
            container: '.mp-checkout-container',
            label: 'Pagar con MercadoPago'
        }
    });
}
</script>
```

## 5. Variables de entorno necesarias

```env
# .env
MP_ACCESS_TOKEN=TEST-1234567890... # Token de producción
MP_PUBLIC_KEY=TEST-abcdef123...    # Public key
MP_WEBHOOK_SECRET=tu_secret_webhook
```

## 6. Manejo de estados de pago

```javascript
// utils/payment-status.js
const handlePaymentStatus = (status) => {
    const messages = {
        approved: 'Pago aprobado ✅',
        pending: 'Pago pendiente de confirmación 🕐',
        in_process: 'Procesando tu pago...',
        rejected: 'Pago rechazado. Intenta con otro medio de pago ❌',
        cancelled: 'Pago cancelado',
        refunded: 'Pago devuelto',
        charged_back: 'Contracargo realizado'
    };
    
    return messages[status] || 'Estado desconocido';
};
```

## 7. Consideraciones importantes

### Seguridad
- **NUNCA** exponer el access token en el frontend
- Validar todos los pagos en el backend via webhook
- Usar HTTPS siempre
- Guardar logs de todas las transacciones

### UX para Argentina
- Mostrar cuotas disponibles claramente
- Incluir todos los medios de pago (no solo tarjetas)
- Mostrar precios con IVA incluido
- Considerar promociones con bancos específicos

### Testing
```javascript
// Tarjetas de prueba para Argentina
const testCards = {
    visa: {
        number: '4509 9535 6623 3704',
        cvv: '123',
        expiry: '11/25'
    },
    mastercard: {
        number: '5031 7557 3453 0604',
        cvv: '123',
        expiry: '11/25'
    },
    amex: {
        number: '3711 803032 57522',
        cvv: '1234',
        expiry: '11/25'
    }
};
```

## 8. Ejemplo de flujo completo

1. Usuario se registra
2. Elige plan (mensual/anual)
3. Se crea preferencia de pago
4. Redirige a MercadoPago
5. Usuario paga con su medio preferido
6. MercadoPago redirige según resultado
7. Webhook confirma pago en backend
8. Se activa la cuenta automáticamente
9. Usuario accede al dashboard

## 9. Ventajas adicionales

- **Split de pagos**: Dividir pagos entre profesionales
- **Marketplace**: Cobrar comisiones
- **Suscripciones**: Cobros recurrentes automáticos
- **Point**: Cobrar con tarjeta físicamente
- **QR**: Pagos con código QR

## 10. Costos aproximados (2024)

- Tarjeta de crédito: 3.99% + IVA
- Tarjeta de débito: 2.99% + IVA  
- MercadoPago (dinero en cuenta): 0.8% + IVA
- Transferencia: Sin costo
- Efectivo: 2.99% + IVA

El dinero se acredita inmediatamente en tu cuenta de MercadoPago.

## 1. Instalación

```bash
npm install mercadopago
```

## 2. Configuración Backend

```javascript
// config/mercadopago.js
const mercadopago = require('mercadopago');

mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN
});

module.exports = mercadopago;
```

## 3. Endpoint para crear preferencia de pago

```javascript
// routes/payment.js
const express = require('express');
const mercadopago = require('../config/mercadopago');
const router = express.Router();

router.post('/api/payment/create-preference', async (req, res) => {
    try {
        const { planType, userId } = req.body;
        
        // Configurar item según el plan
        const plans = {
            mensual: {
                title: 'AIRA - Plan Mensual',
                unit_price: 15000, // $15.000 ARS
                quantity: 1
            },
            anual: {
                title: 'AIRA - Plan Anual (20% OFF)',
                unit_price: 144000, // $144.000 ARS (12.000 x mes)
                quantity: 1
            }
        };
        
        const preference = {
            items: [plans[planType] || plans.mensual],
            payer: {
                email: req.body.email
            },
            back_urls: {
                success: 'https://tudominio.com/payment/success',
                failure: 'https://tudominio.com/payment/failure',
                pending: 'https://tudominio.com/payment/pending'
            },
            auto_return: 'approved',
            
            // Configurar medios de pago
            payment_methods: {
                excluded_payment_types: [
                    { id: 'ticket' } // Excluir pagos en efectivo si querés
                ],
                installments: 12, // Hasta 12 cuotas
                default_installments: 1
            },
            
            // Metadata para tracking
            metadata: {
                user_id: userId,
                plan_type: planType
            }
        };
        
        const response = await mercadopago.preferences.create(preference);
        
        res.json({
            preferenceId: response.body.id,
            initPoint: response.body.init_point // URL de pago
        });
        
    } catch (error) {
        console.error('Error creating preference:', error);
        res.status(500).json({ error: 'Error al crear preferencia de pago' });
    }
});

// Webhook para notificaciones de pago
router.post('/api/payment/webhook', async (req, res) => {
    const { type, data } = req.body;
    
    if (type === 'payment') {
        try {
            const payment = await mercadopago.payment.findById(data.id);
            
            if (payment.body.status === 'approved') {
                // Activar cuenta del usuario
                const userId = payment.body.metadata.user_id;
                await activateUserAccount(userId);
                
                // Enviar email de confirmación
                await sendWelcomeEmail(userId);
            }
            
            res.sendStatus(200);
        } catch (error) {
            console.error('Webhook error:', error);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(200);
    }
});

module.exports = router;
```

## 4. Frontend - Botón de pago

```html
<!-- En demopagina_funcional_backup.html -->
<script src="https://sdk.mercadopago.com/js/v2"></script>

<script>
async function processPaymentWithMP() {
    try {
        // Mostrar loading
        setLoading($('#paymentBtn')[0], true, 'Preparando pago...');
        
        // Crear preferencia en backend
        const response = await fetch('/api/payment/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planType: 'mensual',
                email: currentUser.email,
                userId: currentUser.id
            })
        });
        
        const { initPoint } = await response.json();
        
        // Redirigir a MercadoPago
        window.location.href = initPoint;
        
    } catch (error) {
        showNotification('Error al procesar el pago', 'error');
        setLoading($('#paymentBtn')[0], false);
    }
}

// O usar el Checkout Pro embebido
function initMercadoPagoCheckout(preferenceId) {
    const mp = new MercadoPago('TU_PUBLIC_KEY', {
        locale: 'es-AR'
    });
    
    mp.checkout({
        preference: {
            id: preferenceId
        },
        render: {
            container: '.mp-checkout-container',
            label: 'Pagar con MercadoPago'
        }
    });
}
</script>
```

## 5. Variables de entorno necesarias

```env
# .env
MP_ACCESS_TOKEN=TEST-1234567890... # Token de producción
MP_PUBLIC_KEY=TEST-abcdef123...    # Public key
MP_WEBHOOK_SECRET=tu_secret_webhook
```

## 6. Manejo de estados de pago

```javascript
// utils/payment-status.js
const handlePaymentStatus = (status) => {
    const messages = {
        approved: 'Pago aprobado ✅',
        pending: 'Pago pendiente de confirmación 🕐',
        in_process: 'Procesando tu pago...',
        rejected: 'Pago rechazado. Intenta con otro medio de pago ❌',
        cancelled: 'Pago cancelado',
        refunded: 'Pago devuelto',
        charged_back: 'Contracargo realizado'
    };
    
    return messages[status] || 'Estado desconocido';
};
```

## 7. Consideraciones importantes

### Seguridad
- **NUNCA** exponer el access token en el frontend
- Validar todos los pagos en el backend via webhook
- Usar HTTPS siempre
- Guardar logs de todas las transacciones

### UX para Argentina
- Mostrar cuotas disponibles claramente
- Incluir todos los medios de pago (no solo tarjetas)
- Mostrar precios con IVA incluido
- Considerar promociones con bancos específicos

### Testing
```javascript
// Tarjetas de prueba para Argentina
const testCards = {
    visa: {
        number: '4509 9535 6623 3704',
        cvv: '123',
        expiry: '11/25'
    },
    mastercard: {
        number: '5031 7557 3453 0604',
        cvv: '123',
        expiry: '11/25'
    },
    amex: {
        number: '3711 803032 57522',
        cvv: '1234',
        expiry: '11/25'
    }
};
```

## 8. Ejemplo de flujo completo

1. Usuario se registra
2. Elige plan (mensual/anual)
3. Se crea preferencia de pago
4. Redirige a MercadoPago
5. Usuario paga con su medio preferido
6. MercadoPago redirige según resultado
7. Webhook confirma pago en backend
8. Se activa la cuenta automáticamente
9. Usuario accede al dashboard

## 9. Ventajas adicionales

- **Split de pagos**: Dividir pagos entre profesionales
- **Marketplace**: Cobrar comisiones
- **Suscripciones**: Cobros recurrentes automáticos
- **Point**: Cobrar con tarjeta físicamente
- **QR**: Pagos con código QR

## 10. Costos aproximados (2024)

- Tarjeta de crédito: 3.99% + IVA
- Tarjeta de débito: 2.99% + IVA  
- MercadoPago (dinero en cuenta): 0.8% + IVA
- Transferencia: Sin costo
- Efectivo: 2.99% + IVA

El dinero se acredita inmediatamente en tu cuenta de MercadoPago.

## 1. Instalación

```bash
npm install mercadopago
```

## 2. Configuración Backend

```javascript
// config/mercadopago.js
const mercadopago = require('mercadopago');

mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN
});

module.exports = mercadopago;
```

## 3. Endpoint para crear preferencia de pago

```javascript
// routes/payment.js
const express = require('express');
const mercadopago = require('../config/mercadopago');
const router = express.Router();

router.post('/api/payment/create-preference', async (req, res) => {
    try {
        const { planType, userId } = req.body;
        
        // Configurar item según el plan
        const plans = {
            mensual: {
                title: 'AIRA - Plan Mensual',
                unit_price: 15000, // $15.000 ARS
                quantity: 1
            },
            anual: {
                title: 'AIRA - Plan Anual (20% OFF)',
                unit_price: 144000, // $144.000 ARS (12.000 x mes)
                quantity: 1
            }
        };
        
        const preference = {
            items: [plans[planType] || plans.mensual],
            payer: {
                email: req.body.email
            },
            back_urls: {
                success: 'https://tudominio.com/payment/success',
                failure: 'https://tudominio.com/payment/failure',
                pending: 'https://tudominio.com/payment/pending'
            },
            auto_return: 'approved',
            
            // Configurar medios de pago
            payment_methods: {
                excluded_payment_types: [
                    { id: 'ticket' } // Excluir pagos en efectivo si querés
                ],
                installments: 12, // Hasta 12 cuotas
                default_installments: 1
            },
            
            // Metadata para tracking
            metadata: {
                user_id: userId,
                plan_type: planType
            }
        };
        
        const response = await mercadopago.preferences.create(preference);
        
        res.json({
            preferenceId: response.body.id,
            initPoint: response.body.init_point // URL de pago
        });
        
    } catch (error) {
        console.error('Error creating preference:', error);
        res.status(500).json({ error: 'Error al crear preferencia de pago' });
    }
});

// Webhook para notificaciones de pago
router.post('/api/payment/webhook', async (req, res) => {
    const { type, data } = req.body;
    
    if (type === 'payment') {
        try {
            const payment = await mercadopago.payment.findById(data.id);
            
            if (payment.body.status === 'approved') {
                // Activar cuenta del usuario
                const userId = payment.body.metadata.user_id;
                await activateUserAccount(userId);
                
                // Enviar email de confirmación
                await sendWelcomeEmail(userId);
            }
            
            res.sendStatus(200);
        } catch (error) {
            console.error('Webhook error:', error);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(200);
    }
});

module.exports = router;
```

## 4. Frontend - Botón de pago

```html
<!-- En demopagina_funcional_backup.html -->
<script src="https://sdk.mercadopago.com/js/v2"></script>

<script>
async function processPaymentWithMP() {
    try {
        // Mostrar loading
        setLoading($('#paymentBtn')[0], true, 'Preparando pago...');
        
        // Crear preferencia en backend
        const response = await fetch('/api/payment/create-preference', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                planType: 'mensual',
                email: currentUser.email,
                userId: currentUser.id
            })
        });
        
        const { initPoint } = await response.json();
        
        // Redirigir a MercadoPago
        window.location.href = initPoint;
        
    } catch (error) {
        showNotification('Error al procesar el pago', 'error');
        setLoading($('#paymentBtn')[0], false);
    }
}

// O usar el Checkout Pro embebido
function initMercadoPagoCheckout(preferenceId) {
    const mp = new MercadoPago('TU_PUBLIC_KEY', {
        locale: 'es-AR'
    });
    
    mp.checkout({
        preference: {
            id: preferenceId
        },
        render: {
            container: '.mp-checkout-container',
            label: 'Pagar con MercadoPago'
        }
    });
}
</script>
```

## 5. Variables de entorno necesarias

```env
# .env
MP_ACCESS_TOKEN=TEST-1234567890... # Token de producción
MP_PUBLIC_KEY=TEST-abcdef123...    # Public key
MP_WEBHOOK_SECRET=tu_secret_webhook
```

## 6. Manejo de estados de pago

```javascript
// utils/payment-status.js
const handlePaymentStatus = (status) => {
    const messages = {
        approved: 'Pago aprobado ✅',
        pending: 'Pago pendiente de confirmación 🕐',
        in_process: 'Procesando tu pago...',
        rejected: 'Pago rechazado. Intenta con otro medio de pago ❌',
        cancelled: 'Pago cancelado',
        refunded: 'Pago devuelto',
        charged_back: 'Contracargo realizado'
    };
    
    return messages[status] || 'Estado desconocido';
};
```

## 7. Consideraciones importantes

### Seguridad
- **NUNCA** exponer el access token en el frontend
- Validar todos los pagos en el backend via webhook
- Usar HTTPS siempre
- Guardar logs de todas las transacciones

### UX para Argentina
- Mostrar cuotas disponibles claramente
- Incluir todos los medios de pago (no solo tarjetas)
- Mostrar precios con IVA incluido
- Considerar promociones con bancos específicos

### Testing
```javascript
// Tarjetas de prueba para Argentina
const testCards = {
    visa: {
        number: '4509 9535 6623 3704',
        cvv: '123',
        expiry: '11/25'
    },
    mastercard: {
        number: '5031 7557 3453 0604',
        cvv: '123',
        expiry: '11/25'
    },
    amex: {
        number: '3711 803032 57522',
        cvv: '1234',
        expiry: '11/25'
    }
};
```

## 8. Ejemplo de flujo completo

1. Usuario se registra
2. Elige plan (mensual/anual)
3. Se crea preferencia de pago
4. Redirige a MercadoPago
5. Usuario paga con su medio preferido
6. MercadoPago redirige según resultado
7. Webhook confirma pago en backend
8. Se activa la cuenta automáticamente
9. Usuario accede al dashboard

## 9. Ventajas adicionales

- **Split de pagos**: Dividir pagos entre profesionales
- **Marketplace**: Cobrar comisiones
- **Suscripciones**: Cobros recurrentes automáticos
- **Point**: Cobrar con tarjeta físicamente
- **QR**: Pagos con código QR

## 10. Costos aproximados (2024)

- Tarjeta de crédito: 3.99% + IVA
- Tarjeta de débito: 2.99% + IVA  
- MercadoPago (dinero en cuenta): 0.8% + IVA
- Transferencia: Sin costo
- Efectivo: 2.99% + IVA

El dinero se acredita inmediatamente en tu cuenta de MercadoPago.
