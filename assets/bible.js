/* Mission — la Bible dans le site : toucher une référence d’une étude affiche le passage
   (Louis Segond 1910) dans un panneau, sans quitter l’étude.
   Les références sont repérées à la conversion (outils/lecture/versets.py) : chaque lien a.ref
   pointe vers BibleGateway (« John 15:1-8 ») ; on lit cette adresse pour trouver le passage.
   Texte : donnees/bible/NN.json, un livre par fichier, chargé à la demande puis gardé par le
   service worker (produit par outils/bible/construire_bible.py). Les versets y sont numérotés
   comme sur BibleGateway et YouVersion, que suivent la plupart des études ; « imprimee » donne,
   pour les chapitres où la Segond imprimée numérote autrement, où commence chacun de ses versets.
   « Bible Strong » ouvre le même passage sur Lueur.org, en Segond avec les numéros Strong
   (mots hébreux et grecs, définitions en français) : ce texte-là ne peut pas être copié ici. */
(function (global) {
  "use strict";

  const VERSION_TEXTE = "2"; // à changer quand le texte est reconstruit

  // noms anglais des adresses BibleGateway et noms français, dans l’ordre des livres
  const ANGLAIS = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Songs", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus",
    "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
  ];
  const NOMS = [
    "Genèse", "Exode", "Lévitique", "Nombres", "Deutéronome", "Josué", "Juges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Rois", "2 Rois", "1 Chroniques", "2 Chroniques", "Esdras", "Néhémie", "Esther", "Job", "Psaumes", "Proverbes",
    "Ecclésiaste", "Cantique des cantiques", "Ésaïe", "Jérémie", "Lamentations", "Ézéchiel", "Daniel", "Osée", "Joël",
    "Amos", "Abdias", "Jonas", "Michée", "Nahum", "Habacuc", "Sophonie", "Aggée", "Zacharie", "Malachie",
    "Matthieu", "Marc", "Luc", "Jean", "Actes", "Romains", "1 Corinthiens", "2 Corinthiens", "Galates", "Éphésiens",
    "Philippiens", "Colossiens", "1 Thessaloniciens", "2 Thessaloniciens", "1 Timothée", "2 Timothée", "Tite",
    "Philémon", "Hébreux", "Jacques", "1 Pierre", "2 Pierre", "1 Jean", "2 Jean", "3 Jean", "Jude", "Apocalypse",
  ];
  // noms des livres dans les adresses de Lueur.org (Segond avec les numéros Strong)
  const LUEUR = [
    "genese", "exode", "levitique", "nombres", "deuteronome", "josue", "juges", "ruth", "1samuel", "2samuel",
    "1rois", "2rois", "1chroniques", "2chroniques", "esdras", "nehemie", "esther", "job", "psaumes", "proverbes",
    "ecclesiaste", "cantique", "esaie", "jeremie", "lamentations", "ezechiel", "daniel", "osee", "joel",
    "amos", "abdias", "jonas", "michee", "nahum", "habacuc", "sophonie", "aggee", "zacharie", "malachie",
    "matthieu", "marc", "luc", "jean", "actes", "romains", "1corinthiens", "2corinthiens", "galates", "ephesiens",
    "philippiens", "colossiens", "1thessaloniciens", "2thessaloniciens", "1timothee", "2timothee", "tite",
    "philemon", "hebreux", "jacques", "1pierre", "2pierre", "1jean", "2jean", "3jean", "jude", "apocalypse",
  ];
  const NUMERO = new Map(ANGLAIS.map((n, i) => [n.toLowerCase(), i + 1]));
  NUMERO.set("psalm", 19);
  NUMERO.set("song of solomon", 22);
  const UN_CHAPITRE = new Set([31, 57, 63, 64, 65]); // Abdias, Philémon, 2 et 3 Jean, Jude

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // « John 15:1-8 » → [{ livre: 43, c1: 15, v1: 1, c2: 15, v2: 8 }] ; v1 = 0 : chapitres entiers.
  // null : adresse illisible. Les numéros sont ceux de l’étude, vérifiés une fois le livre chargé.
  function analyser(passage) {
    const p = String(passage || "").trim().replace(/\s*([:,–-])\s*/g, "$1").replace(/–/g, "-").replace(/\s+/g, " ");
    const m = /^((?:[123] )?[A-Za-z]+(?: [A-Za-z]+)*) (\d{1,3})(?::(\d[\d,-]*))?$/.exec(p);
    if (!m) return null;
    const livre = NUMERO.get(m[1].toLowerCase());
    if (!livre) return null;
    let c = Number(m[2]);
    const items = m[3] ? m[3].split(",").filter(Boolean) : [];
    const seg = [];
    if (UN_CHAPITRE.has(livre) && c > 1) {
      // livre d’un seul chapitre : « Jude 20,21 » (arrivé en « Jude 20:21 ») désigne des versets
      seg.push({ livre, c1: 1, v1: c, c2: 1, v2: c });
      for (const it of items) {
        const [a, b] = it.split("-").map(Number);
        if (!a || a <= seg[seg.length - 1].v2) break; // « Jude 9, 1 Pierre… » : ce 1 n’est pas un verset
        seg.push({ livre, c1: 1, v1: a, c2: 1, v2: b >= a ? b : a });
      }
      return seg;
    }
    if (!items.length) return [{ livre, c1: c, v1: 0, c2: c, v2: 0 }];
    for (let i = 0; i < items.length; i++) {
      const [a, b] = items[i].split("-");
      const v1 = Number(a);
      let v2 = b ? Number(b) : v1;
      if (!v1) continue;
      if (b && v2 < v1) {
        if (i + 1 < items.length) {
          // « Exode 4.29 - 5.19 » arrive en « 4:29-5,19 » : passage d’un chapitre à l’autre
          seg.push({ livre, c1: c, v1, c2: v2, v2: Number(items[i + 1].split("-")[0]) });
          c = v2;
          i += 1;
          continue;
        }
        v2 = v1; // « 1 Rois 16:31 – 2 Rois 9:30 » : ce 2 n’est pas la fin du passage
      }
      seg.push({ livre, c1: c, v1, c2: c, v2 });
    }
    return seg;
  }

  // ---------- une référence tapée en français : « Jean 3:16 », « jn 3.16 », « 1 Co 13 », « Ps 23 » ----------
  const sansAccent = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/œ/g, "oe").replace(/[^a-z0-9]/g, "");
  const ALIAS = { // abréviations courantes ; les noms entiers viennent de NOMS
    gn: 1, ge: 1, gen: 1, ex: 2, exo: 2, exod: 2, lv: 3, lev: 3, nb: 4, nomb: 4, dt: 5, deut: 5, deu: 5,
    jos: 6, jg: 7, jug: 7, rt: 8, ru: 8, "1s": 9, "1sa": 9, "1sam": 9, "2s": 10, "2sa": 10, "2sam": 10,
    "1r": 11, "1rs": 11, "2r": 12, "2rs": 12, "1ch": 13, "1chr": 13, "1chron": 13, "2ch": 14, "2chr": 14, "2chron": 14,
    esd: 15, ne: 16, neh: 16, est: 17, jb: 18, ps: 19, psa: 19, psaume: 19, pr: 20, pro: 20, prov: 20, proverbe: 20,
    ec: 21, ecc: 21, eccl: 21, qo: 21, qohelet: 21, qoheleth: 21, ct: 22, cant: 22, cantique: 22,
    es: 23, esa: 23, is: 23, isa: 23, isaie: 23, jr: 24, jer: 24, lm: 25, lam: 25, ez: 26, eze: 26, ezekiel: 26,
    dn: 27, da: 27, dan: 27, os: 28, jl: 29, joe: 29, am: 30, ab: 31, abd: 31, jon: 32, mi: 33, mic: 33,
    na: 34, nah: 34, ha: 35, hab: 35, habakuk: 35, so: 36, soph: 36, ag: 37, agg: 37, za: 38, zac: 38, zach: 38,
    ml: 39, mal: 39, mt: 40, mat: 40, matt: 40, math: 40, mc: 41, mr: 41, mar: 41, lc: 42, lu: 42, jn: 43, jea: 43,
    ac: 44, act: 44, actesdesapotres: 44, rm: 45, ro: 45, rom: 45, "1co": 46, "1cor": 46, "2co": 47, "2cor": 47,
    ga: 48, gal: 48, ep: 49, eph: 49, ph: 50, phil: 50, php: 50, col: 51, "1th": 52, "1thes": 52, "1thess": 52,
    "2th": 53, "2thes": 53, "2thess": 53, "1tm": 54, "1ti": 54, "1tim": 54, "2tm": 55, "2ti": 55, "2tim": 55,
    tt: 56, tit: 56, phm: 57, philem: 57, he: 58, heb: 58, jc: 59, ja: 59, jac: 59, jq: 59,
    "1p": 60, "1pi": 60, "1pie": 60, "2p": 61, "2pi": 61, "2pie": 61, "1jn": 62, "2jn": 63, "3jn": 64,
    jd: 65, jud: 65, ap: 66, apo: 66, apoc: 66,
  };
  const ENTIERS = NOMS.map((n) => sansAccent(n)); // « 1samuel », « cantiquedescantiques »…
  ENTIERS.forEach((n, i) => { ALIAS[n] = i + 1; });
  function livreTape(chiffre, nom) {
    const cle = (chiffre || "") + sansAccent(nom);
    if (!sansAccent(nom)) return 0;
    if (ALIAS[cle]) return ALIAS[cle];
    // début d’un nom entier, s’il n’en désigne qu’un : « apocal », « deuter »
    if (cle.length - (chiffre ? 1 : 0) < 3) return 0;
    const possibles = ENTIERS.map((n, i) => (n.startsWith(cle) ? i + 1 : 0)).filter(Boolean);
    return possibles.length === 1 ? possibles[0] : 0;
  }
  function lireReference(texte) {
    const m = /^\s*(?:([1-3])\s*(?:ère|ere|er|re|e)?\s*)?([A-Za-zÀ-ÿœŒ][A-Za-zÀ-ÿœŒ .’']*?)\s*\.?\s*(\d{1,3})(?:\s*(?:[:.,]|\s)\s*(\d{1,3}))?(?:\s*[-–]\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?)?\s*$/
      .exec(String(texte || ""));
    if (!m) return null;
    const livre = livreTape(m[1], m[2]);
    if (!livre) return null;
    const c = Number(m[3]);
    const v = m[4] ? Number(m[4]) : 0;
    const fin = m[5] ? Number(m[5]) : 0;
    if (UN_CHAPITRE.has(livre) && !v) {
      // « Jude 3 », « Jude 3-5 » : des versets
      if (c === 1 && !fin) return [{ livre, c1: 1, v1: 0, c2: 1, v2: 0 }];
      return [{ livre, c1: 1, v1: c, c2: 1, v2: fin >= c ? fin : c }];
    }
    if (!v) return [{ livre, c1: c, v1: 0, c2: fin > c ? fin : c, v2: 0 }]; // chapitre(s) entier(s)
    if (m[6]) return [{ livre, c1: c, v1: v, c2: fin, v2: Number(m[6]) }]; // d’un chapitre à l’autre
    return [{ livre, c1: c, v1: v, c2: c, v2: fin >= v ? fin : v }];
  }
  // adresse BibleGateway d’un passage : recours sans connexion
  function adresseBibleGateway(seg) {
    const a = seg[0];
    const z = seg[seg.length - 1];
    const ref = !a.v1 ? `${a.c1}${z.c2 !== a.c1 ? `-${z.c2}` : ""}`
      : a.c1 === z.c2 ? `${a.c1}:${a.v1}${z.v2 !== a.v1 ? `-${z.v2}` : ""}` : `${a.c1}:${a.v1}-${z.c2}:${z.v2}`;
    return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(`${ANGLAIS[a.livre - 1]} ${ref}`)}&version=LSG`;
  }

  const passageDuLien = (href) => {
    try {
      return new URL(href, "https://exemple.org/").searchParams.get("search") || "";
    } catch (e) {
      return "";
    }
  };

  // titre en français : « Jean 3:16-18, 21 », « Exode 4:29 – 5:19 », « Psaume 23 »
  function titre(seg) {
    const l = seg[0].livre;
    const unChapitre = seg.every((s) => s.c1 === seg[0].c1 && s.c2 === seg[0].c1);
    const nom = l === 19 && unChapitre ? "Psaume" : NOMS[l - 1];
    let chap = 0;
    const parts = seg.map((s) => {
      if (s.v1 === 0) {
        chap = 0;
        return s.c1 === s.c2 ? `${s.c1}` : `${s.c1}-${s.c2}`;
      }
      const debut = UN_CHAPITRE.has(l) || s.c1 === chap ? `${s.v1}` : `${s.c1}:${s.v1}`;
      const fin = s.c2 !== s.c1 ? ` – ${s.c2}:${s.v2}` : s.v2 !== s.v1 ? `-${s.v2}` : "";
      chap = s.c2;
      return debut + fin;
    });
    return `${nom} ${parts.join(", ")}`;
  }

  // passages qui existent dans ce livre ; une fin trop loin s’arrête au dernier verset.
  // Une référence qui n’existe que dans la numérotation de la Segond imprimée y est retrouvée.
  function resoudre(seg, livre) {
    const ch = livre.chapitres;
    const imp = livre.imprimee || {};
    const n = (c) => (ch[c - 1] || []).length;
    const sortie = [];
    let renumerote = false;
    for (const s of seg) {
      if (s.c1 >= 1 && s.c1 <= ch.length && s.c2 >= s.c1 && s.v1 <= n(s.c1)) {
        const r = { ...s, c2: Math.min(s.c2, ch.length) };
        if (r.v1) r.v2 = Math.min(r.v2, n(r.c2));
        if (!r.v1 || r.c1 !== r.c2 || r.v2 >= r.v1) sortie.push(r);
        continue;
      }
      const debut = s.v1 && imp[s.c1] && imp[s.c1][s.v1 - 1];
      if (debut && debut[0]) {
        const t = imp[s.c2] || [];
        const fin = t[Math.min(s.v2, t.length) - 1] || debut;
        sortie.push({ livre: s.livre, c1: debut[0], v1: debut[1], c2: fin[0], v2: fin[1] });
        renumerote = true;
      }
    }
    return { seg: sortie, renumerote };
  }

  // le passage sur Lueur.org, en Segond avec Strong (même numérotation que nos versets).
  // Lueur ne lit pas les listes (« 16-18, 21 ») : on donne du premier au dernier verset.
  function adresseStrong(seg, entier) {
    const a = seg[0];
    const z = seg[seg.length - 1];
    let ref;
    if (entier || !a.v1) ref = a.c1 === z.c2 ? `${a.c1}` : `${a.c1}-${z.c2}`;
    else if (a.c1 === z.c2) ref = `${a.c1}.${a.v1}${z.v2 !== a.v1 ? `-${z.v2}` : ""}`;
    else ref = `${a.c1}.${a.v1}-${z.c2}.${z.v2}`;
    return `https://www.lueur.org/bible/${LUEUR[a.livre - 1]}${ref}/segond-strong`;
  }

  const charges = new Map();
  function charger(l) {
    if (!charges.has(l)) {
      const p = fetch(`donnees/bible/${String(l).padStart(2, "0")}.json?v=${VERSION_TEXTE}`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
      p.catch(() => charges.delete(l));
      charges.set(l, p);
    }
    return charges.get(l);
  }

  // versets v1..v2 des chapitres c1..c2 (0 : tout le chapitre) ; marque(c, v) : verset du passage
  function versets(chapitres, c1, v1, c2, v2, marque) {
    let h = "";
    for (let c = c1; c <= c2; c++) {
      const liste = chapitres[c - 1] || [];
      const de = c === c1 && v1 ? v1 : 1;
      const a = c === c2 && v2 ? v2 : liste.length;
      if (c2 > c1) h += `<h3 class="bible-chap">Chapitre ${c}</h3>`;
      h += '<p class="bible-passage">';
      for (let v = de; v <= a; v++) {
        const t = liste[v - 1] || "";
        const ligne = t.startsWith("\n") && v > de ? "<br>" : "";
        const texte = esc(t.replace(/^\n/, "")).replace(/\n/g, "<br>");
        const m = marque && marque(c, v) ? " bible-marque" : "";
        h += `${ligne}<span class="bible-v${m}"><sup class="bible-n">${v}</sup>${texte}</span> `;
      }
      h += "</p>";
    }
    return h;
  }

  function passage(chapitres, seg) {
    return seg.map((s, i) => {
      const avant = seg[i - 1];
      const suite = avant && s.v1 && avant.v2 && s.c1 === avant.c2 && s.v1 === avant.v2 + 1;
      return (i && !suite ? '<p class="bible-saut" aria-hidden="true">…</p>' : "") + versets(chapitres, s.c1, s.v1, s.c2, s.v2);
    }).join("");
  }

  // remplit le panneau (déjà ouvert) avec le passage du lien
  function montrer(panneau, href) {
    montrerPassage(panneau, analyser(passageDuLien(href)), href);
  }

  // remplit un panneau ou une carte (.bible-titre, .bible-corps, .bible-texte, .bible-tout, .bible-strong)
  function montrerPassage(panneau, brut, href) {
    const titreEl = panneau.querySelector(".bible-titre");
    const corps = panneau.querySelector(".bible-corps");
    const zone = panneau.querySelector(".bible-texte");
    const bouton = panneau.querySelector(".bible-tout");
    const strong = panneau.querySelector(".bible-strong");
    const jeton = {};
    panneau.jeton = jeton;
    bouton.hidden = true;
    strong.hidden = true;
    corps.scrollTop = 0;
    if (brut && brut.length && !href) href = adresseBibleGateway(brut);
    if (!brut || !brut.length) {
      titreEl.textContent = "Passage introuvable";
      zone.innerHTML = '<p class="bible-info">Cette référence n’a pas pu être lue.</p>';
      return;
    }
    titreEl.textContent = titre(brut);
    zone.innerHTML = '<p class="bible-info">Ouverture du texte…</p>';
    charger(brut[0].livre).then((livre) => {
      if (panneau.jeton !== jeton) return;
      const { seg, renumerote } = resoudre(brut, livre);
      if (!seg.length) {
        zone.innerHTML = '<p class="bible-info">Ce passage n’existe pas dans la Bible : la référence de l’étude contient sans doute une erreur.</p>';
        return;
      }
      const note = renumerote ? `<p class="bible-info">Ce passage est numéroté ${esc(titre(seg))} dans la plupart des Bibles.</p>` : "";
      let entier = false;
      const afficher = () => {
        if (entier) {
          const dans = (c, v) => seg.some((s) => s.v1 && (c > s.c1 || (c === s.c1 && v >= s.v1)) && (c < s.c2 || (c === s.c2 && v <= s.v2)));
          zone.innerHTML = versets(livre.chapitres, seg[0].c1, 0, seg[seg.length - 1].c2, 0, dans);
          const m = zone.querySelector(".bible-marque");
          if (corps.scrollHeight > corps.clientHeight + 2) {
            corps.scrollTop = m ? m.getBoundingClientRect().top - corps.getBoundingClientRect().top + corps.scrollTop - 12 : 0;
          } else if (m) {
            m.scrollIntoView({ block: "center" }); // carte dans la page : c’est la page qui défile
          }
        } else {
          zone.innerHTML = note + passage(livre.chapitres, seg);
          corps.scrollTop = 0;
        }
        bouton.textContent = entier ? "Revenir au passage" : "Voir tout le chapitre";
        bouton.setAttribute("aria-pressed", String(entier));
        strong.href = adresseStrong(seg, entier);
      };
      bouton.onclick = () => { entier = !entier; afficher(); };
      bouton.hidden = seg.every((s) => s.v1 === 0);
      strong.hidden = false;
      afficher();
    }).catch(() => {
      if (panneau.jeton !== jeton) return;
      zone.innerHTML = `<p class="bible-info">Le texte ne s’affiche pas (pas de connexion ?). <a href="${esc(href)}" target="_blank" rel="noopener">Le lire sur BibleGateway</a></p>`;
    });
  }

  global.Bible = { analyser, passageDuLien, titre, resoudre, passage, adresseStrong, lireReference, montrer, montrerPassage };
  if (typeof module === "object" && module.exports) module.exports = global.Bible;
})(typeof window !== "undefined" ? window : globalThis);
