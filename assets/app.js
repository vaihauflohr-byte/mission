/* Mission — affichage de la bibliothèque (données : donnees/bibliotheque.js)
   et lecteur de documents intégré (PDF.js, chargé à la première ouverture d’un document). */
(function () {
  "use strict";

  const B = window.BIBLIO;
  const app = document.getElementById("contenu");
  const corps = document.body;
  const PICTOS = { connaitre: "pousse", grandir: "rameau", murir: "grappe" };
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
  };
  // images (assets/images/<nom>.webp, 4:3) : décoratives, le titre est juste à côté
  const image = (nom, classe, prioritaire) =>
    nom
      ? `<img class="${classe}" src="assets/images/${encodeURIComponent(nom)}.webp" alt="" width="800" height="600" ${
          prioritaire ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" onerror="this.style.visibility='hidden'">`
      : "";

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
    "Participant": "« Participant » ouvre la fiche du participant",
    "Animateur": "« Animateur » ouvre le guide de l’animateur",
    "Avec les réponses": "« Avec les réponses » ouvre la fiche déjà remplie, pour l’animateur",
    "Notes de présentation": "« Notes de présentation » donne ce que l’animateur peut dire",
  };

  // ---------- documents ----------
  // chaque document importé a un chemin (d.f) : documents/<d.f>.pdf, lu dans #/lire/<d.f>
  const documents = new Map();
  B.series.forEach((s) => {
    s.lecons.forEach((l) => l.docs.forEach((d) => d.f && documents.set(d.f, { d, s, l })));
    s.ressources.forEach((d) => d.f && documents.set(d.f, { d, s, l: null }));
  });
  const fichierPdf = (d) => `documents/${d.f}.pdf`;
  // document pas encore importé : lien de secours vers le Drive
  const cible = (d) =>
    d.f ? `href="#/lire/${esc(d.f)}"` : `href="https://drive.google.com/file/d/${encodeURIComponent(d.id)}/view" target="_blank" rel="noopener"`;
  const estPresentation = (d) => d.format === "PowerPoint";
  const titreDoc = ({ d, l }) => (l ? l.titre : d.titre);
  const detailDoc = ({ d, l }) => {
    const parties = [];
    if (l && l.docs.length > 1) parties.push(d.libelle);
    else if (estPresentation(d)) parties.push("Présentation");
    if (d.p) parties.push(estPresentation(d) ? pluriel(d.p, "diapositive", "diapositives") : pluriel(d.p, "page", "pages"));
    return parties.join(", ");
  };
  const nomFichier = ({ d, l }) =>
    ((l ? (l.num ? `Étude ${l.num} – ` : "") + l.titre + (l.docs.length > 1 ? ` (${d.libelle})` : "") : d.titre)
      .replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim() + ".pdf");

  function bouton(d, libelle, principal, aria) {
    return `<a class="doc${principal ? " principal" : ""}" ${cible(d)}${aria ? ` aria-label="${esc(aria)}"` : ""}>${fr(libelle)}</a>`;
  }

  // une étude : un bouton par document (« Ouvrir » s’il n’y en a qu’un)
  function etude(l, s) {
    const nomComplet = (l.num ? `Étude ${l.num} : ` : "") + l.titre;
    const num = l.num ? `<span class="etude-num" aria-hidden="true">${esc(l.num)}</span>` : "";
    const boutons = l.docs.length === 1
      ? bouton(l.docs[0], estPresentation(l.docs[0]) ? "Voir" : "Ouvrir", true, `${estPresentation(l.docs[0]) ? "Voir" : "Ouvrir"} : ${nomComplet}`)
      : l.docs.map((d, i) => bouton(d, COURTS[d.libelle] || d.libelle, i === 0 && d.role !== "animateur", `${d.libelle} : ${nomComplet}`)).join("");
    const vignette = l.image
      ? `<span class="etude-vignette">${image(l.image, "")}${num}</span>`
      : `<span class="etude-vignette sans-image">${num}</span>`;
    return `<li class="etude">
      ${vignette}
      <p class="etude-titre">${fr(l.titre)}</p>
      <div class="etude-docs">${boutons}</div>
    </li>`;
  }

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

  // ---------- pages ----------
  function accueil() {
    document.title = "Mission — études bibliques pour les petits groupes";
    const total = nbEtudes(B.series);
    const etapes = B.niveaux
      .map((n, rang) => {
        const ss = seriesDe(n.id);
        return `<li class="cep-niveau">
          <a class="cep-lien" href="#/niveau/${n.id}">
            <span class="cep-picto">${picto(n.id)}</span>
            ${image(n.image, "cep-image", rang === 0)}
            <span class="cep-etape"><span class="num-etape" aria-hidden="true">${n.num}</span><span class="cep-verbe">${fr(n.titre)}</span></span>
            <span class="cep-texte">${fr(n.texte)}</span>
            ${n.invite ? `<strong class="cep-invite">${fr(n.invite)}</strong>` : ""}
            <span class="cep-compte">${pluriel(ss.length, "série", "séries")}, ${pluriel(nbEtudes(ss), "étude", "études")}</span>
          </a>
        </li>`;
      })
      .join("");
    app.innerHTML = `
      <section class="accueil" aria-labelledby="accueil-titre">
        <div class="dedans accueil-tete">
          <div class="accueil-texte">
            <h1 id="accueil-titre" class="accueil-titre" tabindex="-1">Des études bibliques prêtes pour votre petit groupe</h1>
            <p class="accueil-chapeau">${total} études en français, rangées en trois étapes. Chaque étude a sa fiche du participant, souvent un guide pour l’animateur, et tout se lit ici, sur téléphone comme sur ordinateur.</p>
          </div>
          <form class="recherche" role="search" action="#/chercher">
            <label for="q-accueil">Chercher une étude par sujet, titre ou personnage</label>
            <div class="champ">${loupe}<input id="q-accueil" name="q" type="search" autocomplete="off"
              placeholder="baptême, prière, sabbat, Daniel…" enterkeyhint="search"><button type="submit">Chercher</button></div>
            <p class="exemples">Par exemple : ${["prière", "baptême", "sabbat", "Daniel", "Saint-Esprit", "mort"]
              .map((m) => `<a href="#/chercher/${encodeURIComponent(m)}">${esc(m)}</a>`).join(", ")}.</p>
          </form>
        </div>
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
            <div><dt>Lire, télécharger, imprimer</dt><dd>Chaque document s’ouvre ici, sur le site. Le bouton Télécharger donne le PDF, à garder sur son téléphone ou à imprimer.</dd></div>
            <div><dt>Partager</dt><dd>Chaque série et chaque document ont leur propre lien : envoyez-le pour inviter quelqu’un.</dd></div>
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
    return true;
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
        const vus = new Set(s.lecons.flatMap((l) => l.docs.map((d) => COURTS[d.libelle] || d.libelle)));
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

  // ---------- recherche ----------
  let index = null;
  function construireIndex() {
    index = [];
    B.series.forEach((s) => {
      index.push({ type: "serie", s, cle: norm(s.titre + " " + s.texte) });
      s.lecons.forEach((l) => index.push({ type: "etude", s, l, cle: norm(l.titre + " " + s.titre) }));
    });
  }

  function chercher(q) {
    document.title = "Chercher une étude — Mission";
    app.innerHTML = `
      <div class="page page-recherche">
        ${fil([["Accueil", "#/"], ["Chercher une étude"]])}
        <h1 class="titre-page" tabindex="-1">Chercher une étude</h1>
        <form class="recherche-page" role="search">
          <div class="champ">${loupe}<input id="q" type="search" autocomplete="off" aria-label="Chercher une étude"
            placeholder="baptême, prière, sabbat, Daniel…" enterkeyhint="search" value="${esc(q)}"></div>
        </form>
        <div id="resultats" aria-live="polite"></div>
      </div>`;
    const champ = app.querySelector("#q");
    const zone = app.querySelector("#resultats");
    const afficher = () => {
      const texte = champ.value.trim();
      history.replaceState(null, "", "#/chercher/" + encodeURIComponent(texte));
      zone.innerHTML = resultats(texte);
    };
    champ.addEventListener("input", afficher);
    app.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); champ.blur(); });
    zone.innerHTML = resultats(q);
    return champ;
  }

  function resultats(q) {
    if (!q) return `<p class="recherche-aide">Tapez un mot : <em>baptême</em>, <em>prière</em>, <em>Nicodème</em>, <em>sanctuaire</em>…</p>`;
    if (!index) construireIndex();
    const mots = norm(q).split(/\s+/).filter((m) => m.length > 1 || /\d/.test(m));
    if (!mots.length) return "";
    const trouves = index.filter((e) => mots.every((m) => e.cle.includes(m)));
    if (!trouves.length) {
      return `<p class="vide">Aucune étude ne contient « ${esc(q)} ». Essayez un autre mot, ou parcourez les trois étapes depuis l’accueil.</p>`;
    }
    const lignes = trouves.slice(0, 60).map((e) => {
      const n = niveaux[e.s.niveau];
      if (e.type === "serie") {
        return `<li class="resultat"><a class="resultat-titre" href="#/serie/${e.s.id}">${fr(e.s.titre)}</a>
          <span class="resultat-ou">Série de ${compteSerie(e.s)}, étape ${esc(n.verbe)}</span></li>`;
      }
      const l = e.l;
      const nomComplet = (l.num ? `Étude ${l.num} : ` : "") + l.titre;
      const boutons = l.docs.length === 1
        ? bouton(l.docs[0], estPresentation(l.docs[0]) ? "Voir" : "Ouvrir", true, `${estPresentation(l.docs[0]) ? "Voir" : "Ouvrir"} : ${nomComplet}`)
        : l.docs.map((d, i) => bouton(d, COURTS[d.libelle] || d.libelle, i === 0 && d.role !== "animateur", `${d.libelle} : ${nomComplet}`)).join("");
      return `<li class="resultat"><p class="resultat-titre">${fr(l.titre)}</p>
        <span class="resultat-ou">${l.num ? `Étude ${esc(l.num)} de ` : ""}<a href="#/serie/${e.s.id}">${fr(e.s.titre)}</a>, étape ${esc(n.verbe)}</span>
        <div class="etude-docs">${boutons}</div></li>`;
    });
    const plus = trouves.length > 60 ? `<p class="recherche-aide">Les 60 premiers résultats sur ${trouves.length}. Ajoutez un mot pour préciser.</p>` : "";
    return `<p class="compte">${pluriel(trouves.length, "résultat", "résultats")}</p><ul class="resultats">${lignes.join("")}</ul>${plus}`;
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
    document.title = `${titre}${e.l && e.l.docs.length > 1 ? ` — ${d.libelle}` : ""} — Mission`;
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
          <a class="lecteur-retour" href="#/serie/${s.id}" aria-label="Retour à la série ${esc(s.titre)}">${chevron}<span>${fr(s.titre)}</span></a>
          <div class="lecteur-titres">
            <h1 class="lecteur-titre" tabindex="-1">${fr(titre)}</h1>
            ${detail ? `<p class="lecteur-detail">${fr(detail)}</p>` : ""}
          </div>
          <div class="lecteur-actions">
            ${estPresentation(d) ? `<button type="button" class="lecteur-bouton lecteur-projeter" aria-label="Projeter en plein écran, une diapositive à la fois" hidden>${icone.projeter}<span>Projeter</span></button>` : ""}
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
      </div>`;
    const session = (lecture = { ac: new AbortController(), tache: null, viewer: null });
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

  // ---------- navigation ----------
  const positions = new Map(); // défilement des pages quittées pour un document
  let premiere = true;
  let precedente = "";
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [page, ...reste] = h.split("/");
    const arg = reste.join("/");
    if (page === "lire" && precedente && !precedente.startsWith("lire/")) positions.set(precedente, window.scrollY);
    const depuisDocument = precedente.startsWith("lire/") ? precedente.slice(5) : null;
    if (page !== "lire") fermerLecteur();
    corps.classList.toggle("en-lecture", page === "lire");
    marquerNav(null);
    let champ = null;
    if (!page) accueil();
    else if (page === "niveau") niveau(arg);
    else if (page === "serie") serie(arg);
    else if (page === "chercher") champ = chercher(arg);
    else if (page === "lire") { fermerLecteur(); lire(arg); }
    else introuvable();
    // retour d’un document : on retrouve sa place dans la liste
    const lienDoc = depuisDocument && app.querySelector(`a[href="#/lire/${CSS.escape(depuisDocument)}"]`);
    if (lienDoc && positions.has(h)) {
      window.scrollTo(0, positions.get(h));
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
