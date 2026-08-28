const VERSION = "pagewise-v2";
const STATIC_CACHE = `${VERSION}-static`;
const COVER_CACHE = `${VERSION}-covers`;
const PRECACHE = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, COVER_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok)
    (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function coverResponse(request) {
  const cache = await caches.open(COVER_CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        const keys = await cache.keys();
        if (keys.length > 80) await cache.delete(keys[0]);
      }
      return response;
    })
    .catch(() => cached);
  return cached || refresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.hostname.includes("supabase")) return;
  if (url.hostname === "covers.openlibrary.org") {
    event.respondWith(coverResponse(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/assets/") ||
    /\.(?:png|jpg|jpeg|webp|woff2?)$/.test(url.pathname)
  )
    event.respondWith(cacheFirst(request));
});
