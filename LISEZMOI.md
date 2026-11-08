# Mission — études bibliques pour les petits groupes

Site statique (GitHub Pages) publié sur **https://mission.ka-ilei.com**.
Aucun serveur, aucune base de données : le site range la bibliothèque d’études et ouvre chaque document dans Google Drive.

## Ce que fait le site

- **Accueil** : les trois étapes, *Connaître*, *Grandir*, *Mûrir* (dossiers « 1 - Pour connaitre Jesus », « 2 - Pour grandir en Jésus », « 3 - Mûrir en Jésus » du Drive).
- **Étape** : la liste de ses séries, avec une phrase de présentation et le nombre d’études.
- **Série** : les études dans l’ordre. Un bouton par document : *Participant* (fiche du participant), *Animateur* (guide de l’animateur), *Avec les réponses*, *Notes de présentation*. Les plans du cours, brochures et révisions sont dans « Pour bien commencer ».
- **Chercher** : par mot, sans tenir compte des accents (`bapteme` trouve « baptême »).
- **Appli** : le site s’installe sur l’écran d’accueil du téléphone ; la liste des études reste consultable sans réseau (les documents, eux, demandent une connexion).

## D’où viennent les documents

Dossier Drive **Eglise / Etude petit groupe** (compte vaihau.flohr@gmail.com). Chaque série du site correspond à un dossier, listé dans `SERIES` en tête de `outils/generer_bibliotheque.py`.
Les dossiers des séries sont partagés « Tous les utilisateurs disposant du lien : lecteur », sinon les visiteurs ne peuvent pas ouvrir les documents.

Laissés hors du site : les fiches « Source chinoise » (doublons), les documents propres au programme de Hong Kong (PolyU), les dossiers en anglais, et deux livres publiés (*Se préparer à un mariage heureux*, *Le sanctuaire expliqué simplement*).

## Mettre la bibliothèque à jour

Après l’ajout ou le changement d’un fichier dans le Drive :

1. Exporter l’inventaire du dossier Drive en JSON (`{id: {id, title, mimeType, parentId}}`).
2. `python3 outils/generer_bibliotheque.py inventaire.json` : réécrit `donnees/bibliotheque.js`.
3. Augmenter le numéro de version (`?v=`) dans `index.html` et la constante `CACHE` de `sw.js`, puis publier.

Une nouvelle série = une ligne dans `SERIES` (niveau, identifiant, dossier Drive, titre, présentation) et, si besoin, un partage par lien du dossier.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | page unique (navigation par `#/niveau/…`, `#/serie/…`, `#/chercher/…`) |
| `assets/app.js` | affichage, recherche, navigation |
| `assets/style.css` | mise en page ; polices Alegreya (titres) et Atkinson Hyperlegible (texte, très lisible) |
| `donnees/bibliotheque.js` | catalogue généré : étapes, séries, études, identifiants Drive |
| `sw.js`, `manifest.webmanifest`, `assets/icones/` | appli installable et hors ligne |
| `CNAME` | domaine `mission.ka-ilei.com` |

## Domaine

Zone DNS de `ka-ilei.com` (OVH) : une ligne **CNAME `mission` → `vaihauflohr-byte.github.io.`**, puis *Enforce HTTPS* dans Settings → Pages du dépôt.
Le site est indépendant du site SI (`si.ka-ilei.com`) : aucun lien entre les deux.
