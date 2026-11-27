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
    const vignette = l.image
      ? `<span class="etude-vignette">${image(l.image, "")}${num}</span>`
      : `<span class="etude-vignette sans-image">${picto(s.niveau, "fond-picto")}${num}</span>`;
    return `<li class="etude${jours ? " avec-jours" : ""}">
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
            ${image(n.image, "cep-image", rang === 0)}
            ${n.parallele ? `<span class="cep-parallele-note">${fr(n.parallele)}</span>` : ""}
            <span class="cep-etape"><span class="num-etape" aria-hidden="true">${n.num}</span><span class="cep-verbe">${fr(n.titre)}</span></span>
            <span class="cep-texte">${fr(n.texte)}</span>
            ${n.invite ? `<strong class="cep-invite">${fr(n.invite)}</strong>` : ""}
            <span class="cep-compte">${pluriel(ss.length, "série", "séries")}, ${pluriel(nbEtudes(ss), "étude", "études")}</span>
          </a>
          <ul class="cep-series" aria-label="Séries de l’étape ${n.num}">${ss
            .map((s) => `<li><a href="#/serie/${s.id}"><span class="cep-serie-titre">${fr(s.titre)}${
              s.note ? ` <span class="cep-serie-note">(${fr(s.note)})</span>` : ""}</span><span class="cep-serie-compte">${compteSerie(s)}</span></a></li>`)
            .join("")}</ul>
        </li>`;
      })
      .join("");
    app.innerHTML = `
      <section class="accueil" aria-labelledby="accueil-titre">
        <div class="dedans accueil-tete">
          <div class="accueil-texte">
            <h1 id="accueil-titre" class="accueil-titre" tabindex="-1">Des études bibliques prêtes pour votre petit groupe</h1>
            <p class="accueil-chapeau">${total} études en français, rangées en trois étapes. Chaque étude a sa fiche du participant, souvent un guide pour l’animateur, et tout se lit ici, sur téléphone comme sur ordinateur.</p>
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
        ${etagereShorts()}
        <div class="dedans cep">
          <h2 class="cep-titre">Trois étapes, de la rencontre à la maturité</h2>
          <ol class="cep-liste">${etapes}</ol>
        </div>
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
            ${ressources}
          </div>
          ${liste}
        </div>
      </div>`;
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
      if (carte) Bible.montrerPassage(carte, Bible.lireReference(texte));
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
          <div class="bible-corps"><div class="bible-texte" aria-live="polite"></div></div>
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
    </div>`;
  }

  function panneauImpression(e, avecLecture) {
    const { d } = e;
    return `<div class="panneau-lecture" id="panneau-imprimer" role="dialog" aria-modal="true" aria-labelledby="titre-imprimer" hidden>
      <div class="panneau-tete"><h2 id="titre-imprimer">Imprimer</h2><button type="button" class="panneau-fermer" data-fermer>Fermer</button></div>
      <div class="impression-choix">
        <button type="button" class="lecture-action" data-imprimer="original"><span>Le document d’origine<small>La mise en page du PDF, avec ses images et ses lignes pour écrire</small></span>${icone.imprimer}</button>
        ${avecLecture ? `<button type="button" class="lecture-action" data-imprimer="lecture"><span>Ce que je lis, avec mes réponses<small>Le texte de cette page et ce que vous avez écrit</small></span>${icone.imprimer}</button>` : ""}
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
                ${apres
                  ? `<a class="lecture-action principale" href="#/lire/${esc(apres.d.f)}"><span>Suivante : ${fr(titreApres)}</span>${chevronDroit}</a>`
                  : `<a class="lecture-action principale" href="#/serie/${s.id}"><span>Retour à la série</span>${chevronDroit}</a>`}
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
          <div class="bible-corps"><div class="bible-texte" aria-live="polite"></div></div>
        </div>
        ${panneauImpression(e, true)}
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
    // toucher une référence biblique : le passage s’affiche dans le panneau (assets/bible.js)
    racine.addEventListener("click", (ev) => {
      const a = ev.target.closest('a.ref[data-ouvrir="bible"]');
      if (!a || ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      Bible.montrer(racine.querySelector("#panneau-bible"), a.getAttribute("href"));
    }, { signal });
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
    const synthese = "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function" ? window.speechSynthesis : null;
    const boutonEcouter = racine.querySelector("[data-ecouter]");
    const barreEcoute = racine.querySelector(".ecoute-barre");
    const VITESSES = [[1, "1×", "Vitesse normale"], [1.25, "1,25×", "Plus rapide"], [0.8, "0,8×", "Plus lent"]];
    let ecoute = null; // { blocs, i, morceaux, j, vitesse, pause, u }
    const voixFr = () => {
      const v = synthese.getVoices().filter((x) => /^fr([-_]|$)/i.test(x.lang));
      return v.find((x) => /fr[-_]FR/i.test(x.lang) && x.localService) || v.find((x) => /fr[-_]FR/i.test(x.lang)) || v[0] || null;
    };
    // « Jean 3:16-18 » se dit « Jean chapitre 3, versets 16 à 18 »
    const pourOreille = (t) => t
      .replace(/(\d+):(\d+) – (\d+):(\d+)/g, "chapitre $1, verset $2, au chapitre $3, verset $4")
      .replace(/(\d+):(\d+)-(\d+)/g, "chapitre $1, versets $2 à $3")
      .replace(/(\d+):(\d+)/g, "chapitre $1, verset $2");
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
      synthese.cancel();
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
        synthese.cancel();
        barreEcoute.hidden = false;
        boutonEcouter.setAttribute("aria-pressed", "true");
        majBarre();
        dire();
      }, { signal });
      barreEcoute.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-ecoute]");
        if (!b || !ecoute) return;
        const quoi = b.dataset.ecoute;
        if (quoi === "stop") { finEcoute(); return; }
        if (quoi === "pause") {
          ecoute.pause = !ecoute.pause;
          ecoute.u = null;
          synthese.cancel();
          if (!ecoute.pause) dire();
        } else if (quoi === "vitesse") {
          const k = VITESSES.findIndex(([x]) => x === ecoute.vitesse);
          ecoute.vitesse = VITESSES[(k + 1) % VITESSES.length][0];
          memoire.ecrire("mission.lecture.vitesse", String(ecoute.vitesse));
          if (!ecoute.pause) { ecoute.u = null; synthese.cancel(); dire(); }
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
      if (!livre() || ev.target.closest("textarea, input, a, button, label, select")) return;
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
  function reponses(article, f, signal) {
    const cle = (k) => `mission.rep.${f}.${k}`;
    // une question sans zone de réponse (études à compléter, comme Historacles) en reçoit une, comme dans
    // les autres études ; pas dans les fiches de l’animateur, qui donnent déjà les réponses
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
      ol.innerHTML = ordreDuJour(tous).slice(0, 12).map((x) => `<li><a class="etagere-short" href="#/shorts/${esc(x.id)}">
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
      clearTimeout(minuterieVu);
      minuterieVu = setTimeout(() => { if (!signal.aborted && location.hash === `#/shorts/${id}`) vus.noter(id); }, 1500);
    }), { root: flux, threshold: 0.6 });
    signal.addEventListener("abort", () => clearTimeout(minuterieVu));
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
      const carte = ev.target.closest(".short");
      const x = carte && SH.find((y) => y.id === carte.dataset.id);
      if (!x) return;
      const aimer = ev.target.closest("[data-aimer]");
      if (aimer) {
        const oui = aimes.basculer(x.id);
        aimer.setAttribute("aria-pressed", String(oui));
        aimer.classList.remove("bat");
        if (oui) { void aimer.offsetWidth; aimer.classList.add("bat"); }
        return;
      }
      const p = ev.target.closest("[data-partager-short]");
      if (p) partagerShort(x, p);
    }, { signal });
    // l’image à partager se prépare dès que le doigt touche le bouton
    app.addEventListener("pointerdown", (ev) => {
      const p = ev.target.closest("[data-partager-short]");
      const carte = p && p.closest(".short");
      const x = carte && SH.find((y) => y.id === carte.dataset.id);
      if (x) fichierShort(x).catch(() => {});
    }, { signal });
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
  async function imageShort(x) {
    const L = 1080, H = 1350, M = 84;
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
    if (photo) g.drawImage(photo, 0, 0, L, (L * photo.height) / photo.width);
    else {
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
        g.drawImage(dessin, L - 620, 60, 680, 680);
        g.globalAlpha = 1;
      }
    }
    const voile = g.createLinearGradient(0, 0, 0, H);
    voile.addColorStop(0, "rgba(15,35,33,0.5)");
    voile.addColorStop(0.28, "rgba(15,35,33,0.42)");
    voile.addColorStop(0.58, "rgba(15,35,33,0.94)");
    voile.addColorStop(1, "#0f2321");
    g.fillStyle = voile;
    g.fillRect(0, 0, L, H);
    g.textBaseline = "alphabetic";
    g.fillStyle = "#fff";
    // en haut : la série et l’étude
    g.font = '700 32px "Atkinson Hyperlegible", sans-serif';
    g.fillText(couper(g, x.serie.titre, L - 2 * M)[0], M, M + 28);
    g.font = '400 29px "Atkinson Hyperlegible", sans-serif';
    g.globalAlpha = 0.82;
    g.fillText(couper(g, ouShort(x.lecon), L - 2 * M)[0], M, M + 72);
    g.globalAlpha = 1;
    // en bas : la signature
    const bas = H - M;
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
    let k = 1, idee, vers, ref, hIdee, hVers, total;
    for (let essai = 0; essai < 7; essai++, k *= 0.93) {
      g.font = `600 ${Math.round(62 * k)}px "Alegreya", serif`;
      idee = couper(g, x.i, large);
      g.font = `400 ${Math.round(36 * k)}px "Atkinson Hyperlegible", sans-serif`;
      vers = couper(g, x.t, large - 80);
      hIdee = idee.length * 72 * k;
      hVers = vers.length * 51 * k + 30 * k + 22 + 80;
      total = hIdee + 48 + hVers;
      if (bas - 90 - total >= M + 140) break;
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
  function fichierShort(x) {
    if (!imagesShorts.has(x.id)) {
      const p = imageShort(x).then((b) => new File([b], `mission-${x.s}-${x.n + 1}.jpg`, { type: "image/jpeg" }));
      p.catch(() => imagesShorts.delete(x.id));
      imagesShorts.set(x.id, p);
    }
    return imagesShorts.get(x.id);
  }
  async function partagerShort(x, bouton) {
    const lien = `${location.origin}${location.pathname}#/lire/${x.f}`;
    const texte = `${x.i}\n${x.r}`;
    bouton.setAttribute("aria-busy", "true");
    try {
      let fichier = null;
      if (navigator.canShare) fichier = await fichierShort(x).catch(() => null);
      if (fichier && navigator.canShare({ files: [fichier] })) {
        await navigator.share({ files: [fichier], title: x.lecon.titre, text: `${texte}\n${lien}` });
      } else if (navigator.share) {
        await navigator.share({ title: x.lecon.titre, text: texte, url: lien });
      } else {
        await navigator.clipboard.writeText(`${texte}\n${lien}`);
        bulle("Lien copié : collez-le dans un message.");
      }
    } catch (e) {
      // le partage demande un toucher tout frais : l’image est prête, un second toucher suffit
      if (e && e.name === "NotAllowedError") bulle("L’image est prête : touchez encore « Partager ».");
      else if (!e || e.name !== "AbortError") bulle("Le partage n’a pas abouti.");
    } finally {
      bouton.removeAttribute("aria-busy");
    }
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
    if (page !== "shorts") fermerShorts();
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
  }

  window.addEventListener("hashchange", route);
  route();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
