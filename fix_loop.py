import re

# Leer el archivo
with open('demopagina.html', 'r') as f:
    content = f.read()

# Primera ocurrencia del patrón (manejar el tutorial automático para usuarios nuevos)
pattern1 = r'if \(isDemoMode\) \{\s*setTimeout\(startTutorial, 500\);\s*\} else if \(currentUser && currentUser\.isNewUser\) \{\s*setTimeout\(startTutorial, 500\);\s*\}'
replacement1 = 'if (isDemoMode) {\n                setTimeout(startTutorial, 500);\n            }'
content = re.sub(pattern1, replacement1, content, count=2)

# Guardar el archivo
with open('demopagina.html', 'w') as f:
    f.write(content)

print("Archivo corregido: tutorial automático eliminado para usuarios nuevos")
