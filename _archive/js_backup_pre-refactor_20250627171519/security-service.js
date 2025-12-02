const { doc, setDoc, getDoc } = require('firebase/firestore');
const CryptoJS = require('crypto-js');

const CREDENTIALS_PATH = 'system/credentials';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // Clave desde variables de entorno

class SecurityService {
  constructor(db) {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
      throw new Error('FATAL: ENCRYPTION_KEY no está definida o es insegura. Debe tener al menos 32 caracteres. Verifique sus variables de entorno.');
    }
    this.db = db;
  }

  async encryptData(data) {
    return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
  }

  async decryptData(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext.toString(), ENCRYPTION_KEY);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  }

  async saveCredentials(service, credentials) {
    const encrypted = await this.encryptData(credentials);
    await setDoc(doc(this.db, CREDENTIALS_PATH, service), {
      encryptedData: encrypted,
      lastUpdated: new Date()
    });
  }

  async getCredentials(service) {
    const docSnap = await getDoc(doc(this.db, CREDENTIALS_PATH, service));
    if (!docSnap.exists()) return null;
    return this.decryptData(docSnap.data().encryptedData);
  }
}

module.exports = SecurityService;
