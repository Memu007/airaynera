/**
 * Utilidades de Performance - AIRA Frontend
 * Lazy loading, preloading y optimización de rendimiento
 * @version 1.0.0
 */

(function(window) {
    'use strict';

    const PerformanceUtils = {};

    // ===== LAZY LOADING =====

    /**
     * Lazy loading para imágenes
     */
    PerformanceUtils.initLazyLoading = function() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy-loading');
                        img.classList.add('lazy-loaded');
                        imageObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                img.classList.add('lazy-loading');
                imageObserver.observe(img);
            });
        } else {
            // Fallback para navegadores sin IntersectionObserver
            document.querySelectorAll('img[data-src]').forEach(img => {
                img.src = img.dataset.src;
            });
        }
    };

    /**
     * Lazy loading para componentes pesados
     */
    PerformanceUtils.lazyLoadComponent = function(selector, loadFunction) {
        const element = document.querySelector(selector);
        if (!element) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    loadFunction(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '100px 0px'
        });

        observer.observe(element);
    };

    // ===== ESTADOS DE CARGA =====

    /**
     * Mostrar loading spinner elegante
     */
    PerformanceUtils.showLoading = function(target, message = 'Cargando...') {
        const $target = $(target);
        const loadingHtml = `
            <div class="aira-loading-overlay">
                <div class="aira-loading-content">
                    <div class="aira-spinner">
                        <div class="spinner-ring"></div>
                        <div class="spinner-ring"></div>
                        <div class="spinner-ring"></div>
                        <div class="spinner-ring"></div>
                    </div>
                    <p class="loading-message">${message}</p>
                </div>
            </div>
        `;
        
        $target.addClass('loading-state').append(loadingHtml);
        
        // Auto-hide después de 30 segundos para evitar bloqueos
        setTimeout(() => {
            this.hideLoading(target);
        }, 30000);
    };

    /**
     * Ocultar loading spinner
     */
    PerformanceUtils.hideLoading = function(target) {
        const $target = $(target);
        $target.removeClass('loading-state').find('.aira-loading-overlay').remove();
    };

    /**
     * Loading state para botones
     */
    PerformanceUtils.setButtonLoading = function(button, loading = true) {
        const $btn = $(button);
        
        if (loading) {
            const originalText = $btn.html();
            $btn.data('original-text', originalText)
                .html('<i class="fas fa-spinner fa-spin mr-2"></i>Procesando...')
                .prop('disabled', true)
                .addClass('btn-loading');
        } else {
            const originalText = $btn.data('original-text');
            $btn.html(originalText)
                .prop('disabled', false)
                .removeClass('btn-loading')
                .removeData('original-text');
        }
    };

    /**
     * Progress bar animado
     */
    PerformanceUtils.showProgress = function(target, progress = 0, message = '') {
        const $target = $(target);
        const progressHtml = `
            <div class="aira-progress-overlay">
                <div class="aira-progress-content">
                    <div class="progress mb-3">
                        <div class="progress-bar progress-bar-animated" 
                             role="progressbar" 
                             style="width: ${progress}%"
                             aria-valuenow="${progress}" 
                             aria-valuemin="0" 
                             aria-valuemax="100">
                            ${progress}%
                        </div>
                    </div>
                    ${message ? `<p class="progress-message">${message}</p>` : ''}
                </div>
            </div>
        `;
        
        if ($target.find('.aira-progress-overlay').length === 0) {
            $target.append(progressHtml);
        } else {
            $target.find('.progress-bar').css('width', progress + '%').text(progress + '%');
            if (message) {
                $target.find('.progress-message').text(message);
            }
        }
    };

    // ===== PRELOADING Y PREFETCHING =====

    /**
     * Precargar recursos críticos
     */
    PerformanceUtils.preloadCriticalResources = function() {
        const criticalResources = [
            { href: 'css/styles.css', as: 'style' },
            { href: 'js/security-utils.js', as: 'script' },
            { href: 'js/auth-secure.js', as: 'script' }
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource.href;
            link.as = resource.as;
            link.crossOrigin = 'anonymous';
            document.head.appendChild(link);
        });
    };

    /**
     * Prefetch de rutas que probablemente visitará el usuario
     */
    PerformanceUtils.prefetchRoutes = function(routes) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                routes.forEach(route => {
                    const link = document.createElement('link');
                    link.rel = 'prefetch';
                    link.href = route;
                    document.head.appendChild(link);
                });
            });
        }
    };

    // ===== DEBOUNCING Y THROTTLING =====

    /**
     * Debounce para búsquedas y inputs
     */
    PerformanceUtils.debounce = function(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(this, args);
        };
    };

    /**
     * Throttle para eventos de scroll y resize
     */
    PerformanceUtils.throttle = function(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    };

    // ===== MÉTRICAS DE PERFORMANCE =====

    /**
     * Medir métricas de performance
     */
    PerformanceUtils.measurePerformance = function() {
        if ('performance' in window) {
            const metrics = {
                // Core Web Vitals
                FCP: 0, // First Contentful Paint
                LCP: 0, // Largest Contentful Paint
                FID: 0, // First Input Delay
                CLS: 0, // Cumulative Layout Shift
                
                // Other metrics
                TTFB: 0, // Time to First Byte
                domContentLoaded: 0,
                loadComplete: 0
            };

            // Timing básico
            const timing = performance.timing;
            metrics.TTFB = timing.responseStart - timing.navigationStart;
            metrics.domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
            metrics.loadComplete = timing.loadEventEnd - timing.navigationStart;

            // Performance Observer para métricas modernas
            if ('PerformanceObserver' in window) {
                // First Contentful Paint
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name === 'first-contentful-paint') {
                            metrics.FCP = entry.startTime;
                        }
                    }
                }).observe({ entryTypes: ['paint'] });

                // Largest Contentful Paint
                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    metrics.LCP = lastEntry.startTime;
                }).observe({ entryTypes: ['largest-contentful-paint'] });

                // Layout Shift
                new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            metrics.CLS += entry.value;
                        }
                    }
                }).observe({ entryTypes: ['layout-shift'] });
            }

            // Enviar métricas después de que la página cargue
            window.addEventListener('load', () => {
                setTimeout(() => {
                    console.log('📊 Performance Metrics:', metrics);
                    
                    // En producción, enviar a analytics
                    if (window.gtag) {
                        gtag('event', 'page_performance', {
                            custom_map: { metric_name: 'custom_metric' },
                            FCP: Math.round(metrics.FCP),
                            LCP: Math.round(metrics.LCP),
                            CLS: Math.round(metrics.CLS * 1000) / 1000,
                            TTFB: Math.round(metrics.TTFB),
                            DOM: Math.round(metrics.domContentLoaded),
                            Load: Math.round(metrics.loadComplete)
                        });
                    }
                }, 2000);
            });

            return metrics;
        }
    };

    // ===== MEMORY MANAGEMENT =====

    /**
     * Limpiar memoria de componentes no utilizados
     */
    PerformanceUtils.cleanupMemory = function() {
        // Limpiar event listeners huérfanos
        $(document).off('.temp');
        
        // Limpiar timers globales
        if (window.tempTimers) {
            window.tempTimers.forEach(timer => clearTimeout(timer));
            window.tempTimers = [];
        }
        
        // Limpiar referencias de objetos grandes
        if (window.largeDataSets) {
            window.largeDataSets = null;
        }
    };

    /**
     * Monitor de memoria
     */
    PerformanceUtils.monitorMemory = function() {
        if ('memory' in performance) {
            const memory = performance.memory;
            const memoryInfo = {
                used: Math.round(memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(memory.totalJSHeapSize / 1048576), // MB
                limit: Math.round(memory.jsHeapSizeLimit / 1048576) // MB
            };

            console.log('🧠 Memory Usage:', memoryInfo);

            // Alerta si el uso de memoria es alto
            const usage = (memoryInfo.used / memoryInfo.limit) * 100;
            if (usage > 80) {
                console.warn('⚠️ High memory usage detected:', usage.toFixed(1) + '%');
                this.cleanupMemory();
            }

            return memoryInfo;
        }
    };

    // ===== INICIALIZACIÓN AUTOMÁTICA =====

    /**
     * Inicializar todas las optimizaciones de performance
     */
    PerformanceUtils.init = function() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }

        console.log('🚀 Inicializando optimizaciones de performance...');

        // Inicializar lazy loading
        this.initLazyLoading();

        // Precargar recursos críticos
        this.preloadCriticalResources();

        // Medir performance
        this.measurePerformance();

        // Monitor de memoria cada 5 minutos
        setInterval(() => this.monitorMemory(), 5 * 60 * 1000);

        // Prefetch de rutas comunes
        setTimeout(() => {
            this.prefetchRoutes([
                '/api/auth/profile',
                '/api/patients',
                '/api/sessions'
            ]);
        }, 3000);

        console.log('✅ Optimizaciones de performance inicializadas');
    };

    // Exportar
    window.PerformanceUtils = PerformanceUtils;

    // CSS para los componentes de loading
    const loadingStyles = `
        <style>
        .aira-loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(2px);
        }

        .aira-loading-content {
            text-align: center;
            padding: 2rem;
        }

        .aira-spinner {
            display: inline-block;
            position: relative;
            width: 80px;
            height: 80px;
        }

        .spinner-ring {
            box-sizing: border-box;
            display: block;
            position: absolute;
            width: 64px;
            height: 64px;
            margin: 8px;
            border: 8px solid #007bff;
            border-radius: 50%;
            animation: spinner-ring 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
            border-color: #007bff transparent transparent transparent;
        }

        .spinner-ring:nth-child(1) { animation-delay: -0.45s; }
        .spinner-ring:nth-child(2) { animation-delay: -0.3s; }
        .spinner-ring:nth-child(3) { animation-delay: -0.15s; }

        @keyframes spinner-ring {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .loading-message {
            margin-top: 1rem;
            color: #6c757d;
            font-weight: 500;
        }

        .loading-state {
            position: relative;
            overflow: hidden;
        }

        .btn-loading {
            cursor: not-allowed;
            opacity: 0.8;
        }

        .aira-progress-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 255, 255, 0.95);
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            min-width: 300px;
        }

        .progress-message {
            text-align: center;
            margin: 0;
            color: #6c757d;
        }

        .lazy-loading {
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .lazy-loaded {
            opacity: 1;
        }
        </style>
    `;

    // Inyectar estilos
    document.head.insertAdjacentHTML('beforeend', loadingStyles);

})(window); 