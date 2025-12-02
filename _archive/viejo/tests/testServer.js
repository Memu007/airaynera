const express = require('express');
const app = express();

app.get('/api/pacientes', (req, res) => {
  res.json([
    {id: 'final1', nombre: 'PACIENTE FINAL 1', dni: '11111111'},
    {id: 'final2', nombre: 'PACIENTE FINAL 2', dni: '22222222'}
  ]);
});

app.listen(3000, () => {
  console.log('Servidor de prueba en puerto 3000');
});
