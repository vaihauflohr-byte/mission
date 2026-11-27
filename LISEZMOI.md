# Mission — études bibliques pour les petits groupes

Site statique (GitHub Pages) publié sur **https://mission.ka-ilei.com**.
Aucun serveur, aucune base de données : le site range la bibliothèque d’études et affiche chaque document lui-même, en PDF, sans passer par Google Drive.

## Ce que fait le site

- **Accueil** : les trois étapes, numérotées : *1. Rencontrer Jésus-Christ*, *2. Grandir en Jésus-Christ*, *3. Mûrir en Jésus-Christ* (dossiers « 1 - Pour connaitre Jesus », « 2 - Pour grandir en Jésus », « 3 - Mûrir en Jésus » du Drive ; l’identifiant de la première reste `connaitre` dans les liens), la recherche et le mode d’emploi. « Convient (aussi) à des invités » est en gras sous les étapes 1 et 2. En parallèle de l’étape 3, une branche : *Devenir un disciple du Christ* (identifiant `disciple`, champ `parallele` dans `NIVEAUX`), le parcours FAST et la formation *Devenir un disciple incroyable* ; sur ordinateur elle se place sous Mûrir, sur téléphone après elle, reliée en pointillés ; elle a aussi son lien dans la barre du haut (grand écran) et le pied de page.
- **Étape** : ses séries, avec une image, une phrase de présentation et le nombre d’études.
- **Série** : les études dans l’ordre. Un bouton par document : *Participant* (fiche du participant), *Animateur* (guide de l’animateur), *Avec les réponses*, *Notes de présentation* ; *Ouvrir* ou *Voir* quand il n’y en a qu’un. Les plans du cours, brochures et révisions sont dans « Pour bien commencer ».
- **Mode lecture** (`#/lire/<série>/<document>`) : les études s’ouvrent comme dans l’appli de l’École du sabbat ou un livre — texte qui s’adapte à l’écran, références bibliques qui s’ouvrent dans un panneau, sans quitter l’étude (Bible Louis Segond 1910 intégrée au site), une case « Votre réponse » sous chaque question, gardée sur l’appareil. *Sommaire*, *Affichage* (taille du texte, fond clair / sépia / nuit, police, défiler ou feuilleter page par page), *Imprimer* et *Original* (le PDF) sont toujours dans la barre du haut. Voir « Mode lecture » plus bas.
- **Original** (`#/original/<série>/<document>`, et `#/lire/…` pour les documents sans mode lecture) : le PDF s’affiche dans le site (PDF.js), page après page, à la largeur de l’écran. On zoome en pinçant (téléphone), avec Ctrl + molette ou les boutons − / + (ordinateur). *Télécharger* donne le PDF ; pour les présentations, le menu propose aussi le PowerPoint d’origine, avec les animations, et *Projeter* les montre en plein écran, une diapositive à la fois (flèches ou clic pour avancer).
- **Imprimer** : sur chaque document, en mode lecture comme en PDF. Au choix : *le document d’origine* (les pages du PDF, préparées dans le navigateur puis envoyées à l’imprimante), *ce que je lis, avec mes réponses* (en mode lecture) ou *Télécharger le PDF*.
- **Chercher** : par mot, sans tenir compte des accents (`bapteme` trouve « baptême ») : d’abord dans les titres et sujets, puis dans le texte des études (« sabbat » : 84 documents, du plus riche au plus pauvre, avec un extrait) ; ouvrir un document trouvé surligne le mot et une barre passe d’un passage à l’autre. Une référence tapée (« Jean 3:16 », « 1 co 13:4-7 », « Ps 23 ») affiche le passage en tête. Voir « Recherche » plus bas.
- **Reprendre** : le mode lecture retient où on s’est arrêté dans chaque document ; l’accueil propose la dernière étude ouverte (ou la suivante quand elle est finie), et la rouvrir y ramène.
- **Shorts** (`#/shorts`, `#/shorts/<document>`) : comme les « shorts » des applications de vidéos, une étude par écran, qu’on fait défiler du doigt : son idée clé, en grand, et son verset clé (Segond 1910) sur l’image de l’étude. Un toucher ouvre l’étude ; son bouton retour ramène au même short. *J’aime* garde le short sur l’appareil (filtre « J’aime »), *Partager* envoie une image carrée-haute (1080 × 1350, comme une carte de verset) avec le lien de l’étude, *Série* ouvre la série. Filtres par étape en haut ; l’ordre change chaque jour (le même pour tous), sans deux shorts de la même série à la suite. Sur l’accueil, une étagère montre les douze premiers du jour. Au clavier : flèches, Page suivante, j et k. Voir « Shorts » plus bas.
- **Barre d’onglets** (téléphone) : *Accueil*, *Shorts*, *Chercher* et *Ma lecture* (l’étude en cours, dès qu’on en a ouvert une), toujours sous le pouce, comme dans les applications ; cachée en mode lecture. Sur grand écran, *Shorts* est dans la barre du haut.
- **Zones de réponse** : dans le mode lecture, toute question qui n’a pas sa propre zone de réponse (études à compléter, comme *Historacles*) en reçoit une, « Votre réponse », gardée sur l’appareil comme les autres (clé `mission.rep.<document>.ql<n>`) ; pas dans les fiches de l’animateur. Les mots à compléter s’élargissent à mesure qu’on écrit. En mode « feuilleter », une question ne termine jamais une page : elle passe à la page suivante avec son verset (règle CSS `break-after: avoid`, et `garderQuestions()` pour les navigateurs qui l’ignorent).
- **Écouter** : dans le mode lecture, le téléphone lit l’étude à voix haute (voix française du téléphone), en surlignant le paragraphe lu ; pause, vitesse (1×, 1,25×, 0,8×), arrêt.
- **Sommaire** : sur l’accueil, chaque étape montre la liste de ses séries avec le nombre d’études, comme la page « Study Guides » du Gateway Adventist Centre.
- **Application** (`#/application`) : le site s’installe comme une application (PWA) sur Android, iPhone et ordinateur, sans passer par un magasin d’applications. Bouton « Installer l’application » quand le navigateur le permet (Android, Chrome, Edge), sinon les étapes à suivre (Safari sur iPhone) ; code QR et bouton « Partager le lien » pour la faire connaître. Une fois installée : icône sur l’écran d’accueil, plein écran, raccourcis vers les trois étapes et la recherche (appui long sur l’icône, Android), liste des études consultable sans réseau. Les documents, eux, demandent une connexion (ou se téléchargent).

