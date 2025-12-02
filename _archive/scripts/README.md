# Scripts de Inicialización

Este directorio contiene scripts útiles para inicializar y configurar la base de datos de Firebase.

## seed-firebase.js

Script para crear usuarios de prueba en Firebase Authentication y Firestore.

### Requisitos previos

1. Tener Node.js instalado
2. Tener un archivo `service-account-key.json` con las credenciales de Firebase Admin
3. Tener instaladas las dependencias del proyecto (`npm install` en la raíz)

### Configuración

1. Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
FIREBASE_PROJECT_ID=tu-proyecto-id
```

2. Asegúrate de tener un archivo `service-account-key.json` en la raíz del proyecto con las credenciales de Firebase Admin.

### Uso

```bash
# Instalar dependencias (solo primera vez)
npm install

# Ejecutar el script de inicialización
node scripts/seed-firebase.js
```

### Usuarios de prueba

El script crea los siguientes usuarios de prueba:

1. **Médico Demo**
   - Email: medico@aira.com
   - Contraseña: Password123!
   - Rol: medico
   - Especialidad: Cardiología

2. **Enfermero Demo**
   - Email: enfermero@aira.com
   - Contraseña: Password123!
   - Rol: enfermero
   - Especialidad: Enfermería General

3. **Administrador**
   - Email: admin@aira.com
   - Contraseña: Admin123!
   - Rol: admin

### Notas de seguridad

- **Nunca** subas el archivo `service-account-key.json` a repositorios públicos
- Cambia las contraseñas después de la configuración inicial
- Desactiva o elimina los usuarios de prueba en producción

## Solución de problemas

### Error: "Credential implementation provided to initializeApp()..."
Asegúrate de que el archivo `service-account-key.json` existe y tiene el formato correcto.

### Error: "The default Firebase app does not exist..."
Verifica que las credenciales de Firebase Admin sean correctas y que el proyecto exista en Firebase.
