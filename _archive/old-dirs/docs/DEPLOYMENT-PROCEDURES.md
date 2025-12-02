# 🚀 Procedimientos de Deployment - AIRA Bot

## Índice
1. [Pre-Deployment](#pre-deployment)
2. [Deployment Production](#deployment-production)
3. [Post-Deployment](#post-deployment)
4. [Rollback Procedures](#rollback-procedures)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment

### 1. Checklist de Verificación

#### ✅ Código y Testing
- [ ] Todos los tests pasan (>90% coverage)
- [ ] Linting sin errores
- [ ] Código revisado y aprobado
- [ ] Documentación actualizada
- [ ] CHANGELOG.md actualizado

#### ✅ Seguridad
- [ ] Audit de seguridad completado
- [ ] Variables de entorno configuradas
- [ ] Secrets rotados
- [ ] SSL/TLS configurado
- [ ] Firewall rules configuradas

#### ✅ Infraestructura
- [ ] Servidor de producción preparado
- [ ] Base de datos respaldada
- [ ] DNS configurado
- [ ] CDN configurado (si aplica)
- [ ] Monitoring configurado

#### ✅ Performance
- [ ] Load testing completado
- [ ] Optimizaciones aplicadas
- [ ] Assets minimizados
- [ ] Cache configurado

### 2. Comandos Pre-Deployment

```bash
# 1. Ejecutar health check
npm run health-check

# 2. Ejecutar todos los tests
npm test

# 3. Build de producción
npm run build

# 4. Audit de seguridad
npm audit --audit-level moderate

# 5. Backup de base de datos
npm run backup:create
```

---

## Deployment Production

### 1. Método Blue-Green (Recomendado)

#### Preparación del Ambiente Green
```bash
# 1. Crear nueva instancia
docker-compose -f docker-compose.prod.yml up -d --scale app=2

# 2. Health check del nuevo ambiente
./scripts/deploy-health-check.js --url https://green.airabot.com

# 3. Smoke tests
npm run test:smoke -- --env=green
```

#### Switch de Tráfico
```bash
# 1. Actualizar load balancer
# (Específico del proveedor - AWS ALB, Nginx, etc.)

# 2. Verificar tráfico
./scripts/deploy-health-check.js --url https://airabot.com

# 3. Monitor por 10 minutos
npm run monitor:deployment
```

### 2. Método Rolling Update

```bash
# 1. Update gradual de instancias
for i in {1..3}; do
    docker-compose -f docker-compose.prod.yml up -d --scale app=$i
    sleep 30
    ./scripts/deploy-health-check.js
done
```

### 3. Método Direct (Solo para cambios menores)

```bash
# 1. Backup automático
npm run backup:auto

# 2. Stop servicios
docker-compose -f docker-compose.prod.yml down

# 3. Deploy nueva versión
docker-compose -f docker-compose.prod.yml up -d

# 4. Health check
./scripts/deploy-health-check.js

# 5. Warm up cache
curl -X POST https://airabot.com/api/admin/warmup
```

---

## Post-Deployment

### 1. Verificaciones Inmediatas (0-5 min)

```bash
# Health check completo
./scripts/deploy-health-check.js --checks server,database,api,security

# Verificar logs
docker-compose logs --tail=100 app

# Test funcional básico
npm run test:functional -- --env=production
```

### 2. Verificaciones Extendidas (5-30 min)

```bash
# Performance monitoring
npm run monitor:performance -- --duration=30m

# Error rate monitoring
npm run monitor:errors -- --threshold=1%

# User acceptance test
npm run test:e2e -- --env=production
```

### 3. Comunicación

```bash
# Notificar deployment exitoso
npm run notify:deployment:success

# Actualizar status page
curl -X POST https://status.airabot.com/api/incidents/resolve
```

---

## Rollback Procedures

### 1. Rollback Automático

#### Triggers para Rollback Automático
- Error rate > 5%
- Response time > 5 segundos
- Health check fallando por > 2 minutos
- CPU/Memory > 90% por > 5 minutos

#### Script de Rollback
```bash
#!/bin/bash
# scripts/rollback.sh

# 1. Detectar versión anterior
PREVIOUS_VERSION=$(docker images --format "table {{.Repository}}:{{.Tag}}" | grep airabot | sed -n '2p')

# 2. Rollback rápido
docker-compose -f docker-compose.prod.yml down
docker tag $PREVIOUS_VERSION airabot:latest
docker-compose -f docker-compose.prod.yml up -d

# 3. Verificar rollback
./scripts/deploy-health-check.js

# 4. Notificar
npm run notify:rollback
```

### 2. Rollback Manual

```bash
# 1. Ejecutar rollback
npm run rollback

# 2. Verificar sistema
./scripts/deploy-health-check.js

# 3. Restaurar base de datos (si necesario)
npm run backup:restore -- --version=last-good

# 4. Investigar issue
npm run logs:analysis -- --since="1h"
```

---

## Monitoring

### 1. Métricas Clave

#### Application Metrics
- Response time (P95 < 2s)
- Error rate (< 1%)
- Throughput (requests/min)
- Active users

#### Infrastructure Metrics
- CPU usage (< 70%)
- Memory usage (< 80%)
- Disk usage (< 85%)
- Network I/O

#### Business Metrics
- User registrations
- Session duration
- Feature usage
- Conversion rates

### 2. Alertas Configuradas

```javascript
// Ejemplo de configuración de alertas
const alerts = {
    errorRate: {
        threshold: '5%',
        duration: '5m',
        action: 'page-oncall'
    },
    responseTime: {
        threshold: '5s',
        duration: '2m',
        action: 'slack-notification'
    },
    healthCheck: {
        threshold: 'failing',
        duration: '30s',
        action: 'auto-rollback'
    }
};
```

---

## Troubleshooting

### 1. Problemas Comunes

#### Deployment Fails
```bash
# Verificar logs
docker-compose logs app

# Verificar recursos
docker system df
free -h

# Verificar configuración
npm run config:validate
```

#### High Error Rate
```bash
# Análisis de errores
npm run logs:errors -- --last=1h

# Verificar dependencies
npm run health:dependencies

# Rollback si necesario
npm run rollback
```

#### Performance Issues
```bash
# Profiling
npm run profile:production

# Database performance
npm run db:analyze

# Cache analysis
npm run cache:stats
```

### 2. Contactos de Emergencia

```yaml
escalation:
  level1: 
    - dev-team@airabot.com
    - slack: #dev-alerts
  level2:
    - devops@airabot.com
    - phone: +1-xxx-xxx-xxxx
  level3:
    - cto@airabot.com
    - emergency-line: +1-xxx-xxx-xxxx
```

---

## Comandos Útiles

### Development to Production Pipeline
```bash
# Proceso completo
npm run deploy:full

# Solo verificaciones
npm run deploy:check

# Deploy con backup
npm run deploy:safe

# Deploy con monitoring extendido
npm run deploy:monitored
```

### Maintenance Commands
```bash
# Maintenance mode ON
npm run maintenance:on

# Maintenance mode OFF  
npm run maintenance:off

# Database maintenance
npm run db:maintenance

# Log rotation
npm run logs:rotate
```

### Emergency Commands
```bash
# Emergency rollback
npm run emergency:rollback

# Emergency scaling
npm run emergency:scale -- --instances=5

# Emergency maintenance
npm run emergency:maintenance
```

---

## Checklist Final de Deployment

### ✅ Pre-Deployment
- [ ] Health check passing
- [ ] All tests green
- [ ] Security audit completed
- [ ] Backup created
- [ ] Team notified

### ✅ Durante Deployment
- [ ] Blue-green switch successful
- [ ] Health checks passing
- [ ] No errors in logs
- [ ] Performance metrics normal
- [ ] User traffic stable

### ✅ Post-Deployment
- [ ] Extended monitoring active
- [ ] User acceptance tests passing
- [ ] Documentation updated
- [ ] Team notified of success
- [ ] Rollback plan ready

---

## Automatización

### GitHub Actions Workflow
```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
    
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Pre-deployment checks
        run: npm run deploy:check
      - name: Deploy
        run: npm run deploy:production
      - name: Post-deployment verification
        run: npm run deploy:verify
```

### Rollback Automation
```yaml
# .github/workflows/auto-rollback.yml
name: Auto Rollback

on:
  repository_dispatch:
    types: [rollback]
    
jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Execute rollback
        run: npm run rollback:auto
      - name: Verify rollback
        run: npm run rollback:verify
      - name: Notify team
        run: npm run notify:rollback
```

---

*Documento actualizado: $(date)*
*Versión: 1.0*
*Responsable: DevOps Team* 