# Guía de Despliegue AIRA Bot

## Requisitos Previos
- Node.js 16+
- Cuenta Firebase con Firestore
- Archivo `service-account-key.json`

## Pasos para Deploy

1. **Configurar entorno**
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Ejecutar script de deploy**
```bash
chmod +x deploy.sh
./deploy.sh
```

4. **Verificar**
```bash
curl http://localhost:8080/health
# Debería responder: {"status":"ok"}
```

## Variables de Entorno Obligatorias
```
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
FIREBASE_PROJECT_ID=tu-project-id
JWT_SECRET=tu-secreto-seguro
```
