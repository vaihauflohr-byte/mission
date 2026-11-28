/* Mission — affichage de la bibliothèque (données : donnees/bibliotheque.js)
   et lecteur de documents intégré (PDF.js, chargé à la première ouverture d’un document). */
(function () {
  "use strict";

  const B = window.BIBLIO;
  const app = document.getElementById("contenu");
  const corps = document.body;
  const PICTOS = { connaitre: "pousse", grandir: "rameau", murir: "grappe", disciple: "epi" };
  const niveaux = Object.fromEntries(B.niveaux.map((n) => [n.id, n]));
  const series = Object.fromEntries(B.series.map((s) => [s.id, s]));
  const VERSION_PDFJS = "6.5.438";

  // ---------- outils ----------
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // typographie française : espace insécable avant : ? ! ; et dans les guillemets
  const fr = (s) => esc(s).replace(/ ([:?!;»])/g, " $1").replace(/« /g, "« ")
    .replace(/Jésus-Christ/g, '<span class="insecable">Jésus-Christ</span>');
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").toLowerCase();
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  const taille = (o) =>
    o >= 1e6
      ? `${(o / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: o >= 1e7 ? 0 : 1 })} Mo`
      : `${Math.max(1, Math.round(o / 1e3))} ko`;
  const picto = (id, classe) =>
    `<svg class="${classe || ""}" viewBox="0 0 48 48" aria-hidden="true"><use href="#${PICTOS[id]}"/></svg>`;
  const chevron = '<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>';
  const loupe = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>';
  const icone = {
    telecharger: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19.5h14"/></svg>',
    projeter: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M12 16.5v3M8 20h8"/></svg>',
    moins: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>',
    ajuster: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    appli: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M12 7v7m0 0-3-3m3 3 3-3M10 18.5h4"/></svg>',
    partager: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
    imprimer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8V3.5h10V8M7 17H4.5A1.5 1.5 0 0 1 3 15.5v-6A1.5 1.5 0 0 1 4.5 8h15A1.5 1.5 0 0 1 21 9.5v6a1.5 1.5 0 0 1-1.5 1.5H17"/><path d="M7 13.5h10V21H7z"/><path d="M17.5 11h.01"/></svg>',
    ecouter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18.2 6.3a7.8 7.8 0 0 1 0 11.4"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>',
    jouer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    arreter: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/></svg>',
    sommaire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
    affichage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19 8.5 5h1L15 19M5 14.5h8M15.5 19l3-8h.5l3 8M16.4 16.6h5.2"/></svg>',
    original: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/></svg>',
    lecture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V19.5"/></svg>',
    coeur: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.3s-7.6-4.6-9.3-9.5C1.5 7.3 3.8 4.2 7.1 4.2c2.1 0 3.7 1.1 4.9 2.9 1.2-1.8 2.8-2.9 4.9-2.9 3.3 0 5.6 3.1 4.4 6.6-1.7 4.9-9.3 9.5-9.3 9.5z"/></svg>',
    shorts: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="2.5" width="13" height="19" rx="3.5"/><path d="M10.3 8.9v6.2l5-3.1z"/></svg>',
    maison: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 11.2 12 4.2l8.5 7M6 9.5V20h4.5v-5.5h3V20H18V9.5"/></svg>',
    serie: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7.5" width="13" height="13" rx="2"/><path d="M7.5 4.5h10a2 2 0 0 1 2 2v10"/></svg>',
    haut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m0 0-5.5 5.5M12 5l5.5 5.5"/></svg>',
    coche: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>',
    groupe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.2c2.8-.4 5.2 1.4 5.2 4.6"/></svg>',
    horloge: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"/><path d="M12 9v4.5l2.8 1.8M9.5 2.5h5"/></svg>',
    envoyer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/></svg>',
    copier: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/></svg>',
    story: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><circle cx="12" cy="10" r="2.3"/><path d="M9.3 16.5h5.4"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.7"/><path d="m4.5 17.5 5-4.5 3.5 3 2.5-2 4 3.5"/></svg>',
    lien: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2"/></svg>',
    qr: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 19v1.5M19 14h1.5"/></svg>',
    inviter: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="8" r="3.5"/><path d="M3.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M19 7.5v6M16 10.5h6"/></svg>',
    boussole: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
    carnet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-11z"/><path d="M6.5 3.5v17M4.5 7.5h4M4.5 12h4M4.5 16.5h4M10.5 8h5.5M10.5 11.5h5.5"/></svg>',
    surligner: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 4.5 5 5-8 8H6.5v-5z"/><path d="M4 20.5h16"/></svg>',
    note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h14v10.5l-4.5 4.5H5z"/><path d="M14.5 19.5V15H19M8.5 9h7M8.5 12h4"/></svg>',
    effacer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5.5M13.5 11v5.5"/></svg>',
    cartes: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="7" width="12.5" height="13" rx="2"/><path d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h9.5a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 1-1.5 1.5H16"/><path d="M7 12h5.5M7 15.5h3.5"/></svg>',
    livre: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"/><path d="M12 6v13"/></svg>',
    horsLigne: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18.5a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.5 1.6A3.8 3.8 0 0 1 17.5 18.5z"/><path d="M12 10v6m0 0-2.5-2.5M12 16l2.5-2.5"/></svg>',
    fermer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    retourner: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1"/><path d="M17.5 3.5v3.4h-3.4M6.5 20.5v-3.4h3.4"/></svg>',
  };
  const chevronDroit = '<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg>';
  // images (assets/images/<nom>.webp, 4:3) : décoratives, le titre est juste à côté
  const image = (nom, classe, prioritaire) =>
    nom
      ? `<img class="${classe}" src="assets/images/${encodeURIComponent(nom)}.webp" alt="" width="800" height="600" ${
          prioritaire ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="reessayer(this)">`
      : "";

  // image en échec : nouvel essai par le réseau (adresse différente, donc hors cache), puis masquée
  window.reessayer = (img) => {
    if (img.dataset.essai) { img.style.visibility = "hidden"; return; }
    img.dataset.essai = "1";
    img.src = img.getAttribute("src").split("?")[0] + "?r=" + Date.now();
  };

  const seriesDe = (niveauId) => B.series.filter((s) => s.niveau === niveauId);
  const nbEtudes = (liste) => liste.reduce((t, s) => t + s.lecons.length, 0);
  const toutesPresentations = (s) => s.lecons.length && s.lecons.every((l) => l.docs.every((d) => d.format === "PowerPoint"));
  const compteSerie = (s) =>
    s.lecons.length
      ? pluriel(s.lecons.length, toutesPresentations(s) ? "présentation" : "étude", toutesPresentations(s) ? "présentations" : "études")
      : pluriel(s.ressources.length, "document", "documents");

  const COURTS = {
    "Fiche du participant": "Participant",
    "Guide de l’animateur": "Animateur",
    "Avec les réponses (version 2)": "Réponses, version 2",
  };
  const AIDE = {
    "Leçons du jour": "« Leçons du jour » déplie la leçon de chaque jour, puis toute la semaine en un document",
    "Participant": "« Participant » ouvre la fiche du participant",
    "Animateur": "« Animateur » ouvre le guide de l’animateur",
    "Avec les réponses": "« Avec les réponses » ouvre la fiche déjà remplie, pour l’animateur",
    "Notes de présentation": "« Notes de présentation » donne ce que l’animateur peut dire",
  };

  // ---------- documents ----------
  // chaque document importé a un chemin (d.f) : documents/<d.f>.pdf, lu dans #/lire/<d.f>
  const documents = new Map();
  // leçon du jour (j) d’une étude découpée jour par jour (l.jours) : { d, s, l, j }
  B.series.forEach((s) => {
    s.lecons.forEach((l) => {
      l.docs.forEach((d) => d.f && documents.set(d.f, { d, s, l }));
      (l.jours || []).forEach((j) => j.docs.forEach((d) => d.f && documents.set(d.f, { d, s, l, j })));
    });
    s.ressources.forEach((d) => d.f && documents.set(d.f, { d, s, l: null }));
  });
  const titreJour = (j) => (j.titre ? `${j.nom} : ${j.titre}` : j.nom);
  const fichierPdf = (d) => `documents/${d.f}.pdf`;
  // document pas encore importé : lien de secours vers le Drive
  const cible = (d) =>
    d.f ? `href="#/lire/${esc(d.f)}"` : `href="https://drive.google.com/file/d/${encodeURIComponent(d.id)}/view" target="_blank" rel="noopener"`;
  const estPresentation = (d) => d.format === "PowerPoint";
  const titreDoc = ({ d, l, j }) => (j ? titreJour(j) : l ? l.titre : d.titre);
  const detailDoc = ({ d, l, j }) => {
    const parties = [];
    if (j) parties.push(`Semaine ${l.num} : ${l.titre}`);
    else if (l && l.docs.length > 1) parties.push(d.libelle);
    else if (estPresentation(d)) parties.push("Présentation");
    if (d.p) parties.push(estPresentation(d) ? pluriel(d.p, "diapositive", "diapositives") : pluriel(d.p, "page", "pages"));
    return parties.join(", ");
  };
  const nomFichier = ({ d, l, j }) =>
    ((j ? `Semaine ${l.num} – ${j.nom}${j.titre ? `, ${j.titre}` : ""}`
      : l ? (l.num ? `Étude ${l.num} – ` : "") + l.titre + (l.docs.length > 1 ? ` (${d.libelle})` : "") : d.titre)
      .replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() + ".pdf");

  function bouton(d, libelle, principal, aria) {
    return `<a class="doc${principal ? " principal" : ""}" ${cible(d)}${aria ? ` aria-label="${esc(aria)}"` : ""}>${fr(libelle)}</a>`;
  }

  // une étude : un bouton par document (« Ouvrir » s’il n’y en a qu’un)
  function etude(l, s) {
    const nomComplet = (l.num ? `Étude ${l.num} : ` : "") + l.titre;
    const num = l.num ? `<span class="etude-num" aria-hidden="true">${esc(l.num)}</span>` : "";
    let boutons = l.docs.length === 1
      ? bouton(l.docs[0], estPresentation(l.docs[0]) ? "Voir" : "Ouvrir", true, `${estPresentation(l.docs[0]) ? "Voir" : "Ouvrir"} : ${nomComplet}`)
      : l.docs.map((d, i) => bouton(d, COURTS[d.libelle] || d.libelle, i === 0 && d.role !== "animateur", `${d.libelle} : ${nomComplet}`)).join("");
    // étude découpée jour par jour : « Leçons du jour » déplie la liste des jours, la fiche de toute la semaine en dernier
    let jours = "";
    if (aDesJours(l)) {
      const id = `jours-${s.id}-${l.num}`;
      const ouvert = joursOuverts.has(id);
      const semaine = l.docs.find((d) => d.role === "participant");
      boutons = `<button type="button" class="doc principal jours-bouton" aria-expanded="${ouvert}" aria-controls="${id}"
          aria-label="Leçons du jour : ${esc(nomComplet)}">Leçons du jour${chevronBas}</button>`
        + l.docs.filter((d) => d !== semaine).map((d) => bouton(d, COURTS[d.libelle] || d.libelle, false, `${d.libelle} : ${nomComplet}`)).join("");
      const ligne = (d, nom, titre, classe) => `<li><a class="jour${classe || ""}" ${cible(d)}>
          <span class="jour-nom">${fr(nom)}</span>${titre ? `<span class="jour-titre">${fr(titre)}</span>` : ""}</a></li>`;
      jours = `<ol class="jours" id="${id}" aria-label="Leçons du jour : ${esc(l.titre)}"${ouvert ? "" : " hidden"}>
          ${l.jours.map((j) => ligne(j.docs[0], j.nom, j.titre)).join("")}
          ${semaine ? ligne(semaine, "Toute la semaine", "la fiche du participant en un seul document", " jour-semaine") : ""}
        </ol>`;
    }
    // coche « terminée », posée sur le coin de la vignette
    const cle = s.lecons.length > 1 && cleLecon(l);
    const fait = cle && faites.a(l);
    const coche = cle ? `<button type="button" class="etude-faite" data-faite="${esc(cle)}" aria-pressed="${!!fait}"
        aria-label="Étude terminée : ${esc(nomComplet)}">${icone.coche}</button>` : "";
    const vignette = l.image
      ? `<span class="etude-vignette">${image(l.image, "")}${num}${coche}</span>`
      : `<span class="etude-vignette sans-image">${picto(s.niveau, "fond-picto")}${num}${coche}</span>`;
    return `<li class="etude${jours ? " avec-jours" : ""}${fait ? " faite" : ""}">
      ${vignette}
      <p class="etude-titre">${fr(l.titre)}${l.sujet ? `<span class="cache"> — sujet : </span><span class="etude-sujet">${fr(l.sujet)}</span>` : ""}</p>
      <div class="etude-docs">${boutons}</div>
      ${jours}
    </li>`;
  }
  const aDesJours = (l) => !!(l.jours && l.jours.length);
  const joursOuverts = new Set(); // listes « Leçons du jour » dépliées, gardées d’un affichage de la série à l’autre
  const chevronBas = '<svg class="chevron chevron-bas" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6"/></svg>';
  function basculerJours(bouton, ouvrir) {
    const liste = document.getElementById(bouton.getAttribute("aria-controls"));
    if (!liste) return;
    const ouvert = ouvrir === undefined ? bouton.getAttribute("aria-expanded") !== "true" : ouvrir;
    bouton.setAttribute("aria-expanded", String(ouvert));
    liste.hidden = !ouvert;
    if (ouvert) joursOuverts.add(liste.id);
    else joursOuverts.delete(liste.id);
  }
  app.addEventListener("click", (ev) => {
    const b = ev.target.closest(".jours-bouton");
    if (b) basculerJours(b);
  });

  function fil(etapes) {
    return `<nav class="fil" aria-label="Vous êtes ici"><ol>${etapes
      .map(([texte, lien], i) =>
        i === etapes.length - 1
          ? `<li><span aria-current="page">${fr(texte)}</span></li>`
          : `<li><a href="${lien}">${fr(texte)}</a>${chevron}</li>`)
      .join("")}</ol></nav>`;
  }

  function marquerNav(niveauId) {
    document.querySelectorAll(".entete-nav a").forEach((a) => {
      if (a.dataset.niveau === niveauId) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
    });
  }

  // ---------- application installable (PWA) ----------
  const appareil = (() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
    return /Android/.test(ua) ? "android" : "ordinateur";
  })();
  const installee = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let invitation = null; // proposition d’installation du navigateur (Android, ordinateur)
  function majInstallation() {
    document.querySelectorAll("[data-installer]").forEach((e) => { e.hidden = installee(); });
    document.querySelectorAll("[data-invitation]").forEach((e) => { e.hidden = !invitation || installee(); });
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); invitation = e; majInstallation(); });
  window.addEventListener("appinstalled", () => { invitation = null; majInstallation(); });
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-action-installer]");
    if (b && invitation) {
      e.preventDefault();
      const proposition = invitation;
      invitation = null;
      proposition.prompt();
      await proposition.userChoice.catch(() => null);
      majInstallation();
      return;
    }
    const p = e.target.closest("[data-partager]");
    if (p) {
      const lien = "https://mission.ka-ilei.com/";
      if (navigator.share) {
        navigator.share({ title: "Mission", text: "Études bibliques pour les petits groupes", url: lien }).catch(() => {});
      } else {
        try { await navigator.clipboard.writeText(lien); p.textContent = "Lien copié"; } catch (err) { prompt("Lien à copier :", lien); }
      }
    }
  });

  function application() {
    document.title = "L’application — Mission";
    const cas = {
      ios: `<section class="appli-cas"><h2>iPhone et iPad</h2><ol>
          <li>Ouvrez <strong>mission.ka-ilei.com</strong> avec <strong>Safari</strong>.</li>
          <li>Touchez le bouton <strong>Partager</strong> <span class="appli-icone">${icone.partager}</span>, en bas de l’écran (en haut sur iPad).</li>
          <li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>.</li></ol></section>`,
      android: `<section class="appli-cas"><h2>Téléphone Android</h2><ol>
          <li>Ouvrez <strong>mission.ka-ilei.com</strong> avec <strong>Chrome</strong>.</li>
          <li>Touchez le menu <strong>⋮</strong> en haut à droite, puis <strong>Installer l’application</strong> (parfois <strong>Ajouter à l’écran d’accueil</strong>).</li>
          <li>Confirmez : l’icône Mission apparaît avec les autres applications.</li></ol></section>`,
      ordinateur: `<section class="appli-cas"><h2>Ordinateur</h2><ol>
          <li>Ouvrez le site avec <strong>Chrome</strong> ou <strong>Edge</strong>.</li>
          <li>Cliquez sur l’icône d’installation, à droite de la barre d’adresse, puis sur <strong>Installer</strong>.</li></ol></section>`,
    };
    const ordre = [appareil, ...["ios", "android", "ordinateur"].filter((a) => a !== appareil)];
    app.innerHTML = `
      <div class="page page-appli">
        ${fil([["Accueil", "#/"], ["L’application"]])}
        <div class="appli-mise">
          <div class="appli-texte">
            <h1 class="titre-page" tabindex="-1">L’application Mission</h1>
            <p class="chapeau">Installée sur le téléphone, Mission s’ouvre depuis son icône, en plein écran, comme une application. Elle se met à jour toute seule, et la liste des études reste consultable sans connexion.</p>
            ${installee()
              ? '<p class="appli-ok">L’application est installée sur cet appareil.</p>'
              : `<p class="appli-installer" data-invitation hidden><button type="button" class="doc principal" data-action-installer>${icone.appli}Installer l’application</button></p>`}
            ${ordre.map((a) => cas[a]).join("")}
            <p class="appli-note">Les documents s’ouvrent avec une connexion. Pour en garder un sur le téléphone, touchez Télécharger dans le document.</p>
          </div>
          <aside class="appli-partage" aria-labelledby="partage-titre">
            <h2 id="partage-titre">Faire connaître l’application</h2>
            <img src="assets/icones/qr-mission.svg" alt="Code QR qui ouvre mission.ka-ilei.com" width="200" height="200">
            <p>À scanner avec l’appareil photo du téléphone : il ouvre <strong>mission.ka-ilei.com</strong>, d’où l’on installe l’application.</p>
            <button type="button" class="doc" data-partager>${icone.partager}Partager le lien</button>
          </aside>
        </div>
      </div>`;
    majInstallation();
    return true;
  }

  // ---------- pages ----------
  function accueil() {
    document.title = "Mission — études bibliques pour les petits groupes";
    const total = nbEtudes(B.series);
    const etapes = B.niveaux
      .map((n, rang) => {
        const ss = seriesDe(n.id);
        return `<li class="cep-niveau${n.parallele ? " cep-parallele" : ""}">
          <a class="cep-lien" href="#/niveau/${n.id}">
            <span class="cep-picto">${picto(n.id)}</span>
            ${n.parallele ? `<span class="cep-parallele-note">${fr(n.parallele)}</span>` : ""}
            <span class="cep-etape"><span class="num-etape" aria-hidden="true">${n.num}</span><span class="cep-verbe">${fr(n.titre)}</span></span>
            <span class="cep-texte">${fr(n.texte)}</span>
            ${n.invite ? `<strong class="cep-invite">${fr(n.invite)}</strong>` : ""}
            <span class="cep-compte">${pluriel(ss.length, "série", "séries")}, ${pluriel(nbEtudes(ss), "étude", "études")}</span>
          </a>
          <ul class="cep-series" aria-label="Séries de l’étape ${n.num}">${ss.map((s, k) => {
            const total = s.lecons.length;
            const fait = total > 1 ? faites.nombre(s) : 0;
            return `<li><a class="cep-serie" href="#/serie/${s.id}">
              ${image(s.image, "cep-serie-image", rang === 0 && k < 2)}
              <span class="cep-serie-corps">
                <span class="cep-serie-titre">${fr(s.titre)}${s.note ? ` <span class="cep-serie-note">(${fr(s.note)})</span>` : ""}</span>
                <span class="cep-serie-compte">${compteSerie(s)}${fait ? ` · ${fait === total ? "terminée" : `${fait} faite${fait > 1 ? "s" : ""}`}` : ""}</span>
                ${fait && fait < total ? `<span class="progression-barre" aria-hidden="true"><span style="width:${Math.round((fait / total) * 100)}%"></span></span>` : ""}
              </span>
              ${chevronDroit}
            </a></li>`;
          }).join("")}</ul>
        </li>`;
      })
      .join("");
    app.innerHTML = `
      <section class="accueil" aria-labelledby="accueil-titre">
        <div class="dedans accueil-tete">
          <div class="accueil-texte">
            <h1 id="accueil-titre" class="accueil-titre" tabindex="-1">Des études bibliques prêtes pour votre petit groupe</h1>
            <p class="accueil-chapeau">${total} études en français, rangées en trois étapes. Chaque étude a sa fiche du participant, souvent un guide pour l’animateur, et tout se lit ici, sur téléphone comme sur ordinateur.</p>
            <p class="accueil-commencer">
              <a class="lien-etudes" href="#etudes" data-aller-etudes>${icone.lecture}<span>Voir les ${total} études<small>${pluriel(B.series.length, "série", "séries")}, en trois étapes</small></span></a>
              <a class="lien-commencer" href="#/commencer">${icone.boussole}<span>Par où commencer ?<small>Trois questions pour trouver votre série</small></span></a>
            </p>
            <p class="accueil-appli" data-installer><a class="lien-appli" href="#/application" data-action-installer>${icone.appli}Installer l’application ${
              appareil === "ordinateur" ? "sur cet ordinateur" : "sur ce téléphone"}</a></p>
          </div>
          <form class="recherche" role="search" action="#/chercher">
            <label for="q-accueil">Chercher une étude par sujet, titre ou personnage</label>
            <div class="champ">${loupe}<input id="q-accueil" name="q" type="search" autocomplete="off"
              placeholder="baptême, prière, sabbat, Daniel…" enterkeyhint="search"><button type="submit">Chercher</button></div>
            <p class="exemples">Par exemple : ${["prière", "baptême", "sabbat", "Daniel", "Saint-Esprit", "mort"]
              .map((m) => `<a href="#/chercher/${encodeURIComponent(m)}">${esc(m)}</a>`).join(", ")}.</p>
          </form>
        </div>
        ${reprise()}
        <section class="dedans cep" id="etudes" tabindex="-1" aria-labelledby="etudes-titre">
          <h2 class="cep-titre" id="etudes-titre">Les études</h2>
          <p class="cep-sous">${total} études en ${pluriel(B.series.length, "série", "séries")}, rangées en trois étapes : de la rencontre à la maturité.</p>
          <ol class="cep-liste">${etapes}</ol>
        </section>
        <section class="dedans du-jour" data-du-jour aria-labelledby="du-jour-titre" hidden></section>
        ${etagereShorts()}
        <div class="dedans accueil-groupe">${carteCarnet()}${carteGroupe()}${carteInviter()}</div>
      </section>
      <section class="mode" aria-labelledby="mode-titre">
        <div class="dedans mode-dedans">
          <h2 id="mode-titre" class="section-titre">Comment s’en servir</h2>
          <dl class="mode-liste">
            <div><dt>Une série, dans l’ordre</dt><dd>Chaque étape regroupe plusieurs séries. On suit une série dans l’ordre, une étude par rencontre.</dd></div>
            <div><dt>La fiche du participant</dt><dd>Pour chacun : le texte de l’étude, les versets à lire et les questions.</dd></div>
            <div><dt>Le guide de l’animateur</dt><dd>Pour celui qui conduit le groupe : les réponses, les questions à poser et le déroulement.</dd></div>
            <div><dt>Lire comme dans l’appli</dt><dd>Chaque étude s’ouvre en mode lecture : le texte s’adapte à l’écran, on choisit la taille, le fond (clair, sépia, nuit), on fait défiler ou on tourne les pages comme dans un livre, et on écrit ses réponses sous les questions.</dd></div>
            <div><dt>Imprimer, télécharger</dt><dd>Le bouton Imprimer est toujours là : le document d’origine, ou ce qu’on lit avec ses réponses. L’original reste disponible en PDF, à garder sur son téléphone.</dd></div>
            <div><dt>Partager</dt><dd>Chaque série et chaque document ont leur propre lien : envoyez-le pour inviter quelqu’un.</dd></div>
            <div><dt>Comme une application</dt><dd>Installée sur le téléphone, Mission s’ouvre depuis son icône, en plein écran. <a href="#/application">Voir comment l’installer</a>.</dd></div>
          </dl>
        </div>
      </section>`;
    const liste = app.querySelector(".cep-liste");
    if (!sessionStorage.getItem("mission-vu")) {
      liste.classList.add("pousse");
      try { sessionStorage.setItem("mission-vu", "1"); } catch (e) { /* navigation privée */ }
    }
    app.querySelector(".recherche").addEventListener("submit", (e) => {
      e.preventDefault();
      location.hash = "#/chercher/" + encodeURIComponent(e.target.q.value.trim());
    });
    // « Voir les études » descend jusqu’aux études (sans changer d’adresse : l’adresse #etudes n’est pas une page)
    app.querySelector("[data-aller-etudes]").addEventListener("click", (e) => {
      e.preventDefault();
      const zone = app.querySelector("#etudes");
      zone.scrollIntoView({ behavior: mouvementReduit() ? "auto" : "smooth", block: "start" });
      zone.focus({ preventScroll: true });
    });
    remplirEtagere();
    majInstallation();
    return true;
  }

  // dernière étude lue en mode lecture : la reprendre où on s’était arrêté, ou passer à la suivante
  function cibleReprise() {
    const f = memoire.lire("mission.derniere", "");
    const e = f && aTexte(f) && documents.get(f);
    if (!e) return null;
    const pos = Math.min(1, Math.max(0, Number(memoire.lire(`mission.pos.${f}`, "0")) || 0));
    if (pos < 0.98) return { f, e, pos, etiquette: "Reprendre votre lecture" };
    const apres = suivant(e);
    if (!apres || !apres.d.f || !aTexte(apres.d.f)) return null;
    return { f: apres.d.f, e: documents.get(apres.d.f), pos: 0, etiquette: "Étude suivante" };
  }
  function reprise() {
    const cible = cibleReprise();
    if (!cible) return "";
    const { s, l, j } = cible.e;
    const ou = j ? `Semaine ${l.num} · ` : l && l.num ? `Étude ${l.num} · ` : "";
    const pct = Math.round(cible.pos * 100);
    return `<div class="dedans reprise">
      <a class="reprise-lien" href="#/lire/${esc(cible.f)}">
        <span class="reprise-etiquette">${cible.etiquette}</span>
        <span class="reprise-titre">${fr(titreDoc(cible.e))}</span>
        <span class="reprise-ou">${esc(ou)}${fr(s.titre)}</span>
        ${pct ? `<span class="reprise-barre" aria-hidden="true"><span style="width:${pct}%"></span></span><span class="reprise-pct">${pct} % lu</span>` : ""}
        ${chevronDroit}
      </a>
    </div>`;
  }

  // ---------- études terminées (gardées sur l’appareil, clé mission.faites) ----------
  // une étude = une leçon d’une série ; sa clé : le chemin de sa fiche du participant
  const cleLecon = (l) => {
    const d = l.docs.find((x) => x.f && x.role !== "animateur") || l.docs.find((x) => x.f);
    return d ? d.f : null;
  };
  // document qui ouvre une étude : sa première leçon du jour, sinon la fiche du participant
  const docLecon = (l) => (aDesJours(l) && l.jours[0].docs[0].f ? l.jours[0].docs[0]
    : l.docs.find((x) => x.f && x.role !== "animateur") || l.docs.find((x) => x.f) || null);
  const faites = {
    lire() {
      try {
        const o = JSON.parse(memoire.lire("mission.faites", "{}"));
        return o && typeof o === "object" && !Array.isArray(o) ? o : {};
      } catch (e) { return {}; }
    },
    a(l) { const k = cleLecon(l); return !!(k && this.lire()[k]); },
    mettre(l, oui) {
      const k = cleLecon(l);
      if (!k) return;
      const o = this.lire();
      if (oui) o[k] = o[k] || new Date().toISOString().slice(0, 10);
      else delete o[k];
      memoire.ecrire("mission.faites", JSON.stringify(o));
    },
    nombre(s) { const o = this.lire(); return s.lecons.filter((l) => { const k = cleLecon(l); return k && o[k]; }).length; },
  };
  // avancement d’une série (au moins deux études) : combien sont terminées, et l’étude à suivre
  function progressionSerie(s) {
    const total = s.lecons.length;
    if (total < 2) return "";
    const n = faites.nombre(s);
    const prochaine = s.lecons.find((l) => !faites.a(l) && docLecon(l));
    const d = prochaine && docLecon(prochaine);
    const nom = prochaine ? (prochaine.num ? `Étude ${prochaine.num} · ` : "") + prochaine.titre : "";
    const etat = n === total
      ? `<p class="progression-texte progression-fini">${icone.coche}Série terminée : les ${total} études</p>`
      : n ? `<p class="progression-texte"><strong>${n}</strong> sur ${total} études terminées</p>
          <span class="progression-barre" aria-hidden="true"><span style="width:${Math.round((n / total) * 100)}%"></span></span>` : "";
    return `${etat}${d ? `<a class="progression-suite" ${cible(d)}><span class="progression-etiquette">${n ? "Continuer" : "Commencer"}</span>
        <span class="progression-nom">${fr(nom)}</span>${chevronDroit}</a>` : ""}`;
  }

  function avanceSerie(s) {
    const n = s.lecons.length > 1 ? faites.nombre(s) : 0;
    if (!n) return "";
    const total = s.lecons.length;
    return `<span class="serie-avance"><span class="progression-barre" aria-hidden="true"><span style="width:${Math.round((n / total) * 100)}%"></span></span>
      ${n === total ? "Série terminée" : `${n} sur ${total} terminées`}</span>`;
  }

  // lien vers la page du petit groupe (accueil, étape « Devenir disciple »)
  const carteGroupe = () => `<a class="carte-groupe" href="#/groupe">
      <span class="carte-groupe-icone">${icone.groupe}</span>
      <span class="carte-groupe-texte"><span class="carte-groupe-titre">Vous animez un petit groupe ?</span>
        <span>Le déroulé de la rencontre avec un minuteur, les binômes de la semaine et le bilan en une minute.</span></span>
      ${chevronDroit}
    </a>`;

  const carteInviter = () => `<a class="carte-groupe" href="#/inviter">
      <span class="carte-groupe-icone">${icone.inviter}</span>
      <span class="carte-groupe-texte"><span class="carte-groupe-titre">Inviter un ami</span>
        <span>Un message avec le lien, un code QR à scanner, des cartes d’invitation à imprimer.</span></span>
      ${chevronDroit}
    </a>`;
  // partager un lien : la feuille de partage du téléphone, sinon le texte copié
  async function partagerLien(titre, texte, lien) {
    if (navigator.share) {
      try { await navigator.share({ title: titre, text: texte, url: lien }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    await copierTexte(`${texte}\n${lien}`);
  }

  function niveau(id) {
    const n = niveaux[id];
    if (!n) return introuvable();
    const ss = seriesDe(id);
    document.title = `${n.titre} — Mission`;
    marquerNav(id);
    app.innerHTML = `
      <div class="page">
        ${fil([["Accueil", "#/"], [n.verbe]])}
        <header class="niveau-tete">
          <div class="niveau-texte">
            <h1 class="titre-page titre-niveau" tabindex="-1"><span class="num-etape" aria-hidden="true">${n.num}</span><span><span class="cache">Étape ${n.num} : </span>${fr(n.titre)}</span></h1>
            <p class="chapeau">${fr(n.texte)}</p>
            ${n.invite ? `<p class="niveau-invite">${fr(n.invite)}</p>` : ""}
            ${n.parallele ? `<p class="niveau-parallele">${fr(n.parallele)}, <a href="#/niveau/murir">Mûrir en Jésus-Christ</a></p>` : ""}
            <p class="compte">${pluriel(ss.length, "série", "séries")}, ${pluriel(nbEtudes(ss), "étude", "études")}</p>
          </div>
          ${image(n.image, "niveau-image", true)}
        </header>
        ${id === "disciple" ? `<div class="niveau-groupe">${carteGroupe()}</div>` : ""}
        <h2 class="section-titre">Les séries</h2>
        <ul class="series-grille">
          ${ss
            .map(
              (s) => `<li><a class="serie-carte" href="#/serie/${s.id}">
                ${s.image ? image(s.image, "serie-image") : '<span class="serie-image sans-image"></span>'}
                <span class="serie-corps">
                  <span class="serie-titre">${fr(s.titre)}</span>
                  <span class="serie-texte">${fr(s.texte)}</span>
                  <span class="serie-compte">${compteSerie(s)}</span>
                  ${avanceSerie(s)}
                </span>
              </a></li>`
            )
            .join("")}
        </ul>
      </div>`;
    return true;
  }

  function serie(id) {
    const s = series[id];
    if (!s) return introuvable();
    const n = niveaux[s.niveau];
    document.title = `${s.titre} — Mission`;
    marquerNav(n.id);
    const titreRess = s.lecons.length ? "Pour bien commencer" : "Les documents";
    const ressources = s.ressources.length
      ? `<section class="ressources" aria-labelledby="ressources-titre">
          <h2 id="ressources-titre">${titreRess}</h2>
          <ul>${s.ressources.map((d, i) => `<li>${bouton(d, d.titre, !s.lecons.length && i === 0)}</li>`).join("")}</ul>
        </section>`
      : "";
    let liste = "";
    if (s.lecons.length) {
      const plusieurs = s.lecons.some((l) => l.docs.length > 1);
      let legende = "";
      if (plusieurs) {
        // boutons affichés : une étude découpée jour par jour montre « Leçons du jour » à la place de « Participant »
        const vus = new Set(s.lecons.flatMap((l) => (aDesJours(l) ? ["Leçons du jour"] : [])
          .concat(l.docs.filter((d) => !(aDesJours(l) && d.role === "participant")).map((d) => COURTS[d.libelle] || d.libelle))));
        const phrases = Object.keys(AIDE).filter((k) => vus.has(k)).map((k) => AIDE[k]);
        if (phrases.length) legende = `<p class="legende">${fr(phrases.join(" ; "))}.</p>`;
      }
      let groupe = null;
      let ouvert = false;
      s.lecons.forEach((l) => {
        if ((l.groupe || null) !== groupe) {
          if (ouvert) liste += "</ol>";
          groupe = l.groupe || null;
          if (groupe) liste += `<h3 class="groupe-titre">${fr(groupe)}</h3>`;
          liste += '<ol class="etudes">';
          ouvert = true;
        }
        liste += etude(l, s);
      });
      if (ouvert) liste += "</ol>";
      const seul = s.lecons.length === 1 && s.lecons[0].docs.length === 1 ? s.lecons[0].docs[0] : null;
      liste = seul
        ? `<p class="ouvrir-seul">${bouton(seul, "Ouvrir l’étude", true)}</p>`
        : `<section class="serie-etudes" aria-labelledby="etudes-titre">
            <h2 id="etudes-titre" class="section-titre">${toutesPresentations(s) ? "Les présentations" : "Les études"}</h2>
            ${legende}${liste}
          </section>`;
    }
    app.innerHTML = `
      <div class="page page-serie">
        ${fil([["Accueil", "#/"], [n.verbe, `#/niveau/${n.id}`], [s.titre]])}
        <div class="serie-mise">
          <div class="serie-cote">
            ${image(s.image, "serie-couverture", true)}
            <h1 class="titre-page" tabindex="-1">${fr(s.titre)}</h1>
            <p class="chapeau">${fr(s.texte)}</p>
            <p class="compte">${compteSerie(s)}</p>
            <div class="serie-progression">${progressionSerie(s)}</div>
            <div class="serie-outils">
              <button type="button" class="serie-outil" data-partager-serie>${icone.partager}<span>Partager la série</span></button>
              <a class="serie-outil" href="#/inviter/${s.id}">${icone.qr}<span>Inviter, code QR</span></a>
              <span class="serie-hors-ligne">${boutonHorsLigne(s)}</span>
              ${docsLivret(s).length > 1 ? `<button type="button" class="serie-outil" data-livret>${icone.livre}<span>Livret A5 à imprimer</span></button>` : ""}
            </div>
            ${ressources}
          </div>
          ${liste}
        </div>
      </div>`;
    app.querySelector(".page-serie").addEventListener("click", (ev) => {
      if (ev.target.closest("[data-partager-serie]")) { partagerLien(s.titre, `${s.titre} : ${s.texte}`, lienPartage(s.id)); return; }
      const lv = ev.target.closest("[data-livret]");
      if (lv) {
        if (lv.getAttribute("aria-busy")) return;
        imprimerLivret({ titre: s.titre, sousTitre: compteSerie(s), texte: s.texte, image: s.image, lien: `${SITE}#/serie/${s.id}`, docs: docsLivret(s) }, lv);
        return;
      }
      const hl = ev.target.closest("[data-hors-ligne]");
      if (hl) {
        if (hl.getAttribute("aria-busy")) return;
        const zoneHl = app.querySelector(".serie-hors-ligne");
        (hl.dataset.horsLigne === "retirer" ? retirerHorsLigne(s) : garderHorsLigne(s, hl)).then(() => {
          if (zoneHl.isConnected) zoneHl.innerHTML = boutonHorsLigne(s);
        });
        return;
      }
      const b = ev.target.closest("[data-faite]");
      if (!b) return;
      const l = s.lecons.find((x) => cleLecon(x) === b.dataset.faite);
      if (!l) return;
      const oui = b.getAttribute("aria-pressed") !== "true";
      faites.mettre(l, oui);
      b.setAttribute("aria-pressed", String(oui));
      b.closest(".etude").classList.toggle("faite", oui);
      app.querySelector(".serie-progression").innerHTML = progressionSerie(s);
      bulle(oui ? "Étude marquée comme terminée" : "Étude remise à faire");
    });
    return true;
  }

  // ---------- recherche dans le texte des études (donnees/recherche.json, outils/recherche/) ----------
  const VERSION_RECHERCHE = "1";
  // mots trop courants pour aider (les mêmes que l’index, sans accents)
  const VIDES = new Set(("les des une aux mais donc car que qui quoi dont cet cette ces son ses sur sous leur leurs mon mes "
    + "ton tes notre nos votre vos ils elles nous vous lui pas plus moins tres bien tout tous toute toutes est sont etait "
    + "etaient ete etre avoir ont avait avaient sera seront fait faire peut doit dans par pour avec sans entre vers chez "
    + "comme quand comment pourquoi alors aussi ainsi meme encore deja ici cela ceci celui celle ceux celles quel quelle "
    + "quels quelles autre autres elle non oui apres avant puis etc lorsque parce selon chaque peu fois faits dit dire").split(" "));
  // texte en minuscules sans accents ; carte[i] : place, dans le texte d’origine, du i-ème caractère
  function aplatir(t) {
    let n = "";
    const carte = [];
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      const d = c === "œ" || c === "Œ" ? "oe" : c === "æ" || c === "Æ" ? "ae" : c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      for (const x of d) { n += x; carte.push(i); }
    }
    return { n, carte };
  }
  // mots cherchés ; « sabbats », « prières » : on cherche le début du mot (sabbat…, prier…)
  function motsCherches(q) {
    return [...new Set(aplatir(q).n.split(/[^a-z0-9]+/))]
      .filter((m) => (/^\d+$/.test(m) ? m.length >= 3 : m.length >= 3 && !VIDES.has(m)))
      .map((m) => ({ m, debut: /^\d+$/.test(m) || m.length < 4 ? null : m.length >= 5 ? m.replace(/(es|s|x|e)$/, "") : m }));
  }
  // trouve ces mots dans un texte aplati : le mot est dans le groupe 2
  const motif = (mots) => new RegExp(`(^|[^a-z0-9])(${mots.map(({ m, debut }) => (debut ? `${debut}[a-z0-9]*` : `${m}(?![a-z0-9])`)).join("|")})`, "g");
  function* trouvailles(a, re) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(a.n))) {
      const debut = m.index + m[1].length;
      yield [a.carte[debut], a.carte[m.index + m[0].length - 1] + 1];
    }
  }
  // un texte, ses mots trouvés dans <mark>
  function marquer(t, re) {
    let h = "";
    let i = 0;
    for (const [d, f] of trouvailles(aplatir(t), re)) {
      h += esc(t.slice(i, d)) + `<mark>${esc(t.slice(d, f))}</mark>`;
      i = f;
    }
    return h + esc(t.slice(i));
  }
  let indexTexte = null;
  function chargerIndexTexte() {
    if (!indexTexte) {
      indexTexte = fetch(`donnees/recherche.json?v=${VERSION_RECHERCHE}`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((d) => ({ docs: d.docs, mots: d.mots, cles: Object.keys(d.mots) }));
      indexTexte.catch(() => { indexTexte = null; });
    }
    return indexTexte;
  }
  // documents qui contiennent tous les mots, les plus riches d’abord
  function chercherTexte(ix, mots) {
    const parMot = mots.map(({ m, debut }) => {
      const compte = new Map();
      const cles = debut ? ix.cles.filter((k) => k.startsWith(debut)) : ix.mots[m] ? [m] : [];
      cles.forEach((k) => {
        const p = ix.mots[k];
        for (let i = 0; i < p.length; i += 2) compte.set(p[i], (compte.get(p[i]) || 0) + p[i + 1]);
      });
      return compte;
    });
    const [premier, ...autres] = parMot;
    const res = [];
    premier.forEach((n, doc) => {
      if (autres.every((c) => c.has(doc))) res.push({ f: ix.docs[doc], n: autres.reduce((t, c) => t + c.get(doc), n) });
    });
    return res.sort((x, y) => y.n - x.n);
  }
  // texte d’un document de lecture, pour l’extrait montré sous le résultat
  const textesDocs = new Map();
  function texteDoc(f) {
    if (!textesDocs.has(f)) {
      const p = fetch(`lecture/${f.split("/").map(encodeURIComponent).join("/")}.html?v=${VERSION_LECTURE}`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
        .then((h) => {
          const doc = new DOMParser().parseFromString(`<div>${h}</div>`, "text/html");
          doc.querySelectorAll(".lec-credits, .lec-cache, textarea, script, style").forEach((x) => x.remove());
          doc.querySelectorAll("p, li, h2, h3, h4, td, th, dt, dd, figcaption, blockquote, div, .lec-q-num").forEach((x) => x.append(" "));
          const brut = doc.body.textContent.replace(/\s+/g, " ").trim();
          return { brut, a: aplatir(brut) };
        });
      p.catch(() => textesDocs.delete(f));
      textesDocs.set(f, p);
    }
    return textesDocs.get(f);
  }
  function extrait({ brut, a }, re) {
    const t = trouvailles(a, re).next().value;
    if (!t) return "";
    let g = Math.max(0, t[0] - 80);
    let d = Math.min(brut.length, t[1] + 120);
    if (g > 0) g = brut.indexOf(" ", g) + 1;
    if (d < brut.length) { const k = brut.lastIndexOf(" ", d); if (k > t[1]) d = k; }
    return `${g > 0 ? "… " : ""}${marquer(brut.slice(g, d), re)}${d < brut.length ? " …" : ""}`;
  }

  // ---------- recherche ----------
  let index = null;
  function construireIndex() {
    index = [];
    B.series.forEach((s) => {
      index.push({ type: "serie", s, cle: norm(s.titre + " " + s.texte) });
      s.lecons.forEach((l) => {
        index.push({ type: "etude", s, l, cle: norm(l.titre + " " + (l.sujet || "") + " " + s.titre) });
        // leçons du jour : retrouvées par leur titre seul (le nom de la série ramènerait toutes les leçons)
        (l.jours || []).forEach((j) => j.titre && index.push({ type: "jour", s, l, j, cle: norm(j.titre) }));
      });
    });
  }

  let titresTrouves = new Set(); // études déjà trouvées par leur titre
  let observateur = null;
  function chercher(q) {
    document.title = "Chercher une étude — Mission";
    app.innerHTML = `
      <div class="page page-recherche">
        ${fil([["Accueil", "#/"], ["Chercher une étude"]])}
        <h1 class="titre-page" tabindex="-1">Chercher une étude</h1>
        <form class="recherche-page" role="search">
          <div class="champ">${loupe}<input id="q" type="search" autocomplete="off" aria-label="Chercher une étude ou un verset"
            placeholder="sabbat, prière, Jean 3:16…" enterkeyhint="search" value="${esc(q)}"></div>
        </form>
        <div id="resultats"></div>
      </div>`;
    const champ = app.querySelector("#q");
    const zone = app.querySelector("#resultats");
    let minuterie = 0;
    const afficher = (texte) => {
      zone.innerHTML = resultats(texte);
      // une référence (« Jean 3:16 ») : le passage s’affiche en tête
      const carte = zone.querySelector(".bible-carte");
      if (carte) {
        brancherBiblePlus(carte, null);
        Bible.montrerPassage(carte, Bible.lireReference(texte));
      }
      clearTimeout(minuterie);
      minuterie = setTimeout(() => rechercheTexte(texte, zone), 220);
    };
    champ.addEventListener("input", () => {
      const texte = champ.value.trim();
      history.replaceState(null, "", "#/chercher/" + encodeURIComponent(texte));
      afficher(texte);
    });
    app.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); champ.blur(); });
    // ouvrir un document trouvé dans le texte : ses passages y seront surlignés
    zone.addEventListener("click", (ev) => {
      const a = ev.target.closest("a[data-surligner]");
      if (a) { try { sessionStorage.setItem("mission.surligner", JSON.stringify({ f: a.dataset.surligner, q: champ.value.trim() })); } catch (e) { /* navigation privée */ } }
      const plus = ev.target.closest("[data-plus]");
      if (plus) afficherTexte(zone, Number(plus.dataset.plus));
    });
    afficher(q);
    return champ;
  }

  function resultats(q) {
    titresTrouves = new Set();
    if (!q) return `<p class="recherche-aide">Tapez un mot : <em>baptême</em>, <em>prière</em>, <em>Nicodème</em>, <em>sanctuaire</em>… ou une référence : <em>Jean 3:16</em>.</p>`;
    if (!index) construireIndex();
    // les petits mots (« le », « dans ») trouveraient tout
    const mots = norm(q).split(/\s+/).filter((m) => /\d/.test(m) || (m.length > 2 && !VIDES.has(m)));
    const trouves = mots.length ? index.filter((e) => mots.every((m) => e.cle.includes(m))) : [];
    trouves.forEach((e) => e.type === "etude" && titresTrouves.add(e.l));
    const lignes = trouves.slice(0, 60).map((e) => {
      const n = niveaux[e.s.niveau];
      if (e.type === "serie") {
        return `<li class="resultat"><a class="resultat-titre" href="#/serie/${e.s.id}">${fr(e.s.titre)}</a>
          <span class="resultat-ou">Série de ${compteSerie(e.s)}, étape ${esc(n.verbe)}</span></li>`;
      }
      if (e.type === "jour") {
        const t = titreJour(e.j);
        return `<li class="resultat"><p class="resultat-titre">${fr(t)}</p>
          <span class="resultat-ou">Semaine ${esc(e.l.num)}, ${fr(e.l.titre)}, de <a href="#/serie/${e.s.id}">${fr(e.s.titre)}</a>, étape ${esc(n.verbe)}</span>
          <div class="etude-docs">${bouton(e.j.docs[0], "Ouvrir", true, `Ouvrir : ${t}`)}</div></li>`;
      }
      const l = e.l;
      const nomComplet = (l.num ? `Étude ${l.num} : ` : "") + l.titre;
      const boutons = l.docs.length === 1
        ? bouton(l.docs[0], estPresentation(l.docs[0]) ? "Voir" : "Ouvrir", true, `${estPresentation(l.docs[0]) ? "Voir" : "Ouvrir"} : ${nomComplet}`)
        : l.docs.map((d, i) => bouton(d, COURTS[d.libelle] || d.libelle, i === 0 && d.role !== "animateur", `${d.libelle} : ${nomComplet}`)).join("");
      return `<li class="resultat"><p class="resultat-titre">${fr(l.titre)}${l.sujet ? `<span class="cache"> — sujet : </span><span class="etude-sujet">${fr(l.sujet)}</span>` : ""}</p>
        <span class="resultat-ou">${l.num ? `Étude ${esc(l.num)} de ` : ""}<a href="#/serie/${e.s.id}">${fr(e.s.titre)}</a>, étape ${esc(n.verbe)}</span>
        <div class="etude-docs">${boutons}</div></li>`;
    });
    const plus = trouves.length > 60 ? `<p class="recherche-aide">Les 60 premiers résultats sur ${trouves.length}. Ajoutez un mot pour préciser.</p>` : "";
    const titres = trouves.length
      ? `<h2 class="resultats-titre">Dans les titres <span class="compte">${pluriel(trouves.length, "résultat", "résultats")}</span></h2><ul class="resultats">${lignes.join("")}</ul>${plus}`
      : "";
    const verset = window.Bible && Bible.lireReference(q)
      ? `<section class="bible-carte" aria-labelledby="titre-verset">
          <div class="bible-carte-tete"><h2 id="titre-verset" class="bible-titre"></h2><p class="bible-version">Louis Segond 1910</p></div>
          <div class="bible-outils"><button type="button" class="bible-tout" aria-pressed="false" hidden>Voir tout le chapitre</button><a class="bible-strong" href="https://www.lueur.org/bible/" target="_blank" rel="noopener" aria-label="Bible Strong : ce passage avec les mots hébreux et grecs, sur Lueur.org" hidden><span>Bible Strong</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg></a></div>
          <div class="bible-corps"><div class="bible-texte" aria-live="polite"></div><div class="bible-plus" hidden></div></div>
        </section>`
      : "";
    return `${verset}${titres}<section class="recherche-texte" data-titres="${trouves.length}" aria-live="polite"></section>`;
  }

  // documents dont le texte contient les mots cherchés, avec un extrait chargé quand il devient visible
  let derniereRecherche = null;
  function rechercheTexte(q, zone) {
    const section = zone.querySelector(".recherche-texte");
    if (!section) return;
    const mots = motsCherches(q);
    const aucun = `<p class="vide">Aucune étude ne contient « ${esc(q)} ». Essayez un autre mot, ou parcourez les trois étapes depuis l’accueil.</p>`;
    const sansTitre = section.dataset.titres === "0";
    if (!q || zone.querySelector(".bible-carte")) return; // une référence : le passage suffit
    if (!mots.length) {
      if (sansTitre) section.innerHTML = '<p class="recherche-aide">Tapez un mot plus précis : <em>baptême</em>, <em>prière</em>, <em>sabbat</em>…</p>';
      return;
    }
    section.innerHTML = '<p class="recherche-aide">Recherche dans le texte des études…</p>';
    chargerIndexTexte().then((ix) => {
      if (!section.isConnected) return;
      const res = chercherTexte(ix, mots).filter((r) => {
        const e = documents.get(r.f);
        return e && !(e.l && !e.j && titresTrouves.has(e.l));
      });
      derniereRecherche = { res, re: motif(mots), vus: 0 };
      if (!res.length) { section.innerHTML = sansTitre ? aucun : ""; return; }
      section.innerHTML = `<h2 class="resultats-titre">Dans le texte des études <span class="compte">${pluriel(res.length, "document", "documents")}</span></h2>
        <ul class="resultats resultats-texte"></ul>`;
      afficherTexte(zone, 0);
    }).catch(() => {
      if (section.isConnected) section.innerHTML = '<p class="recherche-aide">La recherche dans le texte des études a besoin d’une connexion la première fois.</p>';
    });
  }

  function afficherTexte(zone, depuis) {
    const r = derniereRecherche;
    const liste = zone.querySelector(".resultats-texte");
    if (!r || !liste) return;
    const PAR = 30;
    const tranche = r.res.slice(depuis, depuis + PAR);
    const bout = zone.querySelector("[data-plus]");
    if (bout) bout.remove();
    liste.insertAdjacentHTML("beforeend", tranche.map(({ f, n }) => {
      const e = documents.get(f);
      const { d, s, l, j } = e;
      const ou = j ? `Semaine ${esc(l.num)}, ${fr(l.titre)}, de ` : l && l.num ? `Étude ${esc(l.num)} de ` : "";
      const genre = !j && l && l.docs.length > 1 ? ` · ${fr(d.libelle)}` : "";
      return `<li class="resultat" data-f="${esc(f)}">
        <a class="resultat-titre" href="#/lire/${esc(f)}" data-surligner="${esc(f)}">${fr(titreDoc(e))}</a>
        <span class="resultat-ou">${ou}<a href="#/serie/${s.id}">${fr(s.titre)}</a>${genre} · ${pluriel(n, "passage", "passages")}</span>
        <p class="resultat-extrait"></p></li>`;
    }).join(""));
    if (depuis + PAR < r.res.length) {
      liste.insertAdjacentHTML("afterend", `<button type="button" class="plus-resultats" data-plus="${depuis + PAR}">Voir ${Math.min(PAR, r.res.length - depuis - PAR)} documents de plus</button>`);
    }
    if (observateur) observateur.disconnect();
    observateur = new IntersectionObserver((entrees) => entrees.forEach((en) => {
      if (!en.isIntersecting) return;
      observateur.unobserve(en.target);
      const li = en.target;
      const re = r.re;
      texteDoc(li.dataset.f).then((t) => {
        const x = li.querySelector(".resultat-extrait");
        if (x && derniereRecherche === r) x.innerHTML = extrait(t, re);
      }).catch(() => {});
    }), { rootMargin: "250px" });
    liste.querySelectorAll("li[data-f]").forEach((li) => { if (!li.querySelector(".resultat-extrait").innerHTML) observateur.observe(li); });
  }

  function introuvable() {
    document.title = "Page introuvable — Mission";
    app.innerHTML = `<div class="page">
      ${fil([["Accueil", "#/"], ["Page introuvable"]])}
      <h1 class="titre-page" tabindex="-1">Cette page n’existe pas</h1>
      <p class="chapeau">Le lien est peut-être ancien. Toutes les études sont rangées dans les trois étapes de l’accueil.</p>
      <p><a class="doc principal" href="#/">Revenir à l’accueil</a></p></div>`;
    return true;
  }

  // ---------- lecteur de documents ----------
  let pdfjs = null; // promesse : { lib, vue }
  function chargerPdfjs() {
    if (!pdfjs) {
      const url = (f) => new URL(`lecteur/${f}?v=${VERSION_PDFJS}`, document.baseURI).href;
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = url("pdf_viewer.min.css");
      document.head.append(css);
      pdfjs = (async () => {
        const lib = await import(url("pdf.min.js"));
        lib.GlobalWorkerOptions.workerSrc = url("pdf.worker.min.js");
        await import(url("pdf_viewer.min.js"));
        return { lib, vue: globalThis.pdfjsViewer };
      })();
      pdfjs.catch(() => { pdfjs = null; css.remove(); });
    }
    return pdfjs;
  }

  let lecture = null; // document ouvert : { ac, tache, viewer }
  function fermerLecteur() {
    viderImpression();
    if (!lecture) return;
    lecture.ac.abort();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    try { lecture.viewer && lecture.viewer.setDocument(null); } catch (e) { /* déjà fermé */ }
    if (lecture.tache) lecture.tache.destroy();
    lecture = null;
  }

  function lire(f) {
    const e = documents.get(f);
    if (!e) return introuvable();
    const { d, s } = e;
    const titre = titreDoc(e);
    const detail = detailDoc(e);
    const pdf = fichierPdf(d);
    document.title = `${titre}${!e.j && e.l && e.l.docs.length > 1 ? ` — ${d.libelle}` : ""} — Mission`;
    const telecharger = d.original
      ? `<details class="menu-telecharger">
          <summary class="lecteur-bouton" aria-label="Télécharger">${icone.telecharger}<span>Télécharger</span></summary>
          <div class="menu">
            <a href="${pdf}" download="${esc(nomFichier(e))}">PDF<span>${taille(d.o)}</span></a>
            <a href="${esc(d.original.url)}" ${d.format === "Excel" ? "download" : ""}>${
              d.format === "Excel" ? "Tableau Excel d’origine" : "PowerPoint d’origine, avec les animations"}<span>${taille(d.original.o)}</span></a>
          </div>
        </details>`
      : `<a class="lecteur-bouton" href="${pdf}" download="${esc(nomFichier(e))}" aria-label="Télécharger le PDF, ${taille(d.o)}">${icone.telecharger}<span>Télécharger</span></a>`;
    app.innerHTML = `
      <div class="lecteur">
        <div class="lecteur-barre">
          ${lienRetour(s, f)}
          <div class="lecteur-titres">
            <h1 class="lecteur-titre" tabindex="-1">${fr(titre)}</h1>
            ${detail ? `<p class="lecteur-detail">${fr(detail)}</p>` : ""}
          </div>
          <div class="lecteur-actions">
            ${aTexte(f) ? `<a class="lecteur-bouton" href="#/lire/${esc(f)}" aria-label="Mode lecture : le texte adapté à l’écran">${icone.lecture}<span>Mode lecture</span></a>` : ""}
            ${estPresentation(d) ? `<button type="button" class="lecteur-bouton lecteur-projeter" aria-label="Projeter en plein écran, une diapositive à la fois" hidden>${icone.projeter}<span>Projeter</span></button>` : ""}
            <button type="button" class="lecteur-bouton" data-ouvrir="imprimer" aria-label="Imprimer">${icone.imprimer}<span>Imprimer</span></button>
            ${telecharger}
          </div>
        </div>
        <div class="lecteur-zone">
          <div class="lecteur-chargement" hidden><span></span></div>
          <div class="lecteur-defile" tabindex="0" aria-label="${esc(titre)}">
            <div class="pdfViewer"></div>
          </div>
          <p class="lecteur-etat" role="status">Ouverture du document…</p>
          <div class="lecteur-outils" hidden>
            <button type="button" class="outil" data-action="moins" aria-label="Réduire">${icone.moins}</button>
            <span class="lecteur-page" aria-hidden="true"><span class="lecteur-num">1</span> / <span class="lecteur-total">${d.p || ""}</span></span>
            <button type="button" class="outil" data-action="plus" aria-label="Agrandir">${icone.plus}</button>
            <button type="button" class="outil" data-action="ajuster" aria-label="Ajuster à la largeur">${icone.ajuster}</button>
          </div>
        </div>
        <div class="voile-lecture" hidden></div>
        ${panneauImpression(e, false)}
      </div>`;
    const session = (lecture = { ac: new AbortController(), tache: null, viewer: null });
    brancherPanneaux(app.querySelector(".lecteur"), session.ac.signal);
    brancherImpression(app.querySelector(".lecteur"), e, session.ac.signal);
    const menu = app.querySelector(".menu-telecharger");
    if (menu) {
      const { signal } = session.ac;
      document.addEventListener("click", (ev) => { if (!menu.contains(ev.target)) menu.open = false; }, { signal });
      menu.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") { menu.open = false; menu.querySelector("summary").focus(); }
      }, { signal });
    }
    ouvrir(e, session);
    return true;
  }

  async function ouvrir(e, session) {
    const { d } = e;
    const zone = app.querySelector(".lecteur-zone");
    const defile = zone.querySelector(".lecteur-defile");
    const etat = zone.querySelector(".lecteur-etat");
    const barre = zone.querySelector(".lecteur-chargement");
    const outils = zone.querySelector(".lecteur-outils");
    const numero = zone.querySelector(".lecteur-num");
    const total = zone.querySelector(".lecteur-total");
    const projeter = app.querySelector(".lecteur-projeter");
    const { signal } = session.ac;
    const pdf = new URL(fichierPdf(d), document.baseURI).href;
    let minuterie = 0; // la barre de chargement n’apparaît que si l’ouverture dure

    const echec = () => {
      clearTimeout(minuterie);
      barre.hidden = true;
      etat.className = "lecteur-etat lecteur-echec";
      etat.innerHTML = `<strong>Le document ne s’affiche pas ici.</strong>
        Ouvrez-le avec le lecteur PDF de l’appareil, ou téléchargez-le.
        <span class="lecteur-echec-actions"><a class="doc principal" href="${fichierPdf(d)}" target="_blank" rel="noopener">Ouvrir le PDF</a>
        <a class="doc" href="${fichierPdf(d)}" download="${esc(nomFichier(e))}">Télécharger</a></span>`;
    };

    let outilsPdf;
    try {
      outilsPdf = await chargerPdfjs();
    } catch (err) {
      if (!signal.aborted) echec();
      return;
    }
    if (signal.aborted) return;
    const { lib, vue } = outilsPdf;
    const mobile = /Android|iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const eventBus = new vue.EventBus();
    const liens = new vue.PDFLinkService({ eventBus, externalLinkTarget: vue.LinkTarget.BLANK, externalLinkRel: "noopener noreferrer" });
    let viewer;
    try {
      viewer = new vue.PDFViewer({
        container: defile,
        eventBus,
        linkService: liens,
        l10n: new vue.GenericL10n("fr"),
        removePageBorders: true,
        maxCanvasPixels: mobile ? 5242880 : 2 ** 25,
        annotationMode: lib.AnnotationMode.ENABLE,
      });
    } catch (err) {
      echec();
      return;
    }
    liens.setViewer(viewer);
    session.viewer = viewer;

    // taille d’affichage : toute la largeur sur téléphone, une page lisible sur grand écran
    let auto = true;
    const ajuster = () => {
      if (!viewer.pdfDocument || !viewer.pagesCount) return;
      if (zone.classList.contains("projection")) { viewer.currentScaleValue = "page-fit"; return; }
      const vuePage = viewer.getPageView(Math.max(0, viewer.currentPageNumber - 1));
      if (!vuePage || !vuePage.viewport) return;
      const largeur = vuePage.viewport.width / vuePage.scale;
      const paysage = vuePage.viewport.width > vuePage.viewport.height;
      const marge = defile.clientWidth < 600 ? 16 : 64;
      const voulu = Math.min(defile.clientWidth - marge, paysage ? 1180 : 900);
      viewer.currentScale = Math.max(0.2, voulu / largeur);
    };
    let reliquat = 1;
    const zoomer = (facteur, origine, deplacement) => {
      auto = false;
      const avant = viewer.currentScale;
      const visee = Math.min(25, Math.max(0.2, avant * facteur * reliquat));
      const arrondi = Math.round(visee * 100) / 100;
      reliquat = visee / arrondi;
      viewer.updateScale({ drawingDelay: 400, scaleFactor: arrondi / avant, origin: origine, pan: deplacement || null });
    };

    eventBus.on("pagesinit", () => {
      clearTimeout(minuterie);
      ajuster();
      etat.hidden = true;
      barre.hidden = true;
      outils.hidden = false;
      total.textContent = viewer.pagesCount;
      if (viewer.pagesCount < 2) outils.classList.add("une-page");
      if (projeter && document.fullscreenEnabled) projeter.hidden = false;
    });
    eventBus.on("pagechanging", ({ pageNumber }) => { numero.textContent = pageNumber; });

    outils.addEventListener("click", (ev) => {
      const b = ev.target.closest("button");
      if (!b) return;
      if (b.dataset.action === "plus") { auto = false; viewer.increaseScale({ drawingDelay: 200 }); }
      else if (b.dataset.action === "moins") { auto = false; viewer.decreaseScale({ drawingDelay: 200 }); }
      else { auto = true; ajuster(); }
    }, { signal });

    // pincer pour zoomer (téléphone), Ctrl + molette ou pincement du pavé tactile (ordinateur)
    new lib.TouchManager({
      container: defile,
      isPinchingDisabled: () => zone.classList.contains("projection"),
      isPinchingStopped: () => false,
      onPinching: (origine, avant, apres, dx, dy) => zoomer(apres / avant, origine, [dx, dy]),
      onPinchEnd: () => { reliquat = 1; },
      onPanning: (dx, dy) => viewer.panBy(dx, dy),
      signal,
    });
    defile.addEventListener("wheel", (ev) => {
      if (!ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      zoomer(Math.exp(-ev.deltaY / (ev.deltaMode ? 3 : 100)), [ev.clientX, ev.clientY]);
    }, { passive: false, signal });

    const surveillance = new ResizeObserver(() => { if (auto || zone.classList.contains("projection")) ajuster(); });
    surveillance.observe(defile);
    signal.addEventListener("abort", () => surveillance.disconnect());

    // projeter : plein écran, une diapositive à la fois
    if (projeter) {
      projeter.addEventListener("click", () => {
        zone.requestFullscreen().then(() => zone.focus()).catch(() => {});
      }, { signal });
      zone.tabIndex = -1;
      document.addEventListener("fullscreenchange", () => {
        const actif = document.fullscreenElement === zone;
        zone.classList.toggle("projection", actif);
        viewer.scrollMode = actif ? vue.ScrollMode.PAGE : vue.ScrollMode.VERTICAL;
        if (!actif) auto = true;
        requestAnimationFrame(() => requestAnimationFrame(ajuster));
      }, { signal });
      zone.addEventListener("keydown", (ev) => {
        if (!zone.classList.contains("projection")) return;
        if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(ev.key)) { ev.preventDefault(); viewer.nextPage(); }
        else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(ev.key)) { ev.preventDefault(); viewer.previousPage(); }
      }, { signal });
      zone.addEventListener("click", (ev) => {
        if (zone.classList.contains("projection") && !ev.target.closest("a, button")) viewer.nextPage();
      }, { signal });
      let repos = 0;
      zone.addEventListener("pointermove", () => {
        if (!zone.classList.contains("projection")) return;
        zone.classList.add("souris");
        clearTimeout(repos);
        repos = setTimeout(() => zone.classList.remove("souris"), 2500);
      }, { signal });
    }

    minuterie = setTimeout(() => { barre.hidden = false; }, 400);
    signal.addEventListener("abort", () => clearTimeout(minuterie));
    const base = new URL("lecteur/", document.baseURI).href;
    const tache = (session.tache = lib.getDocument({
      url: pdf,
      cMapUrl: base + "cmaps/",
      cMapPacked: true,
      standardFontDataUrl: base + "standard_fonts/",
      wasmUrl: base + "wasm/",
      iccUrl: base + "iccs/",
      useSystemFonts: !/Android/.test(navigator.userAgent),
      enableXfa: false,
    }));
    tache.onProgress = ({ loaded, total: tout }) => {
      if (tout) barre.firstElementChild.style.width = `${Math.min(100, (100 * loaded) / tout)}%`;
    };
    try {
      const doc = await tache.promise;
      if (signal.aborted) return;
      viewer.setDocument(doc);
      liens.setDocument(doc, null);
    } catch (err) {
      if (!signal.aborted) echec();
    }
  }


  // ---------- mode lecture : le texte de l’étude adapté à l’écran ----------
  // lecture/<d.f>.html est produit par outils/lecture/convertir.py ; donnees/lecture.js liste ces documents.
  const TEXTES = window.LECTURE || {};
  const VERSION_LECTURE = "2";
  const aTexte = (f) => Object.prototype.hasOwnProperty.call(TEXTES, f);
  const memoire = {
    lire(cle, defaut) { try { const v = localStorage.getItem(cle); return v === null ? defaut : v; } catch (e) { return defaut; } },
    ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch (e) { /* stockage plein ou interdit : on continue sans */ } },
  };
  const TAILLES = [15, 16, 17, 18, 20, 22, 25, 28];
  const reglages = {
    taille: Number(memoire.lire("mission.lecture.taille", "18")),
    fond: memoire.lire("mission.lecture.fond", "clair"),
    mode: memoire.lire("mission.lecture.mode", "defiler"),
    police: memoire.lire("mission.lecture.police", "lisible"),
  };
  if (!TAILLES.includes(reglages.taille)) reglages.taille = 18;
  const mouvementReduit = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // voix : synthèse vocale du navigateur, voix française (mode lecture, shorts, versets)
  const synthese = "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function" ? window.speechSynthesis : null;
  const voixFr = () => {
    const v = synthese.getVoices().filter((x) => /^fr([-_]|$)/i.test(x.lang));
    return v.find((x) => /fr[-_]FR/i.test(x.lang) && x.localService) || v.find((x) => /fr[-_]FR/i.test(x.lang)) || v[0] || null;
  };
  // « Jean 3:16-18 » se dit « Jean chapitre 3, versets 16 à 18 »
  const pourOreille = (t) => t
    .replace(/(\d+):(\d+) – (\d+):(\d+)/g, "chapitre $1, verset $2, au chapitre $3, verset $4")
    .replace(/(\d+):(\d+)-(\d+)/g, "chapitre $1, versets $2 à $3")
    .replace(/(\d+):(\d+)/g, "chapitre $1, verset $2");
  // des morceaux courts : certaines voix s’arrêtent sur une phrase trop longue
  const decouper = (t) => {
    const sortie = [];
    (t.match(/(?:[^.!?;:]|[.:](?=\d))+(?:[.!?;:]+(?:\s*[»”)])*|$)/g) || [t]).forEach((phrase) => {
      let x = phrase.trim();
      while (x.length > 200) {
        const k = Math.max(x.lastIndexOf(", ", 200), x.lastIndexOf(" ", 200));
        sortie.push(x.slice(0, k > 60 ? k + 1 : 200).trim());
        x = x.slice(k > 60 ? k + 1 : 200).trim();
      }
      if (x) sortie.push(x);
    });
    return sortie;
  };
  // Safari (iPhone, iPad, Mac) perd souvent un énoncé lancé juste après cancel() : rien n’est dit, et sa fin n’arrive
  // jamais (bogues WebKit 191745 et 238189). On n’arrête donc la voix que si elle parle, et on attend un peu avant de
  // reparler. Le premier énoncé, lui, part tout de suite, dans le toucher : l’iPhone l’exige.
  const voixOccupee = () => !!(synthese && (synthese.speaking || synthese.pending));
  function apresAnnulation(fn) {
    if (voixOccupee()) {
      synthese.cancel();
      setTimeout(fn, 300);
    } else {
      if (synthese && synthese.paused) synthese.resume();
      fn();
    }
  }
  // sur iPhone, le bouton du mode silencieux coupe aussi la voix : on le dit une fois
  const appareilApple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function conseilSilencieux() {
    if (!appareilApple || memoire.lire("mission.voix.conseil", "") === "1") return;
    memoire.ecrire("mission.voix.conseil", "1");
    setTimeout(() => bulle("Pas de son ? Le mode silencieux de l’iPhone coupe aussi la voix."), 1200);
  }
  // dire un texte court (short, verset) ; fin(true) quand tout est dit, fin(false) s’il est interrompu
  let parole = null;
  function arreterParole() {
    if (!parole) return;
    const p = parole;
    parole = null;
    clearTimeout(p.garde);
    if (voixOccupee()) synthese.cancel();
    if (p.fin) p.fin(false);
  }
  function parler(texte, fin) {
    arreterParole();
    if (!synthese) return false;
    const morceaux = decouper(texte);
    const p = (parole = { fin });
    let i = 0;
    const echec = () => {
      if (parole !== p) return;
      parole = null;
      if (voixOccupee()) synthese.cancel();
      if (fin) fin(false);
    };
    const suite = () => {
      if (parole !== p) return;
      clearTimeout(p.garde);
      if (i >= morceaux.length) { parole = null; if (fin) fin(true); return; }
      const u = new SpeechSynthesisUtterance(morceaux[i]);
      i += 1;
      u.lang = "fr-FR";
      const v = voixFr();
      if (v) u.voice = v;
      u.rate = Number(memoire.lire("mission.lecture.vitesse", "1")) || 1;
      u.onstart = () => { clearTimeout(p.garde); };
      u.onend = suite;
      u.onerror = (ev) => { if (!/interrupted|canceled/.test(ev.error || "")) echec(); };
      p.u = u; // gardé : sans référence, certains navigateurs oublient l’énoncé et ne signalent jamais sa fin
      // garde-fou : une voix qui ne démarre pas en 5 secondes libère le bouton (sinon il resterait allumé)
      p.garde = setTimeout(() => { if (!synthese.speaking) echec(); }, 5000);
      synthese.speak(u);
    };
    apresAnnulation(suite);
    conseilSilencieux();
    return true;
  }
  if (synthese) synthese.getVoices(); // certaines voix se chargent au premier appel

  // document suivant de la série, du même genre (participant, animateur…) ;
  // après une leçon du jour : le jour suivant, puis l’introduction de la semaine suivante
  function suivant(e) {
    const { d, s, l, j } = e;
    if (!l) return null;
    if (j) {
      const apres = [];
      s.lecons.slice(s.lecons.indexOf(l)).forEach((n) => (n.jours || []).forEach((x) => apres.push({ l: n, j: x })));
      const k = apres.findIndex((x) => x.j === j);
      const n = apres.slice(k + 1).find((x) => x.j.docs[0].f);
      return n ? { d: n.j.docs[0], l: n.l, j: n.j } : null;
    }
    const i = s.lecons.indexOf(l);
    for (let k = i + 1; k < s.lecons.length; k++) {
      const n = s.lecons[k];
      const meme = n.docs.find((x) => x.f && x.libelle === d.libelle) || (n.docs.length === 1 && n.docs[0].f ? n.docs[0] : null);
      if (meme) return { d: meme, l: n };
    }
    return null;
  }

  function panneauAffichage() {
    return `<div class="panneau-lecture" id="panneau-affichage" role="dialog" aria-modal="true" aria-labelledby="titre-affichage" hidden>
      <div class="panneau-tete"><h2 id="titre-affichage">Affichage</h2><button type="button" class="panneau-fermer" data-fermer>Fermer</button></div>
      <div class="reglage"><span class="reglage-titre">Taille du texte</span>
        <div class="taille"><button type="button" data-taille="-1" aria-label="Texte plus petit">A−</button><output aria-live="polite"></output><button type="button" data-taille="1" aria-label="Texte plus grand">A+</button></div></div>
      <div class="reglage"><span class="reglage-titre">Fond</span>
        <div class="choix"><button type="button" class="ech-clair" data-choix="fond:clair">Clair</button><button type="button" class="ech-sepia" data-choix="fond:sepia">Sépia</button><button type="button" class="ech-nuit" data-choix="fond:nuit">Nuit</button></div></div>
      <div class="reglage"><span class="reglage-titre">Lecture</span>
        <div class="choix"><button type="button" data-choix="mode:defiler">Défiler<span class="aide">comme l’appli</span></button><button type="button" data-choix="mode:feuilleter">Feuilleter<span class="aide">comme un livre</span></button></div></div>
      <div class="reglage"><span class="reglage-titre">Caractères</span>
        <div class="choix"><button type="button" data-choix="police:lisible">Très lisibles</button><button type="button" data-choix="police:livre" style="font-family: var(--serif)">De livre</button></div></div>
      <button type="button" class="lecture-action panneau-projeter" data-projeter><span>Projeter sur un écran<small>En grand, une idée ou une question à la fois : pour le groupe, sur une télé ou un vidéoprojecteur</small></span>${icone.projeter}</button>
    </div>`;
  }

  function panneauImpression(e, avecLecture) {
    const { d } = e;
    return `<div class="panneau-lecture" id="panneau-imprimer" role="dialog" aria-modal="true" aria-labelledby="titre-imprimer" hidden>
      <div class="panneau-tete"><h2 id="titre-imprimer">Imprimer</h2><button type="button" class="panneau-fermer" data-fermer>Fermer</button></div>
      <div class="impression-choix">
        <button type="button" class="lecture-action" data-imprimer="original"><span>Le document d’origine<small>La mise en page du PDF, avec ses images et ses lignes pour écrire</small></span>${icone.imprimer}</button>
        ${avecLecture ? `<button type="button" class="lecture-action" data-imprimer="lecture"><span>Ce que je lis, avec mes réponses<small>Le texte de cette page et ce que vous avez écrit</small></span>${icone.imprimer}</button>
          <button type="button" class="lecture-action" data-imprimer="livret"><span>Livret A5, avec des lignes pour écrire<small>Pour le plier : choisissez « Livret » dans la fenêtre d’impression</small></span>${icone.livre}</button>` : ""}
        <a class="lecture-action" href="${fichierPdf(d)}" download="${esc(nomFichier(e))}"><span>Télécharger le PDF<small>Pour l’imprimer plus tard (${taille(d.o)})</small></span>${icone.telecharger}</a>
      </div>
      <p class="impression-etat" role="status" hidden></p>
      <button type="button" class="lecture-action principale" data-imprimer="maintenant" hidden><span>Imprimer maintenant</span>${icone.imprimer}</button>
    </div>`;
  }

  // panneaux du bas : ouverts par [data-ouvrir], fermés par [data-fermer], le voile ou Échap
  function brancherPanneaux(racine, signal) {
    const voile = racine.querySelector(".voile-lecture");
    let retour = null;
    const fermer = () => {
      voile.hidden = true;
      racine.querySelectorAll(".panneau-lecture").forEach((x) => { x.hidden = true; });
      if (retour) retour.focus({ preventScroll: true });
    };
    racine.addEventListener("click", (ev) => {
      const o = ev.target.closest("[data-ouvrir]");
      if (o) {
        if (o.tagName === "A" && (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey)) return;
        const panneau = racine.querySelector(`#panneau-${o.dataset.ouvrir}`);
        if (!panneau) return;
        retour = o;
        voile.hidden = false;
        panneau.hidden = false;
        const premier = panneau.querySelector("button");
        if (premier) premier.focus();
        return;
      }
      if (ev.target.closest("[data-fermer]") || ev.target === voile) fermer();
    }, { signal });
    document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !voile.hidden) fermer(); }, { signal });
    return fermer;
  }

  // impression : l’original (pages du PDF rendues en images, partout où window.print existe) ou la version lecture
  let impression = null; // { f, pret: bool }
  function viderImpression() {
    const zone = document.getElementById("impression");
    if (zone) {
      zone.querySelectorAll("img").forEach((i) => URL.revokeObjectURL(i.src));
      zone.remove();
    }
    impression = null;
    corps.classList.remove("impression-pdf", "impression-lecture");
  }

  function brancherImpression(racine, e, signal) {
    const etat = racine.querySelector(".impression-etat");
    const maintenant = racine.querySelector('[data-imprimer="maintenant"]');
    const montrer = (t) => { etat.hidden = false; etat.textContent = t; };
    const imprimerPdf = () => {
      corps.classList.remove("impression-lecture");
      corps.classList.add("impression-pdf");
      window.print();
    };
    window.addEventListener("afterprint", () => corps.classList.remove("impression-pdf", "impression-lecture"), { signal });
    racine.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-imprimer]");
      if (!b) return;
      const quoi = b.dataset.imprimer;
      if (quoi === "maintenant") { imprimerPdf(); return; }
      if (quoi === "livret") {
        imprimerLivret({ titre: titreDoc(e), lien: `${SITE}#/lire/${e.d.f}`, docs: [e.d.f] }, b);
        return;
      }
      if (quoi === "lecture") {
        racine.querySelectorAll(".reponse-imprimee").forEach((x) => x.remove());
        racine.querySelectorAll(".lecture-texte textarea").forEach((t) => {
          const copie = document.createElement("div");
          copie.className = "reponse-imprimee";
          copie.textContent = t.value;
          t.after(copie);
        });
        corps.classList.remove("impression-pdf");
        corps.classList.add("impression-lecture");
        window.print();
        return;
      }
      // l’original
      if (impression && impression.f === e.d.f && impression.pret) { imprimerPdf(); return; }
      if (impression && impression.f === e.d.f) return; // déjà en préparation
      viderImpression();
      const tache = (impression = { f: e.d.f, pret: false });
      montrer("Préparation de l’impression…");
      try {
        const { lib } = await chargerPdfjs();
        const base = new URL("lecteur/", document.baseURI).href;
        const chargement = lib.getDocument({
          url: new URL(fichierPdf(e.d), document.baseURI).href,
          cMapUrl: base + "cmaps/", cMapPacked: true, standardFontDataUrl: base + "standard_fonts/",
          wasmUrl: base + "wasm/", iccUrl: base + "iccs/", enableXfa: false,
        });
        const pdf = await chargement.promise;
        const zone = document.createElement("div");
        zone.id = "impression";
        const echelle = pdf.numPages > 40 ? 1.25 : pdf.numPages > 12 ? 1.6 : 2;
        for (let n = 1; n <= pdf.numPages; n++) {
          if (signal.aborted || impression !== tache) { chargement.destroy(); return; }
          montrer(`Préparation de l’impression : page ${n} sur ${pdf.numPages}…`);
          const page = await pdf.getPage(n);
          const vue = page.getViewport({ scale: echelle });
          const toile = document.createElement("canvas");
          toile.width = Math.floor(vue.width);
          toile.height = Math.floor(vue.height);
          const ctx = toile.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, toile.width, toile.height);
          await page.render({ canvasContext: ctx, viewport: vue }).promise;
          const blob = await new Promise((ok) => toile.toBlob(ok, "image/jpeg", 0.9));
          const img = new Image();
          img.alt = "";
          img.src = URL.createObjectURL(blob);
          zone.append(img);
          page.cleanup();
        }
        chargement.destroy();
        if (signal.aborted || impression !== tache) { zone.querySelectorAll("img").forEach((i) => URL.revokeObjectURL(i.src)); return; }
        document.body.append(zone);
        await Promise.all([...zone.querySelectorAll("img")].map((i) => i.decode().catch(() => {})));
        tache.pret = true;
        montrer("Prêt. Si la fenêtre d’impression ne s’ouvre pas, touchez « Imprimer maintenant ».");
        maintenant.hidden = false;
        imprimerPdf();
      } catch (err) {
        console.error("impression", err);
        if (impression === tache) impression = null;
        montrer("L’impression n’a pas pu être préparée. Téléchargez le PDF, puis imprimez-le depuis l’appareil.");
      }
    }, { signal });
  }

  let texte = null; // document ouvert en mode lecture : { ac, page, pages, pas }
  function fermerTexte() {
    viderImpression();
    if (!texte) return;
    texte.ac.abort();
    texte = null;
  }

  function lireTexte(f) {
    const e = documents.get(f);
    if (!e) return introuvable();
    const { d, s, l, j } = e;
    const titre = titreDoc(e);
    const sous = j ? `Semaine ${l.num} : ${l.titre}` : l && l.docs.length > 1 ? d.libelle : "";
    document.title = `${titre}${sous ? ` — ${sous}` : ""} — Mission`;
    const info = TEXTES[f] || {};
    const apres = suivant(e);
    const num = !j && l && l.num ? `Étude ${l.num}` : "";
    // leçon suivante : « Semaine 2 — Introduction » quand elle ouvre une autre semaine
    const titreApres = !apres ? "" : !apres.j ? apres.l.titre
      : apres.l === l ? titreJour(apres.j) : `Semaine ${apres.l.num} — ${titreJour(apres.j)}`;
    const img = (l && l.image) || s.image;
    // « J’ai terminé » : à la fin d’une étude, ou de la dernière leçon du jour d’une semaine
    const peutCocher = !!(l && cleLecon(l) && (!j || l.jours[l.jours.length - 1] === j));
    const quoi = j ? "la semaine" : "cette étude";
    app.innerHTML = `
      <div class="lecture">
        <div class="lecteur-barre">
          ${lienRetour(s, f)}
          <div class="lecteur-titres">
            <h1 class="lecteur-titre" tabindex="-1">${fr(titre)}</h1>
            ${sous ? `<p class="lecteur-detail">${fr(sous)}</p>` : ""}
          </div>
          <div class="lecteur-actions">
            <button type="button" class="lecteur-bouton" data-ouvrir="sommaire" aria-label="Sommaire" hidden>${icone.sommaire}<span>Sommaire</span></button>
            <button type="button" class="lecteur-bouton" data-ecouter aria-label="Écouter l’étude à voix haute" hidden>${icone.ecouter}<span>Écouter</span></button>
            <button type="button" class="lecteur-bouton" data-ouvrir="affichage" aria-label="Affichage : taille du texte, fond, façon de lire">${icone.affichage}<span>Affichage</span></button>
            <button type="button" class="lecteur-bouton seulement-large" data-projeter aria-label="Projeter sur un écran">${icone.projeter}<span>Projeter</span></button>
            <button type="button" class="lecteur-bouton" data-ouvrir="imprimer" aria-label="Imprimer">${icone.imprimer}<span>Imprimer</span></button>
            <a class="lecteur-bouton" href="#/original/${esc(f)}" aria-label="Voir l’original en PDF">${icone.original}<span>Original</span></a>
          </div>
        </div>
        <div class="lecture-progression" aria-hidden="true"><span></span></div>
        <div class="lecture-zone">
          <div class="lecture-defile" tabindex="0" aria-label="${esc(titre)}">
            <div class="lecture-contenu">
              <header class="lecture-tete${img ? " avec-image" : ""}">
                ${img ? image(img, "", true) : ""}
                <div class="lecture-tete-texte">
                  <p class="lecture-serie">${fr(s.titre)}${num ? ` · ${esc(num)}` : ""}</p>
                  <p class="lecture-titre">${fr(titre)}</p>
                  ${sous ? `<p class="lecture-sous">${fr(sous)}</p>` : ""}
                </div>
              </header>
              ${info.q ? `<p class="lecture-meta">${pluriel(info.q, "question", "questions")}. Vos réponses restent sur cet appareil.</p>` : ""}
              <article class="lecture-texte"><p class="lecture-attente">Ouverture de l’étude…</p></article>
              <footer class="lecture-fin">
                <p class="lecture-fin-titre">Fin ${j ? "de la leçon" : l ? "de l’étude" : "du document"}</p>
                ${peutCocher ? `<button type="button" class="lecture-action lecture-faite" data-faite-lecture aria-pressed="${faites.a(l)}">
                    <span class="si-non">J’ai terminé ${quoi}</span><span class="si-oui">${j ? "Semaine terminée" : "Étude terminée"}</span>${icone.coche}</button>` : ""}
                ${apres
                  ? `<a class="lecture-action principale" href="#/lire/${esc(apres.d.f)}"${peutCocher && apres.l !== l ? " data-terminer" : ""}><span>Suivante : ${fr(titreApres)}</span>${chevronDroit}</a>`
                  : `<a class="lecture-action principale" href="#/serie/${s.id}"><span>Retour à la série</span>${chevronDroit}</a>`}
                <button type="button" class="lecture-action" data-partager-etude><span>Partager l’étude</span>${icone.partager}</button>
                <button type="button" class="lecture-action" data-ouvrir="imprimer"><span>Imprimer</span>${icone.imprimer}</button>
                <a class="lecture-action" href="#/original/${esc(f)}"><span>Voir l’original (PDF)</span>${icone.original}</a>
              </footer>
              <span class="lecture-sentinelle" aria-hidden="true"></span>
            </div>
          </div>
          <nav class="lecture-pages" aria-label="Pages" hidden>
            <button type="button" data-page="-1" aria-label="Page précédente">‹</button>
            <span class="lecture-page-num" aria-live="polite"></span>
            <button type="button" data-page="1" aria-label="Page suivante">›</button>
          </nav>
          <div class="lecture-bas">
            <div class="lecture-note reprise-note" role="status" hidden><span>Vous reprenez où vous vous étiez arrêté.</span><button type="button" data-debut>Revenir au début</button></div>
            <div class="lecture-note ecoute-barre" role="group" aria-label="Lecture à voix haute" hidden>
              <span class="ecoute-etat" aria-live="polite">Lecture à voix haute</span>
              <button type="button" data-ecoute="pause" aria-label="Pause">${icone.pause}</button>
              <button type="button" data-ecoute="vitesse" aria-label="Vitesse normale">1×</button>
              <button type="button" data-ecoute="stop" aria-label="Arrêter la lecture">${icone.arreter}</button>
            </div>
            <div class="lecture-note surl-barre" role="toolbar" aria-label="Surligner le passage choisi" hidden>
              <span class="surl-couleurs">${COULEURS_SURL.map(([c, nom]) =>
                `<button type="button" class="surl-pastille c-${c}" data-couleur="${c}" aria-label="Surligner en ${nom}" aria-pressed="false"></button>`).join("")}</span>
              <button type="button" class="surl-action" data-surl="note">${icone.note}<span>Note</span></button>
              <button type="button" class="surl-action" data-surl="effacer" hidden>${icone.effacer}<span>Effacer</span></button>
              <button type="button" class="surl-action" data-surl="fermer" aria-label="Fermer">${icone.fermer}</button>
            </div>
            <div class="lecture-note trouve-barre" role="group" aria-label="Passages trouvés" hidden>
              <span class="trouve-mot"></span><span class="trouve-compte" aria-live="polite"></span>
              <button type="button" data-trouve="-1" aria-label="Passage précédent">‹</button>
              <button type="button" data-trouve="1" aria-label="Passage suivant">›</button>
              <button type="button" data-trouve="0" aria-label="Effacer le surlignage">✕</button>
            </div>
          </div>
        </div>
        <div class="voile-lecture" hidden></div>
        ${panneauAffichage()}
        <div class="panneau-lecture" id="panneau-sommaire" role="dialog" aria-modal="true" aria-labelledby="titre-sommaire" hidden>
          <div class="panneau-tete"><h2 id="titre-sommaire">Sommaire</h2><button type="button" class="panneau-fermer" data-fermer>Fermer</button></div>
          <ol class="sommaire-lecture"></ol>
        </div>
        <div class="panneau-lecture panneau-bible" id="panneau-bible" role="dialog" aria-modal="true" aria-labelledby="titre-bible" hidden>
          <div class="panneau-tete"><div><h2 id="titre-bible" class="bible-titre">Bible</h2><p class="bible-version">Louis Segond 1910</p></div><button type="button" class="panneau-fermer" data-fermer>Fermer</button></div>
          <div class="bible-outils"><button type="button" class="bible-tout" aria-pressed="false" hidden>Voir tout le chapitre</button><a class="bible-strong" href="https://www.lueur.org/bible/" target="_blank" rel="noopener" aria-label="Bible Strong : ce passage avec les mots hébreux et grecs, sur Lueur.org" hidden><span>Bible Strong</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12"/></svg></a></div>
          <div class="bible-corps"><div class="bible-texte" aria-live="polite"></div><div class="bible-plus" hidden></div></div>
        </div>
        ${panneauImpression(e, true)}
        <div class="panneau-lecture" id="panneau-note" role="dialog" aria-modal="true" aria-labelledby="titre-note" hidden>
          <div class="panneau-tete"><h2 id="titre-note">Ma note</h2><button type="button" class="panneau-fermer" data-fermer>Fermer</button></div>
          <blockquote class="note-passage"></blockquote>
          <textarea class="note-texte" rows="5" maxlength="2000" aria-labelledby="titre-note" placeholder="Ce que ce passage me dit, une question à poser au groupe…"></textarea>
          <div class="note-boutons">
            <button type="button" class="lecture-action principale" data-note="garder"><span>Enregistrer</span>${icone.coche}</button>
            <button type="button" class="lecture-action" data-note="effacer"><span>Effacer la note</span>${icone.effacer}</button>
          </div>
        </div>
      </div>`;

    const racine = app.querySelector(".lecture");
    const defile = racine.querySelector(".lecture-defile");
    const contenu = racine.querySelector(".lecture-contenu");
    const article = racine.querySelector(".lecture-texte");
    const barre = racine.querySelector(".lecture-progression span");
    const nav = racine.querySelector(".lecture-pages");
    const numero = racine.querySelector(".lecture-page-num");
    const session = (texte = { ac: new AbortController(), page: 0, pages: 1, pas: 1 });
    const { signal } = session.ac;
    const fermerPanneaux = brancherPanneaux(racine, signal);
    brancherImpression(racine, e, signal);
    // fin de l’étude : la cocher, ou passer à la suivante (ce qui la coche aussi)
    racine.querySelector(".lecture-fin").addEventListener("click", (ev) => {
      if (ev.target.closest("[data-partager-etude]")) {
        partagerLien(titre, `${titre}${num ? ` (${num})` : ""}, ${s.titre}`, lienPartage(f));
        return;
      }
      const b = ev.target.closest("[data-faite-lecture]");
      if (b) {
        const oui = b.getAttribute("aria-pressed") !== "true";
        faites.mettre(l, oui);
        b.setAttribute("aria-pressed", String(oui));
        bulle(oui ? `${j ? "Semaine" : "Étude"} marquée comme terminée` : `${j ? "Semaine" : "Étude"} remise à faire`);
      } else if (ev.target.closest("[data-terminer]") && !faites.a(l)) {
        faites.mettre(l, true);
        bulle(`${l.num ? `${j ? "Semaine" : "Étude"} ${l.num}` : j ? "Semaine" : "Étude"} terminée`);
      }
    }, { signal });
    // toucher une référence biblique : le passage s’affiche dans le panneau (assets/bible.js)
    racine.addEventListener("click", (ev) => {
      const a = ev.target.closest('a.ref[data-ouvrir="bible"]');
      if (!a || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      racine.querySelector("#panneau-bible .bible-plus").hidden = true;
      Bible.montrer(racine.querySelector("#panneau-bible"), a.getAttribute("href"));
    }, { signal });
    brancherBiblePlus(racine.querySelector("#panneau-bible"), f, signal);
    racine.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-projeter]");
      if (!b) return;
      if (!article.querySelector("p, li, .lec-q")) { bulle("Le texte de l’étude n’est pas encore là"); return; }
      fermerPanneaux();
      projeter(article, e, b);
    }, { signal });
    signal.addEventListener("abort", fermerProjection);
    const livre = () => racine.classList.contains("livre");

    const position = () => {
      if (livre()) return session.pages > 1 ? session.page / (session.pages - 1) : 0;
      const max = defile.scrollHeight - defile.clientHeight;
      return max > 0 ? defile.scrollTop / max : 0;
    };
    const progression = () => {
      if (livre()) {
        barre.style.width = `${((session.page + 1) / session.pages) * 100}%`;
        return;
      }
      const max = defile.scrollHeight - defile.clientHeight;
      barre.style.width = `${max > 0 ? Math.min(100, (defile.scrollTop / max) * 100) : 100}%`;
    };
    const allerPage = (n, anime) => {
      session.page = Math.max(0, Math.min(session.pages - 1, n));
      defile.scrollTo({ left: session.page * session.pas, top: 0, behavior: anime && !mouvementReduit() ? "smooth" : "auto" });
      numero.textContent = `Page ${session.page + 1} sur ${session.pages}`;
      nav.querySelector('[data-page="-1"]').disabled = session.page === 0;
      nav.querySelector('[data-page="1"]').disabled = session.page === session.pages - 1;
      progression();
    };
    // une question ne termine jamais une page : le verset à compléter ou la zone de réponse qui la suit
    // passerait seul à la page suivante, et la question semblerait sans place pour répondre
    const garderQuestions = () => {
      contenu.querySelectorAll(".lec-q[style]").forEach((q) => {
        q.style.removeProperty("break-before");
        q.style.removeProperty("-webkit-column-break-before");
      });
      const base = contenu.getBoundingClientRect();
      const colonne = (r) => Math.floor((r.left - base.left + 1) / session.pas);
      contenu.querySelectorAll(".lec-q").forEach((q) => {
        const suite = q.nextElementSibling;
        if (!suite || suite.classList.contains("lec-q")) return;
        const rq = q.getBoundingClientRect();
        const rs = suite.getClientRects()[0];
        if (!rs || colonne(rs) <= colonne(rq) || rq.top - base.top < 8) return;
        q.style.setProperty("break-before", "column");
        q.style.setProperty("-webkit-column-break-before", "always");
      });
    };
    const paginer = (ratio) => {
      const m = parseFloat(getComputedStyle(defile).paddingLeft) || 16;
      const largeur = defile.clientWidth - 2 * m;
      if (largeur <= 0) return;
      contenu.style.width = `${largeur}px`;
      contenu.style.columnWidth = `${largeur}px`;
      contenu.style.columnGap = `${2 * m}px`;
      session.pas = largeur + 2 * m;
      defile.scrollLeft = 0;
      garderQuestions();
      const fin = contenu.querySelector(".lecture-sentinelle");
      const x = fin.getBoundingClientRect().left - contenu.getBoundingClientRect().left;
      session.pages = Math.max(1, Math.floor((x + 1) / session.pas) + 1);
      allerPage(Math.round((ratio || 0) * (session.pages - 1)), false);
    };
    const appliquer = (garder) => {
      const ratio = garder ? position() : 0;
      racine.style.setProperty("--l-taille", `${reglages.taille}px`);
      racine.classList.remove("fond-clair", "fond-sepia", "fond-nuit");
      racine.classList.add(`fond-${reglages.fond}`);
      racine.classList.toggle("police-livre", reglages.police === "livre");
      const enLivre = reglages.mode === "feuilleter";
      racine.classList.toggle("livre", enLivre);
      nav.hidden = !enLivre;
      racine.querySelector(".taille output").textContent = reglages.taille;
      racine.querySelectorAll("[data-choix]").forEach((b) => {
        const [cle, val] = b.dataset.choix.split(":");
        b.setAttribute("aria-pressed", String(reglages[cle] === val));
      });
      if (enLivre) {
        paginer(ratio);
      } else {
        contenu.style.width = contenu.style.columnWidth = contenu.style.columnGap = "";
        defile.scrollLeft = 0;
        if (garder) defile.scrollTop = ratio * (defile.scrollHeight - defile.clientHeight);
        progression();
      }
    };
    // montrer un élément du texte : sa page (livre), ou le faire défiler en haut (au tiers si « milieu »)
    const allerA = (cible, anime, milieu) => {
      if (livre()) {
        const m = parseFloat(getComputedStyle(defile).paddingLeft) || 16;
        const x = cible.getBoundingClientRect().left - defile.getBoundingClientRect().left - m + defile.scrollLeft;
        allerPage(Math.floor((x + 2) / session.pas), anime);
      } else {
        const haut = cible.getBoundingClientRect().top - defile.getBoundingClientRect().top + defile.scrollTop;
        defile.scrollTo({ top: Math.max(0, haut - (milieu ? defile.clientHeight / 3 : 12)), behavior: anime && milieu && !mouvementReduit() ? "smooth" : "auto" });
      }
    };

    // où on en est : gardé sur l’appareil, pour reprendre la lecture (accueil, réouverture)
    let pret = false;
    let minuteur = 0;
    const retenir = () => {
      if (!pret) return;
      clearTimeout(minuteur);
      minuteur = setTimeout(() => memoire.ecrire(`mission.pos.${f}`, position().toFixed(4)), 400);
    };
    memoire.ecrire("mission.derniere", f);
    signal.addEventListener("abort", () => {
      clearTimeout(minuteur);
      if (pret) memoire.ecrire(`mission.pos.${f}`, position().toFixed(4));
    });
    const noteReprise = racine.querySelector(".reprise-note");
    let minuteurNote = 0;
    noteReprise.querySelector("[data-debut]").addEventListener("click", () => {
      noteReprise.hidden = true;
      if (livre()) allerPage(0, true); else defile.scrollTo({ top: 0 });
    }, { signal });

    // passages trouvés par la recherche : surlignés, et une barre pour aller de l’un à l’autre
    const barreTrouve = racine.querySelector(".trouve-barre");
    let marques = [];
    let actuelle = -1;
    const montrerMarque = (i) => {
      if (!marques.length) return;
      actuelle = (i + marques.length) % marques.length;
      marques.forEach((m, k) => m.classList.toggle("trouve-actuel", k === actuelle));
      barreTrouve.querySelector(".trouve-compte").textContent = `${actuelle + 1} sur ${marques.length}`;
      allerA(marques[actuelle], true, true);
    };
    barreTrouve.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-trouve]");
      if (!b) return;
      const n = Number(b.dataset.trouve);
      if (n) { montrerMarque(actuelle + n); return; }
      marques.forEach((m) => m.replaceWith(...m.childNodes));
      article.normalize();
      marques = [];
      barreTrouve.hidden = true;
    }, { signal });
    const surligner = (q) => {
      const mots = motsCherches(q);
      if (!mots.length) return;
      const re = motif(mots);
      const noeuds = [];
      const w = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest("textarea, .lec-cache, .lec-credits") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      while (w.nextNode()) noeuds.push(w.currentNode);
      noeuds.forEach((t) => {
        const coupes = [...trouvailles(aplatir(t.data), re)];
        if (!coupes.length) return;
        const morceaux = document.createDocumentFragment();
        let i = 0;
        coupes.forEach(([d, fin]) => {
          morceaux.append(t.data.slice(i, d));
          const m = document.createElement("mark");
          m.className = "trouve";
          m.textContent = t.data.slice(d, fin);
          morceaux.append(m);
          marques.push(m);
          i = fin;
        });
        morceaux.append(t.data.slice(i));
        t.replaceWith(morceaux);
      });
      if (!marques.length) return;
      barreTrouve.querySelector(".trouve-mot").textContent = `« ${q} »`;
      barreTrouve.hidden = false;
    };

    // écouter : le téléphone lit l’étude à voix haute (synthèse vocale du navigateur, voix française)
    const boutonEcouter = racine.querySelector("[data-ecouter]");
    const barreEcoute = racine.querySelector(".ecoute-barre");
    const VITESSES = [[1, "1×", "Vitesse normale"], [1.25, "1,25×", "Plus rapide"], [0.8, "0,8×", "Plus lent"]];
    let ecoute = null; // { blocs, i, morceaux, j, vitesse, pause, u }
    const texteADire = (el) => {
      const c = el.cloneNode(true);
      c.querySelectorAll(".lec-cache, textarea, .lec-credits").forEach((x) => x.remove());
      c.querySelectorAll("input.lec-blanc").forEach((x) => x.replaceWith("…"));
      c.querySelectorAll("a.ref").forEach((a) => {
        const seg = Bible.analyser(Bible.passageDuLien(a.getAttribute("href")));
        a.replaceWith(seg && seg.length ? pourOreille(Bible.titre(seg)) : a.textContent);
      });
      let t = c.textContent.replace(/\s+/g, " ").trim();
      const q = el.closest(".lec-q");
      if (q && t && q.querySelector(".lec-q-corps p, .lec-q-corps li") === el) {
        const num = q.querySelector(".lec-q-num");
        if (num && /\d/.test(num.textContent)) t = `Question ${num.textContent.trim()}. ${t}`;
      }
      return t;
    };
    const blocsADire = () => [...article.querySelectorAll("h2, h3, h4, p, li, blockquote, figcaption, td, th, dt, dd")]
      .filter((el) => !el.closest(".lec-credits, .lec-cache") && !el.querySelector("p, li, h2, h3, h4, blockquote, td, th"))
      .filter((el) => texteADire(el));
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const d = defile.getBoundingClientRect();
      return livre() ? r.left >= d.left - 2 && r.left < d.right - 2 : r.bottom > d.top + 8 && r.top < d.bottom - 8;
    };
    const finEcoute = () => {
      if (!ecoute) return;
      ecoute.u = null;
      ecoute = null;
      if (voixOccupee()) synthese.cancel();
      article.querySelectorAll(".lu-en-cours").forEach((x) => x.classList.remove("lu-en-cours"));
      barreEcoute.hidden = true;
      boutonEcouter.setAttribute("aria-pressed", "false");
    };
    const dire = () => {
      if (!ecoute || ecoute.pause) return;
      const bloc = ecoute.blocs[ecoute.i];
      if (!bloc) { finEcoute(); return; }
      if (!ecoute.morceaux) {
        ecoute.morceaux = decouper(texteADire(bloc));
        ecoute.j = 0;
        article.querySelectorAll(".lu-en-cours").forEach((x) => x.classList.remove("lu-en-cours"));
        bloc.classList.add("lu-en-cours");
        if (!visible(bloc)) allerA(bloc, true, true);
      }
      const u = new SpeechSynthesisUtterance(ecoute.morceaux[ecoute.j]);
      u.lang = "fr-FR";
      const v = voixFr();
      if (v) u.voice = v;
      u.rate = ecoute.vitesse;
      u.onend = () => {
        if (!ecoute || ecoute.u !== u) return;
        ecoute.j += 1;
        if (ecoute.j >= ecoute.morceaux.length) { ecoute.i += 1; ecoute.morceaux = null; }
        dire();
      };
      u.onerror = (ev) => { if (ecoute && ecoute.u === u && !/interrupted|canceled/.test(ev.error || "")) finEcoute(); };
      ecoute.u = u;
      synthese.speak(u);
    };
    const majBarre = () => {
      if (!ecoute) return;
      const b = barreEcoute.querySelector('[data-ecoute="pause"]');
      b.innerHTML = ecoute.pause ? icone.jouer : icone.pause;
      b.setAttribute("aria-label", ecoute.pause ? "Reprendre la lecture" : "Pause");
      barreEcoute.querySelector(".ecoute-etat").textContent = ecoute.pause ? "En pause" : "Lecture à voix haute";
      const [, court, long] = VITESSES.find(([x]) => x === ecoute.vitesse);
      const bv = barreEcoute.querySelector('[data-ecoute="vitesse"]');
      bv.textContent = court;
      bv.setAttribute("aria-label", `${long} (changer la vitesse)`);
    };
    if (synthese) {
      boutonEcouter.hidden = false;
      boutonEcouter.setAttribute("aria-pressed", "false");
      synthese.getVoices(); // certaines voix se chargent au premier appel
      boutonEcouter.addEventListener("click", () => {
        if (ecoute) { finEcoute(); return; }
        const blocs = blocsADire();
        if (!blocs.length) return;
        const depart = Math.max(0, blocs.findIndex(visible));
        ecoute = { blocs, i: depart, morceaux: null, j: 0, vitesse: Number(memoire.lire("mission.lecture.vitesse", "1")) || 1, pause: false, u: null };
        if (!VITESSES.some(([x]) => x === ecoute.vitesse)) ecoute.vitesse = 1;
        arreterParole();
        barreEcoute.hidden = false;
        boutonEcouter.setAttribute("aria-pressed", "true");
        majBarre();
        apresAnnulation(dire);
        conseilSilencieux();
      }, { signal });
      barreEcoute.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-ecoute]");
        if (!b || !ecoute) return;
        const quoi = b.dataset.ecoute;
        if (quoi === "stop") { finEcoute(); return; }
        if (quoi === "pause") {
          ecoute.pause = !ecoute.pause;
          ecoute.u = null;
          if (ecoute.pause) { if (voixOccupee()) synthese.cancel(); } else apresAnnulation(dire);
        } else if (quoi === "vitesse") {
          const k = VITESSES.findIndex(([x]) => x === ecoute.vitesse);
          ecoute.vitesse = VITESSES[(k + 1) % VITESSES.length][0];
          memoire.ecrire("mission.lecture.vitesse", String(ecoute.vitesse));
          if (!ecoute.pause) { ecoute.u = null; apresAnnulation(dire); }
        }
        majBarre();
      }, { signal });
      signal.addEventListener("abort", finEcoute);
    }

    const regler = (cle, val) => {
      reglages[cle] = val;
      memoire.ecrire(`mission.lecture.${cle}`, String(val));
      appliquer(true);
    };
    racine.addEventListener("click", (ev) => {
      const c = ev.target.closest("[data-choix]");
      if (c) { const [cle, val] = c.dataset.choix.split(":"); regler(cle, val); return; }
      const t = ev.target.closest("[data-taille]");
      if (t) {
        const i = TAILLES.indexOf(reglages.taille) + Number(t.dataset.taille);
        if (i >= 0 && i < TAILLES.length) regler("taille", TAILLES[i]);
        return;
      }
      const pg = ev.target.closest("[data-page]");
      if (pg) { allerPage(session.page + Number(pg.dataset.page), true); return; }
      const aller = ev.target.closest("[data-aller]");
      if (aller) {
        const cible = article.querySelector(`#${CSS.escape(aller.dataset.aller)}`);
        fermerPanneaux();
        if (cible) allerA(cible, true);
      }
    }, { signal });

    // tourner les pages : glisser, toucher un bord, flèches du clavier
    let depart = null;
    defile.addEventListener("pointerdown", (ev) => {
      if (!livre() || ev.target.closest("textarea, input, a, button, label, select, mark.surl")) return;
      depart = { x: ev.clientX, y: ev.clientY };
    }, { signal });
    defile.addEventListener("pointerup", (ev) => {
      if (!depart) return;
      const dx = ev.clientX - depart.x;
      const dy = ev.clientY - depart.y;
      depart = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) allerPage(session.page + (dx < 0 ? 1 : -1), true);
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
        const r = defile.getBoundingClientRect();
        const pos = (ev.clientX - r.left) / r.width;
        if (pos > 0.75) allerPage(session.page + 1, true);
        else if (pos < 0.25) allerPage(session.page - 1, true);
      }
    }, { signal });
    defile.addEventListener("pointercancel", () => { depart = null; }, { signal });
    defile.addEventListener("keydown", (ev) => {
      if (!livre() || ev.target.closest("textarea, input")) return;
      if (["ArrowRight", "PageDown"].includes(ev.key)) { ev.preventDefault(); allerPage(session.page + 1, true); }
      else if (["ArrowLeft", "PageUp"].includes(ev.key)) { ev.preventDefault(); allerPage(session.page - 1, true); }
    }, { signal });
    defile.addEventListener("scroll", () => {
      if (livre()) {
        // un champ qui prend le focus fait défiler jusqu’à sa page : on suit
        const n = Math.round(defile.scrollLeft / session.pas);
        if (n !== session.page && Math.abs(defile.scrollLeft - n * session.pas) < 2) {
          session.page = n;
          numero.textContent = `Page ${n + 1} sur ${session.pages}`;
          progression();
        }
        retenir();
        return;
      }
      progression();
      retenir();
    }, { passive: true, signal });
    let attente = 0;
    const surveillance = new ResizeObserver(() => {
      clearTimeout(attente);
      attente = setTimeout(() => { if (livre()) paginer(position()); else progression(); }, 120);
    });
    surveillance.observe(defile);
    signal.addEventListener("abort", () => { surveillance.disconnect(); clearTimeout(attente); });

    appliquer(false);
    const adresse = `lecture/${f.split("/").map(encodeURIComponent).join("/")}.html?v=${VERSION_LECTURE}`;
    fetch(adresse, { signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
      .then((h) => {
        if (signal.aborted) return;
        article.innerHTML = h;
        if (window.Bible) {
          article.querySelectorAll("a.ref").forEach((a) => {
            if (Bible.analyser(Bible.passageDuLien(a.getAttribute("href")))) a.dataset.ouvrir = "bible";
          });
        }
        reponses(article, f, signal);
        brancherSurlignage(racine, article, f, signal);
        let demande = null;
        try {
          demande = JSON.parse(sessionStorage.getItem("mission.surligner") || "null");
          sessionStorage.removeItem("mission.surligner");
        } catch (er) { demande = null; }
        if (demande && demande.f === f && demande.q) surligner(demande.q);
        const titres = [...article.querySelectorAll("h2")];
        const liste = titres.length >= 2 ? titres : [...article.querySelectorAll("h2, h3")];
        if (liste.length >= 2) {
          racine.querySelector(".sommaire-lecture").innerHTML = liste
            .map((t) => `<li class="${t.tagName === "H3" && titres.length >= 2 ? "sous" : ""}"><button type="button" data-aller="${esc(t.id)}">${esc(t.textContent)}</button></li>`)
            .join("");
          racine.querySelector('[data-ouvrir="sommaire"]').hidden = false;
        }
        appliquer(false);
        const garde = Number(memoire.lire(`mission.pos.${f}`, "0")) || 0;
        if (marques.length) {
          montrerMarque(0);
        } else if (garde > 0.02 && garde < 0.98) {
          if (livre()) paginer(garde);
          else { defile.scrollTop = garde * (defile.scrollHeight - defile.clientHeight); progression(); }
          noteReprise.hidden = false;
          minuteurNote = setTimeout(() => { noteReprise.hidden = true; }, 7000);
          signal.addEventListener("abort", () => clearTimeout(minuteurNote));
        }
        pret = true;
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!signal.aborted && livre()) paginer(position()); });
      })
      .catch(() => {
        if (signal.aborted) return;
        article.innerHTML = `<p class="lecture-attente">Le texte de cette étude ne s’affiche pas (pas de connexion ?).
          <a href="#/original/${esc(f)}">Ouvrir l’original</a></p>`;
      });
    return true;
  }

  // réponses, mots à compléter et cases cochées : gardés sur l’appareil, par document
  // une question sans zone de réponse (études à compléter, comme Historacles) en reçoit une, comme dans
  // les autres études ; pas dans les fiches de l’animateur, qui donnent déjà les réponses.
  // (aussi utilisé par « Mon carnet » pour retrouver la question de chaque réponse)
  function ajouterZonesReponse(article, f) {
    const e = documents.get(f);
    if (!(e && e.d && e.d.role === "animateur")) {
      article.querySelectorAll(".lec-q").forEach((q, i) => {
        const corps = q.querySelector(".lec-q-corps");
        if (!corps || q.querySelector("textarea, input") || !corps.textContent.includes("?")) return;
        const num = (q.querySelector(".lec-q-num") || {}).textContent || String(i + 1);
        corps.insertAdjacentHTML("beforeend", `<textarea data-q="l${i + 1}" rows="2" placeholder="Votre réponse"
          aria-label="Votre réponse à la question ${esc(num.trim())}"></textarea>`);
      });
      // section « Votre réponse » en fin d’étude (Historacles) : sa question personnelle reçoit aussi une zone
      article.querySelectorAll("h2, h3").forEach((h, k) => {
        if (!/votre réponse|votre réflexion/i.test(h.textContent)) return;
        for (let el = h.nextElementSibling, m = 0; el && !/^H[1-3]$/.test(el.tagName); el = el.nextElementSibling) {
          const apres = el.nextElementSibling;
          if (el.tagName !== "P" || !el.textContent.trim().endsWith("?")
            || (apres && (apres.matches("textarea") || apres.querySelector("textarea, input")))) continue;
          m += 1;
          el.insertAdjacentHTML("afterend", `<textarea data-q="r${k + 1}-${m}" rows="3" placeholder="Votre réponse"
            aria-label="Votre réponse : ${esc(el.textContent.trim().slice(0, 90))}"></textarea>`);
          el = el.nextElementSibling;
        }
      });
    }
  }
  function reponses(article, f, signal) {
    const cle = (k) => `mission.rep.${f}.${k}`;
    ajouterZonesReponse(article, f);
    article.querySelectorAll("textarea[data-q]").forEach((t) => {
      t.value = memoire.lire(cle(`q${t.dataset.q}`), "");
      t.addEventListener("input", () => memoire.ecrire(cle(`q${t.dataset.q}`), t.value), { signal });
    });
    // un mot à compléter s’élargit à mesure qu’on écrit : la réponse reste lisible en entier
    const elargir = (t) => { t.size = Math.min(30, Math.max(Number(t.dataset.taille), t.value.length + 1)); };
    article.querySelectorAll("input.lec-blanc[data-b]").forEach((t) => {
      t.dataset.taille = t.size;
      t.value = memoire.lire(cle(`b${t.dataset.b}`), "");
      elargir(t);
      t.addEventListener("input", () => { memoire.ecrire(cle(`b${t.dataset.b}`), t.value); elargir(t); }, { signal });
    });
    article.querySelectorAll('input[type="checkbox"][data-c]').forEach((t) => {
      t.checked = memoire.lire(cle(`c${t.dataset.c}`), "") === "1";
      t.addEventListener("change", () => memoire.ecrire(cle(`c${t.dataset.c}`), t.checked ? "1" : ""), { signal });
    });
  }

  // ---------- passages surlignés et notes (mode lecture), gardés sur l’appareil : mission.surl.<document> ----------
  // un passage = un morceau de texte d’un bloc (paragraphe, élément de liste, titre…) : { id, g (groupe), b (n° du bloc),
  // d, f (début et fin dans le texte du bloc), t (le texte), c (couleur), n (note, sur le premier morceau du groupe), date }
  const COULEURS_SURL = [["jaune", "jaune"], ["vert", "vert"], ["rose", "rose"], ["bleu", "bleu"]];
  const BLOCS_SURL = "p, li, h2, h3, h4, blockquote, figcaption, td, th, dt, dd";
  const surl = {
    lire: (f) => lireJson(`mission.surl.${f}`, [], (l) => Array.isArray(l)),
    ecrire(f, l) {
      if (l.length) memoire.ecrire(`mission.surl.${f}`, JSON.stringify(l));
      else try { localStorage.removeItem(`mission.surl.${f}`); } catch (e) { /* rien */ }
    },
  };
  const blocsSurl = (article) => [...article.querySelectorAll(BLOCS_SURL)]
    .filter((el) => !el.closest(".lec-credits") && !el.querySelector(BLOCS_SURL));
  // le texte d’un bloc, sans les zones de réponse ni les étiquettes cachées
  const textesDe = (bloc) => {
    const l = [];
    const w = document.createTreeWalker(bloc, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (n.parentElement && n.parentElement.closest("textarea, .lec-cache, select") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    while (w.nextNode()) l.push(w.currentNode);
    return l;
  };
  const texteBloc = (bloc) => textesDe(bloc).map((t) => t.data).join("");
  // une position (nœud, décalage) dans un bloc → nombre de caractères du texte du bloc qui la précèdent
  function decalage(bloc, noeud, off) {
    const r = document.createRange();
    r.setStart(bloc, 0);
    try { r.setEnd(noeud, off); } catch (e) { return 0; }
    let n = 0;
    for (const t of textesDe(bloc)) {
      if (!r.intersectsNode(t)) continue;
      const debut = t === r.startContainer ? r.startOffset : 0;
      const fin = t === r.endContainer ? r.endOffset : t.length;
      n += Math.max(0, fin - debut);
    }
    return n;
  }
  function envelopper(bloc, d, f, classe, h) {
    const marques = [];
    let pos = 0;
    for (const t of textesDe(bloc)) {
      const a = pos;
      const z = pos + t.length;
      pos = z;
      if (z <= d || a >= f) continue;
      let n = t;
      const i = Math.max(0, d - a);
      const j = Math.min(t.length, f - a);
      if (j < n.length) n.splitText(j);
      if (i > 0) n = n.splitText(i);
      const m = document.createElement("mark");
      m.className = classe;
      m.dataset.h = h;
      n.replaceWith(m);
      m.append(n);
      marques.push(m);
    }
    return marques;
  }
  function brancherSurlignage(racine, article, f, signal) {
    const barre = racine.querySelector(".surl-barre");
    const panneauNote = racine.querySelector("#panneau-note");
    const voile = racine.querySelector(".voile-lecture");
    let choix = null; // passage choisi, pas encore surligné : [{ b, d, f, t }]
    let groupe = null; // passage surligné touché
    let noteDe = null; // groupe dont la note est ouverte
    const appliquer = () => {
      article.querySelectorAll("mark.surl").forEach((m) => m.replaceWith(...m.childNodes));
      article.normalize();
      const blocs = blocsSurl(article);
      const liste = surl.lire(f);
      const parGroupe = new Map();
      liste.forEach((h) => {
        const bloc = blocs[h.b];
        if (!bloc) return;
        let { d, f: fin } = h;
        const texte = texteBloc(bloc);
        if (texte.slice(d, fin) !== h.t) {
          // le texte a bougé (étude corrigée) : on retrouve le passage dans son bloc
          const k = texte.indexOf(h.t);
          if (k < 0) return;
          d = k;
          fin = k + h.t.length;
        }
        const marques = envelopper(bloc, d, fin, `surl c-${h.c}`, h.g);
        if (!parGroupe.has(h.g)) parGroupe.set(h.g, { note: "", marques: [] });
        const x = parGroupe.get(h.g);
        x.marques.push(...marques);
        if (h.n) x.note = h.n;
      });
      parGroupe.forEach(({ note, marques }) => {
        const der = marques[marques.length - 1];
        if (note && der) { der.classList.add("a-note"); der.dataset.note = note; }
      });
    };
    const cacher = () => {
      barre.hidden = true;
      choix = null;
      groupe = null;
    };
    const montrer = (mode) => {
      barre.hidden = false;
      barre.querySelector('[data-surl="effacer"]').hidden = mode !== "edition";
      const c = mode === "edition" ? (surl.lire(f).find((h) => h.g === groupe) || {}).c : "";
      barre.querySelectorAll("[data-couleur]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.couleur === c)));
    };
    const lireChoix = () => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { if (choix) cacher(); return; }
      const r = sel.getRangeAt(0);
      if (!article.contains(r.commonAncestorContainer) && !r.commonAncestorContainer.contains(article)) return;
      const depart = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
      if (depart && depart.closest("textarea, input, select")) return;
      const morceaux = [];
      blocsSurl(article).forEach((bloc, b) => {
        if (!r.intersectsNode(bloc)) return;
        const texte = texteBloc(bloc);
        let d = bloc.contains(r.startContainer) ? decalage(bloc, r.startContainer, r.startOffset) : 0;
        let fin = bloc.contains(r.endContainer) ? decalage(bloc, r.endContainer, r.endOffset) : texte.length;
        const brut = texte.slice(d, fin);
        d += brut.length - brut.trimStart().length;
        fin -= brut.length - brut.trimEnd().length;
        // un mot coupé par la sélection est pris en entier
        const lettre = /[\p{L}\p{N}’'-]/u;
        while (d > 0 && d < fin && lettre.test(texte[d - 1]) && lettre.test(texte[d])) d -= 1;
        while (fin < texte.length && fin > d && lettre.test(texte[fin]) && lettre.test(texte[fin - 1])) fin += 1;
        if (fin > d) morceaux.push({ b, d, f: fin, t: texte.slice(d, fin) });
      });
      if (!morceaux.length) return;
      choix = morceaux;
      groupe = null;
      montrer("nouveau");
    };
    let attente = 0;
    document.addEventListener("selectionchange", () => { clearTimeout(attente); attente = setTimeout(lireChoix, 250); }, { signal });
    signal.addEventListener("abort", () => clearTimeout(attente));
    // toucher un passage surligné : changer sa couleur, sa note, ou l’effacer
    article.addEventListener("click", (ev) => {
      const m = ev.target.closest("mark.surl");
      if (!m || ev.target.closest("a, textarea, input")) return;
      const sel = document.getSelection();
      if (sel && !sel.isCollapsed) return;
      groupe = m.dataset.h;
      choix = null;
      montrer("edition");
    }, { signal });
    const creer = (couleur) => {
      const g = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const date = dateIso(new Date());
      surl.ecrire(f, [...surl.lire(f), ...choix.map((m, k) => ({ id: `${g}-${k}`, g, b: m.b, d: m.d, f: m.f, t: m.t, c: couleur, n: "", date }))]);
      const sel = document.getSelection();
      if (sel) sel.removeAllRanges();
      appliquer();
      return g;
    };
    const ouvrirNote = (g) => {
      const liste = surl.lire(f).filter((h) => h.g === g);
      if (!liste.length) return;
      noteDe = g;
      panneauNote.querySelector(".note-passage").textContent = liste.map((h) => h.t).join(" … ");
      panneauNote.querySelector(".note-texte").value = liste[0].n || "";
      voile.hidden = false;
      panneauNote.hidden = false;
      panneauNote.querySelector(".note-texte").focus();
    };
    // les boutons de la barre gardent le texte choisi (sinon le toucher le désélectionne avant le clic)
    barre.addEventListener("pointerdown", (ev) => { if (ev.target.closest("button")) ev.preventDefault(); }, { signal });
    barre.addEventListener("click", (ev) => {
      const coul = ev.target.closest("[data-couleur]");
      const act = ev.target.closest("[data-surl]");
      if (coul) {
        if (choix) { creer(coul.dataset.couleur); bulle("Passage surligné : il est aussi dans Mon carnet"); }
        else if (groupe) {
          surl.ecrire(f, surl.lire(f).map((h) => (h.g === groupe ? { ...h, c: coul.dataset.couleur } : h)));
          appliquer();
        }
        cacher();
        return;
      }
      if (!act) return;
      const quoi = act.dataset.surl;
      if (quoi === "fermer") { const sel = document.getSelection(); if (sel && choix) sel.removeAllRanges(); cacher(); return; }
      if (quoi === "note") {
        const g = choix ? creer("jaune") : groupe;
        cacher();
        if (g) ouvrirNote(g);
        return;
      }
      if (quoi === "effacer" && groupe) {
        surl.ecrire(f, surl.lire(f).filter((h) => h.g !== groupe));
        appliquer();
        cacher();
        bulle("Surlignage effacé");
      }
    }, { signal });
    panneauNote.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-note]");
      if (!b || !noteDe) return;
      const texte = b.dataset.note === "garder" ? panneauNote.querySelector(".note-texte").value.trim() : "";
      let premier = true;
      surl.ecrire(f, surl.lire(f).map((h) => {
        if (h.g !== noteDe) return h;
        const n = premier ? texte : "";
        premier = false;
        return { ...h, n };
      }));
      appliquer();
      voile.hidden = true;
      panneauNote.hidden = true;
      bulle(texte ? "Note enregistrée" : "Note effacée");
      noteDe = null;
    }, { signal });
    appliquer();
  }

  // ---------- shorts des études : une idée clé et un verset clé par étude (donnees/shorts.json, outils/shorts/) ----------
  const VERSION_SHORTS = "4";
  let shortsCharges = null;
  function chargerShorts() {
    if (!shortsCharges) {
      shortsCharges = fetch(`donnees/shorts.json?v=${VERSION_SHORTS}`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then((d) => d.shorts.map((x) => {
          const s = series[x.s];
          const l = s && s.lecons[x.n];
          // l’image peinte pour le short ; sinon celle de l’étude ; les couvertures des livrets FAST,
          // des pages de titre, laissent la place à un fond de couleur
          const img = x.p ? `shorts/${x.p}` : l.image || (s.id.startsWith("fast-") ? "" : s.image);
          return s && l && aTexte(x.f) ? { ...x, id: x.f, serie: s, lecon: l, niveau: s.niveau, img } : null;
        }).filter(Boolean));
      shortsCharges.catch(() => { shortsCharges = null; });
    }
    return shortsCharges;
  }
  // shorts déjà regardés sur cet appareil (plus d’une seconde et demie à l’écran)
  const vus = {
    liste() { try { const l = JSON.parse(memoire.lire("mission.shorts.vus", "[]")); return Array.isArray(l) ? l : []; } catch (e) { return []; } },
    noter(id) {
      const l = this.liste().filter((x) => x !== id);
      l.push(id);
      memoire.ecrire("mission.shorts.vus", JSON.stringify(l.slice(-600)));
    },
  };
  // l’ordre des shorts change toutes les heures (le même pour tous à la même heure), sans deux shorts
  // de la même série à la suite ; puis ceux déjà vus passent après les autres : chaque visite montre du neuf.
  // Quand tout a été vu, on repart pour un tour.
  function ordreDuJour(tous) {
    const j = new Date();
    let a = (((j.getFullYear() * 13 + j.getMonth()) * 32 + j.getDate()) * 24 + j.getHours()) >>> 0;
    const hasard = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const l = tous.slice();
    for (let i = l.length - 1; i > 0; i--) {
      const k = Math.floor(hasard() * (i + 1));
      [l[i], l[k]] = [l[k], l[i]];
    }
    for (let i = 1; i < l.length; i++) {
      if (l[i].s !== l[i - 1].s) continue;
      const k = l.findIndex((x, m) => m > i && x.s !== l[i - 1].s && (!l[m + 1] || l[m + 1].s !== l[i].s));
      if (k > 0) [l[i], l[k]] = [l[k], l[i]];
    }
    const deja = new Set(vus.liste());
    const neufs = l.filter((x) => !deja.has(x.id));
    if (!neufs.length) {
      memoire.ecrire("mission.shorts.vus", "[]");
      return l;
    }
    return [...neufs, ...l.filter((x) => deja.has(x.id))];
  }
  // shorts aimés, gardés sur l’appareil, les derniers en premier
  const aimes = {
    liste() { try { const l = JSON.parse(memoire.lire("mission.shorts.aimes", "[]")); return Array.isArray(l) ? l : []; } catch (e) { return []; } },
    a(id) { return this.liste().includes(id); },
    basculer(id) {
      const avant = this.liste();
      const oui = !avant.includes(id);
      memoire.ecrire("mission.shorts.aimes", JSON.stringify(oui ? [id, ...avant] : avant.filter((x) => x !== id)));
      return oui;
    },
  };
  const imgShort = (nom) => `assets/images/${nom.split("/").map(encodeURIComponent).join("/")}.webp`;
  const ouShort = (l) => (l.num ? `Étude ${l.num} · ${l.titre}` : l.titre);
  // ce que dit la voix : l’idée, puis le verset et sa référence
  const texteAOreille = (x) => `${x.i} ${pourOreille(x.r)} : ${x.t.replace(/\n/g, " ")}`;
  const hasardDe = (graine) => {
    let a = graine >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // le short du jour : le même pour tous ce jour-là, un autre le lendemain (ordre mélangé une fois pour toutes)
  function shortDuJour(tous) {
    if (!tous.length) return null;
    const ordre = tous.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
    const h = hasardDe(1984);
    for (let i = ordre.length - 1; i > 0; i--) {
      const k = Math.floor(h() * (i + 1));
      [ordre[i], ordre[k]] = [ordre[k], ordre[i]];
    }
    const j = new Date();
    return ordre[Math.floor(Date.UTC(j.getFullYear(), j.getMonth(), j.getDate()) / 86400000) % ordre.length];
  }
  function carteDuJour(x) {
    const { serie: s, lecon: l } = x;
    const jour = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return `<div class="du-jour-tete">
        <h2 id="du-jour-titre" class="etagere-titre">${icone.shorts}Le short du jour</h2>
        <span class="du-jour-date">${esc(jour.charAt(0).toUpperCase() + jour.slice(1))}</span>
      </div>
      <article class="du-jour-carte">
        <a class="du-jour-lien" href="#/shorts/${esc(x.id)}" aria-label="Voir le short : ${esc(x.i)}">
          ${x.img ? `<span class="du-jour-fond" aria-hidden="true" style="background-image:url('${imgShort(x.img)}')"></span>`
            : `<span class="du-jour-fond sans-photo" data-niveau="${x.niveau}" aria-hidden="true">${picto(x.niveau, "fond-picto")}</span>`}
          <span class="du-jour-contenu">
            <span class="du-jour-idee">${fr(x.i)}</span>
            <span class="du-jour-verset">${x.t.split("\n").map(fr).join("<br>")} <span class="du-jour-ref">${fr(x.r)}</span></span>
            <span class="du-jour-source">${fr(s.titre)} · ${fr(ouShort(l))}</span>
          </span>
        </a>
        <div class="du-jour-actions">
          ${synthese ? `<button type="button" class="du-jour-bouton" data-ecouter-jour aria-pressed="false">${icone.ecouter}<span>Écouter</span></button>` : ""}
          <button type="button" class="du-jour-bouton" data-partager-jour>${icone.partager}<span>Partager</span></button>
          <a class="du-jour-bouton" href="#/lire/${esc(x.f)}">${icone.lecture}<span>L’étude</span></a>
        </div>
      </article>`;
  }

  // sur l’accueil : une étagère des shorts du jour, comme sur les applications de vidéos
  function etagereShorts() {
    return `<section class="dedans etagere" aria-labelledby="etagere-titre">
      <div class="etagere-tete">
        <h2 id="etagere-titre" class="etagere-titre">${icone.shorts}Shorts</h2>
        <p class="etagere-sous">Une idée clé et un verset clé par étude. Faites défiler, touchez pour ouvrir l’étude.</p>
        <a class="etagere-tout" href="#/shorts">Tout voir${chevronDroit}</a>
      </div>
      <ol class="etagere-liste" data-etagere aria-label="Shorts du jour">${'<li class="etagere-attente" aria-hidden="true"></li>'.repeat(6)}</ol>
    </section>`;
  }
  function remplirEtagere() {
    chargerShorts().then((tous) => {
      const ol = app.querySelector("[data-etagere]");
      if (!ol) return;
      const x = shortDuJour(tous);
      const zone = app.querySelector("[data-du-jour]");
      if (zone && x) {
        zone.innerHTML = carteDuJour(x);
        zone.hidden = false;
        zone.addEventListener("click", (ev) => {
          const ec = ev.target.closest("[data-ecouter-jour]");
          if (ec) {
            if (ec.getAttribute("aria-pressed") === "true") { arreterParole(); return; }
            ec.setAttribute("aria-pressed", "true");
            parler(texteAOreille(x), () => ec.setAttribute("aria-pressed", "false"));
            return;
          }
          const p = ev.target.closest("[data-partager-jour]");
          if (p) feuillePartage(x, p);
        });
      }
      ol.innerHTML = ordreDuJour(tous).filter((y) => !x || y.id !== x.id).slice(0, 12).map((x) => `<li><a class="etagere-short" href="#/shorts/${esc(x.id)}">
          ${x.img ? `<img src="${imgShort(x.img)}" alt="" ${x.p ? 'width="720" height="1280"' : 'width="800" height="600"'} loading="lazy" decoding="async" onerror="reessayer(this)">`
            : `<span class="sans-photo" data-niveau="${x.niveau}">${picto(x.niveau, "fond-picto")}</span>`}
          <span class="etagere-texte">${fr(x.i)}</span>
          <span class="etagere-ref">${fr(x.r)}</span>
        </a></li>`).join("");
    }).catch(() => {
      const s = app.querySelector(".etagere");
      if (s) s.hidden = true;
    });
  }

  function carteShort(x, rang, total) {
    const { serie: s, lecon: l } = x;
    const aime = aimes.a(x.id);
    // une idée courte s’affiche en plus grand : c’est une phrase-choc
    return `<article class="short${x.i.length <= 64 ? " court" : ""}" data-id="${esc(x.id)}" aria-posinset="${rang + 1}" aria-setsize="${total}" aria-labelledby="short-${rang}">
      <a class="short-lien" href="#/lire/${esc(x.f)}">
        ${x.img ? `<span class="short-fond" data-img="${esc(x.img)}" aria-hidden="true"></span>`
          : `<span class="short-fond sans-photo" data-niveau="${x.niveau}" aria-hidden="true">${picto(x.niveau, "fond-picto")}</span>`}
        <span class="short-contenu">
          <span class="short-auteur">
            <span class="short-avatar" aria-hidden="true" style="background-image:url('${imgShort(s.image)}')"></span>
            <span class="short-qui"><strong>${fr(s.titre)}</strong><span>${fr(ouShort(l))}</span></span>
          </span>
          <span class="short-idee" id="short-${rang}">${fr(x.i)}</span>
          <span class="short-verset"><span class="short-verset-texte">${x.t.split("\n").map(fr).join("<br>")}</span><span class="short-ref">${fr(x.r)}</span></span>
          <span class="short-ouvrir">Ouvrir l’étude${chevronDroit}</span>
        </span>
      </a>
      <div class="short-actions">
        ${synthese ? `<button type="button" class="short-action" data-ecouter-short aria-pressed="false">${icone.ecouter}<span>Écouter</span></button>` : ""}
        <button type="button" class="short-action" data-aimer aria-pressed="${aime}">${icone.coeur}<span>J’aime</span></button>
        <button type="button" class="short-action" data-partager-short>${icone.partager}<span>Partager</span></button>
        <a class="short-action" href="#/serie/${s.id}" aria-label="La série : ${esc(s.titre)}">${icone.serie}<span>Série</span></a>
      </div>
    </article>`;
  }

  const FILTRES_SHORTS = [["tout", "Pour vous"], ["connaitre", "Rencontrer"], ["grandir", "Grandir"], ["murir", "Mûrir"],
    ["disciple", "Disciple"], ["aimes", "J’aime"]];
  let filtreShorts = "tout";
  try { filtreShorts = sessionStorage.getItem("mission.shorts.filtre") || "tout"; } catch (e) { /* navigation privée */ }
  let shortsFin = null;
  function fermerShorts() {
    if (shortsFin) { shortsFin.abort(); shortsFin = null; }
  }
  // #/shorts, #/shorts/<f> : les shorts en plein écran, un par écran ; on les fait défiler du doigt
  function shortsPage(cible) {
    fermerShorts();
    const fin = (shortsFin = new AbortController());
    const { signal } = fin;
    document.title = "Shorts : une idée clé, un verset clé — Mission";
    app.innerHTML = `
      <div class="shorts-page">
        <div class="shorts-tete">
          <a class="shorts-retour" href="#/" aria-label="Retour à l’accueil">${chevron}</a>
          <h1 class="cache" tabindex="-1">Shorts : une idée clé et un verset clé par étude</h1>
          <div class="shorts-filtres" role="group" aria-label="Quels shorts">${FILTRES_SHORTS.map(([id, nom]) =>
            `<button type="button" data-filtre="${id}" aria-pressed="${id === filtreShorts}">${id === "aimes" ? icone.coeur : ""}${nom}</button>`).join("")}</div>
          <button type="button" class="shorts-auto" data-auto aria-pressed="false"
            aria-label="${synthese ? "Lecture automatique : chaque short est lu à voix haute, puis le suivant arrive" : "Défilement automatique"}">${icone.jouer}<span>Auto</span></button>
        </div>
        <div class="shorts" role="feed" aria-busy="true" aria-label="Shorts des études"></div>
      </div>`;
    const flux = app.querySelector(".shorts");
    const tete = app.querySelector(".shorts-tete");
    let SH = [];
    let liste = [];
    let rendus = 0;
    const PAQUET = 8;
    const voirImage = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      voirImage.unobserve(e.target);
      e.target.style.backgroundImage = `url("${imgShort(e.target.dataset.img)}")`;
    }), { root: flux, rootMargin: "150% 0px" });
    const voirFin = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) ajouter(); },
      { root: flux, rootMargin: "300% 0px" });
    // le short à l’écran devient l’adresse : un retour depuis l’étude y ramène
    let minuterieVu = 0;
    const voirCourant = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const id = e.target.dataset.id;
      if (location.hash !== `#/shorts/${id}`) history.replaceState(null, "", `#/shorts/${id}`);
      if (e.target !== flux.firstElementChild) cacherAstuce();
      // le short à l’écran : sa photo bouge doucement ; en lecture auto, il est lu
      flux.querySelectorAll(".short.actif").forEach((a) => { if (a !== e.target) a.classList.remove("actif"); });
      e.target.classList.add("actif");
      if (auto) {
        clearTimeout(minuterieAuto);
        minuterieAuto = setTimeout(() => lireAuto(e.target), 500);
      }
      clearTimeout(minuterieVu);
      minuterieVu = setTimeout(() => { if (!signal.aborted && location.hash === `#/shorts/${id}`) vus.noter(id); }, 1500);
    }), { root: flux, threshold: 0.6 });
    signal.addEventListener("abort", () => clearTimeout(minuterieVu));

    // écouter un short ; lecture auto : chaque short est lu, puis le suivant arrive tout seul
    // (sans voix sur l’appareil : le temps de lire, puis le suivant)
    let auto = false;
    let minuterieAuto = 0;
    const boutonAuto = tete.querySelector("[data-auto]");
    const marquerEcoute = (carte, oui) => {
      carte.classList.toggle("en-ecoute", oui);
      const b = carte.querySelector("[data-ecouter-short]");
      if (b) b.setAttribute("aria-pressed", String(oui));
    };
    const avancer = (carte) => {
      const n = carte.nextElementSibling;
      if (!n || !n.classList.contains("short")) { arreterAuto(); bulle("C’était le dernier short"); return; }
      n.scrollIntoView({ behavior: mouvementReduit() ? "auto" : "smooth", block: "start" });
    };
    function lireAuto(carte) {
      if (!auto || signal.aborted || !carte.isConnected) return;
      const x = SH.find((y) => y.id === carte.dataset.id);
      if (!x) return;
      clearTimeout(minuterieAuto);
      marquerEcoute(carte, true);
      const apres = (fini) => {
        marquerEcoute(carte, false);
        if (fini && auto && !signal.aborted) minuterieAuto = setTimeout(() => avancer(carte), 1000);
      };
      if (!parler(texteAOreille(x), apres)) minuterieAuto = setTimeout(() => apres(true), 3500 + 55 * (x.i.length + x.t.length));
    }
    function demarrerAuto() {
      auto = true;
      boutonAuto.setAttribute("aria-pressed", "true");
      garderEcran(true);
      const c = flux.querySelector(".short.actif") || flux.querySelector(".short");
      if (c) lireAuto(c);
    }
    function arreterAuto() {
      if (!auto) return;
      auto = false;
      clearTimeout(minuterieAuto);
      arreterParole();
      boutonAuto.setAttribute("aria-pressed", "false");
      garderEcran(false);
    }
    signal.addEventListener("abort", () => { arreterAuto(); arreterParole(); });
    signal.addEventListener("abort", () => { voirImage.disconnect(); voirFin.disconnect(); voirCourant.disconnect(); });

    // texte trop long pour l’écran : on le resserre d’un cran, puis d’un autre
    const ajuster = (a) => {
      const c = a.querySelector(".short-contenu");
      const libre = tete.offsetHeight + 4;
      a.classList.remove("serre", "tres-serre");
      if (c.offsetTop < libre) a.classList.add("serre");
      if (c.offsetTop < libre) a.classList.add("tres-serre");
    };
    function ajouter() {
      if (rendus >= liste.length) return;
      const morceau = liste.slice(rendus, rendus + PAQUET);
      flux.insertAdjacentHTML("beforeend", morceau.map((x, k) => carteShort(x, rendus + k, liste.length)).join(""));
      rendus += morceau.length;
      flux.querySelectorAll(".short:not([data-suivi])").forEach((a) => {
        a.dataset.suivi = "1";
        ajuster(a);
        const fond = a.querySelector(".short-fond[data-img]");
        if (fond) voirImage.observe(fond);
        voirCourant.observe(a);
      });
      voirFin.disconnect();
      if (rendus < liste.length) voirFin.observe(flux.lastElementChild);
    }
    function remplir(cibleId) {
      liste = filtreShorts === "aimes"
        ? aimes.liste().map((id) => SH.find((x) => x.id === id)).filter(Boolean)
        : ordreDuJour(SH).filter((x) => filtreShorts === "tout" || x.niveau === filtreShorts);
      flux.innerHTML = "";
      rendus = 0;
      flux.setAttribute("aria-busy", "false");
      if (!liste.length) {
        flux.innerHTML = `<div class="shorts-vide">${icone.coeur}<p>Touchez « J’aime » sur un short pour le retrouver ici.</p>
          <button type="button" class="shorts-bouton" data-filtre="tout">Voir tous les shorts</button></div>`;
        return;
      }
      // le short demandé (depuis l’accueil, ou au retour d’une étude) passe en tête ; la suite reste neuve
      const k = cibleId ? liste.findIndex((x) => x.id === cibleId) : -1;
      if (k > 0) liste = [liste[k], ...liste.slice(0, k), ...liste.slice(k + 1)];
      ajouter();
      flux.scrollTop = 0;
    }
    function choisir(id) {
      filtreShorts = id;
      try { sessionStorage.setItem("mission.shorts.filtre", id); } catch (e) { /* navigation privée */ }
      tete.querySelectorAll("[data-filtre]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filtre === id)));
    }
    function montrerAstuce() {
      const a = flux.firstElementChild;
      if (a && a.classList.contains("short") && liste.length > 1)
        a.insertAdjacentHTML("beforeend", `<div class="shorts-astuce" aria-hidden="true">${icone.haut}<span>${
          matchMedia("(pointer: coarse)").matches ? "Glissez vers le haut" : "Faites défiler, ou touche ↓"}</span></div>`);
    }
    function cacherAstuce() {
      const a = flux.querySelector(".shorts-astuce");
      if (a) { a.remove(); memoire.ecrire("mission.shorts.astuce", "1"); }
    }

    chargerShorts().then((tous) => {
      if (signal.aborted) return;
      SH = tous;
      const x = cible && SH.find((y) => y.id === cible);
      // short demandé hors du filtre choisi : on revient à « Pour vous »
      if (x && filtreShorts !== "tout" && !(filtreShorts === "aimes" ? aimes.a(x.id) : x.niveau === filtreShorts)) choisir("tout");
      remplir(x ? x.id : "");
      if (!memoire.lire("mission.shorts.astuce", "")) montrerAstuce();
      if (document.fonts) document.fonts.ready.then(() => { if (!signal.aborted) flux.querySelectorAll(".short").forEach(ajuster); });
    }).catch(() => {
      if (signal.aborted) return;
      flux.setAttribute("aria-busy", "false");
      flux.innerHTML = `<div class="shorts-vide"><p>Les shorts n’ont pas pu être chargés. Vérifiez la connexion, puis réessayez.</p>
        <button type="button" class="shorts-bouton" data-recharger>Réessayer</button></div>`;
    });

    app.addEventListener("click", (ev) => {
      const f = ev.target.closest("[data-filtre]");
      if (f) {
        choisir(f.dataset.filtre);
        remplir("");
        history.replaceState(null, "", "#/shorts");
        return;
      }
      if (ev.target.closest("[data-recharger]")) { shortsPage(cible); return; }
      if (ev.target.closest("[data-auto]")) { if (auto) arreterAuto(); else demarrerAuto(); return; }
      const carte = ev.target.closest(".short");
      const x = carte && SH.find((y) => y.id === carte.dataset.id);
      if (!x) return;
      const ec = ev.target.closest("[data-ecouter-short]");
      if (ec) {
        if (ec.getAttribute("aria-pressed") === "true") { arreterAuto(); arreterParole(); return; }
        arreterAuto();
        marquerEcoute(carte, true);
        parler(texteAOreille(x), () => marquerEcoute(carte, false));
        return;
      }
      const aimer = ev.target.closest("[data-aimer]");
      if (aimer) {
        const oui = aimes.basculer(x.id);
        aimer.setAttribute("aria-pressed", String(oui));
        aimer.classList.remove("bat");
        if (oui) { void aimer.offsetWidth; aimer.classList.add("bat"); }
        return;
      }
      const p = ev.target.closest("[data-partager-short]");
      if (p) { arreterAuto(); feuillePartage(x, p); }
    }, { signal });
    // les images à partager se préparent dès que le doigt touche le bouton
    app.addEventListener("pointerdown", (ev) => {
      const p = ev.target.closest("[data-partager-short]");
      const carte = p && p.closest(".short");
      const x = carte && SH.find((y) => y.id === carte.dataset.id);
      if (x) { fichierShort(x, "story").catch(() => {}); fichierShort(x, "carre").catch(() => {}); }
    }, { signal });
    signal.addEventListener("abort", fermerFeuille);
    // au clavier : flèches, Page suivante, j et k
    document.addEventListener("keydown", (ev) => {
      if (ev.altKey || ev.ctrlKey || ev.metaKey || (ev.target.closest && ev.target.closest("input, textarea, select"))) return;
      const sens = { ArrowDown: 1, PageDown: 1, j: 1, ArrowUp: -1, PageUp: -1, k: -1 }[ev.key];
      if (!sens) return;
      ev.preventDefault();
      flux.scrollBy({ top: sens * flux.clientHeight, behavior: mouvementReduit() ? "auto" : "smooth" });
    }, { signal });
    let attente = 0;
    window.addEventListener("resize", () => {
      clearTimeout(attente);
      attente = setTimeout(() => flux.querySelectorAll(".short").forEach(ajuster), 150);
    }, { signal });
    return true;
  }

  // partager un short : une image (comme une carte de verset) avec le lien de l’étude
  const imagesShorts = new Map();
  const chargerImage = (src) => new Promise((ok, ko) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = ko;
    i.src = src;
  });
  const insecables = (t) => t.replace(/ ([:?!;»])/g, " $1").replace(/« /g, "« ");
  function couper(g, texte, largeur) {
    const lignes = [];
    for (const para of insecables(texte).split("\n")) {
      let ligne = "";
      for (const mot of para.split(" ")) {
        const essai = ligne ? `${ligne} ${mot}` : mot;
        if (ligne && g.measureText(essai).width > largeur) { lignes.push(ligne); ligne = mot; } else ligne = essai;
      }
      lignes.push(ligne);
    }
    return lignes;
  }
  function arrondi(g, x, y, l, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + l, y, x + l, y + h, r);
    g.arcTo(x + l, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + l, y, r);
    g.closePath();
  }
  // l’image d’un short : « carre » (1080 × 1350, pour une publication ou un message)
  // ou « story » (1080 × 1920 ; en haut et en bas, l’application met son nom et le champ de réponse : on y laisse de la place)
  async function imageShort(x, format) {
    const story = format === "story";
    const L = 1080, H = story ? 1920 : 1350, M = 84;
    const HAUT = story ? 200 : M, BAS = story ? 240 : M;
    const c = document.createElement("canvas");
    c.width = L;
    c.height = H;
    const g = c.getContext("2d");
    if (document.fonts) {
      await Promise.all(['600 60px "Alegreya"', '400 36px "Atkinson Hyperlegible"', '700 30px "Atkinson Hyperlegible"']
        .map((f) => document.fonts.load(f))).catch(() => {});
    }
    const [photo, symbole] = await Promise.all([x.img ? chargerImage(imgShort(x.img)).catch(() => null) : null,
      chargerImage("assets/icones/adventiste-blanc.svg").catch(() => null)]);
    g.fillStyle = "#0f2321";
    g.fillRect(0, 0, L, H);
    if (photo) {
      if (story && photo.height > photo.width) {
        // peinture verticale : elle remplit toute la story
        const k = Math.max(L / photo.width, H / photo.height);
        g.drawImage(photo, (L - photo.width * k) / 2, (H - photo.height * k) * 0.3, photo.width * k, photo.height * k);
      } else g.drawImage(photo, 0, 0, L, (L * photo.height) / photo.width);
    } else {
      // sans photo : le dégradé et le pictogramme de l’étape, comme à l’écran
      const fond = g.createLinearGradient(0, 0, L, H);
      fond.addColorStop(0, "#2f6b5e");
      fond.addColorStop(1, "#0f2321");
      g.fillStyle = fond;
      g.fillRect(0, 0, L, H);
      const motif = document.getElementById(PICTOS[x.niveau]);
      const svg = motif && `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${motif.getAttribute("viewBox")}" color="#8fc9b6">${motif.innerHTML}</svg>`;
      const dessin = svg && await chargerImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`).catch(() => null);
      if (dessin) {
        g.globalAlpha = 0.16;
        g.drawImage(dessin, L - 620, HAUT - 24, 680, 680);
        g.globalAlpha = 1;
      }
    }
    const voile = g.createLinearGradient(0, 0, 0, H);
    voile.addColorStop(0, "rgba(15,35,33,0.5)");
    voile.addColorStop(story ? 0.32 : 0.28, "rgba(15,35,33,0.38)");
    voile.addColorStop(story ? 0.6 : 0.58, "rgba(15,35,33,0.94)");
    voile.addColorStop(1, "#0f2321");
    g.fillStyle = voile;
    g.fillRect(0, 0, L, H);
    g.textBaseline = "alphabetic";
    g.fillStyle = "#fff";
    // en haut : la série et l’étude
    g.font = '700 32px "Atkinson Hyperlegible", sans-serif';
    g.fillText(couper(g, x.serie.titre, L - 2 * M)[0], M, HAUT + 28);
    g.font = '400 29px "Atkinson Hyperlegible", sans-serif';
    g.globalAlpha = 0.82;
    g.fillText(couper(g, ouShort(x.lecon), L - 2 * M)[0], M, HAUT + 72);
    g.globalAlpha = 1;
    // en bas : la signature
    const bas = H - BAS;
    if (symbole) g.drawImage(symbole, M, bas - 38, 44, 40);
    g.font = '700 30px "Atkinson Hyperlegible", sans-serif';
    g.fillText("Mission", M + 60, bas - 8);
    const lm = g.measureText("Mission  ").width;
    g.font = '400 28px "Atkinson Hyperlegible", sans-serif';
    g.globalAlpha = 0.82;
    g.fillText("mission.ka-ilei.com", M + 60 + lm, bas - 8);
    g.globalAlpha = 1;
    // au milieu, posés sur la signature : l’idée, puis le verset ; plus petits s’ils ne tiennent pas
    const large = L - 2 * M;
    let k = story ? 1.12 : 1, idee, vers, hIdee, hVers, total;
    for (let essai = 0; essai < 9; essai++, k *= 0.93) {
      g.font = `600 ${Math.round(62 * k)}px "Alegreya", serif`;
      idee = couper(g, x.i, large);
      g.font = `400 ${Math.round(36 * k)}px "Atkinson Hyperlegible", sans-serif`;
      vers = couper(g, x.t, large - 80);
      hIdee = idee.length * 72 * k;
      hVers = vers.length * 51 * k + 30 * k + 22 + 80;
      total = hIdee + 48 + hVers;
      if (bas - 90 - total >= HAUT + 140) break;
    }
    let y = bas - 90 - total;
    g.font = `600 ${Math.round(62 * k)}px "Alegreya", serif`;
    idee.forEach((t, i) => g.fillText(t, M, y + (i + 0.78) * 72 * k));
    y += hIdee + 48;
    g.fillStyle = "rgba(255,255,255,0.11)";
    arrondi(g, M, y, large, hVers, 28);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.16)";
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.94)";
    g.font = `400 ${Math.round(36 * k)}px "Atkinson Hyperlegible", sans-serif`;
    vers.forEach((t, i) => g.fillText(t, M + 40, y + 40 + (i + 0.78) * 51 * k));
    g.fillStyle = "#f0c24b";
    g.font = `700 ${Math.round(31 * k)}px "Atkinson Hyperlegible", sans-serif`;
    g.fillText(insecables(x.r), M + 40, y + 40 + vers.length * 51 * k + 22 + 26 * k);
    return new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("image"))), "image/jpeg", 0.9));
  }
  function fichierShort(x, format) {
    const cle = `${x.id}|${format}`;
    if (!imagesShorts.has(cle)) {
      const nom = `mission-${x.s}-${x.n + 1}${format === "story" ? "-story" : ""}.jpg`;
      const p = imageShort(x, format).then((b) => new File([b], nom, { type: "image/jpeg" }));
      p.catch(() => imagesShorts.delete(cle));
      imagesShorts.set(cle, p);
    }
    return imagesShorts.get(cle);
  }
  // lien à partager : une petite page avec son aperçu (titre, phrase, image), qui ouvre le site (p/, outils/partage/)
  const lienPartage = (chemin) => new URL(`p/${chemin.split("/").map(encodeURIComponent).join("/")}.html`, document.baseURI).href;
  const peutPartagerFichier = () => {
    if (!navigator.canShare) return false;
    try { return navigator.canShare({ files: [new File(["x"], "x.jpg", { type: "image/jpeg" })] }); } catch (e) { return false; }
  };
  async function partagerShort(x, format, bouton) {
    const lien = lienPartage(x.f);
    const texte = `${x.i}\n${x.r}`;
    bouton.setAttribute("aria-busy", "true");
    try {
      if (format === "lien") {
        if (navigator.share) await navigator.share({ title: x.lecon.titre, text: texte, url: lien });
        else await copierTexte(`${texte}\n${lien}`);
        return true;
      }
      const fichier = await fichierShort(x, format);
      if (peutPartagerFichier() && navigator.canShare({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: x.lecon.titre, text: `${texte}\n${lien}` });
      } else {
        // pas de partage de fichiers (ordinateur) : l’image est enregistrée
        const a = document.createElement("a");
        a.href = URL.createObjectURL(fichier);
        a.download = fichier.name;
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        bulle("Image enregistrée dans vos téléchargements");
      }
      return true;
    } catch (e) {
      if (e && e.name === "AbortError") return true;
      // le partage demande un toucher tout frais : l’image est prête, un second toucher suffit
      if (e && e.name === "NotAllowedError") { bulle("L’image est prête : touchez encore."); return false; }
      bulle("Le partage n’a pas abouti.");
      return false;
    } finally {
      bouton.removeAttribute("aria-busy");
    }
  }
  // le choix du partage, en bas de l’écran : story, image ou lien
  let feuille = null;
  function fermerFeuille() {
    if (!feuille) return;
    const { voile, boite, retour } = feuille;
    feuille = null;
    voile.remove();
    boite.remove();
    if (retour && retour.isConnected) retour.focus({ preventScroll: true });
  }
  function feuillePartage(x, retour) {
    fermerFeuille();
    fichierShort(x, "story").catch(() => {});
    fichierShort(x, "carre").catch(() => {});
    const fichiers = peutPartagerFichier();
    const voile = document.createElement("div");
    voile.className = "feuille-voile";
    const boite = document.createElement("div");
    boite.className = "feuille";
    boite.setAttribute("role", "dialog");
    boite.setAttribute("aria-modal", "true");
    boite.setAttribute("aria-labelledby", "feuille-titre");
    boite.innerHTML = `<p class="feuille-titre" id="feuille-titre">Partager ce short</p>
      <button type="button" class="feuille-choix" data-format="story">${icone.story}<span>${fichiers ? "En story" : "Enregistrer la story"}<small>Image verticale : statut WhatsApp, story Facebook ou Instagram</small></span></button>
      <button type="button" class="feuille-choix" data-format="carre">${icone.image}<span>${fichiers ? "En image" : "Enregistrer l’image"}<small>Pour un message ou une publication</small></span></button>
      <button type="button" class="feuille-choix" data-format="lien">${icone.lien}<span>${navigator.share ? "Le lien seulement" : "Copier le lien"}<small>Il ouvre l’étude, avec un aperçu</small></span></button>
      <button type="button" class="feuille-annuler" data-fermer-feuille>Annuler</button>`;
    document.body.append(voile, boite);
    feuille = { voile, boite, retour };
    voile.addEventListener("click", fermerFeuille);
    boite.addEventListener("keydown", (ev) => { if (ev.key === "Escape") fermerFeuille(); });
    boite.addEventListener("click", async (ev) => {
      if (ev.target.closest("[data-fermer-feuille]")) { fermerFeuille(); return; }
      const b = ev.target.closest("[data-format]");
      if (!b || b.getAttribute("aria-busy")) return;
      if (await partagerShort(x, b.dataset.format, b)) fermerFeuille();
    });
    boite.querySelector("[data-format]").focus();
  }
  function bulle(texte) {
    let b = document.querySelector(".bulle");
    if (!b) {
      b = document.createElement("div");
      b.className = "bulle";
      b.setAttribute("role", "status");
      document.body.append(b);
    }
    b.textContent = texte;
    b.classList.add("visible");
    clearTimeout(bulle.minuterie);
    bulle.minuterie = setTimeout(() => b.classList.remove("visible"), 3500);
  }

  // barre d’onglets, en bas sur téléphone
  function majOnglets(page) {
    const actif = !page ? "accueil" : page === "shorts" ? "shorts" : page === "chercher" ? "chercher" : "";
    document.querySelectorAll(".onglets a").forEach((a) => {
      if (a.dataset.onglet === actif) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    const lecture = document.querySelector('.onglets [data-onglet="lecture"]');
    const c = lecture && cibleReprise();
    if (lecture) {
      lecture.hidden = !c;
      if (c) lecture.setAttribute("href", `#/lire/${c.f}`);
    }
  }
  // document ouvert depuis les shorts : son bouton retour y ramène
  let retourShorts = null;
  const lienRetour = (s, f) => (retourShorts === f
    ? `<a class="lecteur-retour" href="#/shorts/${esc(f)}" aria-label="Retour aux shorts">${chevron}<span>Shorts</span></a>`
    : `<a class="lecteur-retour" href="#/serie/${s.id}" aria-label="Retour à la série ${esc(s.titre)}">${chevron}<span>${fr(s.titre)}</span></a>`);

  // ---------- petit groupe : déroulé de la rencontre, binômes, bilan (#/groupe) ----------
  // tout reste sur l’appareil du leader (mission.groupe…) : rien ne part tant qu’il ne partage pas
  const ETAPES_RENCONTRE = [
    { id: "accueil", nom: "Accueil", min: 5, aide: "On s’installe et on prend des nouvelles les uns des autres." },
    { id: "priere", nom: "Prière", min: 3, aide: "Une prière pour ouvrir la rencontre." },
    { id: "versets", nom: "Vérification des versets par binômes", min: 7,
      aide: "Chaque binôme vérifie le verset de la semaine : l’un le récite, l’autre suit sur la carte." },
    { id: "partage", nom: "Retour en groupe pour le partage", min: 20,
      aide: "Un simple retour sur la semaine avec le fascicule. Pas d’étude biblique : la lecture et les questions se font à la maison." },
    { id: "priere-partage", nom: "Prière pour clore le partage", min: 5, aide: "On prie pour ce qui a été partagé." },
    { id: "carte", nom: "Le nouveau verset sur les cartes", min: 5,
      aide: "Chacun écrit sur sa carte le verset de l’étude suivante, pris dans son fascicule, puis la plastifie et la met sur l’anneau." },
    { id: "binomes", nom: "Les nouveaux binômes", min: 2,
      aide: "Toujours un frère avec un frère, une sœur avec une sœur. Ils s’appellent dans la semaine pour prendre des nouvelles et prier ; le leader appelle aussi chacun." },
    { id: "separation", nom: "Prière de séparation", min: 3, aide: "On se quitte dans la prière." },
  ];
  const ONGLETS_GROUPE = [["rencontre", "Rencontre"], ["binomes", "Binômes"], ["bilan", "Bilan"], ["membres", "Le groupe"]];
  const lireJson = (cle, defaut, ok) => {
    try { const v = JSON.parse(memoire.lire(cle, "null")); return v !== null && ok(v) ? v : defaut; } catch (e) { return defaut; }
  };
  const groupe = {
    lire: () => lireJson("mission.groupe", {}, (g) => typeof g === "object" && !Array.isArray(g)),
    maj(f) { const g = this.lire(); f(g); memoire.ecrire("mission.groupe", JSON.stringify(g)); return g; },
  };
  const membresDe = (g) => (Array.isArray(g.membres) ? g.membres.filter((m) => m && m.nom && (m.s === "f" || m.s === "s")) : []);
  const dureesDe = (g) => ETAPES_RENCONTRE.map((e) => {
    const v = g.durees && Number(g.durees[e.id]);
    return v >= 1 && v <= 90 ? Math.round(v) : e.min;
  });
  // la rencontre en cours : { debut, etape, ecoule: [ms par étape], depuis: ms|null (null = en pause), fin }
  const rencontre = {
    // une rencontre restée ouverte plus de 12 h (minuteur oublié) est laissée de côté
    lire: () => lireJson("mission.groupe.rencontre", null, (r) => Array.isArray(r.ecoule) && r.ecoule.length === ETAPES_RENCONTRE.length
      && (r.fin || Date.now() - r.debut < 12 * 3600000)),
    ecrire: (r) => memoire.ecrire("mission.groupe.rencontre", JSON.stringify(r)),
  };
  const ecouleEtape = (r, i, t) => r.ecoule[i] + (r.depuis && r.etape === i ? t - r.depuis : 0);
  const ecouleTotal = (r, t) => r.ecoule.reduce((a, b) => a + b, 0) + (r.depuis ? t - r.depuis : 0);
  const bilans = {
    lire: () => lireJson("mission.groupe.bilans", [], (b) => Array.isArray(b)),
    ajouter(b) {
      const liste = this.lire().filter((x) => x.date !== b.date);
      memoire.ecrire("mission.groupe.bilans", JSON.stringify([b, ...liste].slice(0, 40)));
    },
  };
  const dateIso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dateLongue = (iso) => {
    const [a, m, j] = String(iso).split("-").map(Number);
    if (!a || !m || !j) return "";
    const t = new Date(a, m - 1, j).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const heureFr = (t) => { const d = new Date(t); return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`; };
  const minSec = (ms, versLeHaut) => {
    const s = Math.max(0, versLeHaut ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const listeNoms = (noms) => (noms.length < 2 ? noms.join("") : `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`);
  const numeroWhatsApp = (tel) => {
    let n = String(tel || "").replace(/\D/g, "");
    if (/^[48]\d{7}$/.test(n)) n = "689" + n; // numéro de Polynésie écrit sans l’indicatif
    return n.length >= 8 ? n : "";
  };
  const lienWhatsApp = (texte, tel) => `https://wa.me/${numeroWhatsApp(tel)}?text=${encodeURIComponent(texte)}`;
  async function copierTexte(texte) {
    try {
      await navigator.clipboard.writeText(texte);
    } catch (e) {
      const t = document.createElement("textarea");
      t.value = texte;
      t.setAttribute("readonly", "");
      t.style.cssText = "position:fixed;top:0;opacity:0";
      document.body.append(t);
      t.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { /* rien */ }
      t.remove();
      if (!ok) { bulle("Copie impossible sur ce navigateur"); return false; }
    }
    bulle("Texte copié : collez-le dans WhatsApp ou Messenger");
    return true;
  }
  async function partagerTexte(texte) {
    if (navigator.share) {
      try { await navigator.share({ text: texte }); return true; } catch (e) { if (e && e.name === "AbortError") return false; }
    }
    return copierTexte(texte);
  }

  // binômes : à tour de rôle (méthode du cercle), séparément entre frères et entre sœurs ;
  // nombre impair : le dernier rejoint un binôme (trio), un autre chaque semaine
  function tournoi(n) {
    const ids = [...Array(n).keys()];
    if (n % 2) ids.push(-1);
    const m = ids.length;
    const tours = [];
    for (let t = 0; t < m - 1; t++) {
      const paires = [];
      for (let i = 0; i < m / 2; i++) paires.push([ids[i], ids[m - 1 - i]]);
      tours.push(paires);
      ids.splice(1, 0, ids.pop());
    }
    return tours;
  }
  function binomesDe(membres, tour) {
    const sortie = [];
    ["f", "s"].forEach((genre) => {
      const liste = membres.filter((m) => m.s === genre);
      if (!liste.length) return;
      if (liste.length === 1) { sortie.push({ genre, noms: [liste[0].nom], seul: true }); return; }
      const tours = tournoi(liste.length);
      const groupes = [];
      let reste = null;
      tours[tour % tours.length].forEach(([a, b]) => {
        if (a < 0 || b < 0) reste = liste[a < 0 ? b : a];
        else groupes.push([liste[a], liste[b]]);
      });
      if (reste) groupes[tour % groupes.length].push(reste);
      groupes.forEach((g) => sortie.push({ genre, noms: g.sort((x, y) => liste.indexOf(x) - liste.indexOf(y)).map((m) => m.nom) }));
    });
    return sortie;
  }
  const tourDe = (g) => Math.max(0, Math.floor(Number(g.tour) || 0));
  function texteBinomes(g) {
    const liste = binomesDe(membresDe(g), tourDe(g));
    return [`*Binômes de la semaine${g.nom ? ` — ${g.nom}` : ""}*`,
      ...liste.map((b) => `• ${listeNoms(b.noms)}${b.seul ? " (le leader l’appelle)" : ""}`),
      "", "Appelez-vous dans la semaine pour prendre des nouvelles et prier ensemble."].join("\n");
  }
  function blocBinomes(g, dansRencontre) {
    const membres = membresDe(g);
    if (membres.length < 2) {
      return `<p class="grp-vide">Ajoutez d’abord les membres du groupe, frère ou sœur : les binômes se font tout seuls.
        <a href="#/groupe/membres">Ajouter les membres ›</a></p>`;
    }
    const tour = tourDe(g);
    const liste = binomesDe(membres, tour);
    return `<div class="binomes-bloc">
      <p class="binomes-semaine">Semaine ${tour + 1}</p>
      <ul class="binomes">${liste.map((b) => `<li class="binome ${b.genre === "f" ? "freres" : "soeurs"}${b.seul ? " seul" : ""}">
          <span class="binome-genre">${b.genre === "f" ? "Frères" : "Sœurs"}</span>
          <span class="binome-noms">${esc(listeNoms(b.noms))}</span>
          ${b.seul ? `<span class="binome-note">${b.genre === "f" ? "Seul frère" : "Seule sœur"} du groupe : le leader l’appelle dans la semaine.</span>` : ""}
        </li>`).join("")}</ul>
      <div class="grp-boutons">
        <button type="button" class="doc principal" data-binomes="+1">${icone.groupe}Faire les nouveaux binômes</button>
        ${dansRencontre ? "" : `<button type="button" class="doc" data-binomes="partager">${icone.partager}Envoyer au groupe</button>`}
        ${tour > 0 ? '<button type="button" class="grp-lien" data-binomes="-1">Revenir aux précédents</button>' : ""}
      </div>
    </div>`;
  }
  function actionBinomes(quoi) {
    if (quoi === "partager") { partagerTexte(texteBinomes(groupe.lire())); return false; }
    groupe.maj((g) => { g.tour = Math.max(0, tourDe(g) + (quoi === "+1" ? 1 : -1)); });
    bulle(quoi === "+1" ? "Voici les binômes de la semaine" : "Binômes précédents");
    return true;
  }

  // garder l’écran allumé pendant la rencontre
  let verrouEcran = null;
  async function garderEcran(oui) {
    try {
      if (oui && !verrouEcran && "wakeLock" in navigator && document.visibilityState === "visible") {
        verrouEcran = await navigator.wakeLock.request("screen");
        verrouEcran.addEventListener("release", () => { verrouEcran = null; });
      } else if (!oui && verrouEcran) {
        const v = verrouEcran;
        verrouEcran = null;
        await v.release();
      }
    } catch (e) { verrouEcran = null; }
  }

  function actionRencontre(quoi) {
    const t = Date.now();
    let r = rencontre.lire();
    const arreter = () => { if (r.depuis) { r.ecoule[r.etape] += t - r.depuis; r.depuis = null; } };
    if (quoi === "commencer") r = { debut: t, etape: 0, ecoule: ETAPES_RENCONTRE.map(() => 0), depuis: t, fin: null };
    else if (!r) return;
    else if (quoi === "pause") arreter();
    else if (quoi === "reprendre") { if (!r.fin && !r.depuis) r.depuis = t; }
    else if (quoi === "suivante" || quoi === "precedente") {
      const enMarche = !!r.depuis;
      arreter();
      r.etape = Math.max(0, Math.min(ETAPES_RENCONTRE.length - 1, r.etape + (quoi === "suivante" ? 1 : -1)));
      if (enMarche) r.depuis = t;
    } else if (quoi === "terminer") { arreter(); r.fin = t; }
    else if (quoi === "effacer") r = null;
    rencontre.ecrire(r);
  }

  const CIRCONFERENCE = 2 * Math.PI * 52;
  const signales = new Set(); // étapes déjà signalées (vibration) quand leur temps est écoulé
  function ongletRencontre(zone, signal) {
    const dessiner = () => {
      const g = groupe.lire();
      const r = rencontre.lire();
      const durees = dureesDe(g);
      const prevu = durees.reduce((a, b) => a + b, 0);
      if (!r) {
        zone.innerHTML = `
          <p class="grp-intro">Le cadre : <strong>45 min à 1 h</strong>, un simple retour sur la semaine avec le fascicule. Réglez les durées si besoin, puis lancez le minuteur au début de la rencontre : l’écran reste allumé.</p>
          <ol class="rv-etapes">${ETAPES_RENCONTRE.map((e, i) => `
            <li class="rv-etape">
              <span class="rv-num" aria-hidden="true">${i + 1}</span>
              <span class="rv-nom">${fr(e.nom)}</span>
              <span class="rv-duree" role="group" aria-label="Durée de l’étape ${i + 1}">
                <button type="button" data-duree="${i}" data-pas="-1" aria-label="Une minute de moins"${durees[i] <= 1 ? " disabled" : ""}>${icone.moins}</button>
                <span class="rv-min"><strong>${durees[i]}</strong> min</span>
                <button type="button" data-duree="${i}" data-pas="1" aria-label="Une minute de plus"${durees[i] >= 90 ? " disabled" : ""}>${icone.plus}</button>
              </span>
            </li>`).join("")}</ol>
          <p class="rv-prevu${prevu > 60 || prevu < 45 ? " hors-cadre" : ""}">Durée prévue : <strong>${prevu} min</strong>${
            prevu > 60 ? " : plus d’une heure" : prevu < 45 ? " : moins de 45 min" : ""}</p>
          <div class="grp-boutons">
            <button type="button" class="doc principal grp-grand" data-rv="commencer">${icone.jouer}Commencer la rencontre</button>
            ${g.durees ? '<button type="button" class="grp-lien" data-rv="defaut">Remettre les durées de départ</button>' : ""}
          </div>`;
        return;
      }
      if (r.fin) {
        const total = Math.round(ecouleTotal(r, r.fin) / 60000);
        zone.innerHTML = `
          <div class="rv-finie">
            <p class="rv-finie-titre">${icone.coche}Rencontre terminée</p>
            <p class="rv-finie-texte"><strong>${total} min</strong> pour ${prevu} min prévues${r.debut ? `, de ${heureFr(r.debut)} à ${heureFr(r.fin)}` : ""}.</p>
            <ol class="rv-bilan-etapes">${ETAPES_RENCONTRE.map((e, i) => {
              const m = Math.round(r.ecoule[i] / 60000);
              return `<li><span>${fr(e.nom)}</span><span class="${m > durees[i] ? "en-plus" : ""}">${m} min</span></li>`;
            }).join("")}</ol>
            <div class="grp-boutons">
              <a class="doc principal grp-grand" href="#/groupe/bilan">${icone.envoyer}Faire le bilan</a>
              <button type="button" class="doc" data-rv="effacer">Nouvelle rencontre</button>
            </div>
          </div>`;
        return;
      }
      const i = r.etape;
      const e = ETAPES_RENCONTRE[i];
      const dernier = i === ETAPES_RENCONTRE.length - 1;
      const pause = !r.depuis;
      zone.innerHTML = `
        <div class="rv-encours${pause ? " en-pause" : ""}">
          <p class="rv-haut"><span>Étape ${i + 1} sur ${ETAPES_RENCONTRE.length}</span><span class="rv-fin-prevue"></span></p>
          <div class="rv-cadran">
            <svg class="rv-anneau" viewBox="0 0 120 120" aria-hidden="true">
              <circle class="rv-anneau-fond" cx="60" cy="60" r="52"/>
              <circle class="rv-anneau-avance" cx="60" cy="60" r="52" stroke-dasharray="${CIRCONFERENCE.toFixed(1)}"/>
            </svg>
            <p class="rv-temps"><span class="rv-reste" role="timer" aria-live="off"></span><span class="rv-sur">${pause ? "En pause" : `sur ${durees[i]} min`}</span></p>
          </div>
          <h2 class="rv-titre">${fr(e.nom)}</h2>
          <p class="rv-aide">${fr(e.aide)}</p>
          ${e.id === "binomes" ? blocBinomes(g, true) : ""}
          <div class="rv-commandes">
            <button type="button" class="rv-rond" data-rv="precedente" aria-label="Étape précédente"${i === 0 ? " disabled" : ""}>${chevron}</button>
            <button type="button" class="rv-rond" data-rv="${pause ? "reprendre" : "pause"}" aria-label="${pause ? "Reprendre" : "Pause"}">${pause ? icone.jouer : icone.pause}</button>
            <button type="button" class="doc principal rv-suivante" data-rv="${dernier ? "terminer" : "suivante"}">${dernier ? "Terminer la rencontre" : "Étape suivante"}${chevronDroit}</button>
          </div>
          <ol class="rv-fil" aria-label="Les étapes">${ETAPES_RENCONTRE.map((x, k) => `<li class="${k < i ? "passee" : k === i ? "courante" : ""}"${k === i ? ' aria-current="step"' : ""}>
              <span class="rv-fil-nom">${fr(x.nom)}</span><span class="rv-fil-min">${k < i ? `${Math.round(r.ecoule[k] / 60000)} min` : `${durees[k]} min`}</span></li>`).join("")}</ol>
          <p class="rv-total"></p>
          ${dernier ? "" : '<button type="button" class="grp-lien rv-arreter" data-rv="arreter">Terminer la rencontre maintenant</button>'}
        </div>`;
      majRencontre(zone);
    };
    dessiner();
    zone.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-rv], [data-duree], [data-binomes]");
      if (!b || b.disabled) return;
      if (b.dataset.binomes) { if (actionBinomes(b.dataset.binomes)) dessiner(); return; }
      if (b.dataset.duree) {
        const i = Number(b.dataset.duree);
        groupe.maj((g) => {
          const d = dureesDe(g);
          g.durees = Object.fromEntries(ETAPES_RENCONTRE.map((x, k) => [x.id, k === i ? Math.max(1, Math.min(90, d[k] + Number(b.dataset.pas))) : d[k]]));
        });
        dessiner();
        return;
      }
      let quoi = b.dataset.rv;
      if (quoi === "defaut") { groupe.maj((g) => { delete g.durees; }); dessiner(); return; }
      if (quoi === "arreter") {
        // terminer avant la dernière étape : on demande de toucher une seconde fois
        if (!b.dataset.confirme) {
          b.dataset.confirme = "1";
          b.textContent = "Toucher encore pour terminer la rencontre";
          setTimeout(() => { if (b.isConnected) { delete b.dataset.confirme; b.textContent = "Terminer la rencontre maintenant"; } }, 4000);
          return;
        }
        quoi = "terminer";
      }
      actionRencontre(quoi);
      const r = rencontre.lire();
      garderEcran(!!(r && !r.fin));
      dessiner();
      if (quoi !== "pause" && quoi !== "reprendre") zone.scrollIntoView({ block: "start", behavior: mouvementReduit() ? "auto" : "smooth" });
    }, { signal });
    const minuterie = setInterval(() => majRencontre(zone), 500);
    signal.addEventListener("abort", () => clearInterval(minuterie));
  }
  function majRencontre(zone) {
    const r = rencontre.lire();
    const reste = zone.querySelector(".rv-reste");
    if (!r || r.fin || !reste) return;
    const t = Date.now();
    const durees = dureesDe(groupe.lire());
    const i = r.etape;
    const prevu = durees[i] * 60000;
    const passe = ecouleEtape(r, i, t);
    const restant = prevu - passe;
    reste.textContent = restant >= 0 ? minSec(restant, true) : `+${minSec(-restant)}`;
    zone.querySelector(".rv-encours").classList.toggle("depasse", restant < 0);
    const anneau = zone.querySelector(".rv-anneau-avance");
    anneau.style.strokeDashoffset = String(CIRCONFERENCE * (1 - Math.min(1, passe / prevu)));
    anneau.style.opacity = passe > 1000 ? "1" : "0"; // pas de point rond au départ
    const total = ecouleTotal(r, t);
    const prevuTotal = durees.reduce((a, b) => a + b, 0);
    zone.querySelector(".rv-total").textContent = `Rencontre : ${Math.floor(total / 60000)} min sur ${prevuTotal} prévues`;
    const fin = t + Math.max(0, restant) + durees.slice(i + 1).reduce((a, b) => a + b, 0) * 60000;
    zone.querySelector(".rv-fin-prevue").textContent = r.depuis ? `Fin vers ${heureFr(fin)}` : "";
    const cle = `${r.debut}-${i}`;
    if (restant < 0 && r.depuis && !signales.has(cle)) {
      signales.add(cle);
      if (navigator.vibrate) navigator.vibrate([180, 120, 180]);
    }
  }

  function ongletBinomes(zone, signal) {
    const dessiner = () => {
      zone.innerHTML = `
        <p class="grp-intro">Toujours un frère avec un frère, une sœur avec une sœur. Les binômes changent chaque semaine et s’appellent pour prendre des nouvelles et prier ; le leader appelle aussi chacun.</p>
        ${blocBinomes(groupe.lire(), false)}`;
    };
    dessiner();
    zone.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-binomes]");
      if (b && actionBinomes(b.dataset.binomes)) dessiner();
    }, { signal });
  }

  function ongletMembres(zone, signal) {
    const dessiner = () => {
      const g = groupe.lire();
      const membres = membresDe(g);
      zone.innerHTML = `
        <form class="grp-form" data-reglages autocomplete="off">
          <label class="grp-champ"><span>Nom du groupe</span><input name="nom" value="${esc(g.nom || "")}" maxlength="60" placeholder="Par exemple : groupe de Mataiea"></label>
          <label class="grp-champ"><span>Leader</span><input name="leader" value="${esc(g.leader || "")}" maxlength="40" placeholder="Votre prénom" autocomplete="given-name"></label>
          <label class="grp-champ"><span>WhatsApp du responsable <small>pour envoyer le bilan, facultatif</small></span>
            <input name="tel" type="tel" inputmode="tel" value="${esc(g.tel || "")}" maxlength="22" placeholder="+689 87 12 34 56"></label>
        </form>
        <h2 class="grp-titre">Les membres <span class="grp-compte">${membres.length}</span></h2>
        <p class="grp-note">Ajoutez-vous aussi si vous faites partie des binômes. Les noms restent sur ce téléphone.</p>
        ${membres.length ? `<ul class="membres">${membres.map((m, k) => `<li class="membre">
            <span class="membre-nom">${esc(m.nom)}</span><span class="membre-genre ${m.s === "f" ? "frere" : "soeur"}">${m.s === "f" ? "Frère" : "Sœur"}</span>
            <button type="button" class="membre-retirer" data-retirer="${k}" aria-label="Retirer ${esc(m.nom)} du groupe">${icone.moins}</button>
          </li>`).join("")}</ul>` : ""}
        <form class="membre-ajout" data-ajout autocomplete="off">
          <label class="cache" for="membre-nom">Prénom du nouveau membre</label>
          <input id="membre-nom" name="nom" maxlength="40" placeholder="Prénom" required autocomplete="off">
          <fieldset class="membre-choix"><legend class="cache">Frère ou sœur</legend>
            <label><input type="radio" name="s" value="f" required><span>Frère</span></label>
            <label><input type="radio" name="s" value="s"><span>Sœur</span></label>
          </fieldset>
          <button type="submit" class="doc principal">${icone.plus}Ajouter</button>
        </form>`;
    };
    dessiner();
    zone.addEventListener("input", (ev) => {
      const f = ev.target.form;
      if (!f || !f.hasAttribute("data-reglages")) return;
      groupe.maj((g) => { g.nom = f.nom.value.trim(); g.leader = f.leader.value.trim(); g.tel = f.tel.value.trim(); });
      const h1 = app.querySelector(".page-groupe h1");
      if (h1) h1.textContent = f.nom.value.trim() || "Petit groupe";
    }, { signal });
    zone.addEventListener("submit", (ev) => {
      const f = ev.target;
      if (!f.hasAttribute("data-ajout")) return;
      ev.preventDefault();
      const nom = f.nom.value.trim().replace(/\s+/g, " ");
      const s = f.s.value;
      if (!nom || !s) return;
      groupe.maj((g) => { g.membres = [...membresDe(g), { nom, s }]; });
      dessiner();
      bulle(`${nom} ajouté${s === "s" ? "e" : ""} au groupe`);
      const champ = zone.querySelector("#membre-nom");
      if (champ) champ.focus();
    }, { signal });
    zone.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-retirer]");
      if (!b) return;
      const k = Number(b.dataset.retirer);
      let nom = "";
      groupe.maj((g) => { const l = membresDe(g); nom = (l[k] || {}).nom || ""; l.splice(k, 1); g.membres = l; });
      dessiner();
      if (nom) bulle(`${nom} retiré du groupe`);
    }, { signal });
  }

  // bilan : l’étude proposée est celle qui suit le dernier bilan
  function etudeProposee() {
    const h = bilans.lire()[0];
    if (h && series[h.s] && series[h.s].lecons.length) {
      const s = series[h.s];
      return { s: h.s, i: Math.min(s.lecons.length - 1, (Number(h.i) || 0) + (h.date === dateIso(new Date()) ? 0 : 1)) };
    }
    return { s: "", i: 0 };
  }
  const nomEtude = (l, k) => (l.num ? `Étude ${l.num} · ` : `${k + 1}. `) + l.titre;
  function optionsEtudes(sid, i) {
    const s = series[sid];
    return s ? s.lecons.map((l, k) => `<option value="${k}"${k === i ? " selected" : ""}>${esc(nomEtude(l, k))}</option>`).join("") : "";
  }
  function valeursBilan(f, membres) {
    const presents = [...f.querySelectorAll('input[name="present"]:checked')].map((x) => Number(x.value));
    return {
      date: f.date.value || dateIso(new Date()),
      duree: f.duree.value.trim(),
      s: f.serie.value,
      i: Number(f.etude.value) || 0,
      presents: membres.filter((m, k) => presents.includes(k)).map((m) => m.nom),
      absents: membres.filter((m, k) => !presents.includes(k)).map((m) => m.nom),
      nombre: f.nombre ? Math.max(0, Number(f.nombre.value) || 0) : null,
      visiteurs: Math.max(0, Number(f.visiteurs.value) || 0),
      versets: f.versets.value === "" ? null : Math.max(0, Number(f.versets.value) || 0),
      partage: f.partage.value.trim(),
      priere: f.priere.value.trim(),
    };
  }
  function texteBilan(g, v) {
    const s = series[v.s];
    const l = s && s.lecons[v.i];
    const lignes = [`*Bilan${g.nom ? ` — ${g.nom}` : " du petit groupe"}*`, `${dateLongue(v.date)}${v.duree ? ` · ${v.duree}` : ""}`];
    if (g.leader) lignes.push(`Leader : ${g.leader}`);
    if (l) lignes.push(`Étude : ${s.titre} — ${l.num ? `étude ${l.num}, ` : ""}${l.titre}`);
    const nbPresents = v.nombre !== null ? v.nombre : v.presents.length;
    if (v.nombre === null) {
      const total = v.presents.length + v.absents.length;
      lignes.push(`Présents : ${v.presents.length} sur ${total}${v.presents.length ? ` (${v.presents.join(", ")})` : ""}`);
      if (v.absents.length) lignes.push(`Absents : ${v.absents.join(", ")}`);
    } else lignes.push(`Présents : ${v.nombre}`);
    if (v.visiteurs) lignes.push(`Visiteurs : ${v.visiteurs}`);
    if (v.versets !== null) lignes.push(`Versets récités : ${v.versets}${nbPresents ? ` sur ${nbPresents}` : ""}`);
    if (v.partage) lignes.push("", `Partage : ${v.partage}`);
    if (v.priere) lignes.push("", `Prière et besoins : ${v.priere}`);
    return lignes.join("\n");
  }
  function ongletBilan(zone, signal) {
    const g = groupe.lire();
    const membres = membresDe(g);
    const r = rencontre.lire();
    const aujourdhui = dateIso(new Date());
    const minutes = r && r.fin && dateIso(new Date(r.fin)) === aujourdhui ? Math.round(ecouleTotal(r, r.fin) / 60000) : 0;
    const duree = minutes ? `${minutes} min` : "";
    const choix = etudeProposee();
    const anciens = bilans.lire();
    const optionsSeries = B.niveaux.map((n) => {
      const ss = seriesDe(n.id).filter((s) => s.lecons.length);
      return ss.length ? `<optgroup label="${esc(`${n.num}. ${n.verbe}`)}">${ss.map((s) =>
        `<option value="${s.id}"${s.id === choix.s ? " selected" : ""}>${esc(s.titre)}</option>`).join("")}</optgroup>` : "";
    }).join("");
    zone.innerHTML = `
      <form class="grp-form bilan-form" autocomplete="off">
        <div class="grp-deux">
          <label class="grp-champ"><span>Date</span><input type="date" name="date" value="${aujourdhui}" required></label>
          <label class="grp-champ"><span>Durée</span><input name="duree" value="${esc(duree)}" maxlength="20" placeholder="50 min"></label>
        </div>
        <label class="grp-champ"><span>Série</span><select name="serie"><option value="">Choisir la série…</option>${optionsSeries}</select></label>
        <label class="grp-champ"><span>Étude de la semaine</span><select name="etude"${choix.s ? "" : " disabled"}>${optionsEtudes(choix.s, choix.i)}</select></label>
        <fieldset class="grp-champ bilan-presents"><legend>Présents</legend>
          ${membres.length
            ? `<div class="presents">${membres.map((m, k) => `<label class="present"><input type="checkbox" name="present" value="${k}" checked><span>${esc(m.nom)}</span></label>`).join("")}</div>`
            : `<label class="grp-ligne"><span>Nombre de présents</span><input type="number" name="nombre" min="0" max="99" inputmode="numeric" value=""></label>
               <p class="grp-note">Pour cocher les présents par leur nom, ajoutez les membres dans <a href="#/groupe/membres">Le groupe</a>.</p>`}
          <label class="grp-ligne"><span>Visiteurs</span><input type="number" name="visiteurs" min="0" max="99" inputmode="numeric" value="0"></label>
        </fieldset>
        <label class="grp-ligne"><span>Ont récité leur verset</span><input type="number" name="versets" min="0" max="99" inputmode="numeric" placeholder="nombre"></label>
        <label class="grp-champ"><span>Le partage <small>facultatif</small></span><textarea name="partage" rows="3" maxlength="800" placeholder="Ce qui a touché le groupe, une victoire, une question…"></textarea></label>
        <label class="grp-champ"><span>Prière et besoins <small>facultatif, à partager avec discrétion</small></span><textarea name="priere" rows="3" maxlength="800" placeholder="Sujets de prière, une personne à visiter ou à aider…"></textarea></label>
      </form>
      <div class="bilan-apercu">
        <p class="grp-sous-titre">Le message</p>
        <pre class="bilan-texte"></pre>
      </div>
      ${SCRIPT_MISSION ? `<label class="bilan-tableau"><input type="checkbox" name="tableau"${memoire.lire("mission.groupe.tableau", "1") === "1" ? " checked" : ""}>
          <span>Ranger aussi ce bilan dans le tableau du responsable<small>Il le reçoit dans son Google Sheet ; un bilan corrigé puis renvoyé remplace le précédent.</small></span></label>
        <p class="grp-note bilan-tableau-etat" role="status" hidden></p>` : ""}
      <div class="grp-boutons bilan-envoi">
        <a class="doc principal grp-grand" data-envoi="whatsapp" href="#" target="_blank" rel="noopener">${icone.envoyer}${g.tel && numeroWhatsApp(g.tel) ? "Envoyer au responsable sur WhatsApp" : "Envoyer sur WhatsApp"}</a>
        ${navigator.share ? `<button type="button" class="doc" data-envoi="partager">${icone.partager}Autre application</button>` : ""}
        <button type="button" class="doc" data-envoi="copier">${icone.copier}Copier le texte</button>
      </div>
      ${anciens.length ? `<details class="bilans-anciens"><summary>Bilans déjà faits (${anciens.length})</summary>
        <ul>${anciens.map((b, k) => `<li><span class="bilan-date">${esc(dateLongue(b.date))}</span>
          <span class="bilan-etude">${esc(series[b.s] && series[b.s].lecons[b.i] ? `${series[b.s].titre} — ${nomEtude(series[b.s].lecons[b.i], b.i)}` : "")}</span>
          <button type="button" class="grp-lien" data-ancien="${k}">Copier</button></li>`).join("")}</ul></details>` : ""}`;
    const f = zone.querySelector(".bilan-form");
    const sortie = zone.querySelector(".bilan-texte");
    const whatsapp = zone.querySelector('[data-envoi="whatsapp"]');
    const maj = () => {
      const texte = texteBilan(groupe.lire(), valeursBilan(f, membres));
      sortie.textContent = texte;
      whatsapp.href = lienWhatsApp(texte, groupe.lire().tel);
      return texte;
    };
    maj();
    zone.addEventListener("input", maj, { signal });
    zone.addEventListener("change", (ev) => {
      if (ev.target.name === "serie") {
        f.etude.innerHTML = optionsEtudes(f.serie.value, 0);
        f.etude.disabled = !f.serie.value;
      }
      maj();
    }, { signal });
    const coche = zone.querySelector('input[name="tableau"]');
    const etatTableau = zone.querySelector(".bilan-tableau-etat");
    let dernierEnvoi = "";
    const montrerEtat = (enCours) => {
      if (!etatTableau || !dernierEnvoi) return;
      etatTableau.hidden = false;
      etatTableau.textContent = !enAttente(dernierEnvoi) ? "Rangé dans le tableau du responsable."
        : enCours === true ? "Envoi au tableau du responsable…"
          : "Pas encore arrivé dans le tableau : il partira tout seul dès que la connexion revient.";
    };
    document.addEventListener("mission-envoye", () => montrerEtat(), { signal });
    const garder = () => {
      const v = valeursBilan(f, membres);
      bilans.ajouter({ date: v.date, s: v.s, i: v.i, texte: maj() });
      if (SCRIPT_MISSION && coche && coche.checked) {
        const x = bilanPourTableau(groupe.lire(), v);
        dernierEnvoi = x.id;
        montrerEtat(true);
        envoyerAuTableau(x).then(() => montrerEtat());
      }
    };
    if (coche) coche.addEventListener("change", () => memoire.ecrire("mission.groupe.tableau", coche.checked ? "1" : "0"), { signal });
    zone.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-envoi], [data-ancien]");
      if (!b) return;
      if (b.dataset.ancien) { const a = bilans.lire()[Number(b.dataset.ancien)]; if (a) copierTexte(a.texte); return; }
      garder();
      if (b.dataset.envoi === "partager") { ev.preventDefault(); partagerTexte(maj()); }
      else if (b.dataset.envoi === "copier") { ev.preventDefault(); copierTexte(maj()); }
      // WhatsApp : le lien s’ouvre de lui-même
    }, { signal });
  }

  let groupeAc = null;
  function fermerGroupe() {
    if (groupeAc) { groupeAc.abort(); groupeAc = null; }
    garderEcran(false);
  }
  function groupePage(arg) {
    if (groupeAc) groupeAc.abort();
    const onglet = ONGLETS_GROUPE.some(([id]) => id === arg) ? arg : "rencontre";
    const g = groupe.lire();
    const r = rencontre.lire();
    const enCours = r && !r.fin;
    document.title = `Petit groupe — Mission`;
    app.innerHTML = `
      <div class="page page-groupe">
        ${fil([["Accueil", "#/"], ["Petit groupe"]])}
        <h1 class="titre-page" tabindex="-1">${g.nom ? esc(g.nom) : "Petit groupe"}</h1>
        ${enCours ? "" : '<p class="chapeau grp-chapeau">Pour le leader : le déroulé de la rencontre avec un minuteur, les binômes de la semaine et le bilan à envoyer en une minute.</p>'}
        <nav class="grp-onglets" aria-label="Petit groupe">${ONGLETS_GROUPE.map(([id, nom]) =>
          `<a href="#/groupe/${id}"${id === onglet ? ' aria-current="page"' : ""}>${nom}</a>`).join("")}</nav>
        ${enCours && onglet !== "rencontre" ? `<a class="grp-en-cours" href="#/groupe/rencontre">${icone.horloge}<span>Rencontre en cours : étape ${r.etape + 1}, ${fr(ETAPES_RENCONTRE[r.etape].nom)}</span>${chevronDroit}</a>` : ""}
        <section class="grp-zone" aria-label="${esc(ONGLETS_GROUPE.find(([id]) => id === onglet)[1])}"></section>
      </div>`;
    groupeAc = new AbortController();
    const { signal } = groupeAc;
    const zone = app.querySelector(".grp-zone");
    ({ rencontre: ongletRencontre, binomes: ongletBinomes, bilan: ongletBilan, membres: ongletMembres })[onglet](zone, signal);
    garderEcran(!!enCours);
    // rencontre en cours : le minuteur s’affiche tout de suite, sans avoir à descendre
    if (enCours && onglet === "rencontre") setTimeout(() => { if (!signal.aborted) zone.scrollIntoView({ block: "start" }); }, 0);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      const rr = rencontre.lire();
      garderEcran(!!(rr && !rr.fin));
      majRencontre(zone);
    }, { signal });
    return true;
  }

  // ---------- par où commencer ? trois questions pour trouver sa série (#/commencer) ----------
  const QUESTIONS_DEBUT = [
    { id: "bible", titre: "Où en êtes-vous avec la Bible ?", choix: [
      ["decouvre", "Je la découvre"], ["un-peu", "Je la connais un peu"], ["souvent", "Je la lis depuis longtemps"]] },
    { id: "envie", titre: "Qu’est-ce qui vous attire le plus ?", choix: [
      ["jesus", "Mieux connaître Jésus"], ["questions", "Des réponses aux grandes questions", "La Bible, la mort, le mal, l’avenir"],
      ["propheties", "Les prophéties", "Daniel, l’Apocalypse"], ["vie", "La vie de tous les jours", "Le couple, les enfants, les victoires"],
      ["disciple", "Servir et former des disciples"]] },
    { id: "comment", titre: "Vous allez étudier…", choix: [
      ["seul", "Seul, à mon rythme"], ["deux", "À deux", "Avec quelqu’un qui m’accompagne"], ["groupe", "En petit groupe", "Je l’anime, ou j’y participe"]] },
  ];
  // la série conseillée, puis une autre ; selon ce qu’on connaît de la Bible et ce qui attire
  const PARCOURS = {
    decouvre: { jesus: ["prendre-vie", "vers-jesus"], questions: ["quete-certitude", "fiabilite-bible"], propheties: ["quete-certitude", "historacles"],
      vie: ["prendre-vie", "vivre-avec-jesus"], disciple: ["prendre-vie", "fast-kit-de-survie"] },
    "un-peu": { jesus: ["rencontre-avec-jesus", "cep-sarment"], questions: ["explorateur", "vivre-avec-jesus"], propheties: ["historacles", "daniel"],
      vie: ["vivre-avec-jesus", "excellence"], disciple: ["fast-kit-de-survie", "fast-formation-de-base"] },
    souvent: { jesus: ["cep-sarment", "rencontre-avec-jesus"], questions: ["sanctuaire", "trinite"], propheties: ["daniel", "sanctuaire"],
      vie: ["excellence", "enfants"], disciple: ["disciple-incroyable", "fast-tactiques-d-equipe"] },
  };
  const SELON_SITUATION = ["frequentations", "enfants", "homme-de-dieu", "convoitise", "excellence"];
  function commencerPage() {
    document.title = "Par où commencer ? — Mission";
    const garde = lireJson("mission.commencer", null, (o) => typeof o === "object" && PARCOURS[o.bible] && PARCOURS[o.bible][o.envie]);
    const rep = garde ? { ...garde } : {};
    let etape = garde ? QUESTIONS_DEBUT.length : 0;
    app.innerHTML = `
      <div class="page page-commencer">
        ${fil([["Accueil", "#/"], ["Par où commencer ?"]])}
        <h1 class="titre-page" tabindex="-1">Par où commencer ?</h1>
        <div class="debut" aria-live="polite"></div>
      </div>`;
    const zone = app.querySelector(".debut");
    const montrer = () => {
      if (etape < QUESTIONS_DEBUT.length) {
        const q = QUESTIONS_DEBUT[etape];
        zone.innerHTML = `<p class="debut-etape">Question ${etape + 1} sur ${QUESTIONS_DEBUT.length}</p>
          <span class="progression-barre" aria-hidden="true"><span style="width:${Math.round((etape / QUESTIONS_DEBUT.length) * 100)}%"></span></span>
          <h2 class="debut-question" tabindex="-1">${fr(q.titre)}</h2>
          <div class="debut-choix">${q.choix.map(([id, nom, aide]) => `<button type="button" class="debut-bouton" data-rep="${id}"${rep[q.id] === id ? ' aria-pressed="true"' : ""}>
              <span>${fr(nom)}</span>${aide ? `<small>${fr(aide)}</small>` : ""}</button>`).join("")}</div>
          ${etape ? '<button type="button" class="grp-lien debut-retour" data-debut="retour">Question précédente</button>' : ""}`;
        const h = zone.querySelector(".debut-question");
        if (h && etape) h.focus({ preventScroll: true });
        return;
      }
      memoire.ecrire("mission.commencer", JSON.stringify({ ...rep, date: dateIso(new Date()) }));
      const [id1, id2] = PARCOURS[rep.bible][rep.envie];
      let liste = [id1, id2];
      if (rep.comment === "groupe" && rep.envie === "propheties") liste = [id1, "secrets-prophetie"];
      const [s1, s2] = liste.map((id) => series[id]).filter(Boolean);
      const premiere = s1.lecons.find((l) => !faites.a(l) && docLecon(l)) || s1.lecons[0];
      const d = premiere && docLecon(premiere);
      const autres = rep.envie === "vie" ? SELON_SITUATION.filter((id) => id !== s1.id && (!s2 || id !== s2.id)).map((id) => series[id]).filter(Boolean) : [];
      const conseil = {
        seul: "Lisez une étude à la fois, à votre rythme : vos réponses restent sur votre téléphone, et chaque verset s’ouvre d’un toucher.",
        deux: "Envoyez le lien de la série à la personne qui vous accompagne : vous lirez la même étude, chacun sur son téléphone.",
        groupe: "Chaque étude a sa fiche du participant, et souvent un guide pour l’animateur, avec les réponses.",
      }[rep.comment];
      zone.innerHTML = `<p class="debut-etape">Pour vous</p>
        <h2 class="debut-question" tabindex="-1">${fr(s1.titre)}</h2>
        <a class="debut-serie" href="#/serie/${s1.id}">
          ${image(s1.image, "debut-image")}
          <span class="debut-serie-texte"><span>${fr(s1.texte)}</span><span class="compte">${compteSerie(s1)}</span></span>
        </a>
        <div class="grp-boutons">
          ${d ? `<a class="doc principal grp-grand" ${cible(d)}>${icone.lecture}${faites.nombre(s1) ? "Continuer" : "Commencer"} : ${fr(premiere.num ? `Étude ${premiere.num}` : premiere.titre)}</a>` : ""}
          <a class="doc" href="#/serie/${s1.id}">Voir la série</a>
        </div>
        <p class="debut-conseil">${fr(conseil)}</p>
        ${rep.comment === "deux" ? `<p><a class="doc" href="#/inviter/${s1.id}">${icone.inviter}Inviter la personne qui m’accompagne</a></p>` : ""}
        ${rep.comment === "groupe" ? `<div class="debut-groupe">${carteGroupe()}</div>` : ""}
        ${s2 ? `<h3 class="debut-aussi">Aussi pour vous</h3>
          <a class="debut-autre" href="#/serie/${s2.id}"><strong>${fr(s2.titre)}</strong><span>${fr(s2.texte)}</span>${chevronDroit}</a>` : ""}
        ${autres.length ? `<h3 class="debut-aussi">Selon votre situation</h3>
          <ul class="debut-liste">${autres.map((x) => `<li><a href="#/serie/${x.id}">${fr(x.titre)}</a>${x.note ? ` <span class="cep-serie-note">(${fr(x.note)})</span>` : ""}</li>`).join("")}</ul>` : ""}
        <p><button type="button" class="grp-lien" data-debut="refaire">Refaire les trois questions</button></p>`;
      const h = zone.querySelector(".debut-question");
      if (h && !premiereFois) h.focus({ preventScroll: true });
    };
    let premiereFois = true;
    zone.addEventListener("click", (ev) => {
      premiereFois = false;
      const b = ev.target.closest("[data-rep]");
      if (b) { rep[QUESTIONS_DEBUT[etape].id] = b.dataset.rep; etape += 1; montrer(); return; }
      const a = ev.target.closest("[data-debut]");
      if (!a) return;
      if (a.dataset.debut === "retour") etape = Math.max(0, etape - 1);
      else { etape = 0; Object.keys(rep).forEach((k) => delete rep[k]); try { localStorage.removeItem("mission.commencer"); } catch (e) { /* rien */ } }
      montrer();
    });
    montrer();
    return true;
  }

  // ---------- mon carnet : réponses, passages surlignés et notes de toutes les études (#/carnet) ----------
  // tout vient de l’appareil (mission.rep.*, mission.surl.*) ; les questions sont relues dans le texte des études
  function contenuCarnet() {
    const parDoc = new Map();
    const ajouter = (f) => {
      if (!parDoc.has(f)) parDoc.set(f, { reponses: 0, blancs: 0, coches: 0, surl: [] });
      return parDoc.get(f);
    };
    let cles = [];
    try { cles = Object.keys(localStorage); } catch (e) { cles = []; }
    cles.forEach((k) => {
      if (k.startsWith("mission.rep.")) {
        const reste = k.slice(12);
        const i = reste.lastIndexOf(".");
        const f = reste.slice(0, i);
        const quoi = reste.slice(i + 1);
        const v = memoire.lire(k, "");
        if (!documents.has(f) || !v.trim()) return;
        const x = ajouter(f);
        if (quoi.startsWith("q")) x.reponses += 1;
        else if (quoi.startsWith("b")) x.blancs += 1;
        else if (quoi.startsWith("c") && v === "1") x.coches += 1;
      } else if (k.startsWith("mission.surl.")) {
        const f = k.slice(13);
        if (!documents.has(f)) return;
        const l = surl.lire(f);
        if (l.length) ajouter(f).surl = l;
      }
    });
    const ordre = [...documents.keys()];
    return [...parDoc.entries()].sort((a, b) => ordre.indexOf(a[0]) - ordre.indexOf(b[0]));
  }
  const groupesSurl = (l) => {
    const m = new Map();
    l.forEach((h) => {
      if (!m.has(h.g)) m.set(h.g, { c: h.c, t: [], n: "", date: h.date });
      const x = m.get(h.g);
      x.t.push(h.t);
      if (h.n) x.n = h.n;
    });
    return [...m.values()];
  };
  // les questions et les réponses d’une étude, relues dans son texte
  const textesCarnet = new Map();
  function detailCarnet(f) {
    if (!textesCarnet.has(f)) {
      const p = fetch(`lecture/${f.split("/").map(encodeURIComponent).join("/")}.html?v=${VERSION_LECTURE}`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })
        .then((h) => {
          const a = document.createElement("article");
          a.innerHTML = h;
          ajouterZonesReponse(a, f);
          const propre = (el) => {
            const c = el.cloneNode(true);
            c.querySelectorAll("textarea, .lec-cache, .lec-q-num, input").forEach((x) => x.remove());
            return c.textContent.replace(/\s+/g, " ").trim();
          };
          const qr = [...a.querySelectorAll("textarea[data-q]")].map((t) => {
            const v = memoire.lire(`mission.rep.${f}.q${t.dataset.q}`, "").trim();
            if (!v) return null;
            const q = t.closest(".lec-q");
            const num = q && q.querySelector(".lec-q-num");
            let question = q ? propre(q.querySelector(".lec-q-corps") || q) : "";
            if (!question && t.previousElementSibling) question = propre(t.previousElementSibling);
            return { num: num && /\d/.test(num.textContent) ? num.textContent.trim() : "", question, reponse: v };
          }).filter(Boolean);
          // phrases à compléter : la phrase, avec les mots écrits
          const phrases = [];
          const vus = new Set();
          a.querySelectorAll("input.lec-blanc[data-b]").forEach((t) => {
            const v = memoire.lire(`mission.rep.${f}.b${t.dataset.b}`, "").trim();
            const bloc = t.closest("p, li, td, blockquote") || t.parentElement;
            if (!v || vus.has(bloc)) return;
            vus.add(bloc);
            const c = bloc.cloneNode(true);
            c.querySelectorAll("input.lec-blanc[data-b]").forEach((x) => {
              const w = memoire.lire(`mission.rep.${f}.b${x.dataset.b}`, "").trim();
              const m = document.createElement("strong");
              m.textContent = w || "……";
              x.replaceWith(m);
            });
            c.querySelectorAll("textarea, .lec-cache").forEach((x) => x.remove());
            phrases.push(c.innerHTML.replace(/<(?!\/?strong>)[^>]+>/g, ""));
          });
          return { qr, phrases };
        });
      p.catch(() => textesCarnet.delete(f));
      textesCarnet.set(f, p);
    }
    return textesCarnet.get(f);
  }
  const resumeCarnet = (x) => [
    x.reponses && pluriel(x.reponses, "réponse", "réponses"),
    x.blancs && pluriel(x.blancs, "mot complété", "mots complétés"),
    x.surl.length && pluriel(groupesSurl(x.surl).length, "passage surligné", "passages surlignés"),
    groupesSurl(x.surl).filter((g) => g.n).length && pluriel(groupesSurl(x.surl).filter((g) => g.n).length, "note", "notes"),
  ].filter(Boolean).join(" · ");
  function carnetPage() {
    document.title = "Mon carnet — Mission";
    const docs = contenuCarnet();
    const nbFaites = Object.keys(faites.lire()).length;
    const total = docs.reduce((t, [, x]) => t + x.reponses + x.blancs, 0);
    const passages = docs.reduce((t, [, x]) => t + groupesSurl(x.surl).length, 0);
    app.innerHTML = `
      <div class="page page-carnet">
        ${fil([["Accueil", "#/"], ["Mon carnet"]])}
        <h1 class="titre-page" tabindex="-1">Mon carnet</h1>
        <p class="chapeau">Vos réponses, les passages que vous avez surlignés et vos notes, étude par étude. Tout reste sur ce téléphone : rien n’est envoyé.</p>
        <ul class="carnet-chiffres">
          <li><strong>${docs.length}</strong> ${docs.length > 1 ? "études annotées" : "étude annotée"}</li>
          <li><strong>${total}</strong> ${total > 1 ? "réponses" : "réponse"}</li>
          <li><strong>${passages}</strong> ${passages > 1 ? "passages surlignés" : "passage surligné"}</li>
          <li><strong>${nbFaites}</strong> ${nbFaites > 1 ? "études terminées" : "étude terminée"}</li>
        </ul>
        <div class="serie-outils carnet-outils">
          <a class="serie-outil" href="#/versets">${icone.cartes}<span>Mémoriser les versets</span></a>
          ${docs.length ? `<button type="button" class="serie-outil" data-carnet="copier">${icone.copier}<span>Copier tout</span></button>
            ${navigator.share ? `<button type="button" class="serie-outil" data-carnet="partager">${icone.partager}<span>Partager</span></button>` : ""}
            <button type="button" class="serie-outil" data-carnet="imprimer">${icone.imprimer}<span>Imprimer</span></button>` : ""}
        </div>
        ${docs.length ? `<div class="carnet-liste">${docs.map(([f, x]) => {
          const e = documents.get(f);
          const ou = e.j ? `Semaine ${e.l.num} · ` : e.l && e.l.num ? `Étude ${e.l.num} · ` : "";
          return `<details class="carnet-doc" data-f="${esc(f)}">
            <summary><span class="carnet-titre">${fr(titreDoc(e))}</span>
              <span class="carnet-ou">${esc(ou)}${fr(e.s.titre)}</span>
              <span class="carnet-resume">${esc(resumeCarnet(x))}</span></summary>
            <div class="carnet-detail"><p class="grp-note">Ouverture…</p></div>
          </details>`;
        }).join("")}</div>`
        : `<div class="carnet-vide">${icone.carnet}<p>Rien pour l’instant. Dans une étude, écrivez sous les questions, ou choisissez quelques mots du texte pour les surligner et y ajouter une note : tout se retrouvera ici.</p>
            <a class="doc principal" href="#/commencer">${icone.boussole}Par où commencer ?</a></div>`}
      </div>`;
    const remplir = async (det) => {
      const f = det.dataset.f;
      const zone = det.querySelector(".carnet-detail");
      if (zone.dataset.pret) return;
      const x = docs.find(([g]) => g === f)[1];
      const gs = groupesSurl(x.surl);
      const blocSurl = gs.length ? `<h3 class="carnet-sous">Passages surlignés</h3><ul class="carnet-surl">${gs.map((g) =>
        `<li class="c-${esc(g.c)}"><q>${fr(g.t.join(" … "))}</q>${g.n ? `<p class="carnet-note">${icone.note}<span>${fr(g.n)}</span></p>` : ""}</li>`).join("")}</ul>` : "";
      try {
        const { qr, phrases } = await detailCarnet(f);
        zone.innerHTML = `${qr.length ? `<h3 class="carnet-sous">Mes réponses</h3><ol class="carnet-qr">${qr.map((r) =>
          `<li><p class="carnet-q">${r.num ? `<span class="carnet-num">${esc(r.num)}</span>` : ""}${fr(r.question)}</p><p class="carnet-r">${fr(r.reponse).replace(/\n/g, "<br>")}</p></li>`).join("")}</ol>` : ""}
          ${phrases.length ? `<h3 class="carnet-sous">Phrases complétées</h3><ul class="carnet-phrases">${phrases.map((h) => `<li>${h}</li>`).join("")}</ul>` : ""}
          ${blocSurl}
          <p><a class="doc" href="#/lire/${esc(f)}">${icone.lecture}Ouvrir l’étude</a></p>`;
      } catch (e) {
        zone.innerHTML = `${blocSurl}<p class="grp-note">Les questions ne s’affichent pas sans connexion.</p><p><a class="doc" href="#/lire/${esc(f)}">Ouvrir l’étude</a></p>`;
      }
      zone.dataset.pret = "1";
    };
    app.querySelectorAll(".carnet-doc").forEach((det) => det.addEventListener("toggle", () => { if (det.open) remplir(det); }));
    // tout en texte : pour le copier, le partager, le garder
    const enTexte = async () => {
      const morceaux = ["Mon carnet — Mission", ""];
      for (const [f, x] of docs) {
        const e = documents.get(f);
        morceaux.push(`== ${titreDoc(e)} (${e.s.titre})`);
        try {
          const { qr, phrases } = await detailCarnet(f);
          qr.forEach((r) => morceaux.push(`${r.num ? `${r.num}. ` : ""}${r.question}`, `→ ${r.reponse}`, ""));
          phrases.forEach((h) => morceaux.push(`• ${h.replace(/<\/?strong>/g, "")}`));
        } catch (er) { /* sans connexion : les passages seulement */ }
        groupesSurl(x.surl).forEach((g) => morceaux.push(`« ${g.t.join(" … ")} »${g.n ? `\n  Note : ${g.n}` : ""}`));
        morceaux.push("");
      }
      return morceaux.join("\n").trim();
    };
    app.querySelector(".page-carnet").addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-carnet]");
      if (!b) return;
      const quoi = b.dataset.carnet;
      if (quoi === "imprimer") {
        const dets = [...app.querySelectorAll(".carnet-doc")];
        await Promise.all(dets.map((d) => { d.open = true; return remplir(d); }));
        window.print();
        return;
      }
      b.setAttribute("aria-busy", "true");
      const t = await enTexte();
      b.removeAttribute("aria-busy");
      if (quoi === "copier") copierTexte(t); else partagerTexte(t);
    });
    return true;
  }
  const carteCarnet = () => `<a class="carte-groupe" href="#/carnet">
      <span class="carte-groupe-icone">${icone.carnet}</span>
      <span class="carte-groupe-texte"><span class="carte-groupe-titre">Mon carnet</span>
        <span>Vos réponses, les passages surlignés et vos notes ; les versets à mémoriser.</span></span>
      ${chevronDroit}
    </a>`;

  // ---------- mémoriser les versets (#/versets) : lire, premières lettres, mots cachés, réciter ; révision espacée ----------
  // mission.versets = { appris: { <référence>: { r, t (texte), s (série d’où il vient, ou « perso »), b (boîte 1 à 5),
  // p (prochaine révision, AAAA-MM-JJ) } } } ; un verset su passe à la boîte suivante et revient plus tard
  const INTERVALLES = [0, 1, 3, 7, 14, 30];
  const versets = {
    lire() {
      const o = lireJson("mission.versets", {}, (v) => typeof v === "object" && !Array.isArray(v));
      return { appris: o.appris && typeof o.appris === "object" && !Array.isArray(o.appris) ? o.appris : {} };
    },
    maj(f) { const o = this.lire(); f(o); memoire.ecrire("mission.versets", JSON.stringify(o)); return o; },
  };
  const ajouterJours = (iso, n) => { const [a, m, j] = iso.split("-").map(Number); return dateIso(new Date(a, m - 1, j + n)); };
  const aujourdhui = () => dateIso(new Date());
  function apprendre(r, t, source) {
    let nouveau = false;
    versets.maj((o) => {
      if (o.appris[r]) return;
      o.appris[r] = { r, t, s: source, b: 1, p: aujourdhui() };
      nouveau = true;
    });
    return nouveau;
  }
  const aRevoir = (o) => Object.values(o.appris).filter((x) => x.p <= aujourdhui())
    .sort((a, b) => a.b - b.b || (a.p < b.p ? -1 : a.p > b.p ? 1 : 0));
  const quand = (iso) => {
    const [a, m, j] = iso.split("-").map(Number);
    const n = Math.round((new Date(a, m - 1, j) - new Date(new Date().toDateString())) / 86400000);
    return n <= 0 ? "aujourd’hui" : n === 1 ? "demain" : `dans ${n} jours`;
  };
  const motsDe = (t) => t.replace(/\s+/g, " ").trim().split(" ");
  // « Car Dieu a tant aimé le monde, » → « C D a t a l m, »
  const premieresLettres = (t) => motsDe(t).map((m) => m.replace(/[\p{L}\p{N}]+/gu, (x) => x[0])).join(" ");
  function versetsPage() {
    document.title = "Mémoriser les versets — Mission";
    app.innerHTML = `
      <div class="page page-versets">
        ${fil([["Accueil", "#/"], ["Mon carnet", "#/carnet"], ["Mémoriser les versets"]])}
        <h1 class="titre-page" tabindex="-1">Mémoriser les versets</h1>
        <p class="chapeau">Lisez le verset, cachez des mots, puis récitez-le. Un verset su revient de moins en moins souvent : le lendemain, puis dans 3, 7, 14 et 30 jours.</p>
        <div class="vs-zone"></div>
      </div>`;
    const zone = app.querySelector(".vs-zone");
    let SH = [];
    let revue = null; // { liste, i, mode, trous, sus }
    const liste = () => {
      const o = versets.lire();
      const dus = aRevoir(o);
      const tous = Object.values(o.appris).sort((a, b) => (a.p < b.p ? -1 : a.p > b.p ? 1 : a.r < b.r ? -1 : 1));
      const parSerie = new Map();
      SH.forEach((x) => {
        if (!parSerie.has(x.serie.id)) parSerie.set(x.serie.id, { s: x.serie, v: new Map() });
        const g = parSerie.get(x.serie.id);
        if (!g.v.has(x.r)) g.v.set(x.r, x);
      });
      const boites = (b) => `<span class="vs-boites" aria-label="Boîte ${b} sur 5">${[1, 2, 3, 4, 5].map((k) => `<span${k <= b ? ' class="plein"' : ""}></span>`).join("")}</span>`;
      zone.innerHTML = `
        <section class="vs-revoir">
          ${dus.length ? `<p class="vs-revoir-texte"><strong>${pluriel(dus.length, "verset", "versets")}</strong> à revoir aujourd’hui</p>
            <button type="button" class="doc principal grp-grand" data-vs="reviser">${icone.cartes}Réviser maintenant</button>`
            : tous.length ? `<p class="vs-revoir-texte">${icone.coche}Rien à revoir aujourd’hui. Prochaine révision : ${esc(quand(tous[0].p))}.</p>`
              : `<p class="vs-revoir-texte">Choisissez un verset ci-dessous, ou ajoutez le vôtre : il apparaîtra ici chaque jour où il faut le revoir.</p>`}
        </section>
        <section class="vs-section" aria-labelledby="vs-miens">
          <h2 id="vs-miens" class="section-titre">Mes versets</h2>
          <form class="vs-ajout" autocomplete="off">
            <label for="vs-ref">Ajouter un verset</label>
            <div class="vs-ajout-ligne"><input id="vs-ref" name="ref" placeholder="Jean 3:16, Ps 23:1-3…" enterkeyhint="done"><button type="submit" class="doc principal">Ajouter</button></div>
            <p class="grp-note vs-ajout-etat" role="status"></p>
          </form>
          ${tous.length ? `<ul class="vs-liste">${tous.map((x) => `<li>
              <button type="button" class="vs-verset" data-vs-voir="${esc(x.r)}"><strong>${fr(x.r)}</strong><span>${fr(x.t)}</span></button>
              <span class="vs-etat">${boites(x.b)}<span>${x.p <= aujourdhui() ? "à revoir" : esc(quand(x.p))}</span></span>
              <button type="button" class="grp-lien" data-vs-retirer="${esc(x.r)}">Retirer</button>
            </li>`).join("")}</ul>` : ""}
        </section>
        <section class="vs-section" aria-labelledby="vs-series">
          <h2 id="vs-series" class="section-titre">Les versets clés des séries</h2>
          <p class="grp-note">Un verset clé par étude, celui de son short.</p>
          ${[...parSerie.values()].map(({ s, v }) => `<details class="vs-serie">
              <summary><span>${fr(s.titre)}</span><span class="compte">${pluriel(v.size, "verset", "versets")}</span></summary>
              <ul>${[...v.values()].map((x) => `<li><span class="vs-cle"><strong>${fr(x.r)}</strong> ${fr(x.t)}</span>
                ${o.appris[x.r] ? `<span class="vs-deja">${icone.coche}Appris</span>` : `<button type="button" class="serie-outil" data-vs-apprendre="${esc(x.r)}">Apprendre</button>`}</li>`).join("")}</ul>
              <p><button type="button" class="doc" data-vs-tout="${s.id}">Apprendre les ${v.size} versets</button></p>
            </details>`).join("") || '<p class="grp-note">Chargement…</p>'}
        </section>`;
      zone.querySelector(".vs-ajout").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const etat = zone.querySelector(".vs-ajout-etat");
        const brut = Bible.lireReference(ev.target.ref.value);
        if (!brut) { etat.textContent = "Référence non reconnue : écrivez par exemple « Jean 3:16 » ou « Psaume 23:1-3 »."; return; }
        try {
          const x = await Bible.texte(brut);
          if (x.versets > 8) { etat.textContent = `${x.titre} : ${x.versets} versets, c’est beaucoup. Choisissez-en au plus 8.`; return; }
          apprendre(x.titre, x.texte, "perso");
          bulle(`${x.titre} ajouté`);
          liste();
        } catch (e) {
          etat.textContent = "Ce passage ne s’affiche pas (pas de connexion, ou référence inexistante).";
        }
      });
    };
    const texteSelon = () => {
      const x = revue.liste[revue.i];
      const mots = motsDe(x.t);
      if (revue.mode === "lettres") return `<p class="vs-lettres">${esc(premieresLettres(x.t))}</p><p class="grp-note">Touchez le texte pour voir le verset.</p>`;
      if (revue.mode === "reciter") return `<p class="vs-reciter">Dites le verset de mémoire, à voix haute ou dans votre tête.</p>`;
      if (revue.mode === "trous") {
        const part = [0.35, 0.6, 1][revue.niveau];
        return `<p class="vs-trous">${mots.map((m, k) => {
          const cache = ((k * 7 + 3) % 10) / 10 < part && /[\p{L}\p{N}]{2,}/u.test(m);
          return cache ? `<button type="button" class="vs-trou" data-mot="${esc(m)}" aria-label="Mot caché : toucher pour le voir">${"_".repeat(Math.min(10, m.length))}</button>` : esc(m);
        }).join(" ")}</p>
        <p><button type="button" class="grp-lien" data-vs="plus-de-trous">${revue.niveau < 2 ? "Cacher plus de mots" : "Remettre quelques mots"}</button></p>`;
      }
      return `<p class="vs-lire">${fr(x.t)}</p>`;
    };
    const carte = () => {
      const x = revue.liste[revue.i];
      if (!x) {
        zone.innerHTML = `<section class="vs-fini"><h2 class="debut-question">${icone.coche}Fini pour aujourd’hui</h2>
          <p>${pluriel(revue.sus, "verset su", "versets sus")} sur ${revue.liste.length}. Les autres reviendront demain.</p>
          <p><button type="button" class="doc principal" data-vs="liste">Revenir à mes versets</button></p></section>`;
        revue = null;
        return;
      }
      zone.innerHTML = `<section class="vs-carte" aria-live="polite">
        <p class="vs-compte">${revue.seul ? "Entraînement" : `Verset ${revue.i + 1} sur ${revue.liste.length}`} · boîte ${x.b} sur 5</p>
        <h2 class="vs-ref">${fr(x.r)}</h2>
        <div class="vs-modes" role="group" aria-label="Façon de s’entraîner">${[["lire", "Lire"], ["lettres", "Premières lettres"], ["trous", "Mots cachés"], ["reciter", "Réciter"]]
          .map(([id, nom]) => `<button type="button" data-vs-mode="${id}" aria-pressed="${revue.mode === id}">${nom}</button>`).join("")}</div>
        <div class="vs-texte" data-vs="montrer">${texteSelon()}</div>
        <div class="vs-boutons">
          ${synthese ? `<button type="button" class="doc" data-vs="ecouter">${icone.ecouter}Écouter</button>` : ""}
          <button type="button" class="doc" data-vs="revoir">À revoir</button>
          <button type="button" class="doc principal" data-vs="su">${icone.coche}Je le savais</button>
        </div>
        <p><button type="button" class="grp-lien" data-vs="liste">Arrêter</button></p>
      </section>`;
    };
    const reviser = (liste2, seul) => {
      revue = { liste: liste2, i: 0, mode: "lire", niveau: 0, sus: 0, seul };
      carte();
      zone.scrollIntoView({ block: "start" });
    };
    zone.addEventListener("click", (ev) => {
      const t = ev.target;
      if (t.closest(".vs-trou")) { const b = t.closest(".vs-trou"); b.replaceWith(document.createTextNode(b.dataset.mot)); return; }
      const m = t.closest("[data-vs-mode]");
      if (m && revue) { revue.mode = m.dataset.vsMode; carte(); return; }
      const ap = t.closest("[data-vs-apprendre]");
      if (ap) {
        const x = SH.find((y) => y.r === ap.dataset.vsApprendre);
        if (x) { apprendre(x.r, x.t, x.serie.id); ap.outerHTML = `<span class="vs-deja">${icone.coche}Appris</span>`; bulle(`${x.r} : à revoir dès aujourd’hui`); }
        return;
      }
      const tout = t.closest("[data-vs-tout]");
      if (tout) {
        let n = 0;
        SH.filter((x) => x.serie.id === tout.dataset.vsTout).forEach((x) => { if (apprendre(x.r, x.t, x.serie.id)) n += 1; });
        bulle(n ? `${pluriel(n, "verset ajouté", "versets ajoutés")}` : "Ces versets sont déjà dans votre liste");
        liste();
        return;
      }
      const ret = t.closest("[data-vs-retirer]");
      if (ret) { versets.maj((o) => { delete o.appris[ret.dataset.vsRetirer]; }); liste(); return; }
      const voir = t.closest("[data-vs-voir]");
      if (voir) { const x = versets.lire().appris[voir.dataset.vsVoir]; if (x) reviser([x], true); return; }
      const a = t.closest("[data-vs]");
      if (!a) return;
      const quoi = a.dataset.vs;
      if (quoi === "reviser") { const l = aRevoir(versets.lire()); if (l.length) reviser(l, false); return; }
      if (quoi === "liste") { arreterParole(); revue = null; liste(); return; }
      if (!revue) return;
      const x = revue.liste[revue.i];
      if (quoi === "montrer" && revue.mode === "lettres") { a.innerHTML = `<p class="vs-lire">${fr(x.t)}</p>`; return; }
      if (quoi === "plus-de-trous") { revue.niveau = (revue.niveau + 1) % 3; carte(); return; }
      if (quoi === "ecouter") { parler(`${pourOreille(x.r)}. ${x.t}`); return; }
      if (quoi === "su" || quoi === "revoir") {
        arreterParole();
        versets.maj((o) => {
          const y = o.appris[x.r];
          if (!y) return;
          y.b = quoi === "su" ? Math.min(5, y.b + 1) : 1;
          y.p = ajouterJours(aujourdhui(), quoi === "su" ? INTERVALLES[y.b] : 1);
        });
        if (quoi === "su") revue.sus += 1;
        if (revue.seul) { bulle(quoi === "su" ? "Bien ! Il reviendra plus tard." : "Il reviendra demain."); revue = null; liste(); return; }
        revue.i += 1;
        revue.mode = "lire";
        revue.niveau = 0;
        carte();
      }
    });
    liste();
    chargerShorts().then((tous) => { SH = tous; if (!revue) liste(); }).catch(() => {});
    return true;
  }

  // ---------- autour d’un passage biblique : l’apprendre par cœur, les études qui le citent (donnees/versets.json) ----------
  const VERSION_VERSETS = "1";
  let indexVersets = null;
  function chargerIndexVersets() {
    if (!indexVersets) {
      indexVersets = fetch(`donnees/versets.json?v=${VERSION_VERSETS}`).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); });
      indexVersets.catch(() => { indexVersets = null; });
    }
    return indexVersets;
  }
  function etudesDuPassage(ix, seg, sauf) {
    const score = new Map();
    const compter = (cle, poids) => (ix.r[cle] || []).forEach((n) => score.set(n, (score.get(n) || 0) + poids));
    seg.forEach((x) => {
      for (let c = x.c1; c <= x.c2; c++) {
        compter(`${x.livre}.${c}`, 0.5);
        if (!x.v1) continue;
        const de = c === x.c1 ? x.v1 : 1;
        const a = c === x.c2 ? x.v2 : 180;
        for (let v = de; v <= a; v++) compter(`${x.livre}.${c}.${v}`, 1);
      }
    });
    const ici = sauf && documents.get(sauf);
    return [...score.entries()]
      .filter(([n]) => { const e = documents.get(ix.e[n][0]); return e && !(ici && ici.l && e.l === ici.l); })
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .map(([n]) => ix.e[n]);
  }
  function brancherBiblePlus(panneau, fCourant, signal) {
    const plus = panneau.querySelector(".bible-plus");
    if (!plus) return;
    panneau.addEventListener("passage", (ev) => {
      const { seg, titre: t, texte: tx, versets: nb } = ev.detail;
      const jeton = {};
      plus.jeton = jeton;
      plus.hidden = false;
      const deja = !!versets.lire().appris[t];
      plus.innerHTML = `${nb <= 8 ? `<button type="button" class="bible-apprendre" data-apprendre${deja ? " disabled" : ""}>${icone.cartes}<span>${deja ? "Dans mes versets à mémoriser" : "Apprendre par cœur"}</span></button>` : ""}
        <div class="bible-etudes"></div>`;
      const b = plus.querySelector("[data-apprendre]");
      if (b) b.addEventListener("click", () => {
        apprendre(t, tx, "perso");
        b.disabled = true;
        b.querySelector("span").textContent = "Dans mes versets à mémoriser";
        bulle(`${t} : à revoir dans « Mémoriser les versets »`);
      });
      chargerIndexVersets().then((ix) => {
        if (plus.jeton !== jeton) return;
        const liste = etudesDuPassage(ix, seg, fCourant);
        if (!liste.length) return;
        const ligne = ([f, titre, serie]) => `<li><a href="#/lire/${esc(f)}"><strong>${fr(titre)}</strong><span>${fr(serie)}</span></a></li>`;
        const zoneE = plus.querySelector(".bible-etudes");
        zoneE.innerHTML = `<h3 class="bible-etudes-titre">${fCourant ? "Dans d’autres études" : "Dans les études"} <span>${liste.length}</span></h3>
          <ul class="bible-etudes-liste">${liste.slice(0, 5).map(ligne).join("")}</ul>
          ${liste.length > 5 ? `<button type="button" class="grp-lien" data-tout>Voir les ${liste.length} études</button>` : ""}`;
        const tout = zoneE.querySelector("[data-tout]");
        if (tout) tout.addEventListener("click", () => { zoneE.querySelector("ul").innerHTML = liste.map(ligne).join(""); tout.remove(); });
      }).catch(() => {});
    }, signal ? { signal } : undefined);
  }

  // ---------- une série gardée hors ligne : le texte de ses études et leurs images (cache « mission-hors-ligne », sw.js) ----------
  const CACHE_HORS_LIGNE = "mission-hors-ligne";
  const horsLigne = {
    lire: () => lireJson("mission.horsligne", {}, (o) => typeof o === "object" && !Array.isArray(o)),
    maj(f) { const o = this.lire(); f(o); memoire.ecrire("mission.horsligne", JSON.stringify(o)); },
  };
  const docsAvecTexte = (s) => [...new Set([
    ...s.lecons.flatMap((l) => [...l.docs, ...(l.jours || []).flatMap((j) => j.docs)]),
    ...s.ressources,
  ].map((d) => d.f).filter((f) => f && aTexte(f)))];
  const adresseLecture = (f) => `lecture/${f.split("/").map(encodeURIComponent).join("/")}.html?v=${VERSION_LECTURE}`;
  function etatHorsLigne(s) {
    const x = horsLigne.lire()[s.id];
    if (!x) return { garde: false };
    return { garde: true, aJour: x.v === VERSION_LECTURE, ...x };
  }
  function boutonHorsLigne(s) {
    if (!("caches" in window) || !docsAvecTexte(s).length) return "";
    const e = etatHorsLigne(s);
    if (!e.garde) return `<button type="button" class="serie-outil" data-hors-ligne="garder">${icone.horsLigne}<span>Garder hors ligne</span></button>`;
    if (!e.aJour) return `<button type="button" class="serie-outil" data-hors-ligne="garder">${icone.horsLigne}<span>Mettre à jour (hors ligne)</span></button>`;
    return `<button type="button" class="serie-outil" data-hors-ligne="retirer" aria-pressed="true">${icone.coche}<span>Hors ligne · ${taille(e.o)} · Retirer</span></button>`;
  }
  async function garderHorsLigne(s, bouton) {
    const docs = docsAvecTexte(s);
    const etiquette = bouton.querySelector("span");
    bouton.setAttribute("aria-busy", "true");
    try {
      const c = await caches.open(CACHE_HORS_LIGNE);
      const images = new Set([s.image, ...s.lecons.map((l) => l.image)].filter(Boolean).map((n) => `assets/images/${encodeURIComponent(n)}.webp`));
      const gardees = [];
      let octets = 0;
      for (let k = 0; k < docs.length; k++) {
        etiquette.textContent = `Études : ${k + 1} sur ${docs.length}…`;
        const u = adresseLecture(docs[k]);
        const r = await fetch(u);
        if (!r.ok) throw new Error(String(r.status));
        const h = await r.clone().text();
        await c.put(u, r);
        gardees.push(u);
        octets += new Blob([h]).size;
        (h.match(/src="lecture\/[^"]+"/g) || []).forEach((m) => images.add(m.slice(5, -1)));
      }
      const liste = [...images];
      for (let k = 0; k < liste.length; k++) {
        etiquette.textContent = `Images : ${k + 1} sur ${liste.length}…`;
        const r = await fetch(liste[k]).catch(() => null);
        if (!r || !r.ok) continue;
        octets += Number(r.headers.get("content-length")) || (await r.clone().blob()).size;
        await c.put(liste[k], r);
        gardees.push(liste[k]);
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      horsLigne.maj((o) => { o[s.id] = { v: VERSION_LECTURE, date: aujourdhui(), n: docs.length, o: octets, u: gardees }; });
      bulle(`${s.titre} : disponible sans connexion`);
    } catch (e) {
      bulle("Pas tout gardé : vérifiez la connexion, puis réessayez.");
    }
    bouton.removeAttribute("aria-busy");
  }
  async function retirerHorsLigne(s) {
    const x = horsLigne.lire()[s.id];
    try {
      const c = await caches.open(CACHE_HORS_LIGNE);
      // une image partagée avec une autre série gardée reste
      const autres = new Set(Object.entries(horsLigne.lire()).filter(([id]) => id !== s.id).flatMap(([, y]) => y.u || []));
      await Promise.all(((x && x.u) || []).filter((u) => !autres.has(u)).map((u) => c.delete(u)));
    } catch (e) { /* rien */ }
    horsLigne.maj((o) => { delete o[s.id]; });
    bulle(`${s.titre} n’est plus gardée hors ligne`);
  }

  // ---------- projeter une étude sur un écran (mode lecture) : une diapositive par idée, une par question ----------
  // touche → ou toucher la droite : suivante ; ← ou la gauche : précédente ; Échap : quitter ; une référence s’affiche en grand
  function diaposDe(article, e) {
    const { s, l, j, d } = e;
    const c = article.cloneNode(true);
    c.querySelectorAll("textarea, .lec-cache, .lec-credits, .reponse-imprimee, .lec-rep-titre").forEach((x) => x.remove());
    c.querySelectorAll("mark").forEach((m) => m.replaceWith(...m.childNodes));
    c.querySelectorAll("input.lec-blanc").forEach((x) => { const b = document.createElement("span"); b.className = "proj-blanc"; x.replaceWith(b); });
    c.querySelectorAll("img[loading]").forEach((i) => i.removeAttribute("loading"));
    c.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
    const titre = titreDoc(e);
    const num = j ? `Semaine ${l.num}` : l && l.num ? `Étude ${l.num}` : "";
    const img = (l && l.image) || s.image;
    const lien = `${SITE}#/lire/${d.f}`;
    const liste = [{ type: "titre", html: `${img ? `<img class="proj-fond" src="assets/images/${encodeURIComponent(img)}.webp" alt="">` : ""}
      <div class="proj-titre-texte"><p class="proj-serie">${fr(s.titre)}${num ? ` · ${esc(num)}` : ""}</p><h2>${fr(titre)}</h2>
      <div class="proj-qr"><span data-qr-proj="${esc(lien)}"></span><span>Suivre sur son téléphone :<br>${esc(adresseCourte(lien))}</span></div></div>` }];
    let section = "";
    let courante = null;
    const fermer = () => { if (courante) liste.push(courante); courante = null; };
    const entete = () => (section ? `<p class="proj-section">${esc(section)}</p>` : "");
    // un très long paragraphe (sans lien ni mise en forme) est coupé entre deux phrases
    const morceaux = (el) => {
      if (el.tagName === "P" && !el.children.length && el.textContent.length > 650) {
        const phrases = el.textContent.match(/[^.!?…]+[.!?…]+[»”)]*\s*|[^.!?…]+$/g) || [el.textContent];
        const groupes = [];
        let g = "";
        phrases.forEach((ph) => { if (g && (g + ph).length > 460) { groupes.push(g); g = ""; } g += ph; });
        if (g.trim()) groupes.push(g);
        return groupes.map((t) => `<p>${fr(t.trim())}</p>`);
      }
      return [el.outerHTML];
    };
    let etiquette = ""; // petite ligne au-dessus d’un passage : elle suit le passage, jamais seule à l’écran
    [...c.children].forEach((el) => {
      if (el.matches(".lec-etiquette")) { etiquette += el.outerHTML; return; }
      if (el.matches("h2, h3, h4")) { fermer(); section = el.textContent.trim(); return; }
      if (etiquette && !el.matches("figure, .lec-galerie, .lec-table")) {
        const h = etiquette;
        etiquette = "";
        if (el.matches(".lec-q")) { fermer(); liste.push({ type: "question", html: entete() + h + el.outerHTML }); return; }
        if (courante) fermer();
        courante = { type: "texte", html: entete() + h, taille: 0 };
      }
      if (el.matches(".lec-q")) { fermer(); liste.push({ type: "question", html: entete() + el.outerHTML }); return; }
      if (el.matches("figure, .lec-galerie, .lec-table")) { fermer(); liste.push({ type: "image", html: entete() + el.outerHTML }); return; }
      if (!el.textContent.replace(/\s+/g, " ").trim() && !el.querySelector("img")) return;
      morceaux(el).forEach((h) => {
        const t = h.replace(/<[^>]+>/g, "").length;
        if (courante && courante.taille + t > 520) fermer();
        if (!courante) courante = { type: "texte", html: entete(), taille: 0 };
        courante.html += h;
        courante.taille += t;
      });
    });
    fermer();
    liste.push({ type: "fin", html: `<h2>Fin ${j ? "de la leçon" : "de l’étude"}</h2><p class="proj-serie">${fr(titre)}</p>
      <div class="proj-qr"><span data-qr-proj="${esc(lien)}"></span><span>Pour la relire chez soi :<br>${esc(adresseCourte(lien))}</span></div>` });
    return liste;
  }
  let projection = null;
  function fermerProjection() {
    if (!projection) return;
    const p = projection;
    projection = null;
    p.ac.abort();
    p.boite.remove();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    corps.classList.remove("en-projection");
    garderEcran(false);
    if (p.retour && p.retour.isConnected) p.retour.focus({ preventScroll: true });
  }
  function projeter(article, e, retour) {
    fermerProjection();
    const diapos = diaposDe(article, e);
    const boite = document.createElement("div");
    boite.className = "projection";
    boite.setAttribute("role", "dialog");
    boite.setAttribute("aria-modal", "true");
    boite.setAttribute("aria-label", `Projection : ${titreDoc(e)}`);
    boite.innerHTML = `<div class="proj-diapo" tabindex="-1"></div>
      <div class="proj-verset" hidden><div class="proj-verset-boite">
        <h2 class="bible-titre"></h2>
        <div class="bible-outils"><button type="button" class="bible-tout" aria-pressed="false" hidden>Voir tout le chapitre</button><a class="bible-strong" hidden></a></div>
        <div class="bible-corps"><div class="bible-texte"></div></div>
        <button type="button" class="proj-verset-fermer" data-proj="verset">Revenir à l’étude</button>
      </div></div>
      <div class="proj-bas">
        <span class="proj-barre" aria-hidden="true"><span></span></span>
        <button type="button" data-proj="-1" aria-label="Diapositive précédente">${chevron}</button>
        <span class="proj-num" aria-live="polite"></span>
        <button type="button" data-proj="1" aria-label="Diapositive suivante">${chevronDroit}</button>
        ${document.fullscreenEnabled ? `<button type="button" data-proj="plein" aria-label="Plein écran">${icone.ajuster}</button>` : ""}
        <button type="button" data-proj="fin" aria-label="Quitter la projection">${icone.fermer}</button>
      </div>`;
    document.body.append(boite);
    corps.classList.add("en-projection");
    const ac = new AbortController();
    const { signal } = ac;
    projection = { boite, ac, retour };
    garderEcran(true);
    if (document.fullscreenEnabled) boite.requestFullscreen().catch(() => {});
    const zone = boite.querySelector(".proj-diapo");
    const verset = boite.querySelector(".proj-verset");
    let i = 0;
    // le texte rapetisse tant qu’il dépasse de l’écran
    const ajuster = () => {
      let k = 1;
      zone.style.setProperty("--k", "1");
      while (zone.scrollHeight > zone.clientHeight + 2 && k > 0.5) {
        k -= 0.05;
        zone.style.setProperty("--k", k.toFixed(2));
      }
    };
    const montrer = (n) => {
      i = Math.max(0, Math.min(diapos.length - 1, n));
      const dp = diapos[i];
      zone.className = `proj-diapo proj-${dp.type}`;
      zone.innerHTML = dp.html;
      boite.querySelector(".proj-num").textContent = `${i + 1} / ${diapos.length}`;
      boite.querySelector(".proj-barre span").style.width = `${((i + 1) / diapos.length) * 100}%`;
      boite.querySelector('[data-proj="-1"]').disabled = i === 0;
      boite.querySelector('[data-proj="1"]').disabled = i === diapos.length - 1;
      zone.querySelectorAll("[data-qr-proj]").forEach((q) => chargerQr().then(() => { q.innerHTML = svgQr(q.dataset.qrProj); }).catch(() => q.remove()));
      ajuster();
      zone.querySelectorAll("img").forEach((im) => { if (!im.complete) im.addEventListener("load", ajuster, { once: true }); });
    };
    const fermerVerset = () => { verset.hidden = true; zone.focus({ preventScroll: true }); };
    boite.addEventListener("click", (ev) => {
      const a = ev.target.closest("a.ref");
      if (a) {
        ev.preventDefault();
        const brut = Bible.analyser(Bible.passageDuLien(a.getAttribute("href")));
        if (!brut) return;
        verset.hidden = false;
        Bible.montrerPassage(verset, brut, a.getAttribute("href"));
        return;
      }
      const b = ev.target.closest("[data-proj]");
      if (b) {
        const q = b.dataset.proj;
        if (q === "fin") fermerProjection();
        else if (q === "verset") fermerVerset();
        else if (q === "plein") { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else boite.requestFullscreen().catch(() => {}); }
        else montrer(i + Number(q));
        return;
      }
      if (!verset.hidden || ev.target.closest("a, button, .proj-bas")) return;
      // toucher la diapositive : à droite la suivante, à gauche la précédente
      montrer(i + (ev.clientX > window.innerWidth / 3 ? 1 : -1));
    }, { signal });
    let depart = null;
    boite.addEventListener("pointerdown", (ev) => { depart = { x: ev.clientX, y: ev.clientY }; }, { signal });
    boite.addEventListener("pointerup", (ev) => {
      if (!depart || !verset.hidden) return;
      const dx = ev.clientX - depart.x;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(ev.clientY - depart.y)) { montrer(i + (dx < 0 ? 1 : -1)); depart = null; }
    }, { signal });
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") { ev.preventDefault(); if (!verset.hidden) fermerVerset(); else fermerProjection(); return; }
      if (!verset.hidden) return;
      const sens = { ArrowRight: 1, PageDown: 1, " ": 1, Enter: 1, ArrowDown: 1, ArrowLeft: -1, PageUp: -1, ArrowUp: -1, Backspace: -1 }[ev.key];
      if (sens) { ev.preventDefault(); montrer(i + sens); } else if (ev.key === "Home") montrer(0); else if (ev.key === "End") montrer(diapos.length - 1);
    }, { signal });
    window.addEventListener("resize", ajuster, { signal });
    montrer(0);
    zone.focus({ preventScroll: true });
  }

  // ---------- livret A5 : une étude, ou toute une série, prête à imprimer et à plier ----------
  // pages A5 ; dans la fenêtre d’impression, « Livret » (ou 2 pages par feuille) donne des feuilles A4 à plier
  const docsLivret = (s) => s.lecons.flatMap((l) => (aDesJours(l)
    ? l.jours.map((j) => j.docs[0] && j.docs[0].f).filter((f) => f && aTexte(f))
    : [(l.docs.find((d) => d.f && d.role !== "animateur" && aTexte(d.f)) || l.docs.find((d) => d.f && aTexte(d.f)) || {}).f].filter(Boolean)));
  async function imprimerLivret({ titre, sousTitre, texte, image: img, lien, docs }, bouton) {
    if (bouton) bouton.setAttribute("aria-busy", "true");
    const etiquetteEl = bouton && bouton.querySelector("span");
    const etiquette = etiquetteEl ? etiquetteEl.firstChild : null;
    const ancienTexte = etiquette && etiquette.nodeType === 3 ? etiquette.data : null;
    try {
      if (ancienTexte !== null) etiquette.data = "Préparation du livret…";
      const textes = await Promise.all(docs.map((f) => fetch(adresseLecture(f)).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); })));
      await chargerQr().catch(() => null);
      const ancien = document.getElementById("impression-livret");
      if (ancien) ancien.remove();
      const zone = document.createElement("div");
      zone.id = "impression-livret";
      const qr = window.qrcode ? `<div class="livret-qr">${svgQr(lien)}<span>${esc(adresseCourte(lien))}</span></div>` : "";
      const serie = docs.length > 1;
      const etudes = docs.map((f, k) => {
        const e = documents.get(f);
        const a = document.createElement("div");
        a.innerHTML = textes[k];
        ajouterZonesReponse(a, f);
        a.querySelectorAll("textarea").forEach((t) => {
          const lignes = document.createElement("div");
          lignes.className = "livret-lignes";
          lignes.innerHTML = "<span></span>".repeat(Math.max(2, Math.min(4, Number(t.getAttribute("rows")) || 3)));
          t.replaceWith(lignes);
        });
        a.querySelectorAll("input.lec-blanc").forEach((x) => {
          const b = document.createElement("span");
          b.className = "livret-blanc";
          b.style.minWidth = `${Math.max(3, Number(x.getAttribute("size")) || 8) * 0.6}em`;
          x.replaceWith(b);
        });
        a.querySelectorAll(".lec-cache, .lec-credits").forEach((x) => x.remove());
        a.querySelectorAll("img[loading]").forEach((im) => im.setAttribute("loading", "eager"));
        a.querySelectorAll("[id]").forEach((x) => x.removeAttribute("id"));
        a.querySelectorAll("a.ref").forEach((r) => { const sp = document.createElement("span"); sp.className = "ref"; sp.textContent = r.textContent; r.replaceWith(sp); });
        const { l, j } = e;
        const ou = `${fr(e.s.titre)}${j ? ` · Semaine ${esc(l.num)}` : l && l.num ? ` · Étude ${esc(l.num)}` : ""}`;
        return `<section class="livret-etude"><p class="livret-ou">${ou}</p><h2>${fr(titreDoc(e))}</h2>${a.innerHTML}${serie ? "" : qr}</section>`;
      }).join("");
      zone.innerHTML = (serie ? `<section class="livret-couverture">
          ${img ? `<img src="assets/images/${encodeURIComponent(img)}.webp" alt="">` : ""}
          <div class="livret-couverture-texte"><p class="livret-marque">Mission · études bibliques</p><h1>${fr(titre)}</h1>
          ${sousTitre ? `<p class="livret-sous">${fr(sousTitre)}</p>` : ""}${texte ? `<p class="livret-texte">${fr(texte)}</p>` : ""}${qr}</div>
        </section>
        <section class="livret-sommaire"><h2>Sommaire</h2><ol>${docs.map((f) => `<li>${fr(titreDoc(documents.get(f)))}</li>`).join("")}</ol></section>` : "") + etudes;
      document.body.append(zone);
      const style = document.createElement("style");
      style.id = "style-livret";
      style.textContent = `@page { size: A5 portrait; margin: 13mm 12mm 15mm; @bottom-center { content: counter(page); font: 9pt sans-serif; color: #666; } }
        ${serie ? "@page :first { margin: 0; @bottom-center { content: none; } }" : ""}`;
      document.head.append(style);
      corps.classList.add("impression-livret");
      await Promise.all([...zone.querySelectorAll("img")].map((im) => (im.complete ? Promise.resolve()
        : new Promise((ok) => { im.addEventListener("load", ok, { once: true }); im.addEventListener("error", ok, { once: true }); }))));
      const fin = () => { corps.classList.remove("impression-livret"); zone.remove(); style.remove(); window.removeEventListener("afterprint", fin); };
      window.addEventListener("afterprint", fin);
      window.print();
    } catch (err) {
      bulle("Le livret n’a pas pu être préparé : vérifiez la connexion.");
    } finally {
      if (bouton) bouton.removeAttribute("aria-busy");
      if (ancienTexte !== null) etiquette.data = ancienTexte;
    }
  }

  // ---------- tableau du responsable : bilans et pages lues, vers son Google Sheet (outils/groupe/tableau-apps-script.gs) ----------
  // l’application Web du script (projet « Mission — tableau des bilans », déployé le 27 novembre 2026) ;
  // vide : rien ne part du site
  const SCRIPT_MISSION = "https://script.google.com/macros/s/AKfycbw0nEBnOSPDm8xqZf0NnTIBnKoBR0DlvcCblQ7Ow6XxfZ_5i7AE1NEY12U7QcEimFsK9w/exec";
  const envois = {
    lire: () => lireJson("mission.envois", [], (l) => Array.isArray(l)),
    ecrire: (l) => memoire.ecrire("mission.envois", JSON.stringify(l.slice(-40))),
  };
  const enAttente = (id) => envois.lire().some((y) => y.id === id);
  async function poster(x) {
    const corps = { method: "POST", body: JSON.stringify(x), credentials: "omit", headers: { "Content-Type": "text/plain;charset=utf-8" } };
    try {
      const r = await fetch(SCRIPT_MISSION, corps);
      const o = await r.json();
      if (!o || !o.ok) throw new Error((o && o.erreur) || "refusé");
      return true;
    } catch (e) {
      if (!navigator.onLine || (e && e.message && e.message !== "Failed to fetch" && !/NetworkError|Load failed/i.test(e.message))) return false;
      // réponse illisible (le tableau renvoie ailleurs) : l’envoi est parti ; un double ne fait que remplacer sa ligne
      await fetch(SCRIPT_MISSION, { ...corps, mode: "no-cors" });
      return true;
    }
  }
  let envoiEnCours = null;
  // envoie ce qui attend, dans l’ordre ; ce qui échoue reste en attente (sans réseau : au retour du réseau)
  function viderEnvois() {
    if (!SCRIPT_MISSION || envoiEnCours || !navigator.onLine || !envois.lire().length) return envoiEnCours || Promise.resolve();
    envoiEnCours = (async () => {
      // la file est relue à chaque tour : un bilan ajouté (ou corrigé) pendant l’envoi part aussi
      for (let tour = 0; tour < 50; tour++) {
        const x = envois.lire()[0];
        if (!x) break;
        let ok = false;
        try { ok = await poster(x); } catch (e) { ok = false; }
        if (!ok) break;
        const parti = JSON.stringify(x);
        envois.ecrire(envois.lire().filter((y) => JSON.stringify(y) !== parti));
        document.dispatchEvent(new CustomEvent("mission-envoye", { detail: x.id }));
      }
    })().finally(() => { envoiEnCours = null; });
    return envoiEnCours;
  }
  function envoyerAuTableau(x) {
    envois.ecrire([...envois.lire().filter((y) => y.id !== x.id), x]);
    return viderEnvois();
  }
  window.addEventListener("online", () => viderEnvois());
  const idGroupe = () => groupe.lire().id || groupe.maj((g) => { g.id = Math.random().toString(36).slice(2, 10); }).id;
  function bilanPourTableau(g, v) {
    const s = series[v.s];
    const l = s && s.lecons[v.i];
    return {
      type: "bilan", id: `${idGroupe()}-${v.date}`, date: v.date, groupe: g.nom || "", leader: g.leader || "",
      serie: s ? s.titre : "", etude: l ? nomEtude(l, v.i) : "", duree: v.duree,
      presents: v.nombre !== null ? v.nombre : v.presents.length,
      membres: v.nombre !== null ? "" : v.presents.length + v.absents.length,
      nomsPresents: v.presents.join(", "), absents: v.absents.join(", "), visiteurs: v.visiteurs,
      versets: v.versets === null ? "" : v.versets, partage: v.partage, priere: v.priere,
    };
  }

  // pages lues : des totaux par jour et par page, sans cookie, sans identifiant, sans ce qu’on cherche ;
  // gardés sur l’appareil puis envoyés par paquets. Le bas de page permet de refuser.
  const statsRefusees = () => memoire.lire("mission.stats.non", "") === "1" || navigator.globalPrivacyControl === true;
  const TITRES_STATS = { "": "Accueil", chercher: "Recherche", shorts: "Shorts", groupe: "Petit groupe", application: "L’application",
    commencer: "Par où commencer ?", carnet: "Mon carnet", versets: "Mémoriser les versets", inviter: "Inviter un ami" };
  function compterPage(page, arg) {
    if (!SCRIPT_MISSION || statsRefusees()) return;
    const p = ["niveau", "serie", "lire", "original"].includes(page) && arg ? `${page === "original" ? "lire" : page}/${arg}` : page || "accueil";
    const t = TITRES_STATS[page] !== undefined && !(page === "inviter" && arg) ? TITRES_STATS[page] : document.title.replace(/ — Mission$/, "");
    const o = lireJson("mission.stats", {}, (v) => typeof v === "object" && !Array.isArray(v));
    const cle = `${dateIso(new Date())}|${p}`;
    o[cle] = { t: t.slice(0, 200), n: ((o[cle] && o[cle].n) || 0) + 1 };
    memoire.ecrire("mission.stats", JSON.stringify(o));
    if (Object.values(o).reduce((a, x) => a + x.n, 0) >= 15) envoyerStats();
  }
  function envoyerStats() {
    if (!SCRIPT_MISSION || !navigator.onLine) return;
    const o = lireJson("mission.stats", {}, (v) => typeof v === "object" && !Array.isArray(v));
    const pages = Object.entries(o).map(([k, v]) => {
      const [jour, ...p] = k.split("|");
      return { jour, p: p.join("|"), t: v.t, n: v.n };
    });
    if (!pages.length) return;
    memoire.ecrire("mission.stats", "{}");
    try {
      fetch(SCRIPT_MISSION, { method: "POST", mode: "no-cors", keepalive: true, credentials: "omit",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ type: "visites", lot: Math.random().toString(36).slice(2, 12), pages }) }).catch(() => {});
    } catch (e) { /* tant pis : ce ne sont que des totaux */ }
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") envoyerStats(); });
  function majPiedStats() {
    const zone = document.querySelector("[data-pied-stats]");
    if (!zone) return;
    zone.hidden = !SCRIPT_MISSION;
    if (!SCRIPT_MISSION) return;
    const non = statsRefusees();
    zone.innerHTML = `Pour savoir quelles études servent, le site compte les pages lues : sans cookie, sans nom, sans ce que vous cherchez.
      <button type="button" class="pied-bouton" data-stats>${non ? "Compter à nouveau mes visites" : "Ne pas compter mes visites"}</button>`;
  }
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest("[data-stats]")) return;
    const non = memoire.lire("mission.stats.non", "") !== "1";
    memoire.ecrire("mission.stats.non", non ? "1" : "");
    if (non) memoire.ecrire("mission.stats", "{}");
    majPiedStats();
    bulle(non ? "Vos visites ne sont plus comptées" : "Vos visites sont à nouveau comptées");
  });

  // ---------- codes QR (assets/qr.js, chargé à la demande) ----------
  let qrCharge = null;
  function chargerQr() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrCharge) {
      qrCharge = new Promise((ok, ko) => {
        const sc = document.createElement("script");
        sc.src = "assets/qr.js?v=1";
        sc.onload = () => (window.qrcode ? ok(window.qrcode) : ko(new Error("qr")));
        sc.onerror = () => { qrCharge = null; ko(new Error("qr")); };
        document.head.append(sc);
      });
    }
    return qrCharge;
  }
  // le code QR d’une adresse, en SVG net à toute taille
  function svgQr(texte, couleur) {
    const q = window.qrcode(0, "M");
    q.addData(texte);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
    return `<svg viewBox="0 0 ${n + 8} ${n + 8}" shape-rendering="crispEdges" aria-hidden="true"><rect width="${n + 8}" height="${n + 8}" fill="#fff"/><path d="${d}" fill="${couleur || "#0f2321"}"/></svg>`;
  }
  const SITE = "https://mission.ka-ilei.com/";
  const adresseCourte = (u) => u.replace(/^https?:\/\//, "").replace(/\/$/, "");

  // ---------- inviter un ami (#/inviter, #/inviter/<série>) : un message avec le lien, un code QR à scanner, des cartes à imprimer ----------
  function messageInvitation(s, lien) {
    return s
      ? `Bonjour ! Je te propose la série « ${s.titre} » : ${s.texte.replace(/\s*$/, "")} Ça se lit sur le téléphone, seul ou en petit groupe : ${lien}`
      : `Bonjour ! Je voulais te partager Mission : des études bibliques à lire sur le téléphone, seul ou en petit groupe. Tu peux commencer ici : ${lien}`;
  }
  function inviterPage(arg) {
    const choisie = series[arg] ? arg : "";
    document.title = "Inviter un ami — Mission";
    const options = B.niveaux.map((n) => {
      const ss = seriesDe(n.id).filter((s) => s.lecons.length);
      return ss.length ? `<optgroup label="${esc(`${n.num}. ${n.verbe}`)}">${ss.map((s) =>
        `<option value="${s.id}"${s.id === choisie ? " selected" : ""}>${esc(s.titre)}</option>`).join("")}</optgroup>` : "";
    }).join("");
    app.innerHTML = `
      <div class="page page-inviter">
        ${fil([["Accueil", "#/"], ["Inviter un ami"]])}
        <h1 class="titre-page" tabindex="-1">Inviter un ami</h1>
        <p class="chapeau">Envoyez un message avec le lien, ou montrez le code : on le scanne avec l’appareil photo du téléphone.</p>
        <div class="inviter-mise">
          <form class="grp-form inviter-form" autocomplete="off">
            <label class="grp-champ"><span>Inviter à</span><select name="quoi"><option value="">Mission, tout le site</option>${options}</select></label>
            <label class="grp-champ"><span>Le message</span><textarea name="message" rows="6" maxlength="1200"></textarea></label>
            <div class="grp-boutons">
              <a class="doc principal grp-grand" data-inviter="whatsapp" href="#" target="_blank" rel="noopener">${icone.envoyer}Envoyer sur WhatsApp</a>
              ${navigator.share ? `<button type="button" class="doc" data-inviter="partager">${icone.partager}Autre application</button>` : ""}
              <button type="button" class="doc" data-inviter="copier">${icone.copier}Copier</button>
            </div>
          </form>
          <figure class="inviter-qr">
            <div class="qr-cadre" data-qr></div>
            <figcaption><strong data-qr-titre></strong><span data-qr-lien></span></figcaption>
            <button type="button" class="doc" data-inviter="imprimer">${icone.imprimer}Imprimer des cartes d’invitation</button>
          </figure>
        </div>
      </div>`;
    const f = app.querySelector(".inviter-form");
    const zoneQr = app.querySelector("[data-qr]");
    const whatsapp = app.querySelector('[data-inviter="whatsapp"]');
    let modifie = false;
    const etat = () => {
      const s = series[f.quoi.value] || null;
      return { s, lien: s ? lienPartage(s.id) : lienPartage("inviter"), direct: s ? `${SITE}#/serie/${s.id}` : SITE };
    };
    const majQr = () => {
      const { s, direct } = etat();
      app.querySelector("[data-qr-titre]").textContent = s ? s.titre : "Mission, études bibliques";
      app.querySelector("[data-qr-lien]").textContent = adresseCourte(direct);
      chargerQr().then(() => { if (zoneQr.isConnected) zoneQr.innerHTML = svgQr(direct); })
        .catch(() => { zoneQr.innerHTML = '<p class="grp-note">Le code ne s’affiche pas sans connexion.</p>'; });
    };
    const maj = (refaire) => {
      const { s, lien } = etat();
      if (refaire || !modifie) { f.message.value = messageInvitation(s, lien); modifie = false; }
      whatsapp.href = `https://wa.me/?text=${encodeURIComponent(f.message.value)}`;
    };
    maj(true);
    majQr();
    f.addEventListener("input", (ev) => { if (ev.target.name === "message") modifie = true; maj(false); });
    f.addEventListener("change", (ev) => {
      if (ev.target.name !== "quoi") return;
      history.replaceState(null, "", f.quoi.value ? `#/inviter/${f.quoi.value}` : "#/inviter");
      maj(false);
      majQr();
    });
    app.querySelector(".page-inviter").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-inviter]");
      if (!b) return;
      const quoi = b.dataset.inviter;
      if (quoi === "partager") { ev.preventDefault(); partagerTexte(f.message.value); }
      else if (quoi === "copier") { ev.preventDefault(); copierTexte(f.message.value); }
      else if (quoi === "imprimer") { ev.preventDefault(); imprimerCartes(etat()); }
    });
    return true;
  }
  // huit cartes par feuille A4, à découper : le nom, une phrase, le code QR et l’adresse
  function imprimerCartes({ s, direct }) {
    chargerQr().then(() => {
      document.getElementById("impression-cartes")?.remove();
      const zone = document.createElement("div");
      zone.id = "impression-cartes";
      const qr = svgQr(direct);
      const carte = `<div class="carte-invit">
          <div class="carte-invit-texte">
            <p class="carte-invit-nom">Mission</p>
            <p class="carte-invit-titre">${s ? fr(s.titre) : "Études bibliques"}</p>
            <p class="carte-invit-phrase">${s ? fr(s.texte) : "Rencontrer, grandir, mûrir en Jésus-Christ : des études à lire sur le téléphone, seul ou en petit groupe."}</p>
            <p class="carte-invit-lien">${esc(adresseCourte(direct))}</p>
          </div>
          <div class="carte-invit-qr">${qr}<span>Scannez-moi</span></div>
        </div>`;
      zone.innerHTML = carte.repeat(8);
      document.body.append(zone);
      corps.classList.add("impression-cartes");
      const fin = () => { corps.classList.remove("impression-cartes"); zone.remove(); window.removeEventListener("afterprint", fin); };
      window.addEventListener("afterprint", fin);
      window.print();
    }).catch(() => bulle("Le code QR ne s’affiche pas sans connexion."));
  }

  // ---------- navigation ----------
  const positions = new Map(); // défilement des pages quittées pour un document
  let premiere = true;
  let precedente = "";
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [page, ...reste] = h.split("/");
    const arg = reste.join("/");
    const estDoc = (h2) => h2.startsWith("lire/") || h2.startsWith("original/");
    const docDe = (h2) => (h2.startsWith("lire/") ? h2.slice(5) : h2.startsWith("original/") ? h2.slice(9) : null);
    if ((page === "lire" || page === "original") && precedente && !estDoc(precedente)) positions.set(precedente, window.scrollY);
    const depuisDocument = docDe(precedente);
    if (page !== "lire" && page !== "original") { fermerLecteur(); fermerTexte(); }
    arreterParole();
    fermerFeuille();
    if (page !== "shorts") fermerShorts();
    if (page !== "groupe") fermerGroupe();
    if (page === "lire" || page === "original") retourShorts = precedente.startsWith("shorts") || retourShorts === arg ? arg : null;
    corps.classList.toggle("en-lecture", page === "lire" || page === "original");
    corps.classList.toggle("en-shorts", page === "shorts");
    marquerNav(null);
    majOnglets(page);
    let champ = null;
    if (!page) accueil();
    else if (page === "niveau") niveau(arg);
    else if (page === "serie") serie(arg);
    else if (page === "chercher") champ = chercher(arg);
    else if (page === "shorts") shortsPage(arg);
    else if (page === "application") application();
    else if (page === "groupe") groupePage(arg);
    else if (page === "inviter") inviterPage(arg);
    else if (page === "commencer") commencerPage();
    else if (page === "carnet") carnetPage();
    else if (page === "versets") versetsPage();
    else if (page === "lire") { fermerLecteur(); fermerTexte(); if (aTexte(arg)) lireTexte(arg); else lire(arg); }
    else if (page === "original") { fermerLecteur(); fermerTexte(); lire(arg); }
    else introuvable();
    // retour d’un document : on retrouve sa place dans la liste
    const lienDoc = depuisDocument && app.querySelector(`a[href="#/lire/${CSS.escape(depuisDocument)}"]`);
    // lien rangé dans une liste « Leçons du jour » repliée : on la déplie
    const listeJours = lienDoc && lienDoc.closest(".jours");
    if (listeJours && listeJours.hidden) {
      const b = app.querySelector(`[aria-controls="${listeJours.id}"]`);
      if (b) basculerJours(b, true);
    }
    if (lienDoc && positions.has(h)) {
      window.scrollTo(0, positions.get(h));
      const r = lienDoc.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) lienDoc.scrollIntoView({ block: "center" });
      lienDoc.focus({ preventScroll: true });
    } else {
      window.scrollTo(0, 0);
      if (!premiere) {
        if (champ && !arg) champ.focus();
        else (app.querySelector("h1[tabindex]") || app).focus({ preventScroll: true });
      }
    }
    premiere = false;
    precedente = h;
    compterPage(page, arg);
  }

  window.addEventListener("hashchange", route);
  route();
  majPiedStats();
  viderEnvois();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
