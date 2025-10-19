// Servicio para integración con WhatsApp Business API
const { initializeApp } = require('firebase/app');
const { getFirestore, serverTimestamp, collection, addDoc } = require('firebase/firestore');
const SecurityService = require('./security-service');

class WhatsAppService {
  constructor(firebaseConfig) {
    const firebaseApp = initializeApp(firebaseConfig);
    const db = getFirestore(firebaseApp);
    this.security = new SecurityService(db);
    this.db = db;

    // Adaptador para mantener compatibilidad con la sintaxis v8 usada en los métodos
    this.firebase = {
      firestore: Object.assign(
        () => ({
          collection: (collectionName) => ({
            add: (data) => addDoc(collection(db, collectionName), data),
          }),
        }),
        {
          FieldValue: {
            serverTimestamp: serverTimestamp,
          },
        }
      ),
    };

    this.auth = null;
    this.connected = false;
    this.apiVersion = 'v18.0';
  }

  // Configurar credenciales de forma segura
  async configure() {
    try {
      this.auth = await this.security.getCredentials('whatsapp');
      if (!this.auth) throw new Error('Credenciales no configuradas');
      return true;
    } catch (error) {
      console.error('Error cargando credenciales:', error);
      throw error;
    }
  }

  // Conectar con la API de WhatsApp
  async connect() {
    if (!this.auth) throw new Error('Configure primero las credenciales');
    
    try {
      // Verificar conexión con un request simple
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.auth.phoneNumberId}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.auth.accessToken}` }
      });
      
      if (!response.ok) throw new Error('Error en la conexión');
      
      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      throw error;
    }
  }

  // Divide un mensaje en trozos más pequeños
  _splitMessage(text, chunkSize = 4096) { 
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  // Enviar un mensaje, manejando mensajes grandes
  async sendMessage(to, message) {
    if (typeof message === 'string' && message.length > 4096) {
      const chunks = this._splitMessage(message);
      const sendPromises = chunks.map((chunk, index) => {
        return new Promise(resolve => {
          setTimeout(async () => {
            await this._sendSingleMessage(to, chunk);
            resolve();
          }, index * 250); // Pausa escalonada para evitar saturar la API
        });
      });
      await Promise.all(sendPromises);
      return { success: true, parts: chunks.length };
    }
    return this._sendSingleMessage(to, message);
  }

  // Lógica para enviar un único mensaje (privado)
  async _sendSingleMessage(to, message) {
    if (!this.connected) await this.connect();

    try {
      const url = `https://graph.facebook.com/${this.apiVersion}/${this.auth.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.auth.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: { body: message }
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error ${response.status}: ${errorBody}`);
      }

      const result = await response.json();
      await this.firebase.firestore().collection('whatsapp_messages').add({
        from: this.auth.businessAccountId,
        to: to,
        message: message,
        timestamp: this.firebase.firestore.FieldValue.serverTimestamp(),
        status: 'sent',
        whatsapp_id: result.messages[0].id
      });

      return { success: true, id: result.messages[0].id };
    } catch (error) {
      await this.firebase.firestore().collection('message_errors').add({
        error: error.message,
        timestamp: this.firebase.firestore.FieldValue.serverTimestamp(),
        destination: to,
        message_content: message
      });
      throw error;
    }
  }

  // Recibir mensajes
  async getMessages() {
    if (!this.connected) await this.connect();
    
    // TODO: Implementar recepción real
    return [];
  }
}

module.exports = WhatsAppService;
