#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');

class LegacyCleanupService {
    constructor() {
        this.dryRun = process.argv.includes('--dry-run');
        this.force = process.argv.includes('--force');
        this.verbose = process.argv.includes('--verbose');
        
        // Patrones de archivos legacy a limpiar
        this.cleanupPatterns = {
            backupFiles: [
                /\.backup$/,
                /\.bak$/,
                /\.backup\.\d+$/,
                /backup_\d+/,
                /_backup_/,
                /\.html\.backup/,
                /\.js\.backup/,
                /\.json\.backup/
            ],
            temporaryFiles: [
                /~$/,
                /\.tmp$/,
                /\.temp$/,
                /\.swp$/,
                /\.swo$/,
                /\.DS_Store$/,
                /Thumbs\.db$/
            ],
            legacyDirectories: [
                'js_backup_pre-refactor_20250627171519',
                'backups',
                'legacy'
            ],
            testFiles: [
                /test-basico\.html$/,
                /test-demo\.html$/,
                /test-funcional-fallido\.html$/,
                /prueba\.html$/
            ],
            duplicatedFiles: [
                /demopagina_funcional_backup\.html$/,
                /dashboard-ejemplo\.html$/,
                /reference\.html$/
            ]
        };

        // Archivos que nunca deben eliminarse
        this.protectedFiles = [
            'package.json',
            'package-lock.json',
            '.env',
            '.gitignore',
            'README.md',
            'CHANGELOG.md',
            'jest.config.js',
            'vite.config.ts',
            'tailwind.config.js',
            'Dockerfile',
            'docker-compose.yml',
            '.github/workflows/ci-cd.yml'
        ];

        // Directorios que nunca deben eliminarse
        this.protectedDirectories = [
            'node_modules',
            '.git',
            'src',
            'tests',
            'scripts',
            'docs',
            'coverage',
            'dist',
            'build',
            '.github'
        ];
    }

