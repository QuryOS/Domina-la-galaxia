/* Service worker mínimo: solo hace la app instalable. No guarda nada en caché (así las actualizaciones llegan al instante). */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function () { /* red directa */ });
