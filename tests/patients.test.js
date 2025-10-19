// Mock PatientsService para testing
class MockPatientsService {
  constructor() {
    this.patients = new Map();
  }

  async create(patientData) {
    if (!patientData.name || !patientData.dni) {
      throw new Error('Name and DNI are required');
    }

    // Verificar DNI duplicado
    const existingPatient = Array.from(this.patients.values())
      .find(p => p.dni === patientData.dni);
    
    if (existingPatient) {
      throw new Error('Ya existe un paciente con este DNI');
    }

    const patientId = `patient_${Date.now()}_${Math.random()}`; // Make ID more unique
    const patient = {
      id: patientId,
      name: patientData.name,
      dni: patientData.dni,
      email: patientData.email || '',
      phone: patientData.phone || '',
      birthDate: patientData.birthDate || '',
      address: patientData.address || '',
      createdAt: new Date().toISOString()
    };

    this.patients.set(patientId, patient);

    return {
      success: true,
      patient: patient
    };
  }

  async getAll(limit = 50) {
    const patients = Array.from(this.patients.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);

    return {
      success: true,
      patients: patients
    };
  }

  async getById(patientId) {
    const patient = this.patients.get(patientId);
    if (!patient) {
      throw new Error('Paciente no encontrado');
    }

    return {
      success: true,
      patient: patient
    };
  }

  async update(patientId, updateData) {
    const patient = this.patients.get(patientId);
    if (!patient) {
      throw new Error('Paciente no encontrado');
    }

    const updatedPatient = {
      ...patient,
      ...updateData,
      id: patientId, // Preserve ID
      updatedAt: new Date().toISOString()
    };

    this.patients.set(patientId, updatedPatient);

    return {
      success: true,
      patient: updatedPatient
    };
  }

  async delete(patientId) {
    const patient = this.patients.get(patientId);
    if (!patient) {
      throw new Error('Paciente no encontrado');
    }

    this.patients.delete(patientId);

    return {
      success: true,
      message: 'Paciente eliminado exitosamente'
    };
  }

  async search(criteria) {
    const patients = Array.from(this.patients.values());
    let filtered = patients;

    if (criteria.name) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(criteria.name.toLowerCase())
      );
    }

    if (criteria.dni) {
      filtered = filtered.filter(p => p.dni.includes(criteria.dni));
    }

    if (criteria.email) {
      filtered = filtered.filter(p => 
        p.email.toLowerCase().includes(criteria.email.toLowerCase())
      );
    }

    return {
      success: true,
      patients: filtered
    };
  }
}