    /**
     * Verificar si un archivo debe ser protegido
     * @param {string} filePath - Ruta del archivo
     * @returns {boolean} - True si debe ser protegido
     */
    isProtected(filePath) {
        const fileName = path.basename(filePath);
        const dirName = path.dirname(filePath);
        
        // Verificar archivos protegidos
        if (this.protectedFiles.includes(fileName)) {
            return true;
        }

        // Verificar directorios protegidos
        const pathParts = filePath.split(path.sep);
        for (const protectedDir of this.protectedDirectories) {
            if (pathParts.includes(protectedDir)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Verificar si un archivo coincide con algún patrón de limpieza
     * @param {string} filePath - Ruta del archivo
     * @returns {Object|null} - Información del patrón coincidente o null
     */
    matchesCleanupPattern(filePath) {
        const fileName = path.basename(filePath);
        const dirName = path.basename(path.dirname(filePath));

        for (const [category, patterns] of Object.entries(this.cleanupPatterns)) {
            if (category === 'legacyDirectories') {
                if (patterns.includes(dirName) || patterns.includes(fileName)) {
                    return { category, pattern: fileName, reason: 'Legacy directory' };
                }
            } else {
                for (const pattern of patterns) {
                    if (pattern.test(fileName)) {
                        return { category, pattern: pattern.source, reason: `${category} pattern match` };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Escanear directorio buscando archivos a limpiar
     * @param {string} directory - Directorio a escanear
     * @returns {Array} - Lista de archivos encontrados
     */
    async scanDirectory(directory = '.') {
        const foundFiles = [];

        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                // Saltar archivos/directorios protegidos
                if (this.isProtected(fullPath)) {
                    if (this.verbose) {
                        console.log(`PROTECTED: ${fullPath}`);
                    }
                    continue;
                }

                if (entry.isDirectory()) {
                    // Verificar si el directorio completo debe ser eliminado
                    const match = this.matchesCleanupPattern(fullPath);
                    if (match) {
                        const stats = await fs.stat(fullPath);
                        foundFiles.push({
                            path: fullPath,
                            type: 'directory',
                            size: await this.getDirectorySize(fullPath),
                            lastModified: stats.mtime,
                            match
                        });
                    } else {
                        // Recursively scan subdirectory
                        const subFiles = await this.scanDirectory(fullPath);
                        foundFiles.push(...subFiles);
                    }
                } else if (entry.isFile()) {
                    const match = this.matchesCleanupPattern(fullPath);
                    if (match) {
                        const stats = await fs.stat(fullPath);
                        foundFiles.push({
                            path: fullPath,
                            type: 'file',
                            size: stats.size,
                            lastModified: stats.mtime,
                            match
                        });
                    }
                }
            }

        } catch (error) {
            logger.error('Failed to scan directory', { 
                directory, 
                error: error.message 
            });
        }

        return foundFiles;
    }

    /**
     * Calcular tamaño de directorio
     * @param {string} directory - Directorio
     * @returns {number} - Tamaño en bytes
     */
    async getDirectorySize(directory) {
        let totalSize = 0;

        try {
            const entries = await fs.readdir(directory, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(directory, entry.name);
                
                if (entry.isDirectory()) {
                    totalSize += await this.getDirectorySize(fullPath);
                } else if (entry.isFile()) {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                }
            }

        } catch (error) {
            // Ignorar errores de acceso
        }

        return totalSize;
    }

    /**
     * Eliminar archivo o directorio
     * @param {Object} item - Item a eliminar
     * @returns {boolean} - True si se eliminó correctamente
     */
    async deleteItem(item) {
        try {
            if (this.dryRun) {
                console.log(`DRY RUN: Would delete ${item.type}: ${item.path}`);
                return true;
            }

            if (item.type === 'directory') {
                await fs.rmdir(item.path, { recursive: true });
            } else {
                await fs.unlink(item.path);
            }

            logger.audit('Legacy item deleted', {
                path: item.path,
                type: item.type,
                size: item.size,
                reason: item.match.reason
            });

            return true;

        } catch (error) {
            logger.error('Failed to delete item', {
                path: item.path,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Crear backup antes de limpiar
     * @param {Array} items - Items a respaldar
     * @returns {string} - Ruta del archivo de backup
     */
    async createPreCleanupBackup(items) {
        if (this.dryRun) {
            console.log('DRY RUN: Would create backup of items to be deleted');
            return 'dry-run-backup.tar.gz';
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = `./cleanup-backup-${timestamp}`;
            
            await fs.mkdir(backupDir, { recursive: true });

            // Crear inventario de lo que se va a eliminar
            const inventory = {
                timestamp: new Date().toISOString(),
                itemsCount: items.length,
                totalSize: items.reduce((sum, item) => sum + item.size, 0),
                items: items.map(item => ({
                    path: item.path,
                    type: item.type,
                    size: item.size,
                    reason: item.match.reason,
                    lastModified: item.lastModified
                }))
            };

            await fs.writeFile(
                path.join(backupDir, 'cleanup-inventory.json'),
                JSON.stringify(inventory, null, 2)
            );

            logger.audit('Pre-cleanup backup created', {
                backupDir,
                itemsCount: items.length,
                totalSize: inventory.totalSize
            });

            return backupDir;

        } catch (error) {
            logger.error('Failed to create pre-cleanup backup', { error: error.message });
            throw error;
        }
    }

    /**
     * Analizar archivos duplicados
     * @param {Array} files - Lista de archivos
     * @returns {Array} - Archivos duplicados encontrados
     */
    async findDuplicateFiles(files) {
        const duplicates = [];
        const fileHashes = new Map();

        for (const file of files) {
            if (file.type !== 'file') continue;

            try {
                const content = await fs.readFile(file.path);
                const hash = require('crypto').createHash('md5').update(content).digest('hex');

                if (fileHashes.has(hash)) {
                    const original = fileHashes.get(hash);
                    duplicates.push({
                        original: original.path,
                        duplicate: file.path,
                        size: file.size,
                        hash
                    });
                } else {
                    fileHashes.set(hash, file);
                }

            } catch (error) {
                // Ignorar errores de lectura
            }
        }

        return duplicates;
    }

    /**
     * Generar reporte de limpieza
     * @param {Array} items - Items encontrados
     * @returns {Object} - Reporte detallado
     */
    generateCleanupReport(items) {
        const report = {
            summary: {
                totalItems: items.length,
                totalSize: items.reduce((sum, item) => sum + item.size, 0),
                byCategory: {},
                byType: {
                    files: items.filter(i => i.type === 'file').length,
                    directories: items.filter(i => i.type === 'directory').length
                }
            },
            items: [],
            recommendations: []
        };

        // Agrupar por categoría
        for (const item of items) {
            const category = item.match.category;
            if (!report.summary.byCategory[category]) {
                report.summary.byCategory[category] = {
                    count: 0,
                    size: 0
                };
            }
            report.summary.byCategory[category].count++;
            report.summary.byCategory[category].size += item.size;

            report.items.push({
                path: item.path,
                type: item.type,
                size: this.formatBytes(item.size),
                lastModified: item.lastModified,
                category: category,
                reason: item.match.reason
            });
        }

        // Generar recomendaciones
        if (report.summary.byCategory.backupFiles?.count > 0) {
            report.recommendations.push({
                priority: 'medium',
                action: 'Remove backup files',
                description: `Found ${report.summary.byCategory.backupFiles.count} backup files that can be safely removed`,
                expectedSavings: this.formatBytes(report.summary.byCategory.backupFiles.size)
            });
        }

        if (report.summary.byCategory.temporaryFiles?.count > 0) {
            report.recommendations.push({
                priority: 'low',
                action: 'Clean temporary files',
                description: `Found ${report.summary.byCategory.temporaryFiles.count} temporary files`,
                expectedSavings: this.formatBytes(report.summary.byCategory.temporaryFiles.size)
            });
        }

        if (report.summary.byCategory.legacyDirectories?.count > 0) {
            report.recommendations.push({
                priority: 'high',
                action: 'Remove legacy directories',
                description: `Found ${report.summary.byCategory.legacyDirectories.count} legacy directories`,
                expectedSavings: this.formatBytes(report.summary.byCategory.legacyDirectories.size)
            });
        }

        return report;
    }

    /**
     * Formatear bytes a tamaño legible
     * @param {number} bytes - Bytes
     * @returns {string} - Tamaño formateado
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Ejecutar limpieza completa
     * @returns {Object} - Resultado de la limpieza
     */
    async executeCleanup() {
        try {
            console.log('🧹 Starting legacy cleanup...');
            console.log(`Mode: ${this.dryRun ? 'DRY RUN' : 'LIVE'}`);
            
            logger.audit('Legacy cleanup started', {
                dryRun: this.dryRun,
                force: this.force,
                verbose: this.verbose
            });

            // Escanear archivos
            console.log('📁 Scanning files...');
            const items = await this.scanDirectory();

            if (items.length === 0) {
                console.log('✅ No legacy files found to clean up.');
                return { items: [], deleted: 0, errors: 0 };
            }

            // Generar reporte
            const report = this.generateCleanupReport(items);
            
            console.log('\n📊 Cleanup Report:');
            console.log(`Total items: ${report.summary.totalItems}`);
            console.log(`Total size: ${this.formatBytes(report.summary.totalSize)}`);
            console.log('\nBy category:');
            
            for (const [category, stats] of Object.entries(report.summary.byCategory)) {
                console.log(`  ${category}: ${stats.count} items (${this.formatBytes(stats.size)})`);
            }

            // Mostrar items si verbose
            if (this.verbose) {
                console.log('\n📋 Items to clean:');
                for (const item of report.items) {
                    console.log(`  ${item.type}: ${item.path} (${item.size}) - ${item.reason}`);
                }
            }

            // Confirmar antes de eliminar (si no es dry run)
            if (!this.dryRun && !this.force) {
                console.log('\n⚠️  This will permanently delete the above files.');
                console.log('Use --dry-run to preview or --force to skip this confirmation.');
                process.exit(1);
            }

            // Crear backup si no es dry run
            let backupDir = null;
            if (!this.dryRun && items.length > 0) {
                console.log('💾 Creating pre-cleanup backup...');
                backupDir = await this.createPreCleanupBackup(items);
            }

            // Ejecutar limpieza
            console.log('🗑️  Cleaning up files...');
            let deleted = 0;
            let errors = 0;

            for (const item of items) {
                const success = await this.deleteItem(item);
                if (success) {
                    deleted++;
                    if (this.verbose) {
                        console.log(`✅ Deleted: ${item.path}`);
                    }
                } else {
                    errors++;
                    console.log(`❌ Failed to delete: ${item.path}`);
                }
            }

            const result = {
                items: items.length,
                deleted,
                errors,
                backupDir,
                sizeSaved: report.summary.totalSize,
                report
            };

            console.log('\n🎉 Cleanup completed!');
            console.log(`Items processed: ${items.length}`);
            console.log(`Successfully deleted: ${deleted}`);
            console.log(`Errors: ${errors}`);
            if (!this.dryRun) {
                console.log(`Space saved: ${this.formatBytes(report.summary.totalSize)}`);
                if (backupDir) {
                    console.log(`Backup created: ${backupDir}`);
                }
            }

            logger.audit('Legacy cleanup completed', result);

            return result;

        } catch (error) {
            logger.error('Legacy cleanup failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Listar archivos sin eliminar
     * @returns {Object} - Lista de archivos encontrados
     */
    async listOnly() {
        try {
            console.log('📋 Listing legacy files...');
            
            const items = await this.scanDirectory();
            const report = this.generateCleanupReport(items);

            console.log('\n📊 Legacy Files Report:');
            console.log(JSON.stringify(report, null, 2));

            return report;

        } catch (error) {
            logger.error('Failed to list legacy files', { error: error.message });
            throw error;
        }
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    const service = new LegacyCleanupService();
    
    const command = process.argv[2];
    
    async function executeCommand() {
        try {
            switch (command) {
                case 'clean':
                    await service.executeCleanup();
                    break;
                    
                case 'list':
                    await service.listOnly();
                    break;
                    
                default:
                    console.log(`
🧹 Legacy Cleanup Service

Usage: node cleanup-legacy.js <command> [options]

Commands:
  clean    - Clean up legacy files
  list     - List legacy files without deleting

Options:
  --dry-run    - Preview what would be deleted without actually deleting
  --force      - Skip confirmation prompt
  --verbose    - Show detailed output

Examples:
  node cleanup-legacy.js list
  node cleanup-legacy.js clean --dry-run
  node cleanup-legacy.js clean --force --verbose

Safety Features:
- Protected files and directories are never deleted
- Pre-cleanup backup is created automatically
- Dry run mode available for safe preview
                    `);
                    process.exit(1);
            }
        } catch (error) {
            console.error('❌ Command failed:', error.message);
            process.exit(1);
        }
    }
    
    executeCommand();
}

module.exports = LegacyCleanupService; 