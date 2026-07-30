importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCp32H2WeN3A4ZwwWeUWe3Qcjqh0mz_vvQ",
  authDomain:        "teh-tarik-nusantara-26371.firebaseapp.com",
  projectId:         "teh-tarik-nusantara-26371",
  storageBucket:     "teh-tarik-nusantara-26371.firebasestorage.app",
  messagingSenderId: "354760960352",
  appId:             "1:354760960352:web:7d6a6c07dace937a74d605",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || "TTN Marketing", {
    body: body || "",
    icon: icon || '/logoTTN.png',
  });
});

// ═══════════════════════════════════════════
// CACHE — app shell (network-first) + aset statis (cache-first)
// ═══════════════════════════════════════════
const CACHE_VERSION = "ttn-marketing-v25";

const APP_SHELL = [
  "/", "/index.html", "/login.html",
  "/root.css", "/index.css",
  "/home.css",  "/home.js",
  "/input.css", "/input.js",
  "/tabel.css", "/tabel.js",
  "/customer.css", "/customer.js",
  "/analisis.css", "/analisis.js",
  "/rolling.css", "/rolling.js",
  "/rollingcustomer.css", "/rollingcustomer.js",
  "/laporanharian.css", "/laporanharian.js",
  "/customersales.css", "/customersales.js",
  "/profil.css", "/profil.js",
  "/aksesibilitas.css",
  "/map.css", "/map.js",
  "/operasional.css", "/operasional.js",
  "/peraturan.css", "/peraturan.js",
  "/perjanjian.css", "/perjanjian.js",
  "/keamanan.css", "/keamanan.js",
  "/slip.css", "/slip.js",
  "/chat.css", "/chat.js",
  "/cleaner.css",
  "/tentang.css",
  "/login.css", "/login.js",
  "/index.js",
  "/fcm.js",
  "/ai-float-btn.js",
  "/devconsole.js",
  "/manifest.json",
];

const STATIC_ASSETS = [
  "/LogoTTN.png", "/icon_192.png", "/icon_512.png", "/icon_48.png", "/icon_32.png",
  "/pin.png", "/pinNew.png", "/pinNewLain.png", "/pinOf.png", "/pinOn.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache =>
      Promise.allSettled(
        [...APP_SHELL, ...STATIC_ASSETS].map(url => cache.add(url).catch(() => {}))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(pathname) {
  return STATIC_ASSETS.some(p => pathname.endsWith(p));
}

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Cuma urus GET ke origin sendiri — Firestore/Storage/API biarin lewat langsung
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Aset statis (gambar/pin/icon) — cache-first, jarang berubah
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp && resp.status === 200) {
            const clone = resp.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return resp;
        });
      })
    );
    return;
  }

  // App shell (HTML/CSS/JS) — network-first, fallback cache kalau offline
  event.respondWith(
    fetch(event.request)
      .then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return resp;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === "navigate") return caches.match("/index.html");
        })
      )
  );
});