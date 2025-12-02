#!/bin/bash

# 🔥 DEPLOY A FIREBASE + GOOGLE CLOUD
# Con tu suscripción de $20/mes

echo "╔════════════════════════════════════════╗"
echo "║   🔥 FIREBASE DEPLOY AUTOMÁTICO       ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar Firebase CLI instalado
echo "1️⃣ Verificando Firebase CLI..."
if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}Instalando Firebase CLI...${NC}"
    npm install -g firebase-tools
fi
echo -e "${GREEN}✅ Firebase CLI listo${NC}"

# 2. Login Firebase
echo ""
echo "2️⃣ Login en Firebase..."
firebase login --no-localhost

# 3. Inicializar proyecto
echo ""
echo "3️⃣ Configurando proyecto Firebase..."
if [ ! -f "firebase.json" ]; then
    firebase init hosting functions firestore
else
    echo -e "${GREEN}✅ Proyecto ya configurado${NC}"
fi

# 4. Verificar service account
echo ""
echo "4️⃣ Verificando Service Account..."
if [ ! -f "service-account-key.json" ]; then
    echo -e "${RED}❌ FALTA: service-account-key.json${NC}"
    echo ""
    echo "📥 CÓMO OBTENERLO:"
    echo "1. Ir a: https://console.firebase.google.com"
    echo "2. Tu proyecto → ⚙️ Settings → Service Accounts"
    echo "3. Click 'Generate new private key'"
    echo "4. Guardar como: service-account-key.json"
    echo ""
    read -p "Presioná Enter cuando lo tengas..."
fi

# 5. Configurar .env
echo ""
echo "5️⃣ Configurando variables de entorno..."
if [ ! -f ".env" ]; then
    cp .env.firebase .env
    echo -e "${YELLOW}⚠️ Editá .env con tus keys reales${NC}"
    echo ""
    echo "NECESITÁS:"
    echo "✅ GEMINI_API_KEY desde: https://makersuite.google.com/app/apikey"
    echo "✅ WHATSAPP tokens desde: https://business.facebook.com"
    echo "✅ JWT_SECRET generado con: openssl rand -hex 32"
    echo ""
    read -p "Presioná Enter cuando esté listo..."
fi

# 6. Preparar funciones
echo ""
echo "6️⃣ Preparando Cloud Functions..."
cat > functions/index.js << 'EOF'
const functions = require('firebase-functions');
const app = require('../server');

// Exportar app como Cloud Function
exports.app = functions.https.onRequest(app);

// Scheduled function para limpieza
exports.scheduledCleanup = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        console.log('Running scheduled cleanup...');
        // Limpiar sesiones viejas
        return null;
    });
EOF

# 7. Build de producción
echo ""
echo "7️⃣ Build de producción..."
npm ci --production

# 8. Deploy
echo ""
echo "8️⃣ Deployando a Firebase..."
echo -e "${YELLOW}Esto puede tardar 5-10 minutos...${NC}"

firebase deploy --only hosting,functions,firestore

echo ""
echo "╔════════════════════════════════════════╗"
echo "║         ✅ DEPLOY COMPLETO            ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "🌐 Tu app está en:"
echo "   https://$(firebase apps:list | grep -o '[^ ]*\.web\.app' | head -1)"
echo ""
echo "📊 Dashboard:"
echo "   https://console.firebase.google.com"
echo ""
echo "📱 WhatsApp Webhook URL:"
echo "   https://us-central1-PROJECT-ID.cloudfunctions.net/app/webhook/whatsapp"
echo ""
echo "💡 Próximos pasos:"
echo "1. Configurar webhook en Meta Business"
echo "2. Probar con un mensaje de WhatsApp"
echo "3. Monitorear logs: firebase functions:log"
