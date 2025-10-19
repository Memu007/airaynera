/**
 * Script de backup simple para AIRA
 * Crea una copia de seguridad de los archivos importantes
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Obtener timestamp para el nombre del directorio
const timestamp = new Date().toISOString()
  .replace(/:/g, '')
  .replace(/\..+/, '')
  .replace('T', '_');

// Directorio de backup
const directorioRaiz = path.resolve(__dirname, '..');
const directorioBackup = path.join(directorioRaiz, `backup_${timestamp}`);

// Crear directorio de backup
if (!fs.existsSync(directorioBackup)) {
  fs.mkdirSync(directorioBackup, { recursive: true });
  console.log(`Directorio de backup creado: ${directorioBackup}`);
}

// Directorios a respaldar
const directoriosParaBackup = [
  'src',
  'config',
  'prompts',
  'docs'
];

// Archivos a respaldar
const archivosParaBackup = [
  'package.json',
  'package-lock.json',
  '.env',
  '.firebaserc',
  'firebase.json'
];

// Función para copiar un directorio completo
function copiarDirectorioRecursivo(origen, destino) {
  // Crear directorio destino si no existe
  if (!fs.existsSync(destino)) {
    fs.mkdirSync(destino, { recursive: true });
  }
  
  // Leer contenido del directorio
  const archivos = fs.readdirSync(origen);
  
  // Excluir node_modules y otros directorios grandes
  const excluir = ['node_modules', '.git', 'logs', 'backup_'];
  
  // Copiar cada archivo/directorio
  for (const archivo of archivos) {
    // Saltar directorios excluidos
    if (excluir.some(ex => archivo.includes(ex))) {
      continue;
    }
    
    const rutaOrigen = path.join(origen, archivo);
    const rutaDestino = path.join(destino, archivo);
    
    // Verificar si es directorio o archivo
    const stat = fs.statSync(rutaOrigen);
    
    if (stat.isDirectory()) {
      // Es directorio, copiar recursivamente
      copiarDirectorioRecursivo(rutaOrigen, rutaDestino);
    } else {
      // Es archivo, copiar directamente
      fs.copyFileSync(rutaOrigen, rutaDestino);
    }
  }
}

// Copiar directorios configurados
console.log('Iniciando backup...');

for (const directorio of directoriosParaBackup) {
  const origen = path.join(directorioRaiz, directorio);
  const destino = path.join(directorioBackup, directorio);
  
  if (fs.existsSync(origen)) {
    console.log(`Copiando directorio: ${directorio}`);
    copiarDirectorioRecursivo(origen, destino);
  } else {
    console.log(`Directorio no encontrado: ${directorio}, se omitirá`);
  }
}

// Copiar archivos individuales
for (const archivo of archivosParaBackup) {
  const origen = path.join(directorioRaiz, archivo);
  const destino = path.join(directorioBackup, archivo);
  
  if (fs.existsSync(origen)) {
    console.log(`Copiando archivo: ${archivo}`);
    fs.copyFileSync(origen, destino);
  } else {
    console.log(`Archivo no encontrado: ${archivo}, se omitirá`);
  }
}

// Crear archivo de información
const infoBackup = {
  fecha: new Date().toISOString(),
  directorios: directoriosParaBackup,
  archivos: archivosParaBackup
};

fs.writeFileSync(
  path.join(directorioBackup, 'backup-info.json'),
  JSON.stringify(infoBackup, null, 2)
);

console.log('Backup completado con éxito');
console.log(`Ubicación: ${directorioBackup}`);
