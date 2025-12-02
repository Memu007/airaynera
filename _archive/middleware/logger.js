const fs = require('fs');
const path = require('path');

// Directorio de logs
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Logger simple con rotación
class Logger {
    constructor() {
        this.currentFile = this.getLogFile();
        this.checkRotation();
    }
    
    getLogFile() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(logsDir, `aira-${date}.log`);
    }
    
    log(level, message, data = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...data
        };
        
        // No loguear datos sensibles
        delete entry.password;
        delete entry.token;
        delete entry.dni;
        
        const line = JSON.stringify(entry) + '\n';
        
        try {
            fs.appendFileSync(this.currentFile, line);
        } catch (e) {
            // Si falla, no crashear
        }
    }
    
    checkRotation() {
        // Limpiar logs > 7 días
        fs.readdirSync(logsDir).forEach(file => {
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);
            const days = (Date.now() - stats.mtime) / (1000 * 60 * 60 * 24);
            
            if (days > 7) {
                fs.unlinkSync(filePath);
            }
        });
    }
    
    info(message, data) {
        this.log('INFO', message, data);
    }
    
    error(message, data) {
        this.log('ERROR', message, data);
    }
    
    warn(message, data) {
        this.log('WARN', message, data);
    }
}

module.exports = new Logger();
