# Mission — études bibliques pour les petits groupes

Site statique (GitHub Pages) publié sur **https://mission.ka-ilei.com**.
Aucun serveur, aucune base de données : le site range la bibliothèque d’études et affiche chaque document lui-même, en PDF, sans passer par Google Drive.

## Ce que fait le site

- **Accueil** : les trois étapes, numérotées : *1. Rencontrer Jésus-Christ*, *2. Grandir en Jésus-Christ*, *3. Mûrir en Jésus-Christ* (dossiers « 1 - Pour connaitre Jesus », « 2 - Pour grandir en Jésus », « 3 - Mûrir en Jésus » du Drive ; l’identifiant de la première reste `connaitre` dans les liens), la recherche et le mode d’emploi. « Convient (aussi) à des invités » est en gras sous les étapes 1 et 2.
- **Étape** : ses séries, avec une image, une phrase de présentation et le nombre d’études.
- **Série** : les études dans l’ordre. Un bouton par document : *Participant* (fiche du participant), *Animateur* (guide de l’animateur), *Avec les réponses*, *Notes de présentation* ; *Ouvrir* ou *Voir* quand il n’y en a qu’un. Les plans du cours, brochures et révisions sont dans « Pour bien commencer ».
- **Lecteur** (`#/lire/<série>/<document>`) : le document s’affiche dans le site (PDF.js), page après page, à la largeur de l’écran. On zoome en pinçant (téléphone), avec Ctrl + molette ou les boutons − / + (ordinateur). *Télécharger* donne le PDF ; pour les présentations, le menu propose aussi le PowerPoint d’origine, avec les animations, et *Projeter* les montre en plein écran, une diapositive à la fois (flèches ou clic pour avancer).
- **Chercher** : par mot, sans tenir compte des accents (`bapteme` trouve « baptême »).
- **Appli** : le site s’installe sur l’écran d’accueil du téléphone ; la liste des études reste consultable sans réseau. Les documents, eux, demandent une connexion (ou se téléchargent).

## Les documents

Ils sont dans `documents/<série>/<nom>.pdf` (333 fichiers, 370 Mo environ ; GitHub Pages accepte 1 Go).
Ils viennent du dossier Drive **Eglise / Etude petit groupe** (compte vaihau.flohr@gmail.com) ; chaque série du site correspond à un dossier, listé dans `SERIES` en tête de `outils/generer_bibliotheque.py`.

L’import a été fait une fois par une tâche GitHub (`outils/documents/importer.py`) :

- les PDF sont repris tels quels, avec le titre français dans leurs propriétés ;
- les Word, PowerPoint et Excel sont convertis en PDF avec LibreOffice. Les polices d’origine ne sont pas libres : `outils/documents/polices.conf` leur donne des équivalents (Century Gothic → URW Gothic, de mêmes dimensions ; Garamond → EB Garamond ; Gill Sans → Gillius ; Tahoma → la Tahoma de Wine). Les images des présentations sont réduites pour l’écran (30 à 86 Mo par présentation au départ, 4 à 14 Mo en PDF) ;
- les modifications suivies des fichiers Word sont acceptées, les feuilles techniques du tableau Excel (« Formules », « Présentation ») ne sont pas imprimées ;
- les PowerPoint d’origine (1,3 Go, trop lourds pour le site) sont dans la publication GitHub **powerpoint** du dépôt ; le tableau Excel d’origine est à côté de son PDF.

`outils/documents/resultat.json` garde, pour chaque document, son poids, son nombre de pages et les polices du PDF.
`outils/documents/corriger.py` corrige ensuite les quelques mots restés en anglais dans les PDF (références bibliques de « Sept ingrédients pour le bonheur ») ; on peut le relancer sans risque.

Laissés hors du site : les fiches « Source chinoise » (doublons), les documents propres au programme de Hong Kong (PolyU), les dossiers en anglais, et deux livres publiés (*Se préparer à un mariage heureux*, *Le sanctuaire expliqué simplement*).

## Mettre la bibliothèque à jour

Après l’ajout ou le changement d’un fichier dans le Drive :

1. Exporter l’inventaire du dossier Drive en JSON (`{id: {id, title, mimeType, parentId}}`).
2. `python3 outils/generer_bibliotheque.py inventaire.json` : réécrit `donnees/bibliotheque.js` et la liste des documents à importer (`outils/documents/liste.json`).
3. Réimporter les documents : remettre la tâche `.github/workflows/importer-documents.yml` (elle est dans l’historique du dépôt, commit « Documents en PDF sur le site ») ; elle télécharge les fichiers du Drive (les dossiers doivent alors être partagés par lien), les convertit et pousse le résultat dans la branche `documents-import`. Relire, verser dans `main`, lancer `outils/documents/corriger.py`, relancer le générateur, retirer la tâche.
4. Augmenter le numéro de version (`?v=`) dans `index.html` et la constante `CACHE` de `sw.js`, puis publier.

Une nouvelle série = une ligne dans `SERIES` (niveau, identifiant, dossier Drive, titre, présentation).

## Symbole de l’Église adventiste

`assets/icones/adventiste-blanc.svg` (en-tête) et `adventiste-noir.svg` (pied de page) : le symbole officiel de l’Église adventiste du septième jour, marque déposée, tel que le diffuse la South England Conference (fichiers « adventist-symbol-white » et « adventist-symbol-black »), seulement recadré sur le dessin. Son usage est réservé à l’Église et à ses entités (églises locales, écoles) : ne pas le déformer, le recolorer ni l’associer à un autre dessin.

## Images

Une image par étape, par série et par étude (243 au total), dans `assets/images/<id>.webp` (800 × 600 au plus).
Elles ont été générées avec fal.ai (modèle FLUX dev) à partir des scènes décrites dans `outils/images/scenes.py`
(`outils/images/prompts.json`), avec `outils/images/generer_images.py` (clé fal dans `~/.fal_key`, jamais dans le dépôt).
Le catalogue relie chaque étude à son image : `<série>-<numéro>` (ou `<série>-<position>` pour Daniel), `serie-<série>`, `niveau-<étape>`.
Une image qui manque est simplement masquée.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page unique (navigation par `#/niveau/…`, `#/serie/…`, `#/lire/…`, `#/chercher/…`) |
| `assets/app.js` | affichage, recherche, navigation, lecteur de documents |
| `assets/style.css` | mise en page ; polices Alegreya (titres) et Atkinson Hyperlegible (texte, très lisible) |
| `assets/images/` | images des étapes, séries et études |
| `documents/` | les documents en PDF (et le tableau Excel d’origine) |
| `lecteur/` | PDF.js 6.5.438 (Mozilla, licence Apache 2.0), chargé à la première ouverture d’un document |
| `donnees/bibliotheque.js` | catalogue généré : étapes, séries, études, documents |
| `outils/` | générateur du catalogue, import et corrections des documents, images |
| `sw.js`, `manifest.webmanifest` | appli installable et hors ligne |
| `assets/icones/` | icônes de l’appli (feuille) et symbole adventiste |
| `CNAME`, `.nojekyll` | domaine `mission.ka-ilei.com` ; fichiers publiés tels quels |

## Domaine

Zone DNS de `ka-ilei.com` (OVH) : une ligne **CNAME `mission` → `vaihauflohr-byte.github.io.`**, puis *Enforce HTTPS* dans Settings → Pages du dépôt.
Le site est indépendant du site SI (`si.ka-ilei.com`) : aucun lien entre les deux.
