/* Mission — fonctionnement hors ligne : la liste des études reste consultable sans réseau.
   Les documents eux-mêmes sont sur Google Drive et demandent une connexion. */
const CACHE = "mission-v2";
const COQUILLE = [
  "./",
  "index.html",
  "assets/style.css?v=2",
  "assets/app.js?v=2",
  "donnees/bibliotheque.js?v=2",
  "assets/fonts/alegreya-latin-500-normal.woff2",
  "assets/fonts/alegreya-latin-600-normal.woff2",
  "assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2",
  "assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "assets/icones/favicon.svg",
  "assets/icones/icone-192.png",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  // pages : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((rep) => { caches.open(CACHE).then((c) => c.put("index.html", rep.clone())); return rep; })
        .catch(() => caches.match("index.html"))
    );
    return;
  }
  // le reste : cache d'abord, mis à jour en arrière-plan
  e.respondWith(
    caches.match(req).then((enCache) => {
      const reseau = fetch(req)
        .then((rep) => { if (rep.ok) caches.open(CACHE).then((c) => c.put(req, rep.clone())); return rep; })
        .catch(() => enCache);
      return enCache || reseau;
    })
  );
});
