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
    sommaire: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
    affichage: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19 8.5 5h1L15 19M5 14.5h8M15.5 19l3-8h.5l3 8M16.4 16.6h5.2"/></svg>',
    original: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 13h7M8.5 16.5h5"/></svg>',
    lecture: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5C17 4.5 14 5 12 6.5zM12 6.5V19.5"/></svg>',
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
      <p class="etude-titre">${fr(l.titre)}${l.sujet ? `<span class="cache"> — sujet : </span><span class="etude-sujet">${fr(l.sujet)}</span>` : ""}</p>
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
    majInstallation();
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
      s.lecons.forEach((l) => index.push({ type: "etude", s, l, cle: norm(l.titre + " " + (l.sujet || "") + " " + s.titre) }));
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
      return `<li class="resultat"><p class="resultat-titre">${fr(l.titre)}${l.sujet ? `<span class="cache"> — sujet : </span><span class="etude-sujet">${fr(l.sujet)}</span>` : ""}</p>
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
  const VERSION_LECTURE = "1";
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

  // document suivant de la série, du même genre (participant, animateur…)
  function suivant(e) {
    const { d, s, l } = e;
    if (!l) return null;
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
    const { d, s, l } = e;
    const titre = titreDoc(e);
    const sous = l && l.docs.length > 1 ? d.libelle : "";
    document.title = `${titre}${sous ? ` — ${sous}` : ""} — Mission`;
    const info = TEXTES[f] || {};
    const apres = suivant(e);
    const num = l && l.num ? `Étude ${l.num}` : "";
    const img = (l && l.image) || s.image;
    app.innerHTML = `
      <div class="lecture">
        <div class="lecteur-barre">
          <a class="lecteur-retour" href="#/serie/${s.id}" aria-label="Retour à la série ${esc(s.titre)}">${chevron}<span>${fr(s.titre)}</span></a>
          <div class="lecteur-titres">
            <h1 class="lecteur-titre" tabindex="-1">${fr(titre)}</h1>
            ${sous ? `<p class="lecteur-detail">${fr(sous)}</p>` : ""}
          </div>
          <div class="lecteur-actions">
            <button type="button" class="lecteur-bouton" data-ouvrir="sommaire" aria-label="Sommaire" hidden>${icone.sommaire}<span>Sommaire</span></button>
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
                <p class="lecture-fin-titre">Fin ${l ? "de l’étude" : "du document"}</p>
                ${apres
                  ? `<a class="lecture-action principale" href="#/lire/${esc(apres.d.f)}"><span>Suivante : ${fr(apres.l.titre)}</span>${chevronDroit}</a>`
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
        </div>
        <div class="voile-lecture" hidden></div>
        ${panneauAffichage()}
        <div class="panneau-lecture" id="panneau-sommaire" role="dialog" aria-modal="true" aria-labelledby="titre-sommaire" hidden>
          <div class="panneau-tete"><h2 id="titre-sommaire">Sommaire</h2><button type="button" class="panneau-fermer" data-fermer>Fermer</button></div>
          <ol class="sommaire-lecture"></ol>
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
    const paginer = (ratio) => {
      const m = parseFloat(getComputedStyle(defile).paddingLeft) || 16;
      const largeur = defile.clientWidth - 2 * m;
      if (largeur <= 0) return;
      contenu.style.width = `${largeur}px`;
      contenu.style.columnWidth = `${largeur}px`;
      contenu.style.columnGap = `${2 * m}px`;
      session.pas = largeur + 2 * m;
      defile.scrollLeft = 0;
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
        if (!cible) return;
        if (livre()) {
          const m = parseFloat(getComputedStyle(defile).paddingLeft) || 16;
          const x = cible.getBoundingClientRect().left - defile.getBoundingClientRect().left - m + defile.scrollLeft;
          allerPage(Math.floor((x + 2) / session.pas), true);
        } else {
          defile.scrollTo({ top: cible.getBoundingClientRect().top - defile.getBoundingClientRect().top + defile.scrollTop - 12 });
        }
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
        return;
      }
      progression();
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
        reponses(article, f, signal);
        const titres = [...article.querySelectorAll("h2")];
        const liste = titres.length >= 2 ? titres : [...article.querySelectorAll("h2, h3")];
        if (liste.length >= 2) {
          racine.querySelector(".sommaire-lecture").innerHTML = liste
            .map((t) => `<li class="${t.tagName === "H3" && titres.length >= 2 ? "sous" : ""}"><button type="button" data-aller="${esc(t.id)}">${esc(t.textContent)}</button></li>`)
            .join("");
          racine.querySelector('[data-ouvrir="sommaire"]').hidden = false;
        }
        appliquer(false);
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
    article.querySelectorAll("textarea[data-q]").forEach((t) => {
      t.value = memoire.lire(cle(`q${t.dataset.q}`), "");
      t.addEventListener("input", () => memoire.ecrire(cle(`q${t.dataset.q}`), t.value), { signal });
    });
    article.querySelectorAll("input.lec-blanc[data-b]").forEach((t) => {
      t.value = memoire.lire(cle(`b${t.dataset.b}`), "");
      t.addEventListener("input", () => memoire.ecrire(cle(`b${t.dataset.b}`), t.value), { signal });
    });
    article.querySelectorAll('input[type="checkbox"][data-c]').forEach((t) => {
      t.checked = memoire.lire(cle(`c${t.dataset.c}`), "") === "1";
      t.addEventListener("change", () => memoire.ecrire(cle(`c${t.dataset.c}`), t.checked ? "1" : ""), { signal });
    });
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
    corps.classList.toggle("en-lecture", page === "lire" || page === "original");
    marquerNav(null);
    let champ = null;
    if (!page) accueil();
    else if (page === "niveau") niveau(arg);
    else if (page === "serie") serie(arg);
    else if (page === "chercher") champ = chercher(arg);
    else if (page === "application") application();
    else if (page === "lire") { fermerLecteur(); fermerTexte(); if (aTexte(arg)) lireTexte(arg); else lire(arg); }
    else if (page === "original") { fermerLecteur(); fermerTexte(); lire(arg); }
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
