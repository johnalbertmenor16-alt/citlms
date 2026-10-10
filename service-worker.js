// Service worker for the CIT-LMS progressive web app.
// Caches the static app shell so the app can open quickly (and offline)
// on phones, while always going to the network for API and uploads.
const CACHE_NAME = 'cit-lms-shell-v4';
const SHELL_FILES = [
    './',
    './index.html',
    './style.css',
    './views.css',
    './responsive.css',
    './arc.css',
    './modules.css',
    './classroom-chat.css',
    './classroom-content.css',
    './academic-workflow.css',
    './course-hierarchy.css',
    './password-recovery.css',
    './signup.css',
    './preview.css',
    './auth.css',
    './dashboard.css',
    './app.js',
    './config.js',
    './cit-seal.png',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(SHELL_FILES).catch(() => undefined))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    // Never cache API calls or uploaded files - they must be fresh and private.
    if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

    const isDocument = request.mode === 'navigate' || request.destination === 'document';
    const isFreshAsset = request.destination === 'style' || request.destination === 'script';

    // Network-first for the HTML shell and CSS/JS so phones always get the latest layout.
    if (isDocument || isFreshAsset) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Cache-first for images and other static assets.
    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => cached);
            return cached || network;
        })
    );
});
