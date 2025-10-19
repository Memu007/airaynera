// Servicio Mock para pruebas - NO USAR EN PRODUCCIÓN
module.exports = {
  getPatients: async (dni) => ({
    success: true,
    patients: [
      {id: 'mock1', nombre: 'Paciente Mock 1', dni: '11111111'},
      {id: 'mock2', nombre: 'Paciente Mock 2', dni: '22222222'}
    ]
  })
};
