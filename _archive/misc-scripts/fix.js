const fs = require('fs');
const path = require('path');

// Leer el archivo
const filePath = path.join(__dirname, 'demopagina.html');
let content = fs.readFileSync(filePath, 'utf8');

// Primera ocurrencia - líneas 3186-3190
content = content.replace(
  /if \(isDemoMode\) \{\s+setTimeout\(startTutorial, 500\);\s+\} else if \(currentUser && currentUser.isNewUser\) \{\s+setTimeout\(startTutorial, 500\);\s+\}/g,
  'if (isDemoMode) {\n                setTimeout(startTutorial, 500);\n            }'
);

// Segunda ocurrencia - líneas ~3333-3337
content = content.replace(
  /if \(isDemoMode\) \{\s+setTimeout\(startTutorial, 500\);\s+\} else if \(currentUser && currentUser.isNewUser\) \{\s+setTimeout\(startTutorial, 500\);\s+\}/g,
  'if (isDemoMode) {\n                setTimeout(startTutorial, 500);\n            }'
);

// Guardar el archivo
fs.writeFileSync(filePath, content);
console.log('Archivo editado correctamente');
