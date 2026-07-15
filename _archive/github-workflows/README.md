# Workflows archivados

Estos workflows se retiraron de `.github/workflows/` el 2026-07-14 porque referencian servidores, archivos, scripts o procesos de despliegue que no existen en el proyecto activo.

Se conservan solamente como referencia histórica. No deben volver a habilitarse sin:

1. verificar cada comando contra `package.json`;
2. confirmar que los archivos y servicios referenciados existen;
3. ejecutar el workflow contra una rama de prueba;
4. documentar el propósito y el responsable del despliegue.

La verificación activa del MVP está definida en `.github/workflows/ci.yml`.
