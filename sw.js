/* Mission — fonctionnement hors ligne : la liste des études reste consultable sans réseau.
   Les documents (documents/*.pdf) passent directement par le réseau : ils sont lus par morceaux
   (requêtes partielles) et le bouton Télécharger permet de les garder sur l’appareil. */
const CACHE = "mission-v11";
const COQUILLE = [
  "./",
  "index.html",
  "assets/style.css?v=6",
  "assets/app.js?v=6",
  "donnees/bibliotheque.js?v=10",
  "assets/fonts/alegreya-latin-500-normal.woff2",
  "assets/fonts/alegreya-latin-600-normal.woff2",
  "assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2",
  "assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2",
  "assets/icones/favicon.svg",
  "assets/icones/adventiste-blanc.svg",
  "assets/icones/adventiste-noir.svg",
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
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  // documents et requêtes partielles : réseau seulement
  if (url.pathname.includes("/documents/") || req.headers.has("range")) return;
  // pages : réseau d'abord (pour recevoir les mises à jour), cache si hors ligne
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((rep) => {
          if (rep.ok) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put("index.html", copie)); }
          return rep;
        })
        .catch(() => caches.match("index.html"))
    );
    return;
  }
  // le reste (feuilles de style, scripts, images, lecteur PDF) : cache d'abord, mis à jour en arrière-plan
  e.respondWith(
    caches.match(req).then((enCache) => {
      const reseau = fetch(req)
        .then((rep) => {
          // la copie se fait tout de suite : faite plus tard, Safari enregistre une image vide ou tronquée
          if (rep.ok && rep.status === 200) { const copie = rep.clone(); caches.open(CACHE).then((c) => c.put(req, copie)); }
          return rep;
        })
        .catch(() => enCache);
      return enCache || reseau;
    })
  );
});
