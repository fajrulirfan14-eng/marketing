const CACHE_NAME = "ttn-marketing-v15";

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/root.css",
  "/index.css",
  "/home.css",
  "/home.js",
  "/input.css",
  "/input.js",
  "/tabel.css",
  "/tabel.js",
  "/customer.css",
  "/customer.js",
  "/analisis.css",
  "/analisis.js",
  "/rolling.css",
  "/rolling.js",
  "/rollingcustomer.css",
  "/rollingcustomer.js",
  "/laporanharian.css",
  "/laporanharian.js",
  "/customersales.css",
  "/customersales.js",
  "/profil.css",
  "/profil.js",
  "/aksesibilitas.css",
  "/map.css",
  "/map.js",
  "/operasional.css",
  "/operasional.js",
  "/peraturan.css",
  "/peraturan.js",
  "/perjanjian.css",
  "/perjanjian.js",
  "/keamanan.css",
  "/keamanan.js",
  "/slip.css",
  "/slip.js",
  "/chat.css",
  "/chat.js",
  "/cleaner.css",
  "/tentang.css",
  "/login.css",
  "/login.js",
  "/index.js",
  "/fcm.js",
  "/ai-float-btn.js",
  "/devconsole.js",
  "/manifest.json",
  "/LogoTTN.png",
  "/icon_192.png",
  "/icon_512.png",
  "/icon_48.png",
  "/icon_32.png",
  "/pin.png",
  "/pinNew.png",
  "/pinNewLain.png",
  "/pinOf.png",
  "/pinOn.png",
];

// Install — cache semua static asset
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(() => {
            // Skip jika gagal, jangan block install
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate — hapus cache lama
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — Network first, fallback ke cache
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Skip non-GET dan request external (Firebase, Google Maps, CDN)
  if (event.request.method !== "GET") return;
  if (!url.origin.includes(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Simpan ke cache kalau sukses
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — ambil dari cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback ke index.html untuk navigasi
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
      })
  );
});
