# Configuración de Firebase para AIRA Bot

Este documento proporciona instrucciones para configurar Firebase Authentication y Firestore en el proyecto AIRA Bot.

## Requisitos previos

1. Tener una cuenta de Google y acceso a la consola de Firebase (https://console.firebase.google.com/)
2. Tener instalado Node.js y npm
3. Tener instalada la CLI de Firebase (opcional, pero recomendado)

## Pasos para configurar Firebase

### 1. Crear un proyecto en Firebase

1. Ve a la [consola de Firebase](https://console.firebase.google.com/)
2. Haz clic en "Crear un proyecto" o selecciona un proyecto existente
3. Sigue las instrucciones en pantalla para configurar tu proyecto

### 2. Configurar Firebase Authentication

1. En la consola de Firebase, ve a "Authentication" en el menú de la izquierda
2. Haz clic en "Comenzar" en la pestaña "Sign-in method"
3. Habilita "Correo electrónico/contraseña" como método de inicio de sesión
4. Haz clic en "Guardar"

### 3. Configurar Firestore

1. En la consola de Firebase, ve a "Firestore Database" en el menú de la izquierda
2. Haz clic en "Crear base de datos"
3. Selecciona "Comenzar en modo de prueba" (puedes cambiar esto más tarde)
4. Selecciona una ubicación para tu base de datos y haz clic en "Habilitar"

### 4. Configurar las reglas de seguridad

1. En la pestaña "Reglas" de Firestore, actualiza las reglas según sea necesario
2. Para desarrollo, puedes usar reglas más permisivas, pero asegúrate de endurecerlas para producción

### 5. Configurar la aplicación web

1. En la página de descripción general del proyecto de Firebase, haz clic en el ícono "</>" para agregar una aplicación web
2. Registra tu aplicación con un nombre (por ejemplo, "AIRA Web App")
3. Copia el objeto de configuración que se muestra. Debería verse así:

```javascript
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};
```

4. Actualiza el archivo `js/firebase-config.js` con estas credenciales

### 6. Configurar variables de entorno (opcional pero recomendado)

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
FIREBASE_API_KEY=tu_api_key_aqui
FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
FIREBASE_MESSAGING_SENDER_ID=1234567890
FIREBASE_APP_ID=1:1234567890:web:abcdef123456
FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ
```

### 7. Inicializar Firebase en tu aplicación

Asegúrate de que el archivo `demopagina.html` incluya los scripts necesarios antes de `app-main.js`:

```html
<!-- Firebase App (el archivo base de Firebase) -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>

<!-- Firebase Authentication -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>


<!-- Firebase Firestore -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>


<!-- Firebase Configuration -->
<script src="js/firebase-config.js"></script>
```

## Solución de problemas

### Error: "No Firebase App has been created"
Asegúrate de que el script `firebase-config.js` se cargue antes que cualquier otro script que intente usar Firebase.

### Error: "Missing or insufficient permissions"
Verifica las reglas de seguridad de Firestore y asegúrate de que el usuario esté autenticado correctamente.

### Error: "auth/network-request-failed"
Verifica tu conexión a Internet y asegúrate de que los dominios estén permitidos en la consola de Firebase.

## Próximos pasos

1. Implementa la lógica de registro de usuarios
2. Configura el manejo de sesiones
3. Implementa la recuperación de contraseña
4. Configura reglas de seguridad más estrictas para producción

## Recursos útiles

- [Documentación de Firebase Authentication](https://firebase.google.com/docs/auth)
- [Documentación de Firestore](https://firebase.google.com/docs/firestore)
- [Guía de seguridad de Firebase](https://firebase.google.com/support/guides/security)

---

**Nota importante:** Nunca expongas tus credenciales de Firebase en repositorios públicos. Asegúrate de que el archivo `.env` esté en tu `.gitignore`.