## Les documents

Ils sont dans `documents/<série>/<nom>.pdf` (398 fichiers, 410 Mo environ ; GitHub Pages accepte 1 Go).
Ils viennent du dossier Drive **Eglise / Etude petit groupe** (compte vaihau.flohr@gmail.com) ; chaque série du site correspond à un dossier, listé dans `SERIES` en tête de `outils/generer_bibliotheque.py`.

L’import a été fait une fois par une tâche GitHub (`outils/documents/importer.py`) :

- les PDF sont repris tels quels, avec le titre français dans leurs propriétés ;
- les Word, PowerPoint et Excel sont convertis en PDF avec LibreOffice. Les polices d’origine ne sont pas libres : `outils/documents/polices.conf` leur donne des équivalents (Century Gothic → URW Gothic, de mêmes dimensions ; Garamond → EB Garamond ; Gill Sans → Gillius ; Tahoma → la Tahoma de Wine). Les images des présentations sont réduites pour l’écran (30 à 86 Mo par présentation au départ, 4 à 14 Mo en PDF) ;
- les modifications suivies des fichiers Word sont acceptées, les feuilles techniques du tableau Excel (« Formules », « Présentation ») ne sont pas imprimées ;
- les PowerPoint d’origine (1,3 Go, trop lourds pour le site) sont dans la publication GitHub **powerpoint** du dépôt ; le tableau Excel d’origine est à côté de son PDF.

