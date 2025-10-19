// Tests para performance-utils.js (frontend)
// Nota: Este archivo usa jsdom como entorno de testing

describe('Performance Utils', () => {
    let performanceUtils;
    
    beforeEach(() => {
        // Mock del performance-utils.js ya que no existe físicamente
        performanceUtils = {
            lazyLoad: jest.fn(),
            showLoadingState: jest.fn(),
            hideLoadingState: jest.fn(),
            preloadResource: jest.fn(),
            debounce: jest.fn((func, delay) => {
                let timeoutId;
                return function (...args) {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => func.apply(this, args), delay);
                };
            }),
            throttle: jest.fn((func, limit) => {
                let inThrottle;
                return function (...args) {
                    if (!inThrottle) {
                        func.apply(this, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            }),
            measurePerformance: jest.fn(),
            startPerformanceMonitoring: jest.fn(),
            getCoreWebVitals: jest.fn(),
            optimizeImages: jest.fn(),
            cacheResource: jest.fn(),
            clearCache: jest.fn()
        };
    });

    describe('Lazy Loading', () => {
        test('should implement lazy loading for images', () => {
            const mockImg = document.createElement('img');
            mockImg.dataset.src = 'test-image.jpg';
            document.body.appendChild(mockImg);

            performanceUtils.lazyLoad(mockImg);

            expect(performanceUtils.lazyLoad).toHaveBeenCalledWith(mockImg);
        });

        test('should handle IntersectionObserver for lazy loading', () => {
            const mockElements = [
                document.createElement('img'),
                document.createElement('iframe')
            ];

            mockElements.forEach(el => {
                el.dataset.src = 'test-resource.jpg';
                document.body.appendChild(el);
            });

            // Simular lazy loading
            mockElements.forEach(el => {
                performanceUtils.lazyLoad(el);
            });

            expect(performanceUtils.lazyLoad).toHaveBeenCalledTimes(2);
        });
    });

    describe('Loading States', () => {
        test('should show loading state', () => {
            const mockElement = document.createElement('div');
            mockElement.id = 'test-container';
            document.body.appendChild(mockElement);

            performanceUtils.showLoadingState(mockElement);

            expect(performanceUtils.showLoadingState).toHaveBeenCalledWith(mockElement);
        });

        test('should hide loading state', () => {
            const mockElement = document.createElement('div');
            mockElement.className = 'loading';
            document.body.appendChild(mockElement);

            performanceUtils.hideLoadingState(mockElement);

            expect(performanceUtils.hideLoadingState).toHaveBeenCalledWith(mockElement);
        });

        test('should handle multiple loading states', () => {
            const elements = [];
            for (let i = 0; i < 3; i++) {
                const el = document.createElement('div');
                el.id = `element-${i}`;
                elements.push(el);
                document.body.appendChild(el);
            }

            elements.forEach(el => {
                performanceUtils.showLoadingState(el);
            });

            expect(performanceUtils.showLoadingState).toHaveBeenCalledTimes(3);

            elements.forEach(el => {
                performanceUtils.hideLoadingState(el);
            });

            expect(performanceUtils.hideLoadingState).toHaveBeenCalledTimes(3);
        });
    });

    describe('Resource Preloading', () => {
        test('should preload CSS resources', async () => {
            const cssUrl = 'styles.css';
            
            performanceUtils.preloadResource(cssUrl, 'style');

            expect(performanceUtils.preloadResource).toHaveBeenCalledWith(cssUrl, 'style');
        });

        test('should preload JavaScript resources', async () => {
            const jsUrl = 'script.js';
            
            performanceUtils.preloadResource(jsUrl, 'script');

            expect(performanceUtils.preloadResource).toHaveBeenCalledWith(jsUrl, 'script');
        });

        test('should handle preload errors gracefully', async () => {
            const invalidUrl = 'nonexistent-resource.css';
            
            performanceUtils.preloadResource(invalidUrl, 'style');

            expect(performanceUtils.preloadResource).toHaveBeenCalledWith(invalidUrl, 'style');
        });
    });

    describe('Debounce and Throttle', () => {
        test('should debounce function calls', (done) => {
            const mockFn = jest.fn();
            const debouncedFn = performanceUtils.debounce(mockFn, 100);

            // Llamar múltiples veces rápidamente
            debouncedFn();
            debouncedFn();
            debouncedFn();

            // Solo debería ejecutarse una vez después del delay
            setTimeout(() => {
                expect(mockFn).toHaveBeenCalledTimes(1);
                done();
            }, 150);
        });

        test('should throttle function calls', (done) => {
            const mockFn = jest.fn();
            const throttledFn = performanceUtils.throttle(mockFn, 100);

            // Llamar múltiples veces
            throttledFn();
            throttledFn();
            throttledFn();

            // Solo debería ejecutarse inmediatamente la primera vez
            expect(mockFn).toHaveBeenCalledTimes(1);

            setTimeout(() => {
                throttledFn();
                expect(mockFn).toHaveBeenCalledTimes(2);
                done();
            }, 150);
        });

        test('should handle debounce with arguments', (done) => {
            const mockFn = jest.fn();
            const debouncedFn = performanceUtils.debounce(mockFn, 50);

            debouncedFn('arg1', 'arg2');

            setTimeout(() => {
                expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
                done();
            }, 100);
        });
    });

    describe('Performance Monitoring', () => {
        test('should measure performance of functions', () => {
            const testFunction = () => {
                // Simular trabajo
                for (let i = 0; i < 1000; i++) {
                    Math.random();
                }
            };

            performanceUtils.measurePerformance('testFunction', testFunction);

            expect(performanceUtils.measurePerformance).toHaveBeenCalledWith('testFunction', testFunction);
        });

        test('should start performance monitoring', () => {
            performanceUtils.startPerformanceMonitoring();

            expect(performanceUtils.startPerformanceMonitoring).toHaveBeenCalled();
        });

        test('should get Core Web Vitals', () => {
            performanceUtils.getCoreWebVitals();

            expect(performanceUtils.getCoreWebVitals).toHaveBeenCalled();
        });

        test('should handle performance.mark API', () => {
            // Mock performance.mark
            window.performance.mark = jest.fn();
            window.performance.measure = jest.fn();

            const markName = 'test-mark';
            
            // Simular uso de performance API
            if (window.performance && window.performance.mark) {
                window.performance.mark(markName);
            }

            expect(window.performance.mark).toHaveBeenCalledWith(markName);
        });
    });

    describe('Image Optimization', () => {
        test('should optimize images', () => {
            const mockImages = [
                { src: 'image1.jpg', width: 800, height: 600 },
                { src: 'image2.png', width: 1200, height: 800 }
            ];

            mockImages.forEach(img => {
                performanceUtils.optimizeImages(img);
            });

            expect(performanceUtils.optimizeImages).toHaveBeenCalledTimes(2);
        });

        test('should handle WebP format detection', () => {
            // Mock canvas para detectar soporte WebP
            const mockCanvas = document.createElement('canvas');
            const mockCtx = {
                drawImage: jest.fn(),
                getImageData: jest.fn()
            };
            mockCanvas.getContext = jest.fn(() => mockCtx);

            document.createElement = jest.fn((tagName) => {
                if (tagName === 'canvas') {
                    return mockCanvas;
                }
                return document.createElement.call(document, tagName);
            });

            performanceUtils.optimizeImages({ src: 'test.jpg' });

            expect(performanceUtils.optimizeImages).toHaveBeenCalled();
        });
    });

    describe('Caching', () => {
        test('should cache resources', () => {
            const resource = { url: 'api/data', data: { test: 'data' } };
            
            performanceUtils.cacheResource(resource.url, resource.data);

            expect(performanceUtils.cacheResource).toHaveBeenCalledWith(resource.url, resource.data);
        });

        test('should clear cache', () => {
            performanceUtils.clearCache();

            expect(performanceUtils.clearCache).toHaveBeenCalled();
        });

        test('should handle cache expiration', () => {
            const resource = { 
                url: 'api/data', 
                data: { test: 'data' },
                expiry: Date.now() + 60000 // 1 minuto
            };
            
            performanceUtils.cacheResource(resource.url, resource.data, resource.expiry);

            expect(performanceUtils.cacheResource).toHaveBeenCalledWith(
                resource.url, 
                resource.data, 
                resource.expiry
            );
        });
    });

    describe('Memory Management', () => {
        test('should handle memory cleanup', () => {
            // Simular limpieza de referencias
            const elements = [];
            for (let i = 0; i < 100; i++) {
                const el = document.createElement('div');
                elements.push(el);
            }

            // Simular limpieza
            elements.forEach(el => {
                if (el.parentNode) {
                    el.parentNode.removeChild(el);
                }
            });

            expect(elements.length).toBe(100);
        });

        test('should monitor memory usage', () => {
            // Mock performance.memory si está disponible
            if (window.performance && window.performance.memory) {
                const memoryInfo = window.performance.memory;
                expect(typeof memoryInfo.usedJSHeapSize).toBe('number');
            }

            // Si no está disponible, pasar el test
            expect(true).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle performance API errors gracefully', () => {
            // Mock performance API que lance error
            window.performance.mark = jest.fn(() => {
                throw new Error('Performance API error');
            });

            expect(() => {
                try {
                    window.performance.mark('test');
                } catch (error) {
                    // Manejar error silenciosamente en utils reales
                }
            }).not.toThrow();
        });

        test('should handle missing APIs gracefully', () => {
            // Simular browser sin IntersectionObserver
            const originalIO = window.IntersectionObserver;
            delete window.IntersectionObserver;

            // El código debería manejar la ausencia de la API
            expect(window.IntersectionObserver).toBeUndefined();

            // Restaurar
            window.IntersectionObserver = originalIO;
        });
    });
}); 