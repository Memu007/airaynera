# 📚 GUÍA DEPLOY PARA PRINCIPIANTES - AIRA

**Tiempo total: 30 minutos**  
**Dificultad: Fácil** ⭐

---

## 🎯 OPCIÓN 1: DEPLOY GRATIS (Recomendado para empezar)

### **Render.com - Gratis con límites**

1. **Crear cuenta en [Render.com](https://render.com)**
   - Registrate con GitHub
   - Plan gratuito incluye 750 horas/mes

2. **Conectar tu repositorio**
   ```
   Click "New +" → "Web Service"
   → Conectar GitHub
   → Elegir tu repo "beiabot-master"
   ```

3. **Configuración automática**
   ```
   Name: aira-bot
   Environment: Node
   Build Command: npm install
   Start Command: npm start
   Plan: Free
   ```

4. **Variables de entorno (importante!)**
   Click "Environment" y agregar:
   ```
   JWT_SECRET = (generar en https://randomkeygen.com)
   NODE_ENV = production
   PORT = 3002
   ```

5. **Deploy automático**
   Click "Create Web Service"
   
**URL final:** `https://aira-bot.onrender.com`

---

## 🚀 OPCIÓN 2: DEPLOY PROFESIONAL

### **DigitalOcean - $6/mes**

#### A. Crear Droplet (servidor)

1. **Registrarse en [DigitalOcean](https://digitalocean.com)**
   - Obtén $200 gratis: https://try.digitalocean.com/freetrialoffer

2. **Crear Droplet**
   ```
   Create → Droplets
   → Ubuntu 22.04
   → Basic → Regular → $6/month
   → Datacenter: New York
   → Authentication: Password (anótalo!)
   → Hostname: aira-server
   → Create Droplet
   ```

3. **Anotar IP del servidor**
   Ejemplo: `143.198.123.45`

#### B. Configurar servidor (copia y pega)

1. **Conectar por terminal**
   ```bash
   # En tu Mac:
   ssh root@143.198.123.45
   # Poner password que anotaste
   ```

2. **Instalar todo (1 comando)**
   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash && \
   source ~/.bashrc && \
   nvm install 20 && \
   npm install -g pm2 && \
   apt update && apt install -y nginx git
   ```

3. **Clonar tu proyecto**
   ```bash
   cd /var/www
   git clone https://github.com/TU-USUARIO/beiabot-master.git aira
   cd aira
   ```

4. **Configurar variables**
   ```bash
   nano .env
   # Pegar tu configuración
   # Ctrl+X, Y, Enter para guardar
   ```

5. **Instalar y ejecutar**
   ```bash
   npm install --production
   pm2 start server.js --name aira
   pm2 startup
   pm2 save
   ```

#### C. Configurar dominio (opcional)

1. **Comprar dominio** en Namecheap ($10/año)
2. **Apuntar a servidor**
   ```
   A Record → @ → 143.198.123.45
   A Record → www → 143.198.123.45
   ```

3. **SSL gratis con Certbot**
   ```bash
   apt install certbot python3-certbot-nginx
   certbot --nginx -d tu-dominio.com
   ```

---

## 🎨 OPCIÓN 3: DEPLOY SUPER FÁCIL

### **Railway.app - Un click**

1. **Click en este botón:**
   
   [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

2. **Configurar variables:**
   - JWT_SECRET: (generar)
   - NODE_ENV: production

3. **Listo!** URL tipo: `aira.railway.app`

---

## 📱 OPCIÓN 4: DEPLOY DESDE EL CELULAR

### **Usando Termux (Android)**

1. Instalar Termux desde F-Droid
2. Comandos:
   ```bash
   pkg update && pkg upgrade
   pkg install nodejs git
   git clone [tu-repo]
   cd beiabot-master
   npm install
   npm start
   ```

---

## 🆘 SOLUCIÓN DE PROBLEMAS

### Error: "Permission denied"
```bash
chmod +x deploy-local.sh
sudo chown -R $(whoami) .
```

### Error: "Port 3002 in use"
```bash
lsof -i :3002
kill -9 [PID]
# O cambiar puerto en .env
```

### Error: "Cannot find module"
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Error: "Database locked"
```bash
rm data/*.db-journal
pm2 restart aira
```

---

## ✅ VERIFICACIÓN POST-DEPLOY

### Test rápido (tu computadora)
```bash
# Reemplaza URL con tu dominio
curl https://tu-app.com/health

# Test login
curl -X POST https://tu-app.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"dni":"12345678","pin":"1234"}'
```

### Monitoreo gratis
1. Registrarse en [UptimeRobot](https://uptimerobot.com)
2. Add Monitor → HTTP → tu-url.com
3. Te avisa si se cae

---

## 💰 COMPARACIÓN DE COSTOS

| Servicio | Costo | Pros | Contras |
|----------|-------|------|---------|
| Render | GRATIS | Fácil, SSL auto | Duerme tras 15min |
| Railway | $5/mes | Super fácil | Límite 500MB |
| DigitalOcean | $6/mes | Control total | Requiere config |
| Heroku | $7/mes | Muy estable | Más caro |
| Tu PC | GRATIS | Testing | No es 24/7 |

---

## 🎯 MI RECOMENDACIÓN

**Para empezar HOY:**
1. Usa **Render.com** (gratis)
2. Prueba 1 semana
3. Si funciona bien → DigitalOcean

---

## 📞 AYUDA

Si algo falla, estos comandos te salvan:

```bash
# Ver qué está pasando
pm2 logs aira

# Reiniciar todo
pm2 restart all

# Ver estado
pm2 status

# Rollback si algo sale mal
git checkout HEAD~1
pm2 restart aira
```

**¿Atascado?** Busca el error en Google con comillas.

---

**✨ LISTO! Con esta guía deployás en 30 minutos sin experiencia.**
