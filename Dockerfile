# Etapa 1: Build - Instala dependencias y prepara el código
FROM node:18-slim AS builder

# Metadata
LABEL maintainer="AIRA Team <support@aira.com>"
LABEL description="AIRA Medical Assistant - Production Build"
LABEL version="2.0.0"

# Crear usuario no-root
RUN addgroup -g 1001 -S aira && \
    adduser -S aira -u 1001

# Directorio de trabajo
WORKDIR /usr/src/app

# Copia los archivos de manifiesto del paquete
COPY package*.json ./

# Instala todas las dependencias (incluidas las de desarrollo para cualquier posible build step)
RUN npm install

# Copia todo el código fuente
COPY . .

# (Opcional) Si tuvieras un paso de build (ej. TypeScript), iría aquí
# RUN npm run build

# Optimizar assets
RUN node build/optimize-assets.js || echo "Asset optimization skipped"

# Crear estructura de directorios necesaria
RUN mkdir -p logs dist tmp

# Cambiar ownership a usuario aira
RUN chown -R aira:aira /usr/src/app

# Etapa 2: Producción - Crea la imagen final, limpia y optimizada
FROM node:18-alpine

# Instalar dependencias del sistema
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    tzdata

# Crear usuario no-root
RUN addgroup -g 1001 -S aira && \
    adduser -S aira -u 1001

# Configurar timezone
ENV TZ=America/Argentina/Buenos_Aires
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Directorio de trabajo
WORKDIR /usr/src/app

# Copia los manifiestos de nuevo
COPY package*.json ./

# Instala ÚNICAMENTE las dependencias de producción en un entorno limpio
RUN npm ci --omit=dev

# Copia el código fuente desde la etapa de build
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/js ./js
COPY --from=builder /usr/src/app/css ./css
COPY --from=builder /usr/src/app/images ./images
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/demopagina_funcional_backup.html ./
COPY --from=builder /usr/src/app/server-secure.js ./
COPY --from=builder /usr/src/app/scripts ./scripts
COPY --from=builder /usr/src/app/firestore.rules ./
COPY --from=builder /usr/src/app/env.example ./

# Crear directorios necesarios
RUN mkdir -p logs tmp uploads && \
    chown -R aira:aira logs tmp uploads

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=8082
ENV LOG_LEVEL=info
ENV TZ=America/Argentina/Buenos_Aires

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:$PORT/api/health || exit 1

# Exponer puerto
EXPOSE $PORT

# Cambiar a usuario no-root
USER aira

# Comando de inicio con dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server-secure.js"]

# ===== LABELS PARA METADATA =====
LABEL org.opencontainers.image.title="AIRA Medical Assistant"
LABEL org.opencontainers.image.description="Asistente médico inteligente para profesionales de salud mental"
LABEL org.opencontainers.image.url="https://aira.com"
LABEL org.opencontainers.image.documentation="https://docs.aira.com"
LABEL org.opencontainers.image.source="https://github.com/aira/aira-backend"
LABEL org.opencontainers.image.vendor="AIRA Team"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="2.0.0" 