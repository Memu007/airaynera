#!/bin/bash

# 🚀 DEPLOY LOCAL - Prepara todo antes de subir al servidor

echo "╔════════════════════════════════════╗"
echo "║     🚀 AIRA DEPLOY AUTOMÁTICO      ║"
echo "╚════════════════════════════════════╝"
echo ""

# 1. Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No estás en la carpeta del proyecto"
    echo "   Ejecuta desde: beiabot-master/"
    exit 1
fi

echo "1️⃣ Limpiando proyecto..."
# Limpiar archivos innecesarios
rm -rf node_modules package-lock.json
rm -f *.log .DS_Store
find . -name "*.bak" -delete 2>/dev/null

echo "2️⃣ Verificando configuración..."
# Verificar .env existe
if [ ! -f ".env" ]; then
    echo "⚠️ Creando .env con valores seguros..."
    cat > .env << 'EOF'
JWT_SECRET=cambiar_esto_por_32_caracteres_random_seguros
WHATSAPP_WEBHOOK_TOKEN=cambiar_por_token_webhook_real
NODE_ENV=production
PORT=3002
ENABLE_WHATSAPP_INGEST=true
EOF
    echo "   ⚠️ IMPORTANTE: Edita .env con valores reales"
fi

echo "3️⃣ Creando archivo deploy para servidor..."
# Crear script que correrá en el servidor
cat > deploy-servidor.sh << 'DEPLOY_SCRIPT'
#!/bin/bash

# Script que corre EN EL SERVIDOR

echo "🖥️ DEPLOY EN SERVIDOR"
echo "====================="

# Ir a carpeta del proyecto
cd /var/www/aira || cd ~/aira || exit 1

# Backup antes de actualizar
echo "📦 Haciendo backup..."
if [ -d "backup" ]; then
    tar -czf "backup/pre-deploy-$(date +%Y%m%d-%H%M%S).tar.gz" data/ logs/ .env 2>/dev/null
fi

# Actualizar código
echo "📥 Actualizando código..."
git pull origin main || git pull origin master

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm ci --production

# Migrar base de datos si es necesario
if [ -f "db/database.js" ]; then
    echo "🗄️ Verificando base de datos..."
    node -e "require('./db/database.js')" 2>/dev/null
fi

# Reiniciar aplicación con PM2
echo "🔄 Reiniciando servicio..."
if command -v pm2 &> /dev/null; then
    pm2 restart aira || pm2 start server.js --name aira
    pm2 save
else
    # Si no hay PM2, usar systemd
    sudo systemctl restart aira || {
        echo "⚠️ PM2 no instalado. Instalando..."
        npm install -g pm2
        pm2 start server.js --name aira
        pm2 startup
        pm2 save
    }
fi

# Verificar que funciona
echo "✅ Verificando servicio..."
sleep 3
curl -s http://localhost:3002/health > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ DEPLOY EXITOSO!"
    pm2 status
else
    echo "❌ Error: El servicio no responde"
    echo "   Revisa logs con: pm2 logs aira"
fi
DEPLOY_SCRIPT

chmod +x deploy-servidor.sh

echo "4️⃣ Creando configuración PM2..."
# Configuración PM2 para mantener app viva
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'aira',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    merge_logs: true,
    // Reintentos automáticos
    min_uptime: "10s",
    max_restarts: 5,
    // Esperar que app esté lista
    wait_ready: true,
    listen_timeout: 3000
  }]
};
EOF

echo "5️⃣ Verificando todo está listo..."
# Checklist final
READY=true

# Verificar archivos críticos
for file in "server.js" "package.json" ".env" "deploy-servidor.sh"; do
    if [ ! -f "$file" ]; then
        echo "   ❌ Falta: $file"
        READY=false
    else
        echo "   ✅ $file"
    fi
done

echo ""
if [ "$READY" = true ]; then
    echo "╔════════════════════════════════════╗"
    echo "║    ✅ LISTO PARA DEPLOY           ║"
    echo "╚════════════════════════════════════╝"
    echo ""
    echo "📝 PRÓXIMOS PASOS:"
    echo ""
    echo "1. Editar .env con valores reales"
    echo "2. Subir a GitHub:"
    echo "   git add ."
    echo "   git commit -m 'Deploy producción'"
    echo "   git push origin main"
    echo ""
    echo "3. En el servidor ejecutar:"
    echo "   git clone [tu-repo-github]"
    echo "   cd aira"
    echo "   ./deploy-servidor.sh"
    echo ""
else
    echo "⚠️ Revisa los archivos faltantes antes de continuar"
fi
