/**
 * Script de backup para AIRA
 * Guarda una copia de seguridad de los archivos importantes
 */
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const { execSync } = require('child_process');

// Configuración
const CONFIG = {
  directorioRaiz: path.resolve(__dirname, '..'),
  carpetasParaBackup: [
    'src',
    'config',
    'prompts',
    'docs'
  ],
  archivosParaBackup: [
    'package.json',
    'package-lock.json',
    '.env',
    '.firebaserc',
    'firebase.json'
  ],
  excluir: [
    'node_modules',
    '.git',
    'logs',
    'backup_'
  ]
};

/**
 * Crea un directorio de backup con timestamp
 */
function crearDirectorioBackup() {
  const fecha = new Date();
  const timestamp = fecha.toISOString()
    .replace(/:/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  
  const nombreDirectorio = `backup_${timestamp}`;
  const rutaBackup = path.join(CONFIG.directorioRaiz, nombreDirectorio);
  
  if (!fs.existsSync(rutaBackup)) {
    fs.mkdirSync(rutaBackup, { recursive: true });
    console.log(`Directorio de backup creado: ${rutaBackup}`);
  }
  
  return rutaBackup;
}

/**
 * Copia un directorio recursivamente excluyendo patrones
 */
function copiarDirectorio(origen, destino) {
  try {
    // Verificar si el origen existe
    if (!fs.existsSync(origen)) {
      console.warn(`Advertencia: El directorio ${origen} no existe, se omitirá.`);
      return;
    }
    
    // Crear directorio destino si no existe
    if (!fs.existsSync(destino)) {
      fs.mkdirSync(destino, { recursive: true });
    }
    
    // Leer contenido del directorio
    const elementos = fs.readdirSync(origen);
    
    // Copiar cada elemento
    for (const elemento of elementos) {
      // Verificar si está en la lista de exclusiones
      if (CONFIG.excluir.some(excluir => elemento.includes(excluir))) {
        continue;
      }
      
      const rutaOrigen = path.join(origen, elemento);
      const rutaDestino = path.join(destino, elemento);
      
      const stat = fs.statSync(rutaOrigen);
      
      if (stat.isDirectory()) {
        // Es un directorio, copiar recursivamente
        copiarDirectorio(rutaOrigen, rutaDestino);
      } else {
        // Es un archivo, copiarlo directamente
        fs.copyFileSync(rutaOrigen, rutaDestino);
      }
    }
  } catch (error) {
    console.error(`Error al copiar directorio ${origen}:`, error);
  }
}

/**
 * Realiza el backup completo
 */
function realizarBackup() {
  console.log('Iniciando proceso de backup...');
  
  try {
    // Crear directorio de backup
    const directorioBackup = crearDirectorioBackup();
    
    // Copiar carpetas configuradas
    for (const carpeta of CONFIG.carpetasParaBackup) {
      const origen = path.join(CONFIG.directorioRaiz, carpeta);
      const destino = path.join(directorioBackup, carpeta);
      
      console.log(`Copiando carpeta: ${carpeta}`);
      copiarDirectorio(origen, destino);
    }
    
    // Copiar archivos individuales
    for (const archivo of CONFIG.archivosParaBackup) {
      const origen = path.join(CONFIG.directorioRaiz, archivo);
      const destino = path.join(directorioBackup, archivo);
      
      if (fs.existsSync(origen)) {
        console.log(`Copiando archivo: ${archivo}`);
        fs.copyFileSync(origen, destino);
      } else {
        console.warn(`Advertencia: El archivo ${archivo} no existe, se omitirá.`);
      }
    }
    
    // Crear archivo de metadatos
    const metadatos = {
      fecha: new Date().toISOString(),
      version: require(path.join(CONFIG.directorioRaiz, 'package.json')).version || 'desconocida',
      carpetasIncluidas: CONFIG.carpetasParaBackup,
      archivosIncluidos: CONFIG.archivosParaBackup
    };
    
    fs.writeFileSync(
      path.join(directorioBackup, 'backup-info.json'),
      JSON.stringify(metadatos, null, 2)
    );
    
    console.log('Backup completado con éxito.');
    console.log(`Ubicación: ${directorioBackup}`);
    
    return directorioBackup;
  } catch (error) {
    console.error('Error al realizar el backup:', error);
    throw error;
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  realizarBackup();
}

module.exports = { realizarBackup };