LibreOffice ne rend pas exactement comme Word et PowerPoint (retours à la ligne, polices, place des images). Pour respecter les originaux, les 148 documents Word, PowerPoint et Excel sont réexportés avec Microsoft Office : `outils/documents/windows/convertir.bat` (à lancer sur un PC Windows qui a Office et Google Drive ; il lit `Mon Drive\Eglise\Etude petit groupe`, n’y modifie rien et écrit les PDF dans son dossier `pdf`), puis `python3 outils/documents/office.py <dossier pdf>` les met en place (titre français, poids réduit au-delà de 15 Mo) et `outils/generer_bibliotheque.py` met à jour le catalogue.

`outils/documents/resultat.json` garde, pour chaque document, son poids, son nombre de pages et, pour les conversions, l’outil qui a fait le PDF.
`outils/documents/corriger.py` corrigeait les quelques mots restés en anglais dans l’ancien PDF de « Sept ingrédients pour le bonheur » ; il ignore désormais les documents refaits et on peut le relancer sans risque.

Les études de *En quête de certitude* (les 30 et les six complémentaires A à G), les sept leçons de *Prendre vie avec Jésus* et les quinze de *Vivre avec Jésus* sont refaites à partir des documents anglais d’origine (It Is Written, Gateway Centre, PAPSDA) : texte français posé sur les pages de l’original, avec sa mise en page et ses images (8 pages pour chaque étude de *En quête de certitude*, les livrets imposés A à G remis page par page dans l’ordre de lecture ; 4 pages pour chaque leçon de *Prendre vie* et de *Vivre avec Jésus*, comme l’original). Elles ont la source `refonte` dans `resultat.json` : `importer.py` ne les remplace jamais par le fichier du Drive. Leur titre est celui de la nouvelle couverture (`TITRES_REFAITS` dans `outils/generer_bibliotheque.py`) ; le nom du fichier sur le site, lui, n’a pas changé. Les originaux anglais restent hors du dépôt ; les outils de refonte et les traductions sont dans `outils/refonte/` (voir son `LISEZMOI.md`).

*Historacles et Prophétie* (dossier « 10 - Historacles et Prophéties » de l’étape 2) : les 24 dépliants d’Amazing Facts remis par le pasteur Jérémie Allamelou aux conférences bibliques de Mataiea (octobre 2026), et son étude « Les sept derniers fléaux » en étude complémentaire A ; importés depuis ses courriels, tels quels.

Les cours FAST (dossier « 9 - FAST - Mémorisation de l’Écriture » du Drive, rangé dans l’étape 2, un sous-dossier par série) : Kit de survie, Formation de base, Tactiques d’équipe, Clés de réveil et, pour les leaders, le Manuel du leader et La formule explosive ; sur le site, tous dans « Devenir un disciple du Christ ». Ce sont les pages de fastmissions.com imprimées (février 2025 et avril 2026), avec couvertures et illustrations des livrets ; elles portent la mention « licensed for personal study … Please do not distribute » et le copyright de FAST Missions : mis en ligne à la demande d’Olivier, tels quels, mentions comprises (le mode lecture les garde dans ses mentions de fin).

*Devenir un disciple incroyable* (dossier « 11 - Devenir un disciple incroyable » de l’étape 2, rangé dans « Devenir un disciple du Christ ») : *Amazing Disciples*, édition de l’enseignant d’Amazing Facts (13 semaines), traduit en français puis corrigé sur l’original anglais (novembre 2026). Le livre est découpé par semaine : *Fiche du participant* (introduction, les sept jours et le quiz de la semaine, avec des cases à cocher) et *Guide de l’animateur* (la semaine entière : notes de l’enseignant, parole d’expert, leçon, exemple de plan de leçon et quiz) ; s’y ajoutent le *Plan du cours* (sommaire et avant-propos) et *Le livre complet* (PDF seulement, `EXCLUS` du mode lecture). Chaque semaine se lit aussi jour par jour : sur la page de la série, le bouton « Leçons du jour » déplie l’introduction, les jours 1 à 7, le quiz et, en dernier, toute la semaine (la *Fiche du participant*) ; en mode lecture, « Suivante » mène au jour suivant puis à l’introduction de la semaine suivante. Ces leçons sont des PDF à part, dans le sous-dossier Drive « Leçons du jour » (« 01 - Introduction », « 01 - Jour 1 - Le dernier message », « 01 - Quiz de la semaine ») ; le générateur les rattache à leur semaine (`JOUR_PAR_JOUR`, champ `jours` du catalogue). La semaine 9 n’a pas de quiz : il manque dans la source. Les PDF sont faits hors du dépôt, avec l’outil de correction de la traduction (découpage `--decoupe`) : paragraphes espacés et sans traits de séparation, pour que le mode lecture les reconnaisse.

