// ============================================
// SERVICE WORKER — Cache First, Network Fallback
// sw.js
// ============================================

const CACHE_NAME = 'pharma-v2.0.1';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './css/progress-matrix-styles.css',
    './css/mobile-ui-styles.css',
    './css/auth-styles.css',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './fallback-data.js',
    './js/config.js',
    './js/data-loader.js',
    './js/competencies-config.js',
    './js/test-module.js',
    './js/cards-module.js',
    './js/cases-module.js',
    './js/progress-module.js',
    './js/competency-progress.js',
    './js/progress-matrix.js',
    './js/progress-matrix-ui.js',
    './js/test-selector.js',
    './js/app.js',
    './js/auth-module.js',
    './js/sync-module.js',
    './js/auth-ui.js',
    './js/app-auth-integration.js'
];

// ========================================
// INSTALL — precache всех assets
// ========================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => self.skipWaiting())
    );
});

// ========================================
// ACTIVATE — удалить старые кэши
// ========================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => self.clients.claim())
    );
});

// ========================================
// FETCH — стратегия по типу запроса
// ========================================
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // API (Google Apps Script) — Network First с fallback на кэш
    if (url.hostname === 'script.google.com') {
        event.respondWith(networkFirstStrategy(event.request));
        return;
    }

    // Статика — Cache First с fallback на сеть
    event.respondWith(cacheFirstStrategy(event.request));
});

// ========================================
// СТРАТЕГИИ
// ========================================

/**
 * Cache First: кэш -> сеть -> кэшируем ответ
 */
async function cacheFirstStrategy(request) {
    const cached = await caches.match(request);
    if (cached) {
        return cached;
    }

    try {
        const response = await fetch(request);
        // Кэшируем только успешные GET-ответы
        if (response.ok && request.method === 'GET') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        // Если и кэша нет и сети — вернём fallback для HTML
        if (request.destination === 'document') {
            return caches.match('./index.html');
        }
        throw error;
    }
}

/**
 * Network First: сеть -> кэшируем ответ -> fallback на кэш
 */
async function networkFirstStrategy(request) {
    try {
        const response = await fetch(request);
        // Кэшируем успешные API-ответы
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        // Нет кэша — возвращаем ошибку как JSON
        return new Response(
            JSON.stringify({ error: 'Нет соединения', offline: true }),
            { headers: { 'Content-Type': 'application/json' } }
        );
    }
}
