# 📋 CHECKLIST MAESTRO - TODO PARA DEPLOY

## ✅ **1. PREPARACIÓN LOCAL** (Tu Mac)

### Archivos críticos
- [ ] `server.js` existe y funciona
- [ ] `package.json` sin errores de sintaxis
- [ ] `.env` con variables reales (no placeholders)
- [ ] `data/` carpeta creada
- [ ] `logs/` carpeta creada

### Configuración .env
```bash
JWT_SECRET=                  # 32+ caracteres random
WHATSAPP_WEBHOOK_TOKEN=      # Token de Meta
NODE_ENV=production          # Siempre production
PORT=3002                    # Puerto libre
FIREBASE_PROJECT_ID=         # Si usás Firebase
FIREBASE_PRIVATE_KEY=        # Clave Firebase
```

### Comandos para preparar
```bash
# 1. Limpiar proyecto
rm -rf node_modules package-lock.json

# 2. Instalar limpio
npm ci --production

# 3. Test local
npm start
# Verificar: http://localhost:3002

# 4. Detener con Ctrl+C
```

---

## 🌐 **2. GITHUB** (Repositorio)

### Crear repo si no existe
- [ ] Ir a github.com → New repository
- [ ] Nombre: `beiabot-master`
- [ ] Privado recomendado
- [ ] NO inicializar con README

### Subir código
```bash
# Primera vez
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU-USUARIO/beiabot-master.git
git push -u origin main

# Actualizaciones
git add .
git commit -m "Update"
git push
```

### Verificar .gitignore
```
node_modules/
.env
*.log
data/*.db
logs/
.DS_Store
```

---

## 🚀 **3. OPCIONES DE DEPLOY**

### **A) RENDER (Gratis - Recomendado)**

**Ventajas:** SSL gratis, deploy automático, 750h/mes gratis
**Desventajas:** Duerme tras 15min inactividad

1. [ ] Crear cuenta en render.com
2. [ ] New + → Web Service
3. [ ] Conectar GitHub
4. [ ] Configuración:
   - Build: `npm install`
   - Start: `npm start`
   - Plan: Free
5. [ ] Variables entorno (Environment)
6. [ ] Deploy

**URL final:** `https://[tu-app].onrender.com`

### **B) DIGITALOCEAN ($6/mes)**

**Ventajas:** Control total, siempre activo, IP fija
**Desventajas:** Costo mensual, requiere configuración

1. [ ] Crear Droplet Ubuntu 22.04
2. [ ] Anotar IP: `XXX.XXX.XXX.XXX`
3. [ ] SSH al servidor
4. [ ] Instalar Node + PM2
5. [ ] Clonar repo
6. [ ] Configurar Nginx

### **C) RAILWAY ($5/mes)**

**Ventajas:** Super fácil, GitHub integrado
**Desventajas:** Límite 500MB RAM

1. [ ] railway.app → Deploy from GitHub
2. [ ] Variables automáticas
3. [ ] Listo

### **D) LOCAL (Testing)**

**Solo para probar, no es 24/7**

```bash
npm start
# Abrir: http://localhost:3002
```

---

## 🔧 **4. CONFIGURACIÓN SERVIDOR** (Si elegís VPS)

### Software necesario
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (mantiene app viva)
npm install -g pm2

# Nginx (proxy reverso)
sudo apt install nginx

# Git
sudo apt install git

# Certbot (SSL)
sudo apt install certbot python3-certbot-nginx
```

### Configuración PM2
```bash
pm2 start server.js --name aira
pm2 startup
pm2 save
```

### Configuración Nginx
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔐 **5. SEGURIDAD**

### Antes de deploy
- [ ] Cambiar credenciales demo
- [ ] JWT_SECRET único y seguro
- [ ] .env NO en GitHub
- [ ] HTTPS configurado
- [ ] Rate limiting activo

### Después de deploy
- [ ] Probar login
- [ ] Verificar logs
- [ ] Monitorear 24h
- [ ] Backup inicial

---

## 📱 **6. WHATSAPP INTEGRATION**

### Meta Business
1. [ ] Crear app en developers.facebook.com
2. [ ] WhatsApp → Configuración
3. [ ] Webhook URL: `https://tu-app.com/webhook`
4. [ ] Verify Token: (mismo que .env)
5. [ ] Suscribir a mensajes

### Probar
```bash
curl -X POST https://tu-app.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"test":"message"}'
```

---

## 🧪 **7. TESTING POST-DEPLOY**

### Health check
```bash
curl https://tu-app.com/health
# Debe devolver: {"status":"ok"}
```

### Login test
```bash
curl -X POST https://tu-app.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"dni":"12345678","pin":"1234"}'
```

### WhatsApp test
- Enviar audio a tu número business
- Verificar transcripción

---

## 📊 **8. MONITOREO**

### Gratis
- [ ] UptimeRobot.com - Alertas si cae
- [ ] PM2 web dashboard - `pm2 web`

### Logs
```bash
# Ver logs en tiempo real
pm2 logs aira

# Ver errores
pm2 logs aira --err

# Estado
pm2 status
```

---

## 🔄 **9. ACTUALIZACIONES**

### Proceso seguro
```bash
# 1. Backup
tar -czf backup-$(date +%Y%m%d).tar.gz data/ logs/

# 2. Pull cambios
git pull

# 3. Instalar dependencias
npm ci --production

# 4. Restart
pm2 reload aira

# 5. Verificar
pm2 status
curl localhost:3002/health
```

---

## ⚠️ **10. ROLLBACK SI FALLA**

```bash
# Volver a versión anterior
git checkout HEAD~1
npm ci --production
pm2 restart aira

# Restaurar backup
tar -xzf backup-FECHA.tar.gz
```

---

## 📝 **NOTAS IMPORTANTES**

1. **Primera vez:** Empezá con Render (gratis)
2. **Producción real:** Migrá a DigitalOcean
3. **Siempre:** Backup antes de cambios
4. **Secreto:** Nunca compartas .env
5. **Monitoreo:** Revisá logs diariamente

---

## 🎯 **ORDEN RECOMENDADO**

1. **HOY:** Deploy en Render (gratis, 10min)
2. **MAÑANA:** Probar con 1 usuario
3. **3 DÍAS:** Si funciona, configurar dominio
4. **1 SEMANA:** Si escala, migrar a VPS
5. **1 MES:** Automatizar backups

---

**✅ Con este checklist tenés TODO para deployar sin experiencia**