describe('Patients Service Tests', () => {
  let patientsService;

  beforeEach(() => {
    patientsService = new MockPatientsService();
    jest.clearAllMocks();
  });

  describe('Create Patient', () => {
    test('should create patient successfully', async () => {
      const patientData = {
        name: 'Juan Pérez',
        dni: '12345678',
        email: 'juan@example.com',
        phone: '+5491123456789',
        birthDate: '1990-01-01',
        address: 'Calle Falsa 123'
      };

      const result = await patientsService.create(patientData);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('patient');
      expect(result.patient).toHaveProperty('id');
      expect(result.patient.name).toBe(patientData.name);
      expect(result.patient.dni).toBe(patientData.dni);
    });

    test('should reject duplicate DNI', async () => {
      const patientData = {
        name: 'Juan Pérez',
        dni: '12345678',
        email: 'juan@example.com'
      };

      // Crear primer paciente
      await patientsService.create(patientData);

      // Intentar crear segundo paciente con mismo DNI
      const duplicateData = {
        name: 'María García',
        dni: '12345678',
        email: 'maria@example.com'
      };

      await expect(patientsService.create(duplicateData))
        .rejects.toThrow('Ya existe un paciente con este DNI');
    });

    test('should validate required fields', async () => {
      const incompleteData = {
        name: 'Juan Pérez'
        // missing dni
      };

      await expect(patientsService.create(incompleteData))
        .rejects.toThrow('Name and DNI are required');
    });

    test('should handle optional fields', async () => {
      const minimalData = {
        name: 'Juan Pérez',
        dni: '12345678'
      };

      const result = await patientsService.create(minimalData);

      expect(result.success).toBe(true);
      expect(result.patient.email).toBe('');
      expect(result.patient.phone).toBe('');
    });
  });

  describe('Get Patients', () => {
    beforeEach(async () => {
      // Crear pacientes de prueba
      await patientsService.create({
        name: 'Juan Pérez',
        dni: '12345678'
      });
      await patientsService.create({
        name: 'María García',
        dni: '87654321'
      });
    });

    test('should get all patients successfully', async () => {
      const result = await patientsService.getAll();

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('patients');
      expect(result.patients).toHaveLength(2);
      expect(result.patients[0].name).toBeDefined();
    });

    test('should get patient by ID successfully', async () => {
      const createResult = await patientsService.create({
        name: 'Carlos López',
        dni: '11111111'
      });

      const result = await patientsService.getById(createResult.patient.id);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('patient');
      expect(result.patient.id).toBe(createResult.patient.id);
      expect(result.patient.name).toBe('Carlos López');
    });

    test('should handle non-existent patient', async () => {
      await expect(patientsService.getById('non-existent'))
        .rejects.toThrow('Paciente no encontrado');
    });

    test('should respect limit parameter', async () => {
      // Crear más pacientes
      for (let i = 0; i < 5; i++) {
        await patientsService.create({
          name: `Paciente ${i}`,
          dni: `1111111${i}`
        });
      }

      const result = await patientsService.getAll(3);
      expect(result.patients.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Update Patient', () => {
    let patientId;

    beforeEach(async () => {
      const createResult = await patientsService.create({
        name: 'Juan Pérez',
        dni: '12345678',
        email: 'juan@example.com'
      });
      patientId = createResult.patient.id;
    });

    test('should update patient successfully', async () => {
      const updateData = {
        name: 'Juan Carlos Pérez',
        phone: '+5491123456789'
      };

      const result = await patientsService.update(patientId, updateData);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('patient');
      expect(result.patient.name).toBe(updateData.name);
      expect(result.patient.phone).toBe(updateData.phone);
      expect(result.patient.id).toBe(patientId); // ID should not change
    });

    test('should handle update of non-existent patient', async () => {
      await expect(patientsService.update('non-existent', { name: 'Test' }))
        .rejects.toThrow('Paciente no encontrado');
    });

    test('should preserve unchanged fields', async () => {
      const updateData = { phone: '+5491123456789' };
      
      const result = await patientsService.update(patientId, updateData);

      expect(result.patient.name).toBe('Juan Pérez'); // Should remain unchanged
      expect(result.patient.dni).toBe('12345678'); // Should remain unchanged
      expect(result.patient.phone).toBe('+5491123456789'); // Should be updated
    });
  });

  describe('Delete Patient', () => {
    let patientId;

    beforeEach(async () => {
      const createResult = await patientsService.create({
        name: 'Juan Pérez',
        dni: '12345678'
      });
      patientId = createResult.patient.id;
    });

    test('should delete patient successfully', async () => {
      const result = await patientsService.delete(patientId);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('message', 'Paciente eliminado exitosamente');

      // Verificar que el paciente fue eliminado
      await expect(patientsService.getById(patientId))
        .rejects.toThrow('Paciente no encontrado');
    });

    test('should handle deletion of non-existent patient', async () => {
      await expect(patientsService.delete('non-existent'))
        .rejects.toThrow('Paciente no encontrado');
    });
  });

  describe('Search Patients', () => {
    beforeEach(async () => {
      await patientsService.create({
        name: 'Juan Pérez',
        dni: '12345678',
        email: 'juan@example.com'
      });
      await patientsService.create({
        name: 'María García',
        dni: '87654321',
        email: 'maria@example.com'
      });
      await patientsService.create({
        name: 'Juan Carlos López',
        dni: '11111111',
        email: 'juancarlos@example.com'
      });
    });

    test('should search patients by name', async () => {
      const result = await patientsService.search({ name: 'Juan' });

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('patients');
      expect(result.patients).toHaveLength(2);
      expect(result.patients.every(p => p.name.includes('Juan'))).toBe(true);
    });

    test('should search patients by DNI', async () => {
      const result = await patientsService.search({ dni: '123' });

      expect(result).toHaveProperty('success', true);
      expect(result.patients).toHaveLength(1);
      expect(result.patients[0].dni).toBe('12345678');
    });

    test('should search patients by email', async () => {
      const result = await patientsService.search({ email: 'maria' });

      expect(result).toHaveProperty('success', true);
      expect(result.patients).toHaveLength(1);
      expect(result.patients[0].email).toBe('maria@example.com');
    });

    test('should return empty array for no matches', async () => {
      const result = await patientsService.search({ name: 'NoExiste' });

      expect(result).toHaveProperty('success', true);
      expect(result.patients).toHaveLength(0);
    });

    test('should handle multiple search criteria', async () => {
      const result = await patientsService.search({ 
        name: 'Juan',
        email: 'juancarlos'
      });

      expect(result).toHaveProperty('success', true);
      expect(result.patients).toHaveLength(1);
      expect(result.patients[0].name).toBe('Juan Carlos López');
    });
  });

  describe('Data Integrity', () => {
    test('should maintain patient count correctly', async () => {
      const initialResult = await patientsService.getAll();
      const initialCount = initialResult.patients.length;

      await patientsService.create({
        name: 'Nuevo Paciente',
        dni: '99999999'
      });

      const afterCreateResult = await patientsService.getAll();
      expect(afterCreateResult.patients.length).toBe(initialCount + 1);
    });

    test('should generate unique IDs', async () => {
      const result1 = await patientsService.create({
        name: 'Paciente 1',
        dni: '11111111'
      });

      const result2 = await patientsService.create({
        name: 'Paciente 2',
        dni: '22222222'
      });

      expect(result1.patient.id).not.toBe(result2.patient.id);
    });
  });
}); 