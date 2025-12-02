#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('../src/utils/logger');

const execAsync = promisify(exec);

class SSLSetup {
    constructor() {
        this.domain = process.env.DOMAIN || 'aira.health';
        this.email = process.env.SSL_EMAIL || process.env.ADMIN_EMAIL;
        this.webroot = process.env.WEBROOT || '/var/www/html';
        this.nginxConfig = '/etc/nginx/sites-available/aira';
        this.certPath = `/etc/letsencrypt/live/${this.domain}`;
        
        this.sslConfig = {
            keySize: 4096,
            renewDays: 30,
            protocols: ['TLSv1.2', 'TLSv1.3'],
            ciphers: [
                'ECDHE-ECDSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-ECDSA-CHACHA20-POLY1305',
                'ECDHE-RSA-CHACHA20-POLY1305'
            ]
        };
    }

    /**
     * Configurar SSL completo
     */
    async setupSSL() {
        try {
            logger.audit('Starting SSL setup', { 
                domain: this.domain,
                email: this.email 
            });

            // Verificar prerequisitos
            await this.checkPrerequisites();

            // Configurar Nginx básico
            await this.setupNginxConfig();

            // Obtener certificado SSL
            await this.obtainSSLCertificate();

            // Configurar renovación automática
            await this.setupAutoRenewal();

            // Configurar headers de seguridad
            await this.setupSecurityHeaders();

            // Verificar configuración
            await this.verifySSLSetup();

            logger.audit('SSL setup completed successfully', { 
                domain: this.domain,
                certPath: this.certPath 
            });

            return {
                status: 'success',
                domain: this.domain,
                certPath: this.certPath,
                expiryDate: await this.getCertificateExpiry()
            };

        } catch (error) {
            logger.error('SSL setup failed', { 
                domain: this.domain,
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Verificar prerequisitos del sistema
     */
    async checkPrerequisites() {
        try {
            logger.audit('Checking SSL prerequisites');

            // Verificar que certbot esté instalado
            try {
                await execAsync('certbot --version');
            } catch (error) {
                logger.warn('Certbot not found, installing...');
                await this.installCertbot();
            }

            // Verificar que nginx esté instalado
            try {
                await execAsync('nginx -v');
            } catch (error) {
                throw new Error('Nginx is required but not installed');
            }

            // Verificar configuración de dominio
            if (!this.domain || !this.email) {
                throw new Error('Domain and email are required for SSL setup');
            }

            // Verificar conectividad del dominio
            await this.verifyDomainConnectivity();

            logger.audit('Prerequisites check passed');

        } catch (error) {
            logger.error('Prerequisites check failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Instalar Certbot
     */
    async installCertbot() {
        try {
            logger.audit('Installing Certbot');

            // Para Ubuntu/Debian
            await execAsync('sudo apt-get update');
            await execAsync('sudo apt-get install -y certbot python3-certbot-nginx');

            logger.audit('Certbot installed successfully');

        } catch (error) {
            logger.error('Failed to install Certbot', { error: error.message });
            throw error;
        }
    }

    /**
     * Verificar conectividad del dominio
     */
    async verifyDomainConnectivity() {
        try {
            const { stdout } = await execAsync(`nslookup ${this.domain}`);
            
            if (!stdout.includes('Name:') && !stdout.includes('Address:')) {
                throw new Error(`Domain ${this.domain} does not resolve`);
            }

            logger.audit('Domain connectivity verified', { domain: this.domain });

        } catch (error) {
            logger.warn('Domain connectivity check failed', { 
                domain: this.domain,
                error: error.message 
            });
            // No lanzar error - puede ser temporal
        }
    }

    /**
     * Configurar Nginx básico
     */
    async setupNginxConfig() {
        try {
            logger.audit('Setting up Nginx configuration');

            const nginxConfig = this.generateNginxConfig();
            
            // Escribir configuración
            await fs.writeFile(this.nginxConfig, nginxConfig);

            // Crear enlace simbólico si no existe
            const enabledConfig = `/etc/nginx/sites-enabled/${path.basename(this.nginxConfig)}`;
            try {
                await fs.access(enabledConfig);
            } catch {
                await execAsync(`sudo ln -s ${this.nginxConfig} ${enabledConfig}`);
            }

            // Verificar configuración
            await execAsync('sudo nginx -t');

            // Recargar Nginx
            await execAsync('sudo systemctl reload nginx');

            logger.audit('Nginx configuration completed');

        } catch (error) {
            logger.error('Nginx configuration failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Generar configuración de Nginx
     */
    generateNginxConfig() {
        return `
# AIRA Health SSL Configuration
server {
    listen 80;
    listen [::]:80;
    server_name ${this.domain} www.${this.domain};

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${this.domain} www.${this.domain};

    # SSL Configuration
    ssl_certificate ${this.certPath}/fullchain.pem;
    ssl_certificate_key ${this.certPath}/privkey.pem;
    ssl_trusted_certificate ${this.certPath}/chain.pem;

    # SSL Security
    ssl_protocols ${this.sslConfig.protocols.join(' ')};
    ssl_ciphers '${this.sslConfig.ciphers.join(':')}';
    ssl_prefer_server_ciphers off;
    ssl_ecdh_curve secp384r1;

    # SSL Session
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none';" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), screen-wake-lock=(), web-share=()" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

    # Main Application
    location / {
        proxy_pass http://localhost:${process.env.PORT || 8082};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # API Rate Limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:${process.env.PORT || 8082};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Login Endpoint Rate Limiting
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        
        proxy_pass http://localhost:${process.env.PORT || 8082};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static Files with Caching
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
        
        # Serve from app
        proxy_pass http://localhost:${process.env.PORT || 8082};
        proxy_set_header Host $host;
    }

    # Health Check (no rate limiting)
    location /api/health {
        proxy_pass http://localhost:${process.env.PORT || 8082};
        proxy_set_header Host $host;
        access_log off;
    }

    # Deny access to sensitive files
    location ~ /\\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location ~ \\.(env|log|bak|backup|sql|dump)$ {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Error and Access Logs
    error_log /var/log/nginx/aira_error.log warn;
    access_log /var/log/nginx/aira_access.log combined;
}
`;
    }

    /**
     * Obtener certificado SSL
     */
    async obtainSSLCertificate() {
        try {
            logger.audit('Obtaining SSL certificate');

            // Verificar si el certificado ya existe
            try {
                await fs.access(`${this.certPath}/fullchain.pem`);
                logger.audit('SSL certificate already exists, checking expiry');
                
                const expiryDate = await this.getCertificateExpiry();
                const daysUntilExpiry = Math.floor((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                
                if (daysUntilExpiry > this.sslConfig.renewDays) {
                    logger.audit('SSL certificate is still valid', { 
                        expiryDate, 
                        daysUntilExpiry 
                    });
                    return;
                }
                
                logger.audit('SSL certificate needs renewal', { 
                    expiryDate, 
                    daysUntilExpiry 
                });
            } catch {
                // Certificado no existe, continuar con obtención
            }

            // Obtener certificado usando certbot
            const certbotCmd = [
                'sudo certbot certonly',
                '--nginx',
                '--non-interactive',
                '--agree-tos',
                `--email ${this.email}`,
                `-d ${this.domain}`,
                `-d www.${this.domain}`,
                '--force-renewal'
            ].join(' ');

            await execAsync(certbotCmd);

            logger.audit('SSL certificate obtained successfully');

        } catch (error) {
            logger.error('Failed to obtain SSL certificate', { error: error.message });
            throw error;
        }
    }

    /**
     * Configurar renovación automática
     */
    async setupAutoRenewal() {
        try {
            logger.audit('Setting up SSL auto-renewal');

            // Crear script de renovación
            const renewalScript = `#!/bin/bash
# AIRA SSL Certificate Renewal Script

/usr/bin/certbot renew --quiet --no-self-upgrade
/bin/systemctl reload nginx

# Log renewal attempt
echo "$(date): SSL renewal check completed" >> /var/log/aira-ssl-renewal.log
`;

            await fs.writeFile('/usr/local/bin/aira-ssl-renew.sh', renewalScript);
            await execAsync('sudo chmod +x /usr/local/bin/aira-ssl-renew.sh');

            // Configurar cron job para renovación (diario a las 3:30 AM)
            const cronJob = '30 3 * * * /usr/local/bin/aira-ssl-renew.sh';
            
            try {
                const { stdout } = await execAsync('crontab -l');
                if (!stdout.includes('aira-ssl-renew.sh')) {
                    await execAsync(`(crontab -l ; echo "${cronJob}") | crontab -`);
                }
            } catch {
                // No hay crontab existente
                await execAsync(`echo "${cronJob}" | crontab -`);
            }

            logger.audit('SSL auto-renewal configured');

        } catch (error) {
            logger.error('Failed to setup SSL auto-renewal', { error: error.message });
            throw error;
        }
    }

    /**
     * Configurar headers de seguridad adicionales
     */
    async setupSecurityHeaders() {
        try {
            logger.audit('Setting up security headers');

            // Headers adicionales ya están en la configuración de Nginx
            // Verificar configuración con SSL Labs
            await this.scheduleSSLLabsCheck();

            logger.audit('Security headers configured');

        } catch (error) {
            logger.error('Failed to setup security headers', { error: error.message });
            throw error;
        }
    }

    /**
     * Programar verificación con SSL Labs
     */
    async scheduleSSLLabsCheck() {
        try {
            // Crear script para verificación SSL Labs
            const checkScript = `#!/bin/bash
# SSL Labs Check Script

curl -s "https://api.ssllabs.com/api/v3/analyze?host=${this.domain}&publish=off&all=done" | jq '.endpoints[0].grade' >> /var/log/aira-ssl-grade.log
`;

            await fs.writeFile('/usr/local/bin/aira-ssl-check.sh', checkScript);
            await execAsync('sudo chmod +x /usr/local/bin/aira-ssl-check.sh');

            logger.audit('SSL Labs check scheduled');

        } catch (error) {
            logger.warn('Could not schedule SSL Labs check', { error: error.message });
        }
    }

    /**
     * Verificar configuración SSL
     */
    async verifySSLSetup() {
        try {
            logger.audit('Verifying SSL setup');

            // Verificar que el certificado es válido
            const expiryDate = await this.getCertificateExpiry();
            
            // Verificar configuración de Nginx
            await execAsync('sudo nginx -t');

            // Test de conectividad SSL
            try {
                const { stdout } = await execAsync(`echo | openssl s_client -connect ${this.domain}:443 -servername ${this.domain} 2>/dev/null | openssl x509 -noout -dates`);
                logger.audit('SSL connectivity test passed', { certificateInfo: stdout });
            } catch (error) {
                logger.warn('SSL connectivity test failed', { error: error.message });
            }

            logger.audit('SSL setup verification completed', { expiryDate });

        } catch (error) {
            logger.error('SSL verification failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Obtener fecha de expiración del certificado
     */
    async getCertificateExpiry() {
        try {
            const { stdout } = await execAsync(`openssl x509 -enddate -noout -in ${this.certPath}/fullchain.pem`);
            const expiryMatch = stdout.match(/notAfter=(.+)/);
            
            if (expiryMatch) {
                return new Date(expiryMatch[1]).toISOString();
            }
            
            throw new Error('Could not parse certificate expiry date');

        } catch (error) {
            logger.error('Failed to get certificate expiry', { error: error.message });
            throw error;
        }
    }

    /**
     * Health check del SSL
     */
    async healthCheck() {
        try {
            const health = {
                certificateExists: false,
                certificateValid: false,
                daysUntilExpiry: null,
                nginxConfigValid: false,
                domain: this.domain,
                timestamp: new Date().toISOString()
            };

            // Verificar existencia del certificado
            try {
                await fs.access(`${this.certPath}/fullchain.pem`);
                health.certificateExists = true;

                // Verificar validez y expiración
                const expiryDate = await this.getCertificateExpiry();
                const daysUntilExpiry = Math.floor((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                
                health.daysUntilExpiry = daysUntilExpiry;
                health.certificateValid = daysUntilExpiry > 0;

            } catch (error) {
                logger.warn('Certificate check failed', { error: error.message });
            }

            // Verificar configuración de Nginx
            try {
                await execAsync('sudo nginx -t');
                health.nginxConfigValid = true;
            } catch (error) {
                logger.warn('Nginx config check failed', { error: error.message });
            }

            health.status = (health.certificateExists && health.certificateValid && health.nginxConfigValid) ? 'healthy' : 'unhealthy';

            logger.audit('SSL health check completed', health);

            return health;

        } catch (error) {
            logger.error('SSL health check failed', { error: error.message });
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Renovar certificado manualmente
     */
    async renewCertificate() {
        try {
            logger.audit('Manual SSL certificate renewal initiated');

            await execAsync('sudo certbot renew --force-renewal');
            await execAsync('sudo systemctl reload nginx');

            const newExpiryDate = await this.getCertificateExpiry();

            logger.audit('SSL certificate renewed successfully', { 
                newExpiryDate 
            });

            return {
                status: 'success',
                newExpiryDate,
                domain: this.domain
            };

        } catch (error) {
            logger.error('Manual SSL renewal failed', { error: error.message });
            throw error;
        }
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    const sslSetup = new SSLSetup();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'setup':
            sslSetup.setupSSL().catch(console.error);
            break;
        case 'renew':
            sslSetup.renewCertificate().catch(console.error);
            break;
        case 'health':
            sslSetup.healthCheck().then(console.log).catch(console.error);
            break;
        default:
            console.log('Usage: node ssl-setup.js [setup|renew|health]');
            process.exit(1);
    }
}

module.exports = SSLSetup; 