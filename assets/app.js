/* Mission — affichage de la bibliothèque (données : donnees/bibliotheque.js). */
(function () {
  "use strict";

  const B = window.BIBLIO;
  const app = document.getElementById("contenu");
  const PICTOS = { connaitre: "pousse", grandir: "rameau", murir: "grappe" };
  const niveaux = Object.fromEntries(B.niveaux.map((n) => [n.id, n]));
  const series = Object.fromEntries(B.series.map((s) => [s.id, s]));

  // ---------- outils ----------
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // typographie française : espace insécable avant : ? ! ;
  const fr = (s) => esc(s).replace(/ ([:?!;»])/g, " $1").replace(/« /g, "« ");
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").toLowerCase();
  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
  const lienDrive = (id) => `https://drive.google.com/file/d/${encodeURIComponent(id)}/view?usp=sharing`;
  const picto = (id, classe) =>
    `<svg class="${classe || ""}" viewBox="0 0 48 48" aria-hidden="true"><use href="#${PICTOS[id]}"/></svg>`;
  const chevron = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5"/></svg>';
  const loupe = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>';
  // images des études (assets/images/<nom>.webp, 4:3) : décoratives, le titre est juste à côté
  const image = (nom, classe, prioritaire) =>
    nom
      ? `<img class="${classe}" src="assets/images/${encodeURIComponent(nom)}.webp" alt="" width="800" height="600" ${
          prioritaire ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
      : "";

  const seriesDe = (niveauId) => B.series.filter((s) => s.niveau === niveauId);
  const nbEtudes = (liste) => liste.reduce((t, s) => t + s.lecons.length, 0);
  const formatsDe = (s) => {
    const f = new Set();
    s.lecons.forEach((l) => l.docs.forEach((d) => f.add(d.format)));
    s.ressources.forEach((d) => f.add(d.format));
    const tab = [...f];
    return tab.length > 1 ? tab.slice(0, -1).join(", ") + " et " + tab[tab.length - 1] : tab[0] || "";
  };
  const compteSerie = (s) =>
    s.lecons.length
      ? `${pluriel(s.lecons.length, "étude", "études")}, en ${formatsDe(s)}`
      : `${pluriel(s.ressources.length, "document", "documents")}, en ${formatsDe(s)}`;

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

  function bouton(doc, libelle, principal, avecFormat = true, aria = "") {
    return `<a class="doc${principal ? " principal" : ""}" href="${lienDrive(doc.id)}" target="_blank" rel="noopener"${
      aria ? ` aria-label="${esc(aria)}"` : ""}>
      <span>${fr(libelle)}</span>${avecFormat ? `<span class="doc-format">${esc(doc.format)}</span>` : ""}</a>`;
  }

  // une étude : titre seul cliquable si un seul document, sinon un bouton par document
  function etude(l, boutons, avecFormat) {
    const num = l.num ? `<span class="etude-num" aria-hidden="true">${esc(l.num)}</span>` : "";
    const nomComplet = (l.num ? `Étude ${l.num} : ` : "") + l.titre;
    let corps;
    if (l.docs.length === 1 && !boutons) {
      const d = l.docs[0];
      corps = `<a class="etude-titre" href="${lienDrive(d.id)}" target="_blank" rel="noopener"
        aria-label="${esc(nomComplet)}, ${esc(d.format)}">${fr(l.titre)}</a>${
        avecFormat ? `<span class="format-seul">${esc(d.format)}</span>` : ""}`;
    } else {
      corps = `<p class="etude-titre">${fr(l.titre)}</p>
        <div class="etude-docs">
          ${l.docs.map((d, i) => bouton(d, COURTS[d.libelle] || d.libelle, i === 0 && d.role !== "animateur",
            avecFormat, `${d.libelle}, ${nomComplet}, ${d.format}`)).join("")}
        </div>`;
    }
    if (l.image) {
      return `<li class="etude avec-image"><span class="etude-vignette">${image(l.image, "")}${num}</span><div>${corps}</div></li>`;
    }
    return `<li class="etude${l.num ? "" : " sans-num"}">${num}<div>${corps}</div></li>`;
  }

  // ---------- pages ----------
  function accueil() {
    document.title = "Mission — études bibliques pour les petits groupes";
    const niveauxHtml = B.niveaux
      .map((n, rang) => {
        const ss = seriesDe(n.id);
        return `<li class="cep-niveau">
          <a class="cep-lien" href="#/niveau/${n.id}">
            <span class="cep-picto">${picto(n.id)}</span>
            <span>
              <span class="cep-verbe">${esc(n.verbe)}</span>
              <span class="cep-texte">${fr(n.texte)}</span>
              <span class="cep-compte">${pluriel(ss.length, "série", "séries")}, ${pluriel(nbEtudes(ss), "étude", "études")}</span>
              ${image(n.image, "cep-image", rang === 0)}
            </span>
          </a>
        </li>`;
      })
      .join("");
    app.innerHTML = `
      <section class="cep" aria-labelledby="cep-titre">
        <div class="cep-dedans">
          <h1 id="cep-titre" class="cep-intro">Des études bibliques pour les petits groupes, en trois étapes. Choisissez-en une.</h1>
          <ul class="cep-liste">${niveauxHtml}</ul>
        </div>
      </section>
      <form class="recherche" role="search" action="#/chercher">
        <label for="q-accueil">Chercher une étude</label>
        <div class="champ">${loupe}<input id="q-accueil" name="q" type="search" autocomplete="off"
          placeholder="baptême, prière, sabbat, Daniel…" enterkeyhint="search"></div>
        <p class="recherche-aide">Par sujet, par titre ou par personnage de la Bible.</p>
      </form>
      <section class="mode" aria-labelledby="mode-titre">
        <h2 id="mode-titre">Comment s’en servir</h2>
        <p>Chaque étape regroupe plusieurs séries. Une série se suit dans l’ordre, une étude par rencontre.</p>
        <p>La <strong>fiche du participant</strong> est pour chacun. Le <strong>guide de l’animateur</strong> aide celui qui conduit le groupe : réponses, questions à poser, déroulement.</p>
        <p>Pour partager une étude, envoyez le lien de la page de la série.</p>
      </section>`;
    const liste = app.querySelector(".cep-liste");
    if (!sessionStorage.getItem("mission-vu")) {
      liste.classList.add("pousse");
      try { sessionStorage.setItem("mission-vu", "1"); } catch (e) { /* navigation privée */ }
    }
    app.querySelector(".recherche").addEventListener("submit", (e) => {
      e.preventDefault();
      const q = e.target.q.value.trim();
      location.hash = "#/chercher/" + encodeURIComponent(q);
    });
  }

  function niveau(id) {
    const n = niveaux[id];
    if (!n) return introuvable();
    const ss = seriesDe(id);
    document.title = `${n.verbe} — ${n.titre} — Mission`;
    app.innerHTML = `
      <div class="page">
        <a class="retour" href="#/">${chevron}Accueil</a>
        <h1 class="titre-page titre-niveau" tabindex="-1">${picto(id)}${esc(n.verbe)}</h1>
        <p class="chapeau"><strong>${fr(n.titre)}.</strong> ${fr(n.texte)}</p>
        <p class="compte">${pluriel(ss.length, "série", "séries")}, ${pluriel(nbEtudes(ss), "étude", "études")}</p>
        ${image(n.image, "page-image", true)}
        <ul class="series">
          ${ss
            .map(
              (s) => `<li><a class="serie-lien${s.image ? " avec-image" : ""}" href="#/serie/${s.id}">
                ${image(s.image, "serie-image")}
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
    const ressources = s.ressources.length
      ? `<section class="ressources" aria-label="${s.lecons.length ? "Pour bien commencer" : "Documents"}">
          <h2>${s.lecons.length ? "Pour bien commencer" : "Documents"}</h2>
          <ul>${s.ressources.map((d, i) => `<li>${bouton(d, d.titre, !s.lecons.length && i === 0)}</li>`).join("")}</ul>
        </section>`
      : "";
    // études regroupées (ex. études complémentaires)
    let html = "";
    let groupe = null;
    let ouvert = false;
    const boutons = s.lecons.some((l) => l.docs.length > 1);
    const formats = new Set(s.lecons.flatMap((l) => l.docs.map((d) => d.format)));
    const avecFormat = formats.size > 1;
    let legende = "";
    if (boutons) {
      const vus = new Set(s.lecons.flatMap((l) => l.docs.map((d) => COURTS[d.libelle] || d.libelle)));
      const phrases = Object.keys(AIDE).filter((k) => vus.has(k)).map((k) => AIDE[k]);
      if (phrases.length) legende = `<p class="legende">${fr(phrases.join(" ; "))}.</p>`;
    }
    s.lecons.forEach((l) => {
      if ((l.groupe || null) !== groupe) {
        if (ouvert) html += "</ul>";
        groupe = l.groupe || null;
        if (groupe) html += `<h3 class="groupe-titre">${fr(groupe)}</h3>`;
        html += '<ul class="etudes">';
        ouvert = true;
      }
      html += etude(l, boutons, avecFormat);
    });
    if (ouvert) html += "</ul>";
    const seul = s.lecons.length === 1 && s.lecons[0].docs.length === 1 ? s.lecons[0].docs[0] : null;
    if (seul) {
      html = `<p class="ouvrir-seul">${bouton(seul, "Ouvrir l’étude", true)}</p>`;
    }
    app.innerHTML = `
      <div class="page">
        <a class="retour" href="#/niveau/${n.id}">${chevron}${esc(n.verbe)}</a>
        <h1 class="titre-page" tabindex="-1">${fr(s.titre)}</h1>
        <p class="chapeau">${fr(s.texte)}</p>
        <p class="compte">${compteSerie(s)}</p>
        ${image(s.image, "page-image", true)}
        ${ressources}
        ${s.lecons.length ? `${s.lecons.length > 1 ? `<h2 class="etudes-titre">Les études</h2>${legende}` : ""}${html}` : ""}
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
      <div class="page">
        <a class="retour" href="#/">${chevron}Accueil</a>
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
        return `<li class="resultat"><a class="etude-titre" href="#/serie/${e.s.id}">${fr(e.s.titre)}</a>
          <span class="resultat-ou">Série, ${compteSerie(e.s)}. Étape <a href="#/niveau/${n.id}">${esc(n.verbe)}</a></span></li>`;
      }
      const l = e.l;
      const docs = l.docs.length === 1
        ? `<a class="etude-titre" href="${lienDrive(l.docs[0].id)}" target="_blank" rel="noopener">${fr(l.titre)}</a><span class="format-seul">${esc(l.docs[0].format)}</span>`
        : `<p class="etude-titre">${fr(l.titre)}</p><div class="etude-docs">${l.docs.map((d, i) => bouton(d, d.libelle, i === 0 && d.role !== "animateur")).join("")}</div>`;
      return `<li class="resultat">${docs}
        <span class="resultat-ou">${l.num ? `Étude ${esc(l.num)} de ` : ""}<a href="#/serie/${e.s.id}">${fr(e.s.titre)}</a>, étape ${esc(n.verbe)}</span></li>`;
    });
    const plus = trouves.length > 60 ? `<p class="recherche-aide">Les 60 premiers résultats sur ${trouves.length}. Ajoutez un mot pour préciser.</p>` : "";
    return `<p class="compte">${pluriel(trouves.length, "résultat", "résultats")}</p><ul class="resultats">${lignes.join("")}</ul>${plus}`;
  }

  function introuvable() {
    document.title = "Page introuvable — Mission";
    app.innerHTML = `<div class="page">
      <a class="retour" href="#/">${chevron}Accueil</a>
      <h1 class="titre-page" tabindex="-1">Cette page n’existe pas</h1>
      <p>Le lien est peut-être ancien. Toutes les études sont rangées dans les trois étapes de l’accueil.</p></div>`;
    return true;
  }

  // ---------- navigation ----------
  let premiere = true;
  function route() {
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    const [page, ...reste] = h.split("/");
    const arg = reste.join("/");
    let champ = null;
    if (!page) accueil();
    else if (page === "niveau") niveau(arg);
    else if (page === "serie") serie(arg);
    else if (page === "chercher") champ = chercher(arg);
    else introuvable();
    window.scrollTo(0, 0);
    if (!premiere) {
      if (champ && !arg) champ.focus();
      else (app.querySelector("h1[tabindex]") || app).focus({ preventScroll: true });
    }
    premiere = false;
  }

  window.addEventListener("hashchange", route);
  route();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
