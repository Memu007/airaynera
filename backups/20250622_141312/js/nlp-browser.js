// Versión simplificada de NLP.js para navegador
// Este archivo simula las funcionalidades básicas que necesitamos de NLP.js

// Objeto global
window.nlpjs = {
  // Gestor principal de NLP
  NlpManager: class NlpManager {
    constructor(options = {}) {
      this.languages = options.languages || ['es'];
      this.forceNER = options.forceNER || false;
      this.entities = {};
      this.corpus = [];
      this.trained = false;
      console.log('NlpManager inicializado con idiomas:', this.languages);
    }

    // Añadir entidad (DNI, nombre, etc.)
    addNamedEntityText(entityName, optionName, languages, examples) {
      if (!this.entities[entityName]) {
        this.entities[entityName] = {
          options: {}
        };
      }
      
      if (!this.entities[entityName].options[optionName]) {
        this.entities[entityName].options[optionName] = [];
      }
      
      this.entities[entityName].options[optionName] = 
        this.entities[entityName].options[optionName].concat(examples);
      
      console.log(`Entidad "${entityName}" añadida con ${examples.length} ejemplos`);
      return this;
    }

    // Añadir documento de entrenamiento
    addDocument(language, text, intent) {
      this.corpus.push({ language, text, intent });
      console.log(`Documento añadido para intención "${intent}": "${text}"`);
      return this;
    }

    // Entrenar el modelo
    async train() {
      console.log('Entrenando modelo con:', 
        Object.keys(this.entities).length, 'entidades y', 
        this.corpus.length, 'documentos');
      
      // Simulamos entrenamiento (en un NLP.js real esto tomaría tiempo)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.trained = true;
      console.log('Modelo entrenado correctamente');
      return this;
    }

    // Guardar modelo (simulado)
    save() {
      console.log('Modelo guardado (simulado)');
      return JSON.stringify({
        entities: this.entities,
        corpus: this.corpus,
        trained: this.trained
      });
    }

    // Cargar modelo (simulado)
    load(modelData) {
      try {
        const data = JSON.parse(modelData);
        this.entities = data.entities || {};
        this.corpus = data.corpus || [];
        this.trained = data.trained || false;
        console.log('Modelo cargado correctamente');
      } catch (e) {
        console.error('Error al cargar modelo:', e);
      }
      return this;
    }

    // Procesar texto para extraer entidades e intenciones
    async process(language, text) {
      if (!this.trained) {
        console.warn('El modelo no ha sido entrenado');
      }

      console.log(`Procesando texto: "${text}"`);
      
      // Resultado base
      const result = {
        locale: language,
        utterance: text,
        intent: { name: '', score: 0 },
        entities: []
      };
      
      // Detectar intención (simulado)
      for (const doc of this.corpus) {
        if (text.toLowerCase().includes(doc.text.toLowerCase())) {
          result.intent = { name: doc.intent, score: 0.8 };
          break;
        }
      }
      
      // Detectar entidades (simulado)
      for (const entityName in this.entities) {
        const entity = this.entities[entityName];
        
        for (const optionName in entity.options) {
          const examples = entity.options[optionName];
          
          for (const example of examples) {
            // Simulación simple: si el texto contiene algún ejemplo, lo extraemos
            if (text.toLowerCase().includes(example.toLowerCase())) {
              // Extraer el valor real usando regex simple
              const regex = new RegExp(`\\b(\\d{8}|\\w+\\s+\\w+)\\b`, 'i');
              const match = text.match(regex);
              
              if (match) {
                result.entities.push({
                  entity: entityName,
                  option: optionName,
                  sourceText: match[0],
                  utteranceText: match[0],
                  accuracy: 0.9,
                  start: text.indexOf(match[0]),
                  end: text.indexOf(match[0]) + match[0].length
                });
              }
            }
          }
        }
      }
      
      // Reglas específicas para tipos de datos comunes
      
      // DNI: 8 dígitos
      const dniMatch = text.match(/\b\d{8}\b/);
      if (dniMatch) {
        result.entities.push({
          entity: 'dni',
          option: 'dni',
          sourceText: dniMatch[0],
          utteranceText: dniMatch[0],
          accuracy: 0.95,
          start: text.indexOf(dniMatch[0]),
          end: text.indexOf(dniMatch[0]) + dniMatch[0].length
        });
      }
      
      // Nombre: 2+ palabras juntas con mayúscula inicial
      const nameMatch = text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/);
      if (nameMatch) {
        result.entities.push({
          entity: 'nombre',
          option: 'nombre',
          sourceText: nameMatch[0],
          utteranceText: nameMatch[0],
          accuracy: 0.9,
          start: text.indexOf(nameMatch[0]),
          end: text.indexOf(nameMatch[0]) + nameMatch[0].length
        });
      }
      
      // Teléfono: número de 10 dígitos
      const phoneMatch = text.match(/\b\d{10}\b/);
      if (phoneMatch) {
        result.entities.push({
          entity: 'telefono',
          option: 'telefono',
          sourceText: phoneMatch[0],
          utteranceText: phoneMatch[0],
          accuracy: 0.95,
          start: text.indexOf(phoneMatch[0]),
          end: text.indexOf(phoneMatch[0]) + phoneMatch[0].length
        });
      }
      
      console.log('Resultado del procesamiento:', result);
      return result;
    }
  }
};

console.log('NLP.js (versión simplificada para navegador) cargado correctamente');
