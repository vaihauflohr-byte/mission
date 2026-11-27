/* Index « ce verset dans les études » : pour chaque verset (et chaque chapitre cité en entier),
   les études qui le citent. Lit les références (a.ref) du texte des études (lecture/), et les découpe
   avec assets/bible.js, comme le site. Sortie : donnees/versets.json
     { e: [[document à ouvrir, titre, série], …], r: { "43.3.16": [n° d’étude, …], "43.3": […] } }
   Les fiches d’une même étude (participant, animateur, leçons du jour) comptent pour une seule étude.
   Lancer : node outils/lecture/index_versets.js  (après outils/lecture/convertir.py) */
const fs = require("fs");
const path = require("path");
const RACINE = path.resolve(__dirname, "../..");
global.window = {};
const Bible = require(path.join(RACINE, "assets/bible.js"));
eval(fs.readFileSync(path.join(RACINE, "donnees/bibliotheque.js"), "utf8"));
eval(fs.readFileSync(path.join(RACINE, "donnees/lecture.js"), "utf8"));
const B = window.BIBLIO;
const LECTURE = window.LECTURE;

// longueur des chapitres, pour les passages qui passent d’un chapitre à l’autre
const longueurs = {};
const chapitres = (l) => {
  if (!longueurs[l]) {
    const d = JSON.parse(fs.readFileSync(path.join(RACINE, `donnees/bible/${String(l).padStart(2, "0")}.json`), "utf8"));
    longueurs[l] = d.chapitres.map((c) => c.length);
  }
  return longueurs[l];
};

const etudes = []; // [f, titre, série]
const index = new Map(); // clé -> Set(n° d’étude)
const ajouter = (cle, n) => { if (!index.has(cle)) index.set(cle, new Set()); index.get(cle).add(n); };

function lireRefs(f) {
  if (!Object.prototype.hasOwnProperty.call(LECTURE, f)) return [];
  const html = fs.readFileSync(path.join(RACINE, "lecture", `${f}.html`), "utf8");
  return [...html.matchAll(/<a class="ref" href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

function indexer(n, docs) {
  docs.forEach((f) => lireRefs(f).forEach((href) => {
    const seg = Bible.analyser(Bible.passageDuLien(href));
    if (!seg) return;
    const ch = chapitres(seg[0].livre);
    seg.forEach((s) => {
      if (!s.v1) { for (let c = s.c1; c <= Math.min(s.c2, ch.length); c++) ajouter(`${s.livre}.${c}`, n); return; }
      for (let c = s.c1; c <= Math.min(s.c2, ch.length); c++) {
        const de = c === s.c1 ? s.v1 : 1;
        const a = c === s.c2 ? Math.min(s.v2, ch[c - 1]) : ch[c - 1];
        for (let v = de; v <= a; v++) ajouter(`${s.livre}.${c}.${v}`, n);
      }
    });
  }));
}

for (const s of B.series) {
  for (const l of s.lecons) {
    const docs = [...l.docs.map((d) => d.f), ...(l.jours || []).flatMap((j) => j.docs.map((d) => d.f))].filter(Boolean);
    const avecTexte = docs.filter((f) => Object.prototype.hasOwnProperty.call(LECTURE, f));
    if (!avecTexte.length) continue;
    // le document qui ouvre l’étude : sa première leçon du jour, sinon la fiche du participant
    const j0 = l.jours && l.jours[0] && l.jours[0].docs[0] && l.jours[0].docs[0].f;
    const p = l.docs.find((d) => d.f && d.role !== "animateur" && LECTURE[d.f]);
    const ouvrir = (j0 && LECTURE[j0] ? j0 : null) || (p && p.f) || avecTexte[0];
    const n = etudes.length;
    etudes.push([ouvrir, (l.num ? `Étude ${l.num} · ` : "") + l.titre, s.titre]);
    indexer(n, avecTexte);
  }
  for (const d of s.ressources) {
    if (!d.f || !LECTURE[d.f]) continue;
    const n = etudes.length;
    etudes.push([d.f, d.titre || s.titre, s.titre]);
    indexer(n, [d.f]);
  }
}

const r = {};
[...index.keys()].sort((a, b) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  return x[0] - y[0] || x[1] - y[1] || (x[2] || 0) - (y[2] || 0);
}).forEach((k) => { r[k] = [...index.get(k)].sort((a, b) => a - b); });
const sortie = JSON.stringify({ e: etudes, r });
fs.writeFileSync(path.join(RACINE, "donnees/versets.json"), sortie);
console.log(`${etudes.length} études, ${Object.keys(r).length} versets ou chapitres, ${(sortie.length / 1024).toFixed(0)} ko`);
