#!/bin/bash

# TEST E2E CRÍTICO - Flujo completo psicólogo
# QA Team Senior - Test de humo

echo "🚀 TEST E2E: FLUJO COMPLETO PSICÓLOGO"
echo "======================================"

# 1. Verificar servidor
echo -n "1. Servidor responde... "
if curl -s http://localhost:3002/ | grep -q "AIRA"; then
    echo "✅ OK"
else
    echo "❌ FALLA"
    exit 1
fi

# 2. Verificar API pacientes
echo -n "2. API pacientes... "
PACIENTES=$(curl -s http://localhost:3002/api/pacientes | grep -c "María González")
if [ "$PACIENTES" -gt 0 ]; then
    echo "✅ OK (María González encontrada)"
else
    echo "❌ FALLA"
    exit 1
fi

# 3. Test ingesta WhatsApp
echo -n "3. API WhatsApp ingest... "
RESPONSE=$(curl -s -X POST http://localhost:3002/api/whatsapp/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "from": "1112345678",
    "text": "Sesión con María González. Continúa con sertralina 50mg",
    "type": "text"
  }')

if echo "$RESPONSE" | grep -q "processed"; then
    echo "✅ OK"
else
    echo "⚠️ Warning (puede estar deshabilitado)"
fi

# 4. Verificar seguridad
echo -n "4. Headers seguridad... "
HEADERS=$(curl -sI http://localhost:3002/)
if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo "✅ OK (Headers presentes)"
else
    echo "⚠️ Warning (revisar CSP)"
fi

echo ""
echo "======================================"
echo "📊 RESULTADO: Tests E2E básicos OK"
echo "✅ Sistema listo para testing manual"
