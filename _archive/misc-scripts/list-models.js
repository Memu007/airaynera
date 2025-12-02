// Script para listar los modelos disponibles para tu API key
require('dotenv').config();

async function listAvailableModels() {
  console.log("Consultando modelos disponibles para tu API key...");
  console.log(`Key utilizada: ${process.env.GEMINI_API_KEY.substring(0, 5)}...`);
  
  try {
    // Probar varias versiones de la API
    const versions = ['v1', 'v1beta', 'v1beta2', 'v1beta3'];
    
    for (const version of versions) {
      console.log(`\nProbando versión: ${version}`);
      
      const url = `https://generativelanguage.googleapis.com/${version}/models?key=${process.env.GEMINI_API_KEY}`;
      
      try {
        const response = await fetch(url);
        
        if (!response.ok) {
          const error = await response.json();
          console.error(`  ❌ Error con ${version}: ${response.status}`, error.error?.message || error);
          continue;
        }
        
        const data = await response.json();
        console.log(`  ✅ Éxito con versión ${version}!`);
        console.log(`  Modelos disponibles (${data.models?.length || 0}):`);
        
        if (data.models && data.models.length > 0) {
          data.models.forEach(model => {
            console.log(`  - ${model.name} (${model.displayName || 'Sin nombre'})`);
          });
        } else {
          console.log("  No se encontraron modelos disponibles");
        }
      } catch (error) {
        console.error(`  ❌ Error con ${version}:`, error.message);
      }
    }
    
    console.log("\n=== Recomendaciones ===");
    console.log("1. Verificá que la API 'Gemini API' esté habilitada en la consola de Google Cloud");
    console.log("2. Verificá que la key tenga permisos para acceder a los modelos de Gemini");
    console.log("3. Asegurate que la cuenta tenga facturación activa o créditos disponibles");
    
  } catch (error) {
    console.error("Error general:", error);
  }
}

// Ejecutar
listAvailableModels();
