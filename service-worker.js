const cacheName = "shen-yue-assistant-v206-gallery-name-fix";
const assets = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./updates.json",
  "./manifest.webmanifest",
  "./assets/app-logo.png",
  "./assets/update-splash.png",
  "./assets/sy-product-icons.png",
  "./assets/hero-car-audio.png",
  "./assets/icon-car-android.png",
  "./assets/icon-360-camera.png",
  "./assets/icon-dashcam.png",
  "./assets/icon-car-audio.png",
  "./assets/icon-tailgate.png",
  "./assets/icon-blind-spot.png",
  "./assets/qr-line.png",
  "./assets/qr-phone.png",
  "./assets/product-android.jpg",
  "./assets/product-360.png",
  "./assets/audio-case.jpg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(assets)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
