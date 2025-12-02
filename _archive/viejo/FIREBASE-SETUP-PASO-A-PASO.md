# 🔥 FIREBASE SETUP - PASO A PASO (30 min)

## 📋 **LO QUE NECESITÁS ANTES DE EMPEZAR**

### Cuentas necesarias:
- ✅ Google Cloud (ya tenés con $20/mes)
- ✅ Meta Business (para WhatsApp)

---

## 🚀 **PASO 1: CREAR PROYECTO FIREBASE** (5 min)

1. Ir a [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Create a project"**
3. Nombre: `aira-medical-bot`
4. **SÍ** habilitar Google Analytics
5. Elegir cuenta default
6. Click **"Create project"**

---

## 🔑 **PASO 2: OBTENER TODAS LAS KEYS** (10 min)

### A. Service Account (para backend)
```
Firebase Console → ⚙️ Project Settings → Service Accounts
→ Generate new private key
→ Guardar como: service-account-key.json
```

### B. Gemini AI Key
```
1. Ir a: https://makersuite.google.com/app/apikey
2. Click "Create API Key"
3. Copiar: AIzaSy...
```

### C. WhatsApp Business
```
1. Ir a: https://business.facebook.com
2. Apps → Create App → Business
3. Add Product → WhatsApp
4. Copiar:
   - Access Token: EAAG...
   - Phone Number ID: 123456...
   - Business Account ID: 123456...
```

### D. Generar secrets locales
```bash
# En tu terminal:
openssl rand -hex 32
# Copiar para JWT_SECRET

openssl rand -hex 32  
# Copiar para MASTER_KEY
```

---

## 📝 **PASO 3: CONFIGURAR .env** (2 min)

```bash
# Copiar template
cp .env.firebase .env

# Editar con tus valores
nano .env
```

Llenar estos campos:
```
GOOGLE_CLOUD_PROJECT_ID=aira-medical-bot
GEMINI_API_KEY=AIzaSy...(tu key)
WHATSAPP_API_TOKEN=EAAG...(tu token)
WHATSAPP_PHONE_NUMBER_ID=(tu ID)
JWT_SECRET=(32 caracteres random)
MASTER_KEY=(32 caracteres random)
```

---

## 🔧 **PASO 4: CONFIGURAR FIREBASE LOCAL** (3 min)

```bash
# Instalar CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar
firebase init
```

Seleccionar:
- ✅ Firestore
- ✅ Functions
- ✅ Hosting
- Use existing project → aira-medical-bot
- Functions language: JavaScript
- Install dependencies: Yes
- Public directory: public
- Single-page app: No

---

## 🚀 **PASO 5: DEPLOY** (5 min)

```bash
# Deploy automático
chmod +x deploy-firebase.sh
./deploy-firebase.sh
```

O manual:
```bash
firebase deploy
```

---

## ✅ **PASO 6: CONFIGURAR WEBHOOK WHATSAPP** (5 min)

1. Copiar tu URL:
   ```
   https://us-central1-aira-medical-bot.cloudfunctions.net/app/webhook/whatsapp
   ```

2. En Meta Business:
   ```
   WhatsApp → Configuration → Webhooks
   → Callback URL: [pegar URL]
   → Verify Token: (mismo que en .env)
   → Subscribe to: messages
   ```

---

## 🧪 **VERIFICACIÓN FINAL**

### Test 1: Health Check
```bash
curl https://aira-medical-bot.web.app/api/health
# Debe responder: {"status":"ok"}
```

### Test 2: Ver logs
```bash
firebase functions:log
```

### Test 3: WhatsApp
- Enviar mensaje al número business
- Ver logs para confirmar recepción

---

## 🎯 **URLs FINALES**

| Servicio | URL |
|----------|-----|
| **App Web** | https://aira-medical-bot.web.app |
| **API** | https://aira-medical-bot.web.app/api |
| **WhatsApp Webhook** | https://us-central1-aira-medical-bot.cloudfunctions.net/app/webhook/whatsapp |
| **Dashboard** | https://console.firebase.google.com |

---

## ⚠️ **TROUBLESHOOTING**

### Error: "Permission denied"
```bash
# Verificar service account
cat service-account-key.json
```

### Error: "Quota exceeded"
- Verificar billing en Google Cloud Console
- Tu plan de $20 debería cubrir 10k usuarios

### Error: "Function deployment failed"
```bash
# Limpiar y reintentar
rm -rf functions/node_modules
cd functions && npm install
firebase deploy --only functions
```

---

## 💰 **COSTOS CON TU PLAN $20/MES**

| Recurso | Incluido | Costo adicional |
|---------|----------|-----------------|
| Firestore | 1GB/día gratis | Incluido en plan |
| Functions | 2M invocaciones | Incluido en plan |
| Hosting | 10GB transfer | Incluido en plan |
| Gemini AI | 60 req/min | Incluido en plan |

**Tu plan cubre hasta ~500 usuarios activos sin costo extra**

---

## ✅ **LISTO!**

Tu app está live en: **https://aira-medical-bot.web.app**