Laissés hors du site : les fiches « Source chinoise » (doublons), les documents propres au programme de Hong Kong (PolyU), les dossiers en anglais, et deux livres publiés (*Se préparer à un mariage heureux*, *Le sanctuaire expliqué simplement*).

## Mode lecture

Chaque étude en PDF a une version « lecture », faite à l’avance par `outils/lecture/convertir.py` (PyMuPDF et Pillow ; Tesseract en français pour une page numérisée sans texte) :

- `lecture/<série>/<document>.html` : le texte de l’étude, en fragment HTML que le site insère ; ses images dans `lecture/<série>/<document>/img-N.webp` ;
- `donnees/lecture.js` : la liste des documents qui ont une version lecture, avec leur nombre de questions et de sections.

Le convertisseur remet les colonnes dans l’ordre de lecture, retire en-têtes, pieds de page et titres répétés, reconnaît titres, questions (numérotées, interrogatives ou suivies de lignes pour écrire), listes, cases à cocher, phrases à trous, tableaux, citations et images, et relie les références bibliques (`outils/lecture/versets.py`). La couverture et les lignes d’éditeur passent en mentions à la fin ; les logos d’éditeur (`LOGOS`) sont écartés ; un document rédigé en plan détaillé (A. › 1. › i. › a.) garde un point par ligne. Les présentations et le tableau Excel restent en PDF seulement (`EXCLUS_FORMATS`, `EXCLUS`).

Réglages par série : `QUESTIONS_MARQUEES` (seuls les paragraphes qui commencent par une étiquette, « Réflexion — », « Discussion — », sont des questions avec zone de réponse : *Devenir un disciple incroyable*) ; `VOLETS` (dépliant, plusieurs volets côte à côte sur une page à l’italienne, lus l’un après l’autre comme des pages : Historacles) ; `NUMEROTEES` (seules les questions numérotées sont des questions, les traits courts « ___ » sont des mots à compléter, et la réponse se donne dans les blancs, sans zone de texte). Dans un dépliant, un schéma tracé (ligne chronologique, calcul souligné) est rendu en image avec ses étiquettes, sauf s’il est surtout fait de phrases. Leçons FAST (séries `fast-…`) : le fil d’Ariane de chaque page web (« > Semaine 1 > Mémo ») devient l’intertitre de la section, les cases « Nom / Date / Paraphé par » sont retirées, le logo FAST est écarté (`LOGOS`) ; le manuel, les couvertures et les illustrations se lisent sans zone de réponse.

Les réponses écrites restent dans le navigateur (`localStorage`, clés `mission.rep.<document>…`), rien n’est envoyé.

### La Bible dans le site

Toucher une référence d’une étude affiche le passage dans un panneau en bas de l’écran (aux couleurs et à la taille de texte du mode lecture), avec « Voir tout le chapitre » où le passage est surligné. Les références sont repérées par le convertisseur (`outils/lecture/versets.py`), qui en fait des liens vers BibleGateway ; `assets/bible.js` lit l’adresse du lien (« John 15:1-8 ») et affiche le passage à la place. Un clic avec Ctrl ou ⌘ ouvre toujours BibleGateway ; sans connexion, le panneau le propose aussi. Le bouton « Bible Strong » ouvre le même passage sur Lueur.org, en Segond avec les numéros Strong (mot hébreu ou grec et définition en français) : ces numéros et le dictionnaire en français appartiennent à des éditeurs, on ne peut donc pas les copier sur le site. Lueur numérote les versets comme nous ; il ne lit pas les listes, le lien va du premier au dernier verset.

