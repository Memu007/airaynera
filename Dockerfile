# AIRA Medical - Dockerfile simplificado
FROM node:18-alpine

# Instalar dependencias del sistema (para better-sqlite3)
RUN apk add --no-cache python3 make g++ curl

# Crear usuario no-root
RUN addgroup -S aira && adduser -S aira -G aira

WORKDIR /app

# Copiar package.json primero (para cache de npm install)
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --omit=dev

# Copiar código fuente
COPY server.js ./
COPY services/ ./services/
COPY utils/ ./utils/
COPY js/ ./js/
COPY css/ ./css/
COPY images/ ./images/
COPY index.html ./

# Crear directorios necesarios
RUN mkdir -p data logs uploads && chown -R aira:aira /app

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

EXPOSE $PORT

USER aira

CMD ["node", "server.js"]
