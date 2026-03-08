// sw.js — Instbyte service worker
// Minimal install-only service worker.
// We do not cache anything — Instbyte is a real-time LAN tool and must
// always fetch live data. This file exists solely to satisfy the PWA
// installability requirement.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// No fetch handler — all requests go straight to the network as normal.