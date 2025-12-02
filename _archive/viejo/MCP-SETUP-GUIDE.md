# 🏥 AIRA Medical System - MCP Setup Guide

## 📋 MCP Installation Status

### ✅ **MCPs Successfully Connected:**
- **sequential-thinking** - Análisis estructurado y toma de decisiones médica
- **memory** - Contexto persistente del sistema AIRA
- **chrome-devtools** - Testing frontend y debugging médico
- **code-review** - Calidad y seguridad de código médico
- **eslint** - Estándares de código profesional médico
- **filesystem** - Acceso y organización de archivos médicos

### ⚠️ **MCPs Installed - Need Configuration:**
- **firebase** - Requiere configuración de proyecto Firebase
- **fetch** - Requiere configuración de endpoints API
- **google-calendar** - Requiere OAuth credentials de Google
- **time** - Requiere configuración de timezone
- **encryption** - Requiere claves de encriptación
- **brave-search** - Requiere API key de Brave Search
- **pdf-generator** - Requiere configuración de templates
- **n8n-workflow-builder** - Requiere configuración de instancia n8n

## 🔧 **Configuración Requerida**

### 1. **Firebase Configuration**
```bash
# Crear proyecto en Firebase Console
# Descargar service account key
# Actualizar .env.mcp-aira con:
FIREBASE_PROJECT_ID=tu-proyecto-firebase
FIREBASE_CLIENT_EMAIL=tu-service-account@tu-proyecto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### 2. **Google Calendar Setup**
```bash
# Ir a Google Cloud Console
# Crear OAuth 2.0 credentials
# Habilitar Calendar API
# Actualizar .env.mcp-aira con:
GOOGLE_CALENDAR_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=tu-client-secret
```

### 3. **Brave Search API**
```bash
# Obtener API key de https://brave.com/search/api/
# Actualizar .env.mcp-aira con:
BRAVE_SEARCH_API_KEY=tu-brave-search-api-key
```

### 4. **Encryption Keys**
```bash
# Generar claves seguras:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Actualizar .env.mcp-aira con las claves generadas
```

## 🚀 **Próximos Pasos**

1. **Configurar las credenciales** en `.env.mcp-aira`
2. **Reiniciar Claude Code** para recargar MCPs
3. **Verificar conexión** con `claude mcp list`
4. **Comenzar FASE 1** del plan de protección de demopagina.html

## 📊 **Stack MCP Completo para AIRA**

### **Core Analysis (✅ Funcionando):**
- sequential-thinking, memory, filesystem

### **Development Tools (✅ Funcionando):**
- chrome-devtools, code-review, eslint

### **Medical Integration (Pendiente Config):**
- firebase, google-calendar, n8n-workflow-builder

### **Medical Utilities (Pendiente Config):**
- fetch, time, encryption, brave-search, pdf-generator

## 🎯 **Uso del Stack MCP Completo**

Una vez configurados, los MCPs permitirán:

- **Análisis médico estructurado** con sequential-thinking
- **Memoria contextual persistente** con memory
- **Testing frontend profesional** con chrome-devtools
- **Calidad de código médica** con code-review + eslint
- **Base de datos médica segura** con firebase
- **Gestión de citas profesionales** con google-calendar
- **Workflows médicos automatizados** con n8n
- **API calls optimizadas** con fetch
- **Manejo de horarios médicos** con time
- **PHI encryption segura** con encryption
- **Búsqueda médica privada** con brave-search
- **Reportes médicos en PDF** con pdf-generator

---

**Importante:** Reiniciar Claude Code después de configurar las credenciales médicas.