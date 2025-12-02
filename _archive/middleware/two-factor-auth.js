// 2FA - Autenticación de dos factores con TOTP
const crypto = require('crypto');

// Generador de códigos TOTP simple
class TwoFactorAuth {
    constructor() {
        this.window = 30; // ventana de 30 segundos
        this.codeLength = 6;
        this.secrets = new Map(); // En prod usar DB
    }
    
    // Generar secreto para usuario
    generateSecret(userId) {
        const secret = crypto.randomBytes(20).toString('base64');
        this.secrets.set(userId, {
            secret,
            createdAt: Date.now(),
            verified: false
        });
        
        // QR Code data para Google Authenticator
        const otpauth = `otpauth://totp/AIRA:${userId}?secret=${secret}&issuer=AIRA`;
        
        return {
            secret,
            qrCode: otpauth,
            manualEntry: secret.match(/.{1,4}/g).join(' ')
        };
    }
    
    // Generar código TOTP
    generateTOTP(secret, timeOffset = 0) {
        const time = Math.floor((Date.now() + timeOffset) / (this.window * 1000));
        const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'base64'));
        
        // Convertir tiempo a bytes
        const timeBuffer = Buffer.alloc(8);
        timeBuffer.writeUInt32BE(0, 0);
        timeBuffer.writeUInt32BE(time, 4);
        
        hmac.update(timeBuffer);
        const hash = hmac.digest();
        
        // Extraer código dinámico
        const offset = hash[hash.length - 1] & 0x0f;
        const code = (
            ((hash[offset] & 0x7f) << 24) |
            ((hash[offset + 1] & 0xff) << 16) |
            ((hash[offset + 2] & 0xff) << 8) |
            (hash[offset + 3] & 0xff)
        );
        
        // Formato 6 dígitos
        const otp = String(code % Math.pow(10, this.codeLength));
        return otp.padStart(this.codeLength, '0');
    }
    
    // Verificar código
    verifyTOTP(userId, inputCode) {
        const userData = this.secrets.get(userId);
        if (!userData) return false;
        
        const { secret } = userData;
        
        // Verificar ventana actual y anterior/siguiente (tolerancia)
        for (let offset of [-30000, 0, 30000]) {
            const validCode = this.generateTOTP(secret, offset);
            if (inputCode === validCode) {
                userData.verified = true;
                userData.lastUsed = Date.now();
                return true;
            }
        }
        
        return false;
    }
    
    // Generar códigos de respaldo
    generateBackupCodes(userId, count = 10) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
        }
        
        // Guardar hash de códigos
        const userData = this.secrets.get(userId);
        if (userData) {
            userData.backupCodes = codes.map(code => 
                crypto.createHash('sha256').update(code).digest('hex')
            );
        }
        
        return codes;
    }
    
    // Verificar código de respaldo
    verifyBackupCode(userId, inputCode) {
        const userData = this.secrets.get(userId);
        if (!userData || !userData.backupCodes) return false;
        
        const inputHash = crypto.createHash('sha256').update(inputCode).digest('hex');
        const index = userData.backupCodes.indexOf(inputHash);
        
        if (index !== -1) {
            // Usar código una sola vez
            userData.backupCodes.splice(index, 1);
            return true;
        }
        
        return false;
    }
    
    // Middleware para rutas protegidas
    requireTwoFactor(req, res, next) {
        const userId = req.user?.userId;
        const code = req.headers['x-2fa-code'] || req.body.twoFactorCode;
        
        if (!userId) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        
        // Si no tiene 2FA configurado, permitir (opcional)
        const userData = this.secrets.get(userId);
        if (!userData || !userData.verified) {
            return next();
        }
        
        // Verificar código
        if (!code) {
            return res.status(403).json({ 
                error: '2FA requerido',
                require2FA: true 
            });
        }
        
        // Intentar código TOTP primero, luego backup
        if (this.verifyTOTP(userId, code) || this.verifyBackupCode(userId, code)) {
            next();
        } else {
            res.status(403).json({ error: 'Código 2FA inválido' });
        }
    }
    
    // Enviar código por SMS (mock)
    async sendSMSCode(phone) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // En producción usar Twilio
        console.log(`📱 SMS enviado a ${phone}: ${code}`);
        
        // Guardar temporalmente (5 min)
        this.secrets.set(`sms_${phone}`, {
            code,
            expiresAt: Date.now() + 5 * 60 * 1000
        });
        
        return { sent: true };
    }
    
    // Verificar código SMS
    verifySMSCode(phone, inputCode) {
        const data = this.secrets.get(`sms_${phone}`);
        
        if (!data || Date.now() > data.expiresAt) {
            return false;
        }
        
        if (data.code === inputCode) {
            this.secrets.delete(`sms_${phone}`);
            return true;
        }
        
        return false;
    }
}

module.exports = new TwoFactorAuth();
