/**
 * 🌱 Servidor AIRA Básico
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// Tipos MIME para servir archivos correctamente
const tiposMime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Servidor HTTP simple
const servidor = http.createServer((req, res) => {
  // Obtener ruta de la URL solicitada
  let rutaArchivo = url.parse(req.url).pathname;
  
  // Manejar rutas principales
  if (rutaArchivo === '/' || rutaArchivo === '/index.html' || rutaArchivo === '/webaira') {
    rutaArchivo = '/demopagina.html';
  } else if (rutaArchivo === '/demo') {
    rutaArchivo = '/demo.html';
  }
  
  // Ruta completa del archivo
  const rutaCompleta = path.join(process.cwd(), rutaArchivo);
  
  // Verificar si el archivo existe
  fs.access(rutaCompleta, fs.constants.F_OK, (err) => {
    if (err) {
      // Verificar si es una solicitud API
      if (rutaArchivo.startsWith('/api/')) {
        manejarAPI(req, res, rutaArchivo);
        return;
      }
      
      // Si no es una API y archivo no existe, manejamos como error 404
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 - Archivo no encontrado');
      return;
    }
    
    // Obtener extensión del archivo
    const extension = path.extname(rutaArchivo);
    
    // Establecer el tipo MIME
    const tipoContenido = tiposMime[extension] || 'text/plain';
    
    // Leer y servir el archivo
    fs.readFile(rutaCompleta, (err, contenido) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 - Error interno del servidor');
        return;
      }
      
      res.writeHead(200, { 'Content-Type': tipoContenido });
      res.end(contenido);
    });
  });
});

// Función para manejar solicitudes API
function manejarAPI(req, res, ruta) {
  // Preparamos para recibir JSON en solicitudes POST
  if (req.method === 'POST') {
    let cuerpo = '';
    req.on('data', fragmento => {
      cuerpo += fragmento.toString();
    });
    
    req.on('end', () => {
      let datos;
      try {
        datos = JSON.parse(cuerpo);
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          mensaje: 'JSON inválido' 
        }));
        return;
      }
      
      // Manejar diferentes rutas API
      if (ruta === '/api/login') {
        manejarLogin(res, datos);
      } else if (ruta === '/api/registro') {
        manejarRegistro(res, datos);
      } else if (ruta === '/api/pacientes') {
        manejarPacientes(res, datos);
      } else if (ruta === '/api/sesiones') {
        manejarSesiones(res, datos);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          success: false, 
          mensaje: 'API no encontrada' 
        }));
      }
    });
  }
  // Para solicitudes GET de API
  else if (req.method === 'GET') {
    const urlParsed = url.parse(req.url, true);
    const params = urlParsed.query;
    
    if (ruta === '/api/estado') {
      manejarEstado(res);
    } else if (ruta === '/api/pacientes') {
      manejarGetPacientes(res, params);
    } else if (ruta === '/api/sesiones') {
      manejarGetSesiones(res, params);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        mensaje: 'API no encontrada' 
      }));
    }
  }
  // Para otros métodos HTTP
  else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      mensaje: 'Método no permitido' 
    }));
  }
}

// Manejo básico de datos (en memoria para demo)
let usuarios = [];
let pacientes = [];
let sesiones = [];

// Cargar datos de archivos si existen
function cargarDatos() {
  try {
    // Crear directorio datos si no existe
    if (!fs.existsSync('./datos')) {
      fs.mkdirSync('./datos');
    }
    
    if (fs.existsSync('./datos/usuarios.json')) {
      usuarios = JSON.parse(fs.readFileSync('./datos/usuarios.json'));
    }
    if (fs.existsSync('./datos/pacientes.json')) {
      pacientes = JSON.parse(fs.readFileSync('./datos/pacientes.json'));
    }
    if (fs.existsSync('./datos/sesiones.json')) {
      sesiones = JSON.parse(fs.readFileSync('./datos/sesiones.json'));
    }
  } catch (error) {
    console.log('No se pudieron cargar datos:', error);
  }
}

// Guardar datos en archivos
function guardarDatos() {
  try {
    if (!fs.existsSync('./datos')) {
      fs.mkdirSync('./datos');
    }
    
    fs.writeFileSync('./datos/usuarios.json', JSON.stringify(usuarios, null, 2));
    fs.writeFileSync('./datos/pacientes.json', JSON.stringify(pacientes, null, 2));
    fs.writeFileSync('./datos/sesiones.json', JSON.stringify(sesiones, null, 2));
  } catch (error) {
    console.log('No se pudieron guardar datos:', error);
  }
}

// Funciones para manejar solicitudes API
function manejarLogin(res, datos) {
  const { email, password } = datos;
  
  const usuario = usuarios.find(u => u.email === email && u.password === password);
  
  if (usuario) {
    // Eliminar password antes de enviar
    const usuarioSinPass = { ...usuario };
    delete usuarioSinPass.password;
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, usuario: usuarioSinPass }));
  } else {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      mensaje: 'Credenciales incorrectas' 
    }));
  }
}

function manejarRegistro(res, datos) {
  const { nombre, email, password, especialidad, dni } = datos;
  
  if (!nombre || !email || !password) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      mensaje: 'Faltan datos obligatorios' 
    }));
    return;
  }
  
  // Verificar si el usuario ya existe
  if (usuarios.find(u => u.email === email)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      mensaje: 'El usuario ya existe' 
    }));
    return;
  }
  
  const nuevoUsuario = {
    id: Date.now().toString(),
    nombre,
    email,
    password,
    especialidad: especialidad || '',
    dni: dni || '',
    fechaRegistro: new Date().toISOString()
  };
  
  usuarios.push(nuevoUsuario);
  guardarDatos();
  
  // Versión sin password para retornar
  const usuarioSinPass = { ...nuevoUsuario };
  delete usuarioSinPass.password;
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    usuario: usuarioSinPass 
  }));
}

function manejarPacientes(res, datos) {
  const { usuarioId, nombre, dni, telefono, obraSocial, notas } = datos;
  
  if (!usuarioId || !nombre) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      mensaje: 'Faltan datos obligatorios' 
    }));
    return;
  }
  
  const nuevoPaciente = {
    id: Date.now().toString(),
    usuarioId,
    nombre,
    dni: dni || '',
    telefono: telefono || '',
    obraSocial: obraSocial || '',
    notas: notas || '',
    fechaRegistro: new Date().toISOString()
  };
  
  pacientes.push(nuevoPaciente);
  guardarDatos();
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    paciente: nuevoPaciente 
  }));
}

function manejarGetPacientes(res, params) {
  const { usuarioId } = params;
  
  if (!usuarioId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      mensaje: 'Falta ID de usuario' 
    }));
    return;
  }
  
  const pacientesUsuario = pacientes.filter(p => p.usuarioId === usuarioId);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    pacientes: pacientesUsuario 
  }));
}

function manejarSesiones(res, datos) {
  const { usuarioId, pacienteId, observaciones, animo, fecha } = datos;
  
  if (!usuarioId || !pacienteId || !observaciones) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      mensaje: 'Faltan datos obligatorios' 
    }));
    return;
  }
  
  // Generar resumen simple para demo
  const resumen = observaciones.length > 100 
    ? observaciones.substring(0, 97) + '...' 
    : observaciones;
  
  const nuevaSesion = {
    id: Date.now().toString(),
    usuarioId,
    pacienteId,
    observaciones,
    resumen,
    animo: animo || 3,
    fecha: fecha || new Date().toISOString(),
    fechaCreacion: new Date().toISOString()
  };
  
  sesiones.push(nuevaSesion);
  guardarDatos();
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    sesion: nuevaSesion 
  }));
}

function manejarGetSesiones(res, params) {
  const { pacienteId } = params;
  
  if (!pacienteId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      mensaje: 'Falta ID de paciente' 
    }));
    return;
  }
  
  const sesionesPaciente = sesiones.filter(s => s.pacienteId === pacienteId);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    success: true, 
    sesiones: sesionesPaciente 
  }));
}

function manejarEstado(res) {
  const memoria = process.memoryUsage();
  const usadaMB = (memoria.heapUsed / 1024 / 1024).toFixed(2);
  const totalMB = (memoria.heapTotal / 1024 / 1024).toFixed(2);
  
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    estado: 'activo',
    uptime: process.uptime(),
    memoria: {
      usada: `${usadaMB} MB`,
      total: `${totalMB} MB`,
      porcentaje: `${(memoria.heapUsed / memoria.heapTotal * 100).toFixed(2)}%`
    },
    datos: {
      usuarios: usuarios.length,
      pacientes: pacientes.length,
      sesiones: sesiones.length
    }
  }));
}

// Cargar datos al iniciar
cargarDatos();

// Iniciar servidor en puerto 8082
const PUERTO = process.env.PORT || 8082;
servidor.listen(PUERTO, () => {
  console.log(`🌱 Servidor AIRA corriendo en http://localhost:${PUERTO}`);
  console.log(`📊 Estado disponible en: http://localhost:${PUERTO}/api/estado`);
});
