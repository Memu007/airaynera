// build_nlp.js
// Este archivo se usa solo para generar el bundle navegable de NLP.js.
// Comando sugerido (agregado en package.json):
// browserify build_nlp.js -s nlpjs -o js/nlp.bundle.js && terser js/nlp.bundle.js -c -m -o js/nlp.bundle.js
// Exportamos todo node-nlp como "nlpjs" global.

window.nlpjs = require('node-nlp');
