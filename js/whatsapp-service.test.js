// 1. Mockear los módulos de Firebase ANTES de importar el servicio
const mockAddDoc = jest.fn();
const mockCollection = jest.fn(() => ({ add: mockAddDoc }));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn().mockReturnValue({}),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn().mockReturnValue({}),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
  collection: mockCollection,
  addDoc: mockAddDoc,
}));

// 2. Importar el servicio DESPUÉS de los mocks
const WhatsAppService = require('./whatsapp-service');

describe('WhatsAppService', () => {
  jest.useFakeTimers(); // Controlar el tiempo
  let service;

  beforeEach(() => {
    // 3. Limpiar mocks antes de cada test
    jest.clearAllMocks();

    // 4. Instanciar el servicio (usará los mocks automáticamente)
    service = new WhatsAppService({}); // La config es irrelevante por el mock

    // Mockeamos el servicio de seguridad
    service.security = {
      getCredentials: jest.fn().mockResolvedValue({
        accessToken: 'test-token',
        phoneNumberId: '12345',
      }),
    };

    // Mockeamos la API fetch global
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid_123' }] }),
      })
    );
  });

  // Los tests de _splitMessage no dependen de Firebase, no necesitan cambios
  describe('_splitMessage', () => {
    it('No debería dividir un mensaje corto', () => {
      const message = 'Hola Mundo';
      const chunks = service._splitMessage(message, 4096);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(message);
    });

    it('Debería dividir un mensaje largo en los trozos correctos', () => {
      const longMessage = 'a'.repeat(5000);
      const chunks = service._splitMessage(longMessage, 4096);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].length).toBe(4096);
      expect(chunks[1].length).toBe(904);
    });

    it('Debería manejar mensajes que son un múltiplo exacto del tamaño del trozo', () => {
      const message = 'a'.repeat(8192);
      const chunks = service._splitMessage(message, 4096);
      expect(chunks).toHaveLength(2);
      expect(chunks[0].length).toBe(4096);
      expect(chunks[1].length).toBe(4096);
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await service.configure();
    });

    it('Debería enviar un único mensaje y guardarlo en Firestore', async () => {
      await service.sendMessage('123', 'hola');
      // Verificar que se intentó guardar en la colección correcta
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'whatsapp_messages');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });

        it('Debería dividir un mensaje largo y enviar múltiples trozos', async () => {
      const longMessage = 'a'.repeat(5000);
      const spy = jest.spyOn(service, '_sendSingleMessage');
      const promise = service.sendMessage('123', longMessage);
      jest.runAllTimers(); // Avanzar el reloj para los setTimeouts del bucle
      await promise;
      expect(spy).toHaveBeenCalledTimes(2);
      spy.mockRestore();
    });

    it('Debería registrar un error en Firestore si la API de WhatsApp falla', async () => {
      // 1. Mock exitoso para la llamada a connect()
      global.fetch.mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'test' }) }))
      // 2. Mock de fallo para la llamada a _sendSingleMessage()
      .mockImplementationOnce(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Server Error' }) }));

      await expect(service.sendMessage('123', 'test error')).rejects.toThrow();
      
      // Verificar que se intentó guardar en la colección de errores
      expect(mockCollection).toHaveBeenCalledWith(expect.anything(), 'message_errors');
      expect(mockAddDoc).toHaveBeenCalledTimes(1);
    });
  });
});
