/*
 * pwa-service-worker.js — Harpoon Platform Core (Tier 1)
 *
 * Generic cache-first service worker template. This file is a TEMPLATE,
 * not runnable as committed here: the consuming build step fills in the
 * cache name and precache URL list placeholder constants below before
 * writing it out alongside the page(s) it serves.
 *
 * Vendored locally by each consumer (e.g. harpoon-story-engine's
 * renderer/pwa/) rather than loaded live cross-origin the way
 * harpoon-ui.js is — a service worker can only ever control pages on
 * its own origin, so it must physically ship with each product's own
 * build output, not be included from ui.har.pn at runtime.
 *
 * Strategy: cache-first for anything precached at install time, network
 * for anything not precached (caching successful same-origin responses
 * as they come in), and — for page navigations only, when both cache
 * and network miss — fall back to the precached start page rather than
 * showing the browser's own offline error. PRECACHE_URLS[0] is assumed
 * to be that start page; the build step must list it first.
 */
'use strict';

var CACHE_NAME = '__CACHE_NAME__';
var PRECACHE_URLS = __PRECACHE_URLS__;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(PRECACHE_URLS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200 && response.type === 'basic') {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function () {
          if (event.request.mode === 'navigate') {
            return caches.match(PRECACHE_URLS[0]);
          }
        });
    })
  );
});
