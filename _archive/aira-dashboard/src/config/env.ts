// src/config/env.ts

// Valida y expone explícitamente las variables de entorno del lado del cliente.
// Solo las variables listadas aquí serán accesibles en la aplicación.

const getEnvVar = (key: string): string => {
  const value = import.meta.env[key];
  if (value === undefined || value === null) {
    throw new Error(`Falta la variable de entorno del lado del cliente: ${key}`);
  }
  return value;
};

// --- Lista Blanca de Variables de Entorno para el Frontend ---
// Añade aquí cualquier otra variable VITE_ que la aplicación necesite.
export const API_URL = getEnvVar('VITE_API_URL');

// Ejemplo de cómo añadir otra variable:
// export const ANOTHER_VAR = getEnvVar('VITE_ANOTHER_VAR');

// Objeto de configuración para tener un único punto de importación.
export const env = {
  API_URL,
  // ANOTHER_VAR,
};

export default env;