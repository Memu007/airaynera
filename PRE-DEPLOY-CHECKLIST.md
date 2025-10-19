# ⚡ PRE-DEPLOY CHECKLIST FINAL - AIRA
**Ejecutar 30 min antes del deploy**  
**Fecha:** 13 Agosto 2024

---

## 🔴 CRÍTICO - Bloquea Deploy

### SEGURIDAD
- [ ] Cambiar credenciales demo (DNI: 12345678)
- [ ] Verificar .env tiene claves reales (no placeholders)
- [ ] Confirmar FIREBASE_PRIVATE_KEY configurada
- [ ] JWT_SECRET mínimo 32 caracteres
- [ ] .gitignore incluye .env, *.db, logs/

### DATOS
- [ ] Backup manual antes de deploy
- [ ] Verificar migración SQLite → Firebase funciona
- [ ] Test de persistencia (reiniciar y verificar datos)

### CONFIGURACIÓN
- [ ] Puerto 3002 disponible en servidor
- [ ] Dominio apuntando correctamente
- [ ] SSL certificado válido

---

## 🟡 IMPORTANTE - Deploy con precaución

### PERFORMANCE
- [ ] npm audit fix ejecutado
- [ ] package.json sin duplicados
- [ ] node_modules limpio (npm ci)
- [ ] Logs con espacio suficiente (>1GB)

### MONITOREO
- [ ] Telemetría capturando métricas
- [ ] Logs escribiendo correctamente
- [ ] Rate limiting verificado (test manual)

### WHATSAPP
- [ ] WHATSAPP_WEBHOOK_TOKEN configurado
- [ ] Webhook URL registrado en Meta
- [ ] Test mensaje de voz funciona

---

## 🟢 NICE TO HAVE - No bloquea

### OPTIMIZACIÓN
- [ ] Comprimir assets JS/CSS
- [ ] Cache headers configurados
- [ ] Favicon presente

### DOCUMENTACIÓN
- [ ] README actualizado
- [ ] Credenciales en 1Password/Vault
- [ ] Contacto soporte definido

---

## 📋 COMANDOS PRE-DEPLOY

```bash
# 1. LIMPIEZA
rm -rf node_modules package-lock.json
npm ci --production

# 2. VERIFICACIÓN
npm audit
node -e "console.log('Node:', process.version)"
node -e "require('crypto').randomBytes(32, (e,b) => console.log('Crypto OK:', !e))"

# 3. TEST RÁPIDO
curl -I http://localhost:3002/health
curl -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"dni":"12345678","pin":"1234"}'

# 4. BACKUP
cp data/aira.db data/aira-pre-deploy-$(date +%Y%m%d).db
tar -czf backup-pre-deploy.tar.gz data/ logs/

# 5. PERMISOS
chmod 600 .env
chmod 700 data/ logs/
```

---

## 🚨 ROLLBACK PLAN

Si algo falla post-deploy:

```bash
# 1. DETENER SERVICIO
pm2 stop aira || systemctl stop aira

# 2. RESTAURAR BACKUP
tar -xzf backup-pre-deploy.tar.gz
cp data/aira-pre-deploy-*.db data/aira.db

# 3. VERSION ANTERIOR
git checkout [último-commit-estable]
npm ci

# 4. REINICIAR
pm2 start server.js --name aira
```

---

## ✅ SIGNOFF CHECKLIST

**Pre-Deploy:**
- [ ] Dev lead aprobó código
- [ ] QA testeó funcionalidades críticas
- [ ] Cliente notificado de ventana mantenimiento

**Deploy:**
- [ ] Backup completado
- [ ] Servidor health check OK
- [ ] Monitoreo activo

**Post-Deploy:**
- [ ] Test E2E pasando
- [ ] Sin errores en logs (5 min)
- [ ] Cliente confirmó funciona

---

## 📞 CONTACTOS EMERGENCIA

```
Dev Lead: [nombre] - [teléfono]
DevOps: [nombre] - [teléfono]
Cliente: [nombre] - [teléfono]
```

---

## ⏰ TIMELINE DEPLOY

```
T-30min: Pre-deploy checks
T-15min: Backup completo
T-10min: Notificar usuarios
T-5min: Stop servicio actual
T-0: Deploy nuevo código
T+5min: Health checks
T+10min: Test E2E
T+15min: Go/No-Go decision
T+30min: Monitoreo estable
```

---

**FIRMA DEPLOY:**
- Dev: ________________
- QA: _________________
- PM: _________________

**RESULTADO:** [ ] SUCCESS [ ] ROLLBACK
