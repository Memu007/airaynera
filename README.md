# AIRA Medical

Sistema de gestión para profesionales de salud mental. Gestiona pacientes y sesiones con SQLite.

## Requisitos

- Node.js >= 18
- npm >= 8

## Instalación

```bash
npm install
```

## Configuración

Copiar `.env.example` a `.env` y configurar:

```bash
cp .env.example .env
```

Variables principales:
- `PORT` - Puerto del servidor (default: 3000)
- `JWT_SECRET` - Secreto para tokens JWT
- `DATA_KEY` - Clave de cifrado para datos sensibles (opcional)

## Ejecutar

```bash
# Desarrollo
npm run dev

# Producción
npm start
```

Abrir en navegador: `http://localhost:3000`

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth/verify` | Verificar token |
| GET | `/api/patients` | Listar pacientes |
| POST | `/api/patients` | Crear paciente |
| PATCH | `/api/patients/:id` | Actualizar paciente |
| DELETE | `/api/patients/:id` | Eliminar paciente |
| GET | `/api/sessions` | Listar sesiones |
| POST | `/api/sessions` | Crear sesión |
| PATCH | `/api/sessions/:id` | Actualizar sesión |
| DELETE | `/api/sessions/:id` | Eliminar sesión |

## Deploy

### Render

1. Conectar repositorio en Render
2. El archivo `render.yaml` configura todo automáticamente
3. Variables JWT_SECRET y DATA_KEY se generan automáticamente

### Docker

```bash
docker build -t aira-medical .
docker run -p 3000:3000 -v ./data:/app/data aira-medical
```

### VPS (PM2)

```bash
npm install -g pm2
pm2 start server.js --name aira
pm2 save
```

## Backup

```bash
npm run backup
```

Los backups se guardan en `data/backups/`.

## Estructura

```
├── server.js          # Servidor Express
├── index.html         # Frontend completo
├── services/
│   └── sqlite.js      # Base de datos SQLite
├── utils/
│   └── crypto.js      # Cifrado de datos
├── js/, css/, images/ # Assets frontend
├── data/              # SQLite y datos
└── scripts/
    └── backup-simple.js
```

## Escala

Optimizado para:
- Hasta 2000 profesionales
- 400 pacientes por profesional (800K total)
- 20M+ sesiones

SQLite con WAL mode + índices compuestos.
