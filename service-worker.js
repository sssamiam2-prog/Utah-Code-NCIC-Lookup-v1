const CACHE = "ncic-app-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.webmanifest",
  "./smot_data.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/choices.js/public/assets/styles/choices.min.css",
  "https://cdn.jsdelivr.net/npm/choices.js/public/assets/scripts/choices.min.js"
];

self.addEventListener("install", (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e)=>{
  e.respondWith((async ()=>{
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request);
    if (cached) return cached;
    try {
      const net = await fetch(e.request);
      if (e.request.method === "GET" && net.ok) cache.put(e.request, net.clone());
      return net;
    } catch {
      return cached || new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })());
});
