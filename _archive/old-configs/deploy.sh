#!/bin/bash

# Script de deploy para AIRA Bot

echo "🚀 Iniciando despliegue de AIRA Bot"

# 1. Instalar dependencias
echo "📦 Instalando dependencias..."
npm install --production

# 2. Verificar variables de entorno
if [ ! -f ".env" ]; then
  echo "❌ Error: Archivo .env no encontrado"
  exit 1
fi

# 3. Iniciar servidor
echo "🖥  Iniciando servidor..."
NODE_ENV=production node minimalServer.js &

# 4. Verificar salud
echo "🩺 Verificando salud del servicio..."
sleep 5
curl -s http://localhost:8080/health | grep ok || {
  echo "❌ Error: El servicio no responde correctamente"
  exit 1
}

echo "✅ Despliegue completado exitosamente!"
