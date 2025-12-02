// Gestor de seguridad para AIRA Bot
const crypto = require('crypto');
const bcrypt = require('bcrypt');

class SecurityManager {
  constructor() {
    // Configuración de seguridad
    this.saltRounds = 10; // Para bcrypt
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'clave_por_defecto_cambiar_en_produccion';
    this.algorithm = 'aes-256-gcm';
  }

  // Valida la entrada para evitar inyecciones
  validateInput(input) {
    if (typeof input !== 'string') return false;
    
    // Tamaño razonable
    if (input.length === 0 || input.length > 10000) return false;
    
    // Validación básica contra patrones peligrosos
    const dangerousPatterns = [
      /(<script[\s\S]*?>[\s\S]*?<\/script>)/i,  // Scripts
      /(javascript:)/i,                          // javascript: URLs
      /(\b(exec|eval|setTimeout|setInterval)\s*\()/i  // Funciones peligrosas
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(input));
  }

  // Hashea un PIN para almacenamiento seguro
  async hashPin(pin) {
    return await bcrypt.hash(pin, this.saltRounds);
  }

  // Verifica un PIN contra su hash almacenado
  async verifyPin(pin, hash) {
    return await bcrypt.compare(pin, hash);
  }

  // Encripta datos sensibles
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm, 
      Buffer.from(this.encryptionKey.padEnd(32).slice(0, 32)), 
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    // Combinar IV, authTag y texto cifrado
    return iv.toString('hex') + ':' + authTag + ':' + encrypted;
  }

  // Desencripta datos sensibles
  decrypt(encryptedText) {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) throw new Error('Formato de texto cifrado inválido');
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encryptedData = parts[2];
      
      const decipher = crypto.createDecipheriv(
        this.algorithm, 
        Buffer.from(this.encryptionKey.padEnd(32).slice(0, 32)), 
        iv
      );
      
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Error al desencriptar:', error.message);
      return null;
    }
  }

  // Autenticar profesional contra la base de datos
  async authenticateProfessional(dni, pin) {
    try {
      // En un sistema real, aquí consultaríamos la base de datos
      // Este es un ejemplo simplificado
      const mockProfessionals = {
        '12345678': {
          nombre: 'Dr. Juan Pérez',
          pinHash: '$2b$10$abcdefghijklmnopqrstuv' // Representación de un hash
        }
      };
      
      const professional = mockProfessionals[dni];
      if (!professional) return false;
      
      // En un sistema real, esto sería una verificación real contra el hash
      // Para pruebas, aceptamos "1234" como PIN válido
      return pin === '1234';
    } catch (error) {
      console.error('Error en autenticación:', error);
      return false;
    }
  }

  // Detecta actividad sospechosa (muchos intentos fallidos)
  detectSuspiciousActivity(phoneNumber, failedAttempts) {
    // Umbral de intentos fallidos
    const threshold = 5;
    return failedAttempts >= threshold;
  }
}

module.exports = SecurityManager;