Texte : Louis Segond 1910 (domaine public), dans `donnees/bible/01.json` … `66.json`, un livre par fichier, téléchargé à la première référence de ce livre puis gardé sur l’appareil. Les versets suivent la numérotation de BibleGateway et YouVersion, celle de la plupart des études (traduites de l’anglais) : titres des psaumes dans le verset 1, Ésaïe 9.6 « un enfant nous est né », Ecclésiaste 12.13… Une référence qui n’existe que dans la Segond imprimée (Ecclésiaste 12.15) est retrouvée, avec une ligne qui le signale. Une référence fautive dans une étude affiche un message au lieu du texte ; celles qu’on a trouvées (chiffres inversés, comme « Luc 64.6 » pour Luc 6.46) sont corrigées dans la version lecture par `CORRECTIONS` dans `outils/lecture/versets.py`, appliqué à chaque conversion (le PDF d’origine reste tel quel).

Pour reconstruire le texte (instructions en tête du script) :

```
python3 outils/bible/construire_bible.py <dossier p.sfm de la Segond UBS> <FrenchBible.xml de Beblia>
```

puis augmenter `VERSION_TEXTE` dans `assets/bible.js`.

Après un changement de documents :

```
python3 outils/lecture/convertir.py                                  # tout (quelques minutes)
python3 outils/lecture/convertir.py vivre-avec-jesus/01-il-revient   # un seul document
python3 outils/lecture/convertir.py --plan vivre-avec-jesus/01-il-revient   # voir le découpage, sans rien écrire
```

puis augmenter `VERSION_LECTURE` dans `assets/app.js` et le `?v=` de `donnees/lecture.js` (dans `index.html` et `sw.js`), pour que les téléphones reprennent les nouvelles versions, et refaire l’index de recherche (ci-dessous).

### Recherche dans le texte des études

`outils/recherche/construire_index.py` lit chaque document de lecture et compte ses mots (sans accents, sans les petits mots) dans `donnees/recherche.json` (environ 1,3 Mo, 360 Ko compressé). La page Chercher ne le télécharge qu’à la première recherche, puis le garde hors ligne ; les extraits viennent des documents eux-mêmes, chargés quand le résultat apparaît à l’écran. Après chaque conversion :

```
python3 outils/recherche/construire_index.py
```

puis augmenter `VERSION_RECHERCHE` dans `assets/app.js`. Positions de lecture : `localStorage`, clés `mission.pos.<document>` et `mission.derniere` ; vitesse de la voix : `mission.lecture.vitesse`.

### Shorts

`outils/shorts/shorts.txt` : pour chaque étude qui a un mode lecture, une ligne `numéro | verset | idée clé`, rangée sous `[identifiant de la série]` (`-` pour l’étude unique d’une série, `#3` pour la 3e étude d’une série sans numéros, comme Daniel). Les idées sont écrites à la main, à partir des questions et des versets de chaque étude ; le verset clé est toujours un verset que l’étude cite. Puis :

```
python3 outils/shorts/construire_shorts.py
```

Le script prend le texte du verset dans `donnees/bible/` (sans le titre des psaumes, vers par vers pour la poésie), vérifie que l’étude le cite (liens de versets de `lecture/<document>.html`) et écrit `donnees/shorts.json` (269 shorts, 100 Ko) ; il s’arrête sur toute erreur. Augmenter ensuite `VERSION_SHORTS` dans `assets/app.js` (et le `?v=` de `donnees/shorts.json` dans `sw.js`). Les études sans mode lecture (*Les secrets de la prophétie*, *Fiabilité de la Bible*) et sans verset cité n’ont pas de short. Shorts aimés : `localStorage`, clé `mission.shorts.aimes` ; filtre choisi : `sessionStorage`, `mission.shorts.filtre`.

