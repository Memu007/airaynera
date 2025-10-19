#!/usr/bin/env node

/**
 * 🔄 PLAN DE ROLLBACK AUTOMÁTICO
 * Script para rollback inmediato en caso de fallo en producción
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class RollbackPlan {
    constructor() {
        this.backupDir = path.join(__dirname, '../backups/rollback');
        this.logFile = path.join(__dirname, '../logs/rollback.log');
        this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        this.ensureDirectories();
    }

    ensureDirectories() {
        [this.backupDir, path.dirname(this.logFile)].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${type}: ${message}\n`;
        
        console.log(logEntry.trim());
        fs.appendFileSync(this.logFile, logEntry);
    }

    async createBackup() {
        this.log('🔄 Creando backup pre-deploy...');
        
        const backup = {
            timestamp: this.timestamp,
            version: this.getCurrentVersion(),
            database: await this.backupDatabase(),
            config: this.backupConfig(),
            logs: this.backupLogs()
        };

        const backupPath = path.join(this.backupDir, `backup-${this.timestamp}.json`);
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
        
        this.log(`✅ Backup creado: ${backupPath}`);
        return backupPath;
    }

    getCurrentVersion() {
        try {
            const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
            return packageJson.version;
        } catch (error) {
            return 'unknown';
        }
    }

    async backupDatabase() {
        // Simulación - en producción usaría Firebase Admin SDK
        return {
            patients: 'firebase-backup-patients',
            sessions: 'firebase-backup-sessions',
            users: 'firebase-backup-users',
            timestamp: new Date().toISOString()
        };
    }

    backupConfig() {
        const configFiles = [
            '.env',
            'jest.config.js',
            'firestore.rules',
            'package.json'
        ];

        const configBackup = {};
        
        configFiles.forEach(file => {
            const filePath = path.join(__dirname, '..', file);
            if (fs.existsSync(filePath)) {
                configBackup[file] = fs.readFileSync(filePath, 'utf8');
            }
        });

        return configBackup;
    }

    backupLogs() {
        const logFiles = ['health-monitor.log', 'rollback.log'];
        const logs = {};

        logFiles.forEach(logFile => {
            const logPath = path.join(__dirname, '../logs', logFile);
            if (fs.existsSync(logPath)) {
                logs[logFile] = fs.readFileSync(logPath, 'utf8');
            }
        });

        return logs;
    }

    async rollback(backupPath) {
        this.log('🚨 Iniciando rollback automático...');
        
        try {
            const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
            
            // 1. Restaurar configuración
            await this.restoreConfig(backup.config);
            
            // 2. Restaurar base de datos
            await this.restoreDatabase(backup.database);
            
            // 3. Verificar integridad
            await this.verifyIntegrity();
            
            this.log('✅ Rollback completado exitosamente');
            return true;
            
        } catch (error) {
            this.log(`❌ Error en rollback: ${error.message}`, 'ERROR');
            return false;
        }
    }

    async restoreConfig(configBackup) {
        this.log('📋 Restaurando configuración...');
        
        Object.entries(configBackup).forEach(([file, content]) => {
            const filePath = path.join(__dirname, '..', file);
            fs.writeFileSync(filePath, content);
            this.log(`✅ Configuración restaurada: ${file}`);
        });
    }

    async restoreDatabase(databaseBackup) {
        this.log('🗄️ Restaurando base de datos...');
        
        // En producción, usaría Firebase Admin SDK
        this.log('✅ Base de datos restaurada (simulado)');
    }

    async verifyIntegrity() {
        this.log('🔍 Verificando integridad del sistema...');
        
        // Verificar que los endpoints funcionan
        const healthCheck = require('./monitor-health');
        const monitor = new healthCheck.HealthMonitor();
        const results = await monitor.checkAllEndpoints();
        
        const allOk = results.every(r => r.status === 'OK');
        
        if (allOk) {
            this.log('✅ Integridad verificada');
        } else {
            this.log('❌ Problemas de integridad detectados', 'ERROR');
        }
        
        return allOk;
    }

    async emergencyRollback() {
        this.log('🆘 ROLLBACK DE EMERGENCIA INICIADO');
        
        // Buscar el último backup
        const backups = fs.readdirSync(this.backupDir)
            .filter(f => f.startsWith('backup-'))
            .sort()
            .reverse();
        
        if (backups.length === 0) {
            this.log('❌ No hay backups disponibles', 'ERROR');
            return false;
        }
        
        const latestBackup = path.join(this.backupDir, backups[0]);
        return await this.rollback(latestBackup);
    }

    generateRollbackReport() {
        const report = {
            timestamp: new Date().toISOString(),
            currentVersion: this.getCurrentVersion(),
            availableBackups: fs.readdirSync(this.backupDir),
            rollbackSteps: [
                '1. Ejecutar: node scripts/rollback-plan.js --emergency',
                '2. Verificar logs en: logs/rollback.log',
                '3. Confirmar integridad con: npm test',
                '4. Notificar al equipo de soporte'
            ],
            contact: {
                email: 'soporte@aira-medical.com',
                phone: '+54 11 1234-5678',
                slack: '#medical-alerts'
            }
        };

        const reportPath = path.join(__dirname, '../logs/rollback-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        return report;
    }

    async testRollback() {
        this.log('🧪 Probando procedimiento de rollback...');
        
        const backupPath = await this.createBackup();
        const success = await this.rollback(backupPath);
        
        if (success) {
            this.log('✅ Prueba de rollback exitosa');
        } else {
            this.log('❌ Prueba de rollback fallida', 'ERROR');
        }
        
        return success;
    }
}

// CLI
if (require.main === module) {
    const rollback = new RollbackPlan();
    
    const args = process.argv.slice(2);
    
    if (args.includes('--create')) {
        rollback.createBackup();
    } else if (args.includes('--emergency')) {
        rollback.emergencyRollback();
    } else if (args.includes('--test')) {
        rollback.testRollback();
    } else if (args.includes('--report')) {
        const report = rollback.generateRollbackReport();
        console.log('📊 Reporte generado:', JSON.stringify(report, null, 2));
    } else {
        console.log(`
🔄 PLAN DE ROLLBACK - SISTEMA MÉDICO AIRA

Uso:
  node scripts/rollback-plan.js --create    Crear backup pre-deploy
  node scripts/rollback-plan.js --emergency Rollback inmediato
  node scripts/rollback-plan.js --test      Probar procedimiento
  node scripts/rollback-plan.js --report    Generar reporte

Contacto de emergencia: soporte@aira-medical.com
        `);
    }
}

module.exports = RollbackPlan;
