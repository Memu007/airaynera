// Versión optimizada del servicio Gemini con manejo de cuotas y modelos alternativos
const fs = require('fs').promises;
const path = require('path');
const NodeCache = require('node-cache');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.cache = new NodeCache({ stdTTL: 300 }); // Cache de 5 minutos
    this.promptsLoaded = false;
    this.prompts = {};
    
    // Configuración flexible de modelos (en orden de preferencia)
    this.models = [
      {
        name: 'gemini-1.5-flash',
        version: 'v1beta',
        temperature: 0.3,
        maxTokens: 2048
      },
      {
        name: 'gemini-1.5-pro',
        version: 'v1beta',
        temperature: 0.3,
        maxTokens: 2048
      },
      {
        name: 'gemini-1.0-pro',
        version: 'v1beta',
        temperature: 0.4,
        maxTokens: 1024
      }
    ];
    
    // Modelo actualmente en uso (empezamos con el primero)
    this.currentModelIndex = 0;

    if (!this.apiKey) {
      throw new Error('API key de Gemini no configurada. Agregá GEMINI_API_KEY al archivo .env');
    }

    console.log('Inicializando GeminiService v2 - Optimizado');
  }

  // Carga todos los prompts desde archivos
  async loadPrompts() {
    try {
      const promptsDir = path.join(__dirname, 'prompts');
      
      // Cargar prompts básicos
      const files = ['base.md', 'crisis.md', 'pacientes.md', 'sesiones.md'];
      
      for (const file of files) {
        const content = await fs.readFile(path.join(promptsDir, file), 'utf-8');
        const key = path.basename(file, '.md');
        this.prompts[key] = content;
        console.log(`Prompt cargado: ${key}`);
      }
      
      this.promptsLoaded = true;
    } catch (error) {
      console.error('Error al cargar los prompts:', error);
      throw error;
    }
  }

  // Construye el prompt completo en base al contexto
  buildFullPrompt(userMessage, conversationState = {}) {
    // Base siempre está presente
    let fullPrompt = this.prompts.base || '';
    
    // Agregar información del profesional si está autenticado
    if (conversationState.professional) {
      fullPrompt += `\n\n# Información del Profesional\nNombre: ${conversationState.professional.nombre}\nDNI: ${conversationState.professional.dni}`;
    }
    
    // Agregar información del paciente seleccionado
    if (conversationState.selectedPatient) {
      fullPrompt += `\n\n# Paciente Actual\nNombre: ${conversationState.selectedPatient.nombre}\nDNI: ${conversationState.selectedPatient.dni}`;
      
      // Agregar prompts específicos según el contexto
      if (conversationState.state === 'SESSION_CREATION') {
        fullPrompt += `\n\n${this.prompts.sesiones || ''}`;
      }
    } else {
      // Si no hay paciente seleccionado, agregar info de pacientes
      fullPrompt += `\n\n${this.prompts.pacientes || ''}`;
    }
    
    // Historial de conversación
    if (conversationState.history && conversationState.history.length > 0) {
      fullPrompt += '\n\n# Historial de Conversación\n';
      // Limitar a los últimos 5 mensajes para no exceder tokens
      const recentHistory = conversationState.history.slice(-5);
      recentHistory.forEach(entry => {
        fullPrompt += `${entry.role === 'user' ? 'Usuario' : 'Asistente'}: ${entry.content}\n`;
      });
    }
    
    // Mensaje actual del usuario
    fullPrompt += `\n\nUsuario: ${userMessage}`;
    
    return fullPrompt;
  }

  // Obtener el modelo actual
  getCurrentModel() {
    return this.models[this.currentModelIndex];
  }

  // Cambiar al siguiente modelo si hay un error
  rotateToNextModel() {
    this.currentModelIndex = (this.currentModelIndex + 1) % this.models.length;
    const model = this.getCurrentModel();
    console.log(`Rotando al modelo: ${model.name} (${model.version})`);
    return model;
  }

  // Llamada principal a la API de Gemini con manejo de errores y reintentos
  async callGeminiAPI(prompt, maxRetries = 2) {
    if (!this.promptsLoaded) {
      await this.loadPrompts();
    }
    
    const cacheKey = `gemini_${prompt.substring(0, 100)}`;
    const cachedResponse = this.cache.get(cacheKey);
    
    if (cachedResponse) {
      console.log('Usando respuesta en caché');
      return cachedResponse;
    }
    
    let lastError = null;
    
    // Intentar con cada modelo hasta tener éxito o agotar reintentos
    for (let retry = 0; retry <= maxRetries; retry++) {
      if (retry > 0) {
        console.log(`Reintento ${retry} de ${maxRetries}`);
        // Rotar al siguiente modelo en cada reintento
        this.rotateToNextModel();
      }
      
      const model = this.getCurrentModel();
      
      try {
        // Crear un AbortController para el timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        console.log(`Llamando a Gemini API (modelo: ${model.name})`);
        
        const response = await fetch(
          `https://generativelanguage.googleapis.com/${model.version}/models/${model.name}:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }],
              generationConfig: {
                temperature: model.temperature,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: model.maxTokens,
              }
            }),
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`Error API (${model.name}): ${response.status}`, errorData);
          
          // Si es un error 429 (quota), intentar con el siguiente modelo
          if (response.status === 429) {
            lastError = new Error(`Cuota excedida en ${model.name}: ${errorData.error?.message || 'Unknown error'}`);
            continue; // Probar con el siguiente modelo
          }
          
          throw new Error(`API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        // Guardar en caché
        this.cache.set(cacheKey, data);
        return data;
      } catch (error) {
        console.error(`Error con modelo ${model.name}:`, error);
        lastError = error;
        
        // Si es un error de conexión o timeout, intentar con otro modelo
        if (error.name === 'AbortError' || error.message.includes('network')) {
          continue;
        }
        
        // Para otros errores, solo reintentamos si quedan reintentos
        if (retry < maxRetries) {
          continue;
        }
      }
    }
    
    // Si llegamos aquí, todos los modelos/reintentos fallaron
    throw lastError || new Error('Todos los modelos de IA fallaron');
  }

  // Procesa una conversación y extrae la acción y texto
  async handleConversation(conversationState, userMessage) {
    const fullPrompt = this.buildFullPrompt(userMessage, conversationState);
    
    try {
      const response = await this.callGeminiAPI(fullPrompt);
      
      // Extraer el texto y JSON de la respuesta
      const responseText = response.candidates[0].content.parts[0].text;
      
      // Intentar extraer JSON
      let actionData = null;
      try {
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                         responseText.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          actionData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        }
      } catch (e) {
        console.warn('No se pudo extraer JSON de la respuesta:', e.message);
      }
      
      // Si no hay JSON, usar fallback para mostrar solo texto
      if (!actionData) {
        actionData = {
          respuesta_texto: responseText,
          opciones_rapidas: ["Ayuda", "Ver opciones"]
        };
      }
      
      // Extraer texto para mostrar al usuario
      const displayText = actionData.respuesta_texto || responseText;
      
      return {
        displayText,
        actionData
      };
    } catch (error) {
      console.error('Error al procesar la conversación:', error);
      
      // Respuesta de fallback en caso de error
      return {
        displayText: '⚠️ Lo siento, estoy teniendo problemas para procesar tu solicitud. Por favor intentá de nuevo en unos momentos.',
        actionData: {
          respuesta_texto: 'Error al procesar la solicitud',
          opciones_rapidas: ['Reiniciar', 'Ayuda']
        }
      };
    }
  }

  // Método específico para detección de crisis
  async detectCrisis(message) {
    // Usar cache para evitar llamadas repetidas para el mismo mensaje
    const cacheKey = `crisis_${message.substring(0, 50)}`;
    
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }
    
    if (!this.promptsLoaded) {
      await this.loadPrompts();
    }
    
    // Prompt específico para detección de crisis
    const crisisPrompt = `${this.prompts.crisis || ''}\n\nAnaliza este mensaje para detectar señales de crisis:\n"${message}"\n\nResponde SOLO en formato JSON con esta estructura:\n{\n  "esCrisis": true/false,\n  "nivelUrgencia": número del 1-5,\n  "palabrasClave": ["palabra1", "palabra2"]\n}`;
    
    try {
      // Usar un modelo más pequeño y rápido para crisis
      const originalModelIndex = this.currentModelIndex;
      this.currentModelIndex = 0; // Usar el primer modelo (gemini-1.5-flash)
      
      const response = await this.callGeminiAPI(crisisPrompt);
      
      // Restaurar modelo original
      this.currentModelIndex = originalModelIndex;
      
      // Extraer JSON de la respuesta
      const responseText = response.candidates[0].content.parts[0].text;
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                       responseText.match(/\{[\s\S]*\}/);
      
      let result = { isCrisis: false, crisisLevel: 0 };
      
      if (jsonMatch) {
        const crisisData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        result = {
          isCrisis: crisisData.esCrisis || false,
          crisisLevel: crisisData.nivelUrgencia || 0,
          keywords: crisisData.palabrasClave || []
        };
      }
      
      // Guardar en caché
      this.cache.set(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('Error al detectar crisis:', error);
      
      // Si falla, asumimos que no es crisis para evitar falsos positivos
      return {
        isCrisis: false,
        crisisLevel: 0,
        keywords: []
      };
    }
  }
}

module.exports = GeminiService;