**Images des shorts.** Chaque short a sa propre image, peinte pour lui avec fal.ai : `outils/shorts/images.txt` décrit, pour chaque short (mêmes clés que `shorts.txt`), la scène à peindre, en anglais, fidèle au verset clé, à l’idée clé et au récit de l’étude (décor, vêtements et époque bibliques ; `TAHITI:` en tête pour une scène d’aujourd’hui à Tahiti). Le script ajoute le style commun (celui des images des études) et le cadrage vertical : sujet dans le haut, bas plus sombre pour le texte.

```
FAL_KEY=… python3 outils/shorts/generer_images.py --essai 8      # un essai, 8 séries différentes
FAL_KEY=… python3 outils/shorts/generer_images.py                # toutes celles qui manquent
FAL_KEY=… python3 outils/shorts/generer_images.py --refaire daniel-8 historacles-9
python3 outils/shorts/generer_images.py --planches               # planches contact, pour tout relire
python3 outils/shorts/construire_shorts.py                       # les shorts prennent leur image
python3 outils/shorts/generer_images.py --vignettes              # les études sans image prennent celle de leur short
```

Images : `assets/images/shorts/<série>-<numéro>.webp`, 720 × 1280 (moins d’un mégapixel : fal facture au mégapixel entamé). Modèle : `fal-ai/flux/dev` par défaut (`--modele` ou `FAL_MODELE` pour un autre) ; modèle, graine et scène de chaque image dans `outils/shorts/images.json`. La clé fal vient de `FAL_KEY` (ou `~/.fal_key`), jamais du dépôt ; l’espace de travail doit avoir l’accès réseau à `fal.run` et `fal.media`. Tant qu’un short n’a pas son image, il prend celle de l’étude ; les livrets FAST, dont l’image est une couverture, prennent un fond dégradé et le pictogramme de l’étape. Les études sans image (livrets FAST, *Devenir un disciple incroyable*…) montrent ce même dégradé dans la liste de leur série, jusqu’à ce que `--vignettes` leur donne une vignette découpée dans le haut de l’image de leur short (`assets/images/<série>-<numéro>.webp`, le nom que reprend `generer_bibliotheque.py`).

## Mettre la bibliothèque à jour

Après l’ajout ou le changement d’un fichier dans le Drive :

1. Exporter l’inventaire du dossier Drive en JSON (`{id: {id, title, mimeType, parentId}}`).
2. `python3 outils/generer_bibliotheque.py inventaire.json` : réécrit `donnees/bibliotheque.js` et la liste des documents à importer (`outils/documents/liste.json`). Pour ajouter ou refaire une seule série, l’inventaire de son dossier suffit : `--seulement <série>` garde les autres séries telles qu’elles sont.
3. Réimporter les documents : remettre la tâche `.github/workflows/importer-documents.yml` (elle est dans l’historique du dépôt, commit « Documents en PDF sur le site ») ; elle télécharge les fichiers du Drive (les dossiers doivent alors être partagés par lien), les convertit et pousse le résultat dans la branche `documents-import`. Relire, verser dans `main`, lancer `outils/documents/corriger.py`, relancer le générateur, retirer la tâche.
4. Refaire le mode lecture : `python3 outils/lecture/convertir.py` (voir « Mode lecture »).
5. Augmenter le numéro de version (`?v=`) dans `index.html` et la constante `CACHE` de `sw.js`, puis publier.

Une nouvelle série = une ligne dans `SERIES` (niveau, identifiant, dossier Drive, titre, présentation). Les fichiers déjà téléchargés s’importent sans passer par la tâche GitHub : `python3 outils/documents/importer.py --source <dossier avec <id>.pdf> --seulement <chemins>`. Les études numérotées par une lettre (« A - … ») forment un groupe à part, titré dans `GROUPES_COMPLEMENTAIRES`. Quand le titre d’une étude ne dit pas son sujet (titres tirés d’une histoire, comme pour Historacles), `SUJETS` donne une ligne affichée sous le titre ; elle compte aussi pour la recherche (« sabbat » trouve « Des briques sans paille »).

## Symbole de l’Église adventiste

