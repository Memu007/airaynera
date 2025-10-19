const { faker } = require('@faker-js/faker');

const createMockPatient = (overrides = {}) => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  dni: faker.string.numeric(8),
  email: faker.internet.email(),
  phone: faker.phone.number('+54 9 11 #### ####'),
  insurance: faker.helpers.arrayElement(['OSDE', 'Swiss Medical', 'Galeno', 'IOMA', 'PAMI']),
  birthDate: faker.date.birthdate({ min: 18, max: 90, mode: 'age' }),
  address: faker.location.streetAddress(),
  status: faker.helpers.arrayElement(['activo', 'inactivo', 'pendiente']),
  notes: faker.lorem.paragraph(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides
});

const createMockSession = (overrides = {}) => ({
  id: faker.string.uuid(),
  patientId: faker.string.uuid(),
  professionalId: faker.string.uuid(),
  date: faker.date.future(),
  duration: faker.number.int({ min: 30, max: 120 }),
  type: faker.helpers.arrayElement(['consulta', 'seguimiento', 'emergencia']),
  status: faker.helpers.arrayElement(['programada', 'completada', 'cancelada']),
  notes: faker.lorem.paragraph(),
  diagnosis: faker.lorem.sentence(),
  treatment: faker.lorem.paragraph(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides
});

const createMockUser = (overrides = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  password: faker.internet.password({ length: 12 }),
  name: faker.person.fullName(),
  role: faker.helpers.arrayElement(['admin', 'professional', 'assistant']),
  license: faker.string.alphanumeric(8).toUpperCase(),
  phone: faker.phone.number(),
  isActive: true,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides
});

const createMockAuthData = (overrides = {}) => ({
  email: faker.internet.email(),
  password: faker.internet.password({ length: 12 }),
  ...overrides
});

module.exports = {
  createMockPatient,
  createMockSession,
  createMockUser,
  createMockAuthData
};
