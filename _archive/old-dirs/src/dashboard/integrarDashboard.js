/**
 * Script para integrar el dashboard de monitoreo en la página principal
 * Carga dinámicamente los recursos necesarios y muestra el dashboard
 */

// Función para integrar el dashboard
function integrarDashboardMonitoreo(contenedorId = 'contenedor-dashboard') {
  // Verificar si el contenedor existe
  const contenedor = document.getElementById(contenedorId);
  if (!contenedor) {
    console.error(`No se encontró el contenedor con ID: ${contenedorId}`);
    return false;
  }

  try {
    // Cargar CSS
    cargarCSS('/src/dashboard/monitoreo.css');
    
    // Cargar el componente de UI
    cargarScript('/src/dashboard/monitoreo-ui.js', () => {
      // Una vez cargado el script, cargar el contenido HTML
      cargarHTML('/src/dashboard/dashboard-widget.html', contenedor, () => {
        console.log('Dashboard de monitoreo integrado correctamente');
      });
    });
    
    return true;
  } catch (error) {
    console.error('Error al integrar dashboard de monitoreo:', error);
    return false;
  }
}

/**
 * Carga un archivo CSS dinámicamente
 * @param {String} url - URL del archivo CSS
 */
function cargarCSS(url) {
  // Verificar si ya está cargado
  const links = document.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    if (links[i].href.includes(url)) {
      return; // Ya está cargado
    }
  }
  
  // Crear elemento link
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = url;
  
  // Añadir al head
  document.head.appendChild(link);
}

/**
 * Carga un script JavaScript dinámicamente
 * @param {String} url - URL del script
 * @param {Function} callback - Función a ejecutar cuando el script se carga
 */
function cargarScript(url, callback) {
  // Verificar si ya está cargado
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].src.includes(url)) {
      if (callback) callback();
      return; // Ya está cargado
    }
  }
  
  // Crear elemento script
  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = url;
  
  // Configurar callback
  if (callback) {
    script.onload = callback;
  }
  
  // Añadir al body
  document.body.appendChild(script);
}

/**
 * Carga contenido HTML desde una URL y lo inserta en un contenedor
 * @param {String} url - URL del archivo HTML
 * @param {HTMLElement} contenedor - Elemento contenedor
 * @param {Function} callback - Función a ejecutar cuando se completa
 */
function cargarHTML(url, contenedor, callback) {
  // Crear petición
  const xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        // Insertar contenido
        contenedor.innerHTML = xhr.responseText;
        
        // Ejecutar scripts en el contenido
        const scripts = contenedor.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
          eval(scripts[i].innerText);
        }
        
        if (callback) callback();
      } else {
        console.error(`Error al cargar HTML: ${xhr.status}`);
      }
    }
  };
  
  xhr.send();
}

// Exportar función
window.integrarDashboardMonitoreo = integrarDashboardMonitoreo;

// Auto-inicializar si existe el contenedor por defecto
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('contenedor-dashboard')) {
    integrarDashboardMonitoreo();
  }
});