`assets/icones/adventiste-blanc.svg` (en-tête) et `adventiste-noir.svg` (pied de page) : le symbole officiel de l’Église adventiste du septième jour, marque déposée, tel que le diffuse la South England Conference (fichiers « adventist-symbol-white » et « adventist-symbol-black »), seulement recadré sur le dessin. Son usage est réservé à l’Église et à ses entités (églises locales, écoles) : ne pas le déformer, le recolorer ni l’associer à un autre dessin.

## Images

Une image par étape, par série et par étude (273 au total ; les études FAST n’en ont pas), dans `assets/images/<id>.webp` (800 × 600 au plus).
Les trois étapes ont de vraies photos, prises sur Unsplash (licence libre, usage sur un site permis sans demande), comme la série *Devenir un disciple incroyable* (un pêcheur lance son filet) : auteurs et pages d’origine dans `outils/photos/photos.json`, crédit dans le pied de page.
Les autres images ont été générées avec fal.ai (modèle FLUX dev) à partir des scènes décrites dans `outils/images/scenes.py`
(`outils/images/prompts.json`), avec `outils/images/generer_images.py` (clé fal dans `~/.fal_key`, jamais dans le dépôt).
Historacles et Prophétie garde les illustrations de ses dépliants (récit de chaque étude, titre gravé de la couverture), et les séries FAST la couverture de leurs livrets (titre, Bible ouverte dessinée) : `outils/images/images_originaux.py`.
Le catalogue relie chaque étude à son image : `<série>-<numéro>` (ou `<série>-<position>` pour Daniel), `serie-<série>`, `niveau-<étape>`.
Une image qui manque est simplement masquée.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page unique (navigation par `#/niveau/…`, `#/serie/…`, `#/lire/…`, `#/original/…`, `#/chercher/…`, `#/shorts/…`) ; barre d’onglets du téléphone |
| `assets/app.js` | affichage, recherche, navigation, lecteur de documents |
| `assets/style.css` | mise en page ; polices Alegreya (titres) et Atkinson Hyperlegible (texte, très lisible) |
| `assets/images/` | images des étapes, séries et études |
| `documents/` | les documents en PDF (et le tableau Excel d’origine) |
| `lecture/`, `donnees/lecture.js` | mode lecture : textes des études et leurs images, liste des documents concernés (générés) |
| `lecteur/` | PDF.js 6.5.438 (Mozilla, licence Apache 2.0), chargé à la première ouverture d’un document |
| `donnees/bibliotheque.js` | catalogue généré : étapes, séries, études, documents |
| `assets/bible.js`, `donnees/bible/` | la Bible (Louis Segond 1910) affichée quand on touche une référence |
| `donnees/recherche.json` | index des mots du texte des études, pour la recherche (généré) |
| `outils/shorts/shorts.txt`, `donnees/shorts.json` | shorts : idée clé et verset clé de chaque étude (écrits à la main), et leur version publiée (générée) |
| `outils/shorts/images.txt`, `assets/images/shorts/` | shorts : scène de chaque image (écrite à la main) et images peintes avec fal.ai (`generer_images.py`) |
| `outils/` | générateur du catalogue, import et corrections des documents, images, mode lecture (`outils/lecture/`), texte de la Bible (`outils/bible/`), index de recherche (`outils/recherche/`) |
| `sw.js`, `manifest.webmanifest`, `assets/captures/` | application installable, hors ligne ; captures montrées dans la fenêtre d’installation (Android) |
| `assets/icones/` | icônes de l’appli (feuille), symbole adventiste, code QR de `mission.ka-ilei.com` |
| `CNAME`, `.nojekyll` | domaine `mission.ka-ilei.com` ; fichiers publiés tels quels |

## Domaine

Zone DNS de `ka-ilei.com` (OVH) : une ligne **CNAME `mission` → `vaihauflohr-byte.github.io.`**, puis *Enforce HTTPS* dans Settings → Pages du dépôt.
Le site est indépendant du site SI (`si.ka-ilei.com`) : aucun lien entre les deux.
