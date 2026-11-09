# Refonte des documents sur la mise en page d’origine

Ces outils posent le texte français sur les pages des documents anglais d’origine (mêmes colonnes,
images, lignes-réponses), puis publient le résultat sur le site. Les originaux anglais ne sont pas
dans le dépôt.

## Ce qu’il faut à côté du dépôt

| Variable | Contenu | Valeur par défaut |
| --- | --- | --- |
| `REFONTE_ORIGINAUX` | PDF anglais rangés par série (`quete-certitude/`, `prendre-vie/`…) | `/home/claude/mission-work/originaux/sortie/pdf` |
| `REFONTE_POLICES` | polices ci-dessous | `/home/claude/mission-work/polices/ttf` |
| `REFONTE_OCR_CACHE` | OCR des livrets numérisés de *En quête de certitude* 1 à 30 (`ocr_lot.py`) | `/home/claude/mission-work/refonte/ocr-cache` |

Python : `pymupdf`, `pikepdf`, `numpy`, `scipy`, `pillow`, `pyphen`, `fonttools` ; Tesseract pour `ocr_lot.py`.
Polices du système (paquets Debian) : `fonts-crosextra-caladea`, `fonts-liberation`, `fonts-adf-gillius`,
`fonts-ebgaramond`, `fonts-dejavu`.

Polices du dossier `REFONTE_POLICES` (toutes libres) : Source Sans 3 (Regular, Italic, Bold, BoldItalic,
Black), Mr Dafoe, DejaVu Sans (4 styles), Gillius ADF (Regular, Bold, Italic, BoldItalic, Cond, BoldCond),
Sorts Mill Goudy, EB Garamond 700 et 800, Kristi, Nothing You Could Do : en version « -c », faite par
`python3 polices.py SOURCE…` (copie sans table GSUB, que MuPDF applique mal) ; Anton et Archivo Black
telles quelles.

## Fichiers

- `natif.py` : moteur pour les PDF anglais natifs (texte sélectionnable) — unités de texte, effacement,
  pose du français, réglages par document (`decaler`, `bas`, `decoupe`, `zones`, `reglages`…).
  `python3 natif.py NOM` construit `sortie/NOM.pdf` ; `voir NOM [pages]` et `planche NOM` comparent
  l’original et le français.
- `livret.py` : livrets imposés (deux pages par feuille) remis page par page dans l’ordre de lecture.
- `sfc.py` (+ `refaire_scan.py`, `ocr.py`, `ocr_lot.py`) : *En quête de certitude* 1 à 30, livrets numérisés.
- `aligner.py` : premier brouillon d’un document (unités anglaises -> paragraphes français déjà publiés).
- `series/prendre_vie.py` : textes des sept leçons de *Prendre vie avec Jésus* -> `textes/pv-0N.json`.
- `series/vivre_avec_jesus.py` : textes des quinze leçons de *Vivre avec Jésus* -> `textes/vj-NN.json`
  (même gabarit en bleu ; part des brouillons alignés, corrigés leçon par leçon).
- `publier.py` : copie `sortie/` à la place des PDF du site (mêmes noms de fichiers) et met à jour
  `donnees/bibliotheque.js`, `outils/documents/resultat.json` et `liste.json` (source `refonte`).
- `textes/` : les traductions françaises de chaque document (`textes/brouillons/` : premiers jets alignés).

## Refaire et publier un document

    cd outils/refonte
    python3 series/prendre_vie.py 5      # textes/pv-05.json
    python3 natif.py pv-05               # sortie/pv-05.pdf + liste des unités réduites ou serrées
    python3 natif.py planche pv-05       # vérification visuelle
    python3 publier.py pv 5              # sur le site (séries : sfc, pv, vj) ; puis ?v= de bibliotheque.js et CACHE de sw.js
