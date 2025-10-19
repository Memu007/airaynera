#!/bin/bash

# 🚀 DEPLOY FÁCIL - 1 CLICK
# Para quien nunca deployó antes

clear
echo "╔══════════════════════════════════════╗"
echo "║   🚀 DEPLOY AUTOMÁTICO AIRA 🚀      ║"
echo "║      (Para principiantes)            ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Detectar sistema operativo
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="Mac"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
else
    OS="Windows"
fi

echo "🖥️  Sistema detectado: $OS"
echo ""

# Menu principal
echo "¿Dónde querés deployar?"
echo ""
echo "1️⃣  GRATIS en Render (recomendado para empezar)"
echo "2️⃣  LOCAL en mi computadora (para probar)"
echo "3️⃣  SERVIDOR propio (DigitalOcean, AWS, etc)"
echo ""
read -p "Elegí opción (1, 2 o 3): " opcion

case $opcion in
    1)
        echo ""
        echo "📦 DEPLOY EN RENDER (Gratis)"
        echo "============================"
        echo ""
        
        # Preparar para Render
        echo "Preparando archivos..."
        
        # Crear build script para Render
        cat > build.sh << 'EOF'
#!/bin/bash
npm install --production
EOF
        chmod +x build.sh
        
        # Verificar package.json tiene start script
        if ! grep -q '"start"' package.json; then
            echo "Agregando script start..."
            # Agregar script start si no existe
            node -e "
            const pkg = require('./package.json');
            pkg.scripts = pkg.scripts || {};
            pkg.scripts.start = 'node server.js';
            require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
            "
        fi
        
        echo "✅ Archivos preparados"
        echo ""
        echo "📝 INSTRUCCIONES:"
        echo ""
        echo "1. Subí tu código a GitHub:"
        echo "   git add ."
        echo "   git commit -m 'Deploy Render'"
        echo "   git push origin main"
        echo ""
        echo "2. Andá a https://render.com"
        echo "3. Click 'New +' → 'Web Service'"
        echo "4. Conectá tu GitHub"
        echo "5. Configuración:"
        echo "   - Build Command: ./build.sh"
        echo "   - Start Command: npm start"
        echo ""
        echo "6. Variables de entorno (Environment):"
        echo "   JWT_SECRET = $(openssl rand -hex 32 2>/dev/null || echo 'generar-32-caracteres-random')"
        echo "   NODE_ENV = production"
        echo ""
        echo "7. Click 'Create Web Service'"
        echo ""
        echo "🎉 En 5 minutos tenés tu app online!"
        ;;
        
    2)
        echo ""
        echo "💻 DEPLOY LOCAL"
        echo "==============="
        echo ""
        
        # Verificar Node instalado
        if ! command -v node &> /dev/null; then
            echo "❌ Node.js no instalado"
            echo "Descargalo de: https://nodejs.org"
            exit 1
        fi
        
        echo "Instalando dependencias..."
        npm install --production
        
        echo "Iniciando servidor..."
        echo ""
        echo "✅ Tu app va a estar en: http://localhost:3002"
        echo ""
        echo "Presioná Ctrl+C para detener"
        echo ""
        npm start
        ;;
        
    3)
        echo ""
        echo "🖥️  DEPLOY EN SERVIDOR"
        echo "====================="
        echo ""
        
        read -p "IP del servidor: " server_ip
        read -p "Usuario (default: root): " server_user
        server_user=${server_user:-root}
        
        echo ""
        echo "📦 Preparando deploy..."
        
        # Crear script remoto
        cat > remote-deploy.sh << 'EOF'
#!/bin/bash
# Instalar Node si no existe
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Instalar PM2 si no existe
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Clonar o actualizar código
if [ -d "/var/www/aira" ]; then
    cd /var/www/aira
    git pull
else
    cd /var/www
    git clone $(git config --get remote.origin.url) aira
    cd aira
fi

# Instalar y ejecutar
npm install --production
pm2 stop aira 2>/dev/null
pm2 start server.js --name aira
pm2 save
pm2 startup

echo "✅ Deploy completo!"
echo "URL: http://$1:3002"
EOF
        
        echo "Copiando archivos al servidor..."
        scp remote-deploy.sh $server_user@$server_ip:/tmp/
        
        echo "Ejecutando deploy..."
        ssh $server_user@$server_ip "bash /tmp/remote-deploy.sh $server_ip"
        
        echo ""
        echo "✅ DEPLOY COMPLETO"
        echo "🌐 URL: http://$server_ip:3002"
        ;;
        
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "💡 TIPS:"
echo "- Guardá las credenciales en un lugar seguro"
echo "- Hacé backup antes de cambios grandes"
echo "- Monitoreá los logs regularmente"
echo ""
echo "📚 Más info en: DEPLOY-GUIA-COMPLETA.md"
