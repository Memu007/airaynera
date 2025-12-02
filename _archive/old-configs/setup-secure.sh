#!/bin/bash

# SETUP SEGURO AIRA - Instalación rápida

echo "🚀 CONFIGURACIÓN SEGURA AIRA"
echo "============================"

# 1. Generar claves seguras
echo "1. Generando claves seguras..."
if [ ! -f .env ]; then
    echo "JWT_SECRET=$(openssl rand -hex 32)" > .env
    echo "WHATSAPP_WEBHOOK_TOKEN=$(openssl rand -hex 16)" >> .env
    echo "ENABLE_WHATSAPP_INGEST=true" >> .env
    echo "NODE_ENV=production" >> .env
    echo "PORT=3002" >> .env
    echo "✅ Claves generadas"
else
    echo "⚠️ .env ya existe"
fi

# 2. Crear directorios necesarios
echo "2. Creando directorios..."
mkdir -p data logs reportes uploads/temp
echo "✅ Directorios creados"

# 3. Permisos seguros
echo "3. Configurando permisos..."
chmod 600 .env
chmod 700 data logs
echo "✅ Permisos configurados"

# 4. Instalar dependencias (opcional)
read -p "¿Instalar dependencias npm? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    npm install
    echo "✅ Dependencias instaladas"
fi

# 5. Test de seguridad rápido
echo ""
echo "4. Test de seguridad..."
node -e "
const crypto = require('crypto');
console.log('✅ Crypto disponible');
console.log('✅ Random bytes:', crypto.randomBytes(8).toString('hex'));
"

echo ""
echo "============================"
echo "✅ SETUP COMPLETO"
echo ""
echo "Para iniciar:"
echo "  npm start"
echo ""
echo "Credenciales demo:"
echo "  DNI: 12345678"
echo "  PIN: 1234"
echo ""
echo "⚠️ IMPORTANTE: Cambiar credenciales en producción"
