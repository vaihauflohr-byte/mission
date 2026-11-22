#!/usr/bin/env python3
"""Mode lecture : chaque document d'étude (PDF) devient une page HTML qui s'adapte à l'écran.

    python3 outils/lecture/convertir.py                 # tous les documents
    python3 outils/lecture/convertir.py vivre-avec-jesus/01-il-revient   # un seul (chemin d.f)
    python3 outils/lecture/convertir.py --plan vivre-avec-jesus/01-il-revient   # plan lisible, sans écrire

Pour chaque document : lecture/<d.f>.html (fragment inséré par le site) et ses images dans
lecture/<d.f>/. L'index donnees/lecture.js liste les documents qui ont une version lecture.
Le PDF reste la version d'origine, à imprimer.

Le texte est lu dans le PDF avec PyMuPDF : colonnes remises dans l'ordre de lecture, en-têtes et
pieds de page retirés, titres, questions, lignes-réponses (traits ou soulignés), listes, tableaux et
images repérés. La page de couverture et les lignes d'éditeur passent en mentions de fin ; les
documents rédigés en plan détaillé (A. › 1. › i. › a.) gardent un point par ligne ; les pages
numérisées sans texte passent par la reconnaissance de caractères (Tesseract, français).
Documents laissés en PDF seulement : EXCLUS_FORMATS et EXCLUS ; logos d'éditeur écartés : LOGOS.
"""
import collections
import difflib
import html
import json
import os
import re
import sys
import unicodedata
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
import fitz  # noqa: E402  (PyMuPDF)
from PIL import Image  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from versets import lier as _lier, corriger as corriger_references, REF as REF_ENTIER, REF_ABREGE  # noqa: E402


def equilibrer(h):
    """Gras et italique bien appariés dans un fragment (fermetures orphelines retirées, oublis refermés)."""
    pile, out, pos = [], [], 0
    for m in re.finditer(r"<(/?)(strong|em)>", h):
        out.append(h[pos:m.start()])
        pos = m.end()
        if not m.group(1):
            pile.append(m.group(2))
            out.append(m.group(0))
        elif m.group(2) in pile:
            while pile:
                t = pile.pop()
                out.append(f"</{t}>")
                if t == m.group(2):
                    break
    out.append(h[pos:])
    out.extend(f"</{t}>" for t in reversed(pile))
    return re.sub(r"<(strong|em)>(\s*)</\1>", r"\2", "".join(out))


def lier(h):
    return _lier(equilibrer(h))

RACINE = Path(__file__).resolve().parents[2]
DOCS = RACINE / "documents"
SORTIE = RACINE / "lecture"
INDEX = RACINE / "donnees" / "lecture.js"
VERSION = 1

# Documents laissés en PDF seulement : présentations, tableau, formulaires, scans.
EXCLUS_FORMATS = {"PowerPoint", "Excel"}
EXCLUS = {
    "fiabilite-bible/01-fiabilite-de-la-bible",            # présentation numérisée (images)
    "explorateur/feuille-des-coordonnees-des-participants",  # formulaire à remplir à la main
}
# Dépliants : chaque page à l'italienne porte n volets côte à côte, lus l'un après l'autre comme des pages.
VOLETS = {"historacles": 3}
# Séries dont seules les questions numérotées sont des questions (le récit en pose d'autres, sans réponse à écrire) ;
# leurs lignes justifiées ne sont pas coupées aux grands espaces, et « ➢ 1) » est un numéro de question.
NUMEROTEES = {"historacles"}
RE_CODE_VOLET = re.compile(r"^\s*SP\d{2}\s*$")      # code d'impression en bas d'un volet (Historacles)
# Leçons FAST (pages de fastmissions.com imprimées) : séries « fast-… ».
RE_FIL_FAST = re.compile(r"^.{0,40}?>\s*(?:Semaine\s*\d+|Illustrations)\s*>\s*(\S.*?)\s*$")   # « ++++ > Semaine 1 > Mémo »
RE_CHAMP_FAST = re.compile(r"^\s*(?:Nom|Date|Paraphé par)\s*:\s*$")                      # cases à remplir du livret
RE_LICENCE = re.compile(r"(?i)licensed for personal study|do not distribute")
NBSP, NNBSP = " ", " "
PUCES = "•●▪■◦○◆◇►▶✓✔➢➤→–—-*·"
RE_PUCE = re.compile(r"^\s*([" + re.escape(PUCES) + r"]|o(?= +[A-ZÀ-Ý«\d]))\s+")
RE_NUM = re.compile(r"^\s*(\d{1,2})\s*[.)]\s+(?=[^\s;,:.])")
RE_LETTRE = re.compile(r"^\s*([a-hA-H])\s*[.)]\s+(?=\S)")
RE_QUESTION_MOT = re.compile(r"^\s*(?:Question|Q)\s*(\d{1,2})\s*[:.)–-]?\s*", re.I)
RE_COCHE = re.compile(r"^\s*(?:\[\s?\]|☐|□|❑|❒|\uf06f|\uf0a8|\uf071)\s*")
RE_TRAITS = re.compile(r"^[\s_.…\-–—]{6,}$")
RE_PAGE = re.compile(r"^[\s\-–—]*(?:page\s*)?\d{1,3}(?:\s*(?:/|sur)\s*\d{1,3})?[\s\-–—]*$", re.I)
FIN_PHRASE = tuple(".!?:;»”\"…)]")
COMPOSES = ("être", "il", "ils", "elle", "elles", "on", "je", "tu", "nous", "vous", "ce", "là", "ci", "même",
            "mêmes", "t-il", "t-elle", "t-on", "dessus", "dessous", "unes", "uns", "delà", "à-dire", "moi", "toi",
            "lui", "leur", "y", "en", "le", "la", "les", "Christ", "Esprit", "faire", "midi", "temps")


# ---------------------------------------------------------------- texte

def propre(t):
    t = unicodedata.normalize("NFC", t)
    t = t.replace("\t", " ").replace("\u00a0", " ").replace("\u202f", " ")
    t = re.sub(r"[\u2002-\u200b\u3000]", " ", t)
    t = re.sub(r"[\uf0b7\uf0a7\uf0d8\uf0fc\uf06e\uf076]", "•", t)
    t = re.sub(r"[\x00-\x08\x0b-\x1f\x7f\ufffd]", "", t)
    return t


def typo(t):
    """Espaces insécables du français (avant ? ! ; : et dans les guillemets)."""
    t = re.sub(r"[   ]+([?!;])", NNBSP + r"\1", t)
    t = re.sub(r"[   ]+:", NBSP + ":", t)
    t = re.sub(r"«[   ]*", "«" + NBSP, t)
    t = re.sub(r"[   ]*»", NBSP + "»", t)
    return t


def cle_texte(t):
    t = unicodedata.normalize("NFD", t.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def est_gras(span):
    f = span["font"].lower()
    return bool(span["flags"] & 16) or any(m in f for m in ("bold", "black", "heavy", "semibold", "demi", "-bd", "extrab"))


def est_italique(span):
    f = span["font"].lower()
    return bool(span["flags"] & 2) or "italic" in f or "oblique" in f or "-it" in f


class Ligne:
    __slots__ = ("page", "x0", "y0", "x1", "y1", "spans", "taille", "gras", "ital", "couleur", "genre", "img", "table",
                 "id")

    def __init__(self, page, bbox, spans=None, genre="texte"):
        self.page = page
        self.x0, self.y0, self.x1, self.y1 = bbox
        self.spans = spans or []   # (texte, gras, italique, taille, couleur)
        self.genre = genre          # texte | trait | image | table
        self.img = None
        self.table = None
        if self.spans:
            n = sum(len(s[0].strip()) for s in self.spans) or 1
            self.taille = sum(s[3] * len(s[0].strip()) for s in self.spans) / n
            self.gras = sum(len(s[0].strip()) for s in self.spans if s[1]) / n
            self.ital = sum(len(s[0].strip()) for s in self.spans if s[2]) / n
            c = collections.Counter()
            for s in self.spans:
                c[s[4]] += len(s[0].strip())
            self.couleur = c.most_common(1)[0][0]
        else:
            self.taille = self.gras = self.ital = 0
            self.couleur = 0

    @property
    def texte(self):
        return "".join(s[0] for s in self.spans).strip()

    @property
    def h(self):
        return self.y1 - self.y0

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2

    def __repr__(self):
        return f"<{self.genre} p{self.page} {self.x0:.0f},{self.y0:.0f}-{self.x1:.0f},{self.y1:.0f} {self.texte[:40]!r}>"


# ---------------------------------------------------------------- lecture d'une page

def lignes_texte(page, num, ocr=False, coupures=(), ecarts=True):
    flags = fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES
    if ocr:
        # page numérisée : texte reconnu par Tesseract (français)
        import os
        os.environ.setdefault("TESSDATA_PREFIX", "/usr/share/tesseract-ocr/5/tessdata")
        tp = page.get_textpage_ocr(flags=flags, language="fra", dpi=300, full=True)
        d = page.get_text("dict", flags=flags, textpage=tp)
    else:
        d = page.get_text("dict", flags=flags)
    lignes = _lignes_dict(d, num, invisibles=False, coupures=coupures, ecarts=ecarts)
    if not lignes:
        # page numérisée avec une couche de texte invisible (reconnaissance déjà faite) : c'est le texte
        lignes = _lignes_dict(d, num, invisibles=True, coupures=coupures, ecarts=ecarts)
    return lignes


def _lignes_dict(d, num, invisibles, coupures=(), ecarts=True):
    def volet(s):
        c = (s["bbox"][0] + s["bbox"][2]) / 2
        return sum(c >= x for x in coupures)

    lignes = []
    for b in d["blocks"]:
        if b.get("type") != 0:
            continue
        for ln in b["lines"]:
            if abs(ln["dir"][1]) > 0.1:      # texte tourné (bandeau vertical) : ignoré
                continue
            morceaux = []                    # coupe les lignes qui sautent une colonne
            courant = []
            prec = None
            for s in ln["spans"]:
                if (s.get("alpha", 255) == 0 and not invisibles) or not s["text"]:
                    continue
                if prec is not None and s["text"].strip() and (
                        (ecarts and s["bbox"][0] - prec["bbox"][2] > max(18, 2.6 * s["size"])) or volet(s) != volet(prec)):
                    morceaux.append(courant)
                    courant = []
                courant.append(s)
                if s["text"].strip():
                    prec = s
            if courant:
                morceaux.append(courant)
            for m in morceaux:
                vis = [s for s in m if s["text"].strip()]
                if not vis:
                    continue
                x0 = min(s["bbox"][0] for s in vis); x1 = max(s["bbox"][2] for s in vis)
                y0 = min(s["bbox"][1] for s in vis); y1 = max(s["bbox"][3] for s in vis)
                spans = [(propre(s["text"]), est_gras(s), est_italique(s), round(s["size"], 1), s["color"]) for s in m]
                lignes.append(Ligne(num, (x0, y0, x1, y1), spans))
    return lignes


def corps_page(lignes):
    c = collections.Counter()
    for l in lignes:
        for sp in l.spans:
            if sp[0].strip():
                c[round(sp[3])] += len(sp[0].strip())
    return c.most_common(1)[0][0] if c else 11


def schemas(page, lignes, coupures, cadres, corps):
    """Schémas tracés (lignes chronologiques, calculs soulignés) : zone rendue en image, avec ses étiquettes.

    Rend [(zone, lignes de texte absorbées)]. Traits isolés (filet, soulignement) : pas des schémas."""
    def volet(r):
        return sum((r.x0 + r.x1) / 2 >= x for x in coupures)
    traces = []
    for d in page.get_drawings():
        if d.get("type") not in ("s", "fs"):
            continue
        r = fitz.Rect(d["rect"])
        if r.width > 0.5 * page.rect.width and r.height > 0.5 * page.rect.height:
            continue
        if any(fitz.Rect(c.x0 - 6, c.y0 - 6, c.x1 + 6, c.y1 + 6).contains(r) for c in cadres):
            continue
        traces.append((r, len(d["items"])))
    groupes = []
    for r, n in sorted(traces, key=lambda t: (volet(t[0]), t[0].y0)):
        for g in groupes:
            if g[0] == volet(r) and r.y0 <= g[1].y1 + 30 and r.y1 >= g[1].y0 - 30:
                g[1] |= r
                g[2] += n
                break
        else:
            groupes.append([volet(r), fitz.Rect(r), n])
    res = []
    for _, R, n in groupes:
        if n < 3 or R.width < 150:
            continue
        pris, change = set(), True
        while change:
            change = False
            for l in lignes:
                if (id(l) in pris or l.genre != "texte" or l.x1 < R.x0 - 12 or l.x0 > R.x1 + 12
                        or RE_PAGE.match(l.texte)):
                    continue
                court = len(l.texte) <= 25 or l.taille <= corps * 0.92 or (l.gras > 0.6 and len(l.texte) <= 40)
                if court and l.y1 >= R.y0 - 20 and l.y0 <= R.y1 + 20:
                    R |= fitz.Rect(l.x0, l.y0, l.x1, l.y1)
                    pris.add(id(l))
                    change = True
        if sum(len(l.texte) > 45 for l in lignes if id(l) in pris) > 4:
            continue            # schéma surtout fait de phrases (listes encadrées) : mieux lu en texte sur un téléphone
        Z = fitz.Rect(R.x0 - 6, R.y0 - 6, R.x1 + 6, R.y1 + 6)
        for l in lignes:           # le texte voisin, gardé dans le fil, ne doit pas déborder dans l'image
            if id(l) in pris or l.genre != "texte" or l.x1 < Z.x0 or l.x0 > Z.x1:
                continue
            if R.y1 <= l.y0 < Z.y1:
                Z.y1 = l.y0 - 0.5
            elif Z.y0 < l.y1 <= R.y0:
                Z.y0 = l.y1 + 0.5
        res.append((Z, pris))
    return res


def lignes_fast(lt, tr):
    """Leçons FAST : fil d'Ariane de chaque page → intertitre de section ; cases « Nom / Date / Paraphé par »
    retirées avec leurs traits ; numéro de question posé à côté du texte, un peu plus haut : rattaché."""
    res = []
    champs = [l for l in lt if RE_CHAMP_FAST.match(l.texte)]
    tr = [t for t in tr if not any(abs(t.cy - c.y1) < 8 for c in champs)]
    for l in lt:
        t = l.texte
        if l in champs or re.fullmatch(r"Mémo\s*:", t):
            continue
        m = RE_FIL_FAST.match(t)
        if m:
            nom = m.group(1)
            nom = nom[0].upper() + nom[1:].lower()
            l = Ligne(l.page, (l.x0, l.y0, l.x1, l.y1), [(nom, True, False, l.taille * 1.3, l.couleur)])
        elif t.startswith("!!"):          # « !!Le mandat évangélique » : reste de la page web
            sp = list(l.spans)
            sp[0] = (sp[0][0].lstrip().lstrip("!"),) + tuple(sp[0][1:])
            l = Ligne(l.page, (l.x0, l.y0, l.x1, l.y1), sp)
        elif re.match(r"(?:Le Rédacteur|L’Éditeur|Caché en Christ)", t):
            l = Ligne(l.page, (l.x0, l.y0, l.x1, l.y1), [(s[0], False, True) + tuple(s[3:]) for s in l.spans])
        res.append(l)
    fusion = []
    for l in sorted(res, key=lambda l: (l.y0, l.x0)):
        m = next((x for x in fusion if RE_MARQUEUR_SEUL.match(x.texte) and l.x0 > x.x1 and 0 <= l.y0 - x.y0 < 9
                  and not any(y is not x and y.y0 >= x.y0 - 1 and y.x0 > x.x1 and y.x0 < l.x0 and y in fusion for y in fusion)), None)
        if m is not None and l.genre == "texte":
            fusion[fusion.index(m)] = Ligne(l.page, (m.x0, m.y0, l.x1, l.y1), list(m.spans) + [(" ",) + tuple(l.spans[0][1:])] + list(l.spans))
            continue
        fusion.append(l)
    return fusion, tr


def meme_ligne(lignes, coupures):
    """Mots d'une ligne justifiée lus comme des lignes séparées (grands espaces) : remis en une ligne."""
    def volet(l):
        return sum((l.x0 + l.x1) / 2 >= x for x in coupures)
    res = []
    for l in sorted(lignes, key=lambda l: (volet(l), round(l.y1), l.x0)):
        p = res[-1] if res else None
        if (p is not None and volet(p) == volet(l) and abs(p.y1 - l.y1) < 1.5 and abs(p.y0 - l.y0) < 2.5
                and l.x0 >= p.x1 - 1 and abs(p.taille - l.taille) < 1):
            res[-1] = Ligne(p.page, (p.x0, min(p.y0, l.y0), l.x1, max(p.y1, l.y1)),
                            list(p.spans) + [(" ",) + tuple(l.spans[0][1:])] + list(l.spans))
            continue
        res.append(l)
    return res


RE_ELISION_ESPACE = re.compile(r"\b([lLdDjJmMnNsStTcC]|[qQ]u|[jJ]usqu|[lL]orsqu|[pP]uisqu)’ (?=[A-Za-zÀ-ÿ])")


def numero_colle(l):
    """« 1.Pourquoi … » : espace rétabli après le numéro ; « ➢ 1) Comment … » : la puce devant le numéro est retirée.
    « l’ urgence » : l'espace après l'apostrophe est retiré."""
    l.spans = [(RE_ELISION_ESPACE.sub(r"\1’", s[0]),) + tuple(s[1:]) for s in l.spans]
    if l.spans and re.match(r"^[➢►▶➤→•]\s*\d{1,2}\)\s", l.texte):
        retire = False
        for k, s in enumerate(l.spans):
            t = s[0]
            if not retire:
                if not t.strip():
                    l.spans[k] = ("",) + tuple(s[1:])
                    continue
                t = re.sub(r"^\s*[➢►▶➤→•]", "", t, count=1)
                retire = True
            if retire:
                t2 = t.lstrip()
                l.spans[k] = (t2,) + tuple(s[1:])
                if t2:
                    break
    if not l.spans or not re.match(r"^\d{1,2}\.(?=[A-ZÀ-Ý«])", l.texte):
        return l
    s = l.spans[0]
    if re.match(r"^\s*\d{1,2}\.\s*$", s[0]):
        l.spans[0] = (s[0].rstrip() + " ",) + tuple(s[1:])
    else:
        l.spans[0] = (re.sub(r"^(\s*\d{1,2}\.)", r"\1 ", s[0], count=1),) + tuple(s[1:])
    return l


def traits(page, num, lignes):
    """Lignes horizontales tracées (lignes-réponses), hors soulignements du texte."""
    res = []
    W = page.rect.width
    for p in page.get_drawings():
        for it in p["items"]:
            if it[0] == "l":
                a, b = it[1], it[2]
                if abs(a.y - b.y) < 1.2 and abs(a.x - b.x) > 60:
                    res.append((min(a.x, b.x), a.y, max(a.x, b.x)))
            elif it[0] == "re":
                r = it[1]
                if r.height < 2.2 and r.width > 60:
                    res.append((r.x0, (r.y0 + r.y1) / 2, r.x1))
    out = []
    for x0, y, x1 in sorted(res, key=lambda t: (t[1], t[0])):
        if x1 - x0 > 0.92 * W:
            continue
        # soulignement : un texte juste au-dessus, sur la même largeur
        dessus = [l for l in lignes if -3 <= y - l.y1 < 4 and l.x0 < x1 and l.x1 > x0 and (min(l.x1, x1) - max(l.x0, x0)) > 0.5 * (x1 - x0)]
        if dessus:
            continue
        if out and abs(out[-1].y0 - y) < 1.5 and abs(out[-1].x0 - x0) < 2:
            continue
        out.append(Ligne(num, (x0, y - 0.5, x1, y + 0.5), genre="trait"))
    return out


def images(doc, page, num, compteur_xref, dossier, prefixe, nb_pages):
    res = []
    aire_page = page.rect.width * page.rect.height
    for info in page.get_image_info(xrefs=True):
        x = info.get("xref")
        r = fitz.Rect(info["bbox"]) & page.rect
        if not x or r.is_empty:
            continue
        aire = r.width * r.height
        if aire < 2600 or r.width < 40 or r.height < 40:
            continue
        if aire > 0.7 * aire_page:            # fond de page
            continue
        if max(r.width / r.height, r.height / r.width) > 7:   # bandeau décoratif
            continue
        if r.width / r.height > 2.2 and r.height < 90:          # logo en bandeau (en-tête)
            continue
        if nb_pages >= 3 and compteur_xref[x] >= max(3, 0.5 * nb_pages):   # logo répété
            continue
        res.append(Ligne(num, (r.x0, r.y0, r.x1, r.y1), genre="image"))
        res[-1].img = (x, r)
    return res


def texte_cellule(page, bbox):
    """Texte d'une case, mot par mot (les espaces sont gardés), lignes recollées pour suivre la largeur de l'écran."""
    if not bbox:
        return ""
    r = fitz.Rect(bbox)
    mots = [m for m in page.get_text("words", clip=r) if r.contains(fitz.Point((m[0] + m[2]) / 2, (m[1] + m[3]) / 2))]
    lignes = {}
    for m in sorted(mots, key=lambda m: (m[5], m[6], m[7])):
        lignes.setdefault((m[5], m[6]), []).append(m[4])
    texte = ""
    for mots_ligne in lignes.values():
        l = propre(" ".join(mots_ligne)).strip()
        if not l:
            continue
        if not texte:
            texte = l
        elif RE_PUCE.match(l) or RE_NUM.match(l):
            texte += "\n" + l                     # liste dans la case : garder le retour à la ligne
        elif texte.endswith("-") and l[:1].islower():
            texte = texte[:-1] + l                # mot coupé en fin de ligne
        else:
            texte += " " + l
    return texte


def tables(page, num, lignes):
    """Vrais tableaux (au moins 2 lignes et 2 colonnes, bordés) : gardés ensemble, rangée par rangée."""
    res = []
    try:
        trouves = page.find_tables(strategy="lines")
    except Exception:
        return res
    for t in trouves.tables:
        if t.row_count < 2 or t.col_count < 2:
            continue
        r = fitz.Rect(t.bbox)
        if r.width < 120 or r.height < 30:
            continue
        if r.width * r.height > 0.45 * page.rect.width * page.rect.height:
            continue          # cadre de mise en page, pas un tableau
        cellules = [[texte_cellule(page, bb) for bb in rang.cells] for rang in t.rows]
        if sum(1 for rang in cellules for c in rang if c) < 3:
            continue
        if max(len(c) for rang in cellules for c in rang) > 400:
            continue          # cases remplies de texte courant : mise en page en colonnes
        L = Ligne(num, (r.x0, r.y0, r.x1, r.y1), genre="table")
        L.table = cellules
        res.append(L)
    return res


# ---------------------------------------------------------------- ordre de lecture

def gouttiere(lignes):
    """Cherche une séparation verticale entre colonnes. Rend (x, lignes qui la traversent) ou None."""
    txt = [l for l in lignes if l.genre != "trait"]
    if len(txt) < 4:
        return None
    xmin = min(l.x0 for l in txt); xmax = max(l.x1 for l in txt)
    largeur = xmax - xmin
    if largeur < 150:
        return None
    pas = 2.0
    n = int(largeur / pas) + 1
    couv = [0] * n
    for l in txt:
        a = int((l.x0 - xmin) / pas); b = int((l.x1 - xmin) / pas)
        for i in range(max(0, a), min(n, b + 1)):
            couv[i] += 1
    tol = max(1, int(0.12 * len(txt)))
    tol = min(tol, 3)
    meilleur = None
    i = 0
    while i < n:
        if couv[i] <= tol:
            j = i
            while j < n and couv[j] <= tol:
                j += 1
            # dans cette zone peu couverte : la plus large bande la moins traversée
            cmin = min(couv[i:j])
            k, best = i, (0, i)
            while k < j:
                if couv[k] == cmin:
                    d = k
                    while d < j and couv[d] == cmin:
                        d += 1
                    if d - k > best[0]:
                        best = (d - k, k)
                    k = d
                else:
                    k += 1
            g0 = xmin + best[1] * pas; g1 = g0 + best[0] * pas
            if (g1 - g0 >= (6 if cmin == 0 else 9) and g0 - xmin > 0.18 * largeur and xmax - g1 > 0.18 * largeur):
                x = (g0 + g1) / 2
                gauche = [l for l in txt if l.x1 <= x]
                droite = [l for l in txt if l.x0 >= x]
                travers = [l for l in txt if l.x0 < x < l.x1]
                if len(gauche) >= 2 and len(droite) >= 2:
                    ga = (min(l.y0 for l in gauche), max(l.y1 for l in gauche))
                    dr = (min(l.y0 for l in droite), max(l.y1 for l in droite))
                    recouv = min(ga[1], dr[1]) - max(ga[0], dr[0])
                    plus_petit = min(ga[1] - ga[0], dr[1] - dr[0]) or 1
                    if recouv > 0.3 * plus_petit:
                        score = (len(travers), -(g1 - g0))
                        travers = [l for l in txt if l.x0 < x < l.x1]
                        if meilleur is None or score < meilleur[0]:
                            meilleur = (score, x, travers)
            i = j
        else:
            i += 1
    if not meilleur:
        return None
    return meilleur[1], meilleur[2]


def ordonner(lignes, profondeur=0):
    if len(lignes) <= 1 or profondeur > 6:
        return sorted(lignes, key=lambda l: (round(l.y0), l.x0))
    g = gouttiere(lignes)
    if not g:
        return sorted(lignes, key=lambda l: (round(l.y0 / 2), l.x0))
    x, travers = g
    reste = [l for l in lignes if l not in travers]
    res = []
    bornes = sorted(travers, key=lambda l: l.y0)
    haut = -1e9
    for b in bornes + [None]:
        bas = b.y0 if b else 1e9
        bande = [l for l in reste if haut <= l.cy < bas]
        gauche = [l for l in bande if l.cy is not None and (l.x0 + l.x1) / 2 < x]
        droite = [l for l in bande if (l.x0 + l.x1) / 2 >= x]
        res += ordonner(gauche, profondeur + 1) + ordonner(droite, profondeur + 1)
        if b:
            res.append(b)
            haut = b.cy
    return res


# ---------------------------------------------------------------- document

def doublon_demi_page(lignes, W):
    """Pages paysage imprimées deux fois côte à côte (Explorateur) : on garde la moitié gauche."""
    g = [l for l in lignes if l.genre == "texte" and l.x1 <= W / 2 + 5]
    d = [l for l in lignes if l.genre == "texte" and l.x0 >= W / 2 - 5]
    if len(g) < 3 or len(d) < 3:
        return lignes
    tg = cle_texte(" ".join(l.texte for l in sorted(g, key=lambda l: (l.y0, l.x0))))
    td = cle_texte(" ".join(l.texte for l in sorted(d, key=lambda l: (l.y0, l.x0))))
    if difflib.SequenceMatcher(None, tg, td).ratio() > 0.85:
        return [l for l in lignes if l.x1 <= W / 2 + 5]
    return lignes


def entetes_pieds(pages_lignes, hauteurs):
    """Textes répétés en haut ou en bas des pages, et numéros de page."""
    compte = collections.Counter()
    nb = len(pages_lignes)
    for i, ls in enumerate(pages_lignes):
        H = hauteurs[i]
        vus = set()
        for l in ls:
            if l.genre == "texte" and (l.y1 < 0.09 * H or l.y0 > 0.91 * H):
                k = re.sub(r"\d+", "#", cle_texte(l.texte))
                if k not in vus:
                    compte[k] += 1
                    vus.add(k)
    a_retirer = {k for k, c in compte.items() if nb >= 2 and c >= max(2, 0.4 * nb)}
    credits = []
    res = []
    for i, ls in enumerate(pages_lignes):
        H = hauteurs[i]
        garde = []
        for l in ls:
            if l.genre == "texte":
                marge = l.y1 < 0.09 * H or l.y0 > 0.91 * H
                k = re.sub(r"\d+", "#", cle_texte(l.texte))
                if RE_PAGE.match(l.texte) and marge:
                    continue
                if re.match(r"^[\s\-–—]*\d+[\s\-–—]+\d+[\s\-–—]+\w{0,6}\s*$", l.texte) and marge:
                    continue
                if marge and k in a_retirer:
                    if ("©" in l.texte or "copyright" in k or "reprodu" in k or "autoris" in k) and l.texte not in credits:
                        credits.append(l.texte)
                    continue
            garde.append(l)
        res.append(garde)
    return res, credits


def encadres_lateraux(lignes, corps):
    """Citation en grands caractères posée à côté du texte courant : sortie du fil, gardée en un bloc."""
    txt = [l for l in lignes if l.genre == "texte"]
    cand = []
    for g in txt:
        if g.taille < 1.2 * corps or g.gras > 0.6 or len(g.texte) > 70:
            continue
        voisins = [b for b in txt if b is not g and b.taille < 1.1 * corps and b.y0 < g.y1 and b.y1 > g.y0]
        if voisins and all(b.x1 <= g.x0 + 3 or b.x0 >= g.x1 - 3 for b in voisins):
            cand.append(g)
    if len(cand) < 2:
        return lignes
    cand.sort(key=lambda l: l.y0)
    groupes = [[cand[0]]]
    for l in cand[1:]:
        d = groupes[-1][-1]
        if l.y0 - d.y1 < 1.6 * max(d.h, 1) and l.x0 < d.x1 and l.x1 > d.x0:
            groupes[-1].append(l)
        else:
            groupes.append([l])
    retires = set()
    nouveaux = []
    for gr in groupes:
        if len(gr) < 2:
            continue
        spans = []
        for k, l in enumerate(gr):
            if k:
                spans.append((" ", False, l.spans[0][2], l.spans[0][3], l.spans[0][4]))
            spans += list(l.spans)
        c = Ligne(gr[0].page, (min(l.x0 for l in gr), gr[0].y0, max(l.x1 for l in gr), gr[-1].y1), spans, genre="citation")
        nouveaux.append(c)
        retires.update(id(l) for l in gr)
    return [l for l in lignes if id(l) not in retires] + nouveaux


RE_CREDIT = re.compile(r"©|copyright|reprodu|autoris|tous droits|courriel|e-?mail|www\.|https?:|\btél|\bfax\b|imprimé|"
                       r"conference|division|union|po box|b\.?p\.? \d", re.I)


def bas_de_page(pages_lignes, hauteurs, corps, credits):
    """Mentions (droits, adresse, autorisation) en bas de la dernière page : rangées dans les crédits."""
    if not pages_lignes:
        return pages_lignes, credits
    H = hauteurs[-1]
    der = pages_lignes[-1]
    bas = [l for l in der if l.genre == "texte" and l.y0 > 0.8 * H]
    if bas and any(RE_CREDIT.search(l.texte) for l in bas):
        zone_y = min(l.y0 for l in bas if RE_CREDIT.search(l.texte)) - 4
        a_retirer = [l for l in bas if l.y0 >= zone_y and (RE_CREDIT.search(l.texte) or l.taille < corps * 0.95)]
        ordre = sorted(a_retirer, key=lambda l: (l.y0, l.x0))
        for x in sorted({l.x1 for l in a_retirer}):
            gauche = [l for l in a_retirer if l.x1 <= x + 1]
            droite = [l for l in a_retirer if l.x0 >= x + 4]
            if gauche and droite and len(gauche) + len(droite) == len(a_retirer):   # deux colonnes côte à côte
                ordre = sorted(gauche, key=lambda l: l.y0) + sorted(droite, key=lambda l: l.y0)
                break
        for l in ordre:
            if l.texte not in credits:
                credits.append(l.texte)
        pages_lignes[-1] = [l for l in der if l not in a_retirer]
    for i, ls in enumerate(pages_lignes):
        garde = []
        for l in ls:
            if l.genre == "texte" and ("©" in l.texte or RE_LICENCE.search(l.texte)) and l.taille <= corps and len(l.texte) < 200:
                if l.texte not in credits:
                    credits.append(l.texte)
                continue
            garde.append(l)
        pages_lignes[i] = garde
    return pages_lignes, credits


class Bloc:
    def __init__(self, genre, lignes=None):
        self.genre = genre       # p, titre, q, puce, num, lettre, traits, image, table
        self.lignes = lignes or []
        self.marque = None       # numéro de question / de liste
        self.nb_traits = 0
        self.niveau = 2
        self.img = None
        self.table = None
        self.etiquette = None
        self.fin_reponse = False
        self.label_apres = None

    @property
    def texte(self):
        return joindre_lignes(self.lignes)

    def __repr__(self):
        return f"[{self.genre}{' ' + str(self.marque) if self.marque else ''}] {self.texte[:70]}"


def joindre_lignes(lignes):
    morceaux = []
    for l in lignes:
        t = l.texte
        if not t:
            continue
        if morceaux:
            prec = morceaux[-1]
            if prec.endswith("­"):
                morceaux[-1] = prec[:-1]
                morceaux.append(t)
                continue
            m = re.search(r"(\w+)-$", prec)
            if m and re.match(r"^[a-zàâäéèêëîïôöùûüç]", t):
                suite = re.match(r"^[\w-]+", t).group(0)
                if suite.split("-")[0] in COMPOSES:
                    morceaux.append(t)          # mot composé : on garde le trait d'union
                else:
                    morceaux[-1] = prec[:-1]
                    morceaux.append(t)
                continue
            morceaux.append(" " + t)
        else:
            morceaux.append(t)
    t = re.sub(r"[ ]{2,}", " ", "".join(morceaux)).strip()
    return re.sub("\u00ad(?=\\S)", "-", t).replace("\u00ad", "")


def html_lignes(lignes):
    """Texte des lignes avec gras et italique, échappé."""
    parts = []
    for i, l in enumerate(lignes):
        for j, (t, g, it, _, _) in enumerate(l.spans):
            parts.append([t, g, it])
        if i < len(lignes) - 1:
            parts.append(["\n", False, False])
    # coupures de mots en fin de ligne
    texte = ""
    styles = []
    for t, g, it in parts:
        styles.append((len(texte), g, it))
        texte += t
    # recoller les lignes (mêmes règles que joindre_lignes) en gardant les styles par caractère
    car = []
    for idx, (debut, g, it) in enumerate(styles):
        fin = styles[idx + 1][0] if idx + 1 < len(styles) else len(texte)
        for c in texte[debut:fin]:
            car.append([c, g, it])
    s = "".join(c[0] for c in car)
    i = 0
    out = []
    while i < len(car):
        c = car[i][0]
        if c == "\n":
            avant = "".join(x[0] for x in out).rstrip()
            apres = s[i + 1:].lstrip()
            # enlever espaces de fin
            while out and out[-1][0] == " ":
                out.pop()
            j = i + 1
            while j < len(car) and car[j][0] == " ":
                j += 1
            if out and out[-1][0] == "­":
                out.pop()
            elif out and out[-1][0] == "-" and re.search(r"\w-$", avant) and re.match(r"^[a-zàâäéèêëîïôöùûüç]", apres):
                suite = re.match(r"^[\w-]+", apres).group(0).split("-")[0]
                if suite not in COMPOSES:
                    out.pop()
            else:
                out.append([" ", car[j][1] if j < len(car) else False, car[j][2] if j < len(car) else False])
            i = j
            continue
        if c == "\u00ad":
            if i + 1 < len(car) and car[i + 1][0] != "\n":
                out.append(["-", car[i][1], car[i][2]])
        else:
            out.append(car[i])
        i += 1
    # nettoyage : espaces multiples
    res = []
    g0 = it0 = False
    tampon = ""

    def vider():
        nonlocal tampon
        if not tampon:
            return
        t = html.escape(typo(tampon), quote=False)
        if g0 and tampon.strip():
            t = f"<strong>{t}</strong>"
        if it0 and tampon.strip():
            t = f"<em>{t}</em>"
        res.append(t)
        tampon = ""

    for c, g, it in out:
        if c == " " and tampon.endswith(" "):
            continue
        if (g, it) != (g0, it0) and c.strip():
            vider()
            g0, it0 = g, it
        tampon += c
    vider()
    h = "".join(res).strip()
    h = re.sub(r"</strong>(\s*)<strong>", r"\1", h)
    h = re.sub(r"</em>(\s*)<em>", r"\1", h)
    return h


RE_MARQUEUR_SEUL = re.compile(r"^\s*(?:\d{1,2}\s*[.)]|[a-hA-H]\s*[.)]|[" + re.escape(PUCES) + r"]|o)\s*$")


def fusionner_marqueurs(ordre):
    """Numéro ou puce seul sur sa ligne : collé au texte de l'élément, à sa droite."""
    res = []
    i = 0
    ordre = list(ordre)
    while i < len(ordre):
        l = ordre[i]
        if l.genre == "texte" and RE_MARQUEUR_SEUL.match(l.texte) and res:
            a = res[-1]
            if a.genre == "texte" and a.page == l.page and abs(a.y0 - l.y0) < 4 and a.x0 > l.x1 - 1 and not RE_MARQUEUR_SEUL.match(a.texte):
                marque = l.texte.strip()
                spans = [(marque + " ", l.spans[0][1], False, a.spans[0][3], l.spans[0][4])] + list(a.spans)
                res[-1] = Ligne(a.page, (l.x0, min(l.y0, a.y0), a.x1, max(l.y1, a.y1)), spans)
                i += 1
                continue
        if l.genre == "texte" and RE_MARQUEUR_SEUL.match(l.texte):
            for j in range(i + 1, min(i + 6, len(ordre))):
                n = ordre[j]
                if n.genre == "texte" and n.page == l.page and abs(n.y0 - l.y0) < 4 and n.x0 > l.x1 - 1:
                    marque = l.texte.strip()
                    spans = [(marque + " ", l.spans[0][1], False, n.spans[0][3], l.spans[0][4])] + list(n.spans)
                    l = Ligne(n.page, (l.x0, min(l.y0, n.y0), n.x1, max(l.y1, n.y1)), spans)
                    del ordre[j]
                    break
        res.append(l)
        i += 1
    return res


def construire_blocs(ordre, corps):
    """Regroupe les lignes en paragraphes, titres, questions, listes, traits, images, tableaux."""
    ordre = fusionner_marqueurs(ordre)
    blocs = []
    cour = None
    prec = None
    en_attente = []
    lettrine = None

    def fermer():
        nonlocal cour
        if cour and (cour.lignes or cour.genre in ("image", "table", "traits")):
            blocs.append(cour)
        cour = None
        while en_attente:
            c = Bloc("citation", [en_attente.pop(0)])
            blocs.append(c)

    for l in ordre:
        if l.genre == "citation":
            en_attente.append(l)
            continue
        if l.genre == "texte" and len(l.texte) == 1 and l.texte.isalpha() and l.taille >= 1.8 * corps:
            lettrine = l.texte
            continue
        if lettrine and l.genre == "texte":
            premier = l.spans[0]
            l = Ligne(l.page, (l.x0, l.y0, l.x1, l.y1), [(lettrine + premier[0].lstrip(),) + tuple(premier[1:])] + list(l.spans[1:]))
            lettrine = None
            fermer()
            prec = None
        if l.genre == "image":
            fermer()
            b = Bloc("image"); b.img = l.img; b.lignes = []
            blocs.append(b); prec = None
            continue
        if l.genre == "table":
            fermer()
            b = Bloc("table"); b.table = l.table
            blocs.append(b); prec = None
            continue
        if l.genre == "trait" or RE_TRAITS.match(l.texte or "x"):
            fermer()
            n = 1 if l.genre == "trait" else max(1, (l.texte.count("_") + l.texte.count(".")) // 60 + 1)
            if blocs and blocs[-1].genre == "traits":
                blocs[-1].nb_traits += n
            else:
                b = Bloc("traits"); b.nb_traits = n
                blocs.append(b)
            prec = None
            continue
        t = l.texte
        # soulignés à la fin d'une ligne de texte : « Qui …? ________ »
        m_tr = re.search(r"[_]{6,}[\s_]*$", t)
        nouveau = False
        if cour is None or prec is None:
            nouveau = True
        else:
            ecart = l.y0 - prec.y1
            haut = max(prec.h, l.h, 1)
            meme_col = l.page == prec.page and abs(l.x0 - prec.x0) < 0.6 * max(1, prec.x1 - prec.x0) and l.y0 >= prec.y0 - 1
            if l.page != prec.page or not meme_col:
                nouveau = True
            elif ecart > 0.65 * haut + 1.5:
                nouveau = True
            elif abs(l.taille - prec.taille) > 1.2:
                nouveau = True
            elif (l.gras > 0.8) != (prec.gras > 0.8) and (len(t) < 90 or len(prec.texte) < 90):
                nouveau = True
            elif RE_PUCE.match(t) or RE_NUM.match(t) or RE_LETTRE.match(t) or RE_QUESTION_MOT.match(t) or RE_COCHE.match(t):
                nouveau = True
            elif l.x0 - prec.x0 > 14 and prec.texte.endswith(FIN_PHRASE):
                nouveau = True       # alinéa
            elif (prec.texte.upper() == prec.texte and sum(c.isalpha() for c in prec.texte) >= 8
                  and t.upper() != t and not prec.texte.rstrip().endswith((",", "-", "–", "'", "’"))):
                nouveau = True       # ligne en capitales (intertitre) suivie du texte
        if nouveau:
            fermer()
            if RE_COCHE.match(t):
                genre = "coche"
            elif RE_QUESTION_MOT.match(t):
                genre = "num"
            elif RE_NUM.match(t):
                genre = "num"
            elif RE_LETTRE.match(t):
                genre = "lettre"
            elif RE_PUCE.match(t):
                genre = "puce"
            else:
                genre = "p"
            cour = Bloc(genre, [l])
        else:
            cour.lignes.append(l)
        prec = l
        if m_tr:
            fermer()
            b = Bloc("traits"); b.nb_traits = 1
            blocs.append(b)
            prec = None
    fermer()
    return blocs


def retirer_debut(ligne, n):
    """Retire les n premiers caractères (hors espaces de tête) du texte d'une ligne, en gardant les styles."""
    spans, reste, tete = [], n, True
    for s in ligne.spans:
        t = s[0]
        if tete:
            t = t.lstrip()
            if not t:
                continue
            tete = False
        if reste > 0:
            k = min(reste, len(t))
            t, reste = t[k:], reste - k
        if t:
            spans.append((t,) + tuple(s[1:]))
    ligne.spans = spans


def titre_connu(texte, titres_connus):
    """Le texte reprend le titre de l'étude ou le nom de la série (déjà affichés par le site)."""
    k = re.sub(r"^\d{1,3} ", "", cle_texte(texte))
    if not k or len(k) > 160:
        return False
    for tc in titres_connus:
        kt = cle_texte(tc)
        if kt and (k == kt or (len(k) > 6 and (k in kt or kt in k) and abs(len(k) - len(kt)) < 25)
                   or (len(k) >= 4 and (kt.startswith(k + " ") or kt.endswith(" " + k)))
                   or difflib.SequenceMatcher(None, k, kt).ratio() > 0.86):
            return True
    return False


def classer(blocs, corps, titres_connus, role, numerotees=False):
    """Titres, questions (numérotées ou finissant par ?), suites de paragraphes coupés par les colonnes."""
    # 1. titres
    for b in blocs:
        if b.genre not in ("p",) or not b.lignes:
            continue
        t = b.texte
        taille = max(l.taille for l in b.lignes)
        gras = sum(l.gras * len(l.texte) for l in b.lignes) / max(1, sum(len(l.texte) for l in b.lignes))
        court = len(t) <= 140 and len(b.lignes) <= 3
        majuscules = t.upper() == t and sum(c.isalpha() for c in t) >= 4
        fin = t.rstrip().endswith((".", ",", ";")) and not t.rstrip().endswith("...")
        if "?" in t and not majuscules and len(t) > 50:
            continue
        if court and not fin and (taille >= corps * 1.18 or (gras > 0.85 and (majuscules or taille >= corps * 1.04))
                                 or (majuscules and gras > 0.5) or (gras > 0.85 and len(t) < 70 and not t.endswith("?"))):
            b.genre = "titre"
            b.niveau = 2 if (taille >= corps * 1.12 or majuscules) else 3
            if t.rstrip().endswith(":") and len(t) <= 45 and taille < corps * 1.3:
                b.genre = "etiquette"
                b.etiquette = t.rstrip().rstrip(":").strip()
    # 2. titres du document déjà affichés par le site (titre de l'étude, nom de la série) : retirés en tête
    debut = [b for b in blocs if b.genre in ("titre", "p", "num") and b.lignes and b.lignes[0].page == 0][:8]
    debut = [b for k, b in enumerate(debut) if k < 3 or max(l.taille for l in b.lignes) >= corps * 1.15]
    for b in debut:
        if titre_connu(b.texte, titres_connus):
            b.genre = "retire"
            continue
        # « ÊTRE UN HOMME DE DIEU – LE BUT DU MARIAGE Trois composantes… » : le titre en capitales est retiré du début
        m = re.match(r"^([A-ZÀ-ÝŒÆ0-9][A-ZÀ-ÝŒÆ0-9 ’'«»:,.–-]{10,}?)\s+(?=[A-ZÀ-Ý][a-zà-ÿ])", b.texte)
        if m and len(m.group(1).split()) >= 3 and titre_connu(m.group(1), titres_connus):
            retirer_debut(b.lignes[0], m.end())
    blocs = [b for b in blocs if b.genre != "retire"]
    nettoyes = []
    for k, b in enumerate(blocs):
        if (b.genre == "traits" and b.nb_traits == 1 and nettoyes and nettoyes[-1].lignes and k + 1 < len(blocs)
                and blocs[k + 1].lignes and not nettoyes[-1].texte.endswith(FIN_PHRASE)
                and re.match(r"^[a-zàâäéèêëîïôöùûüç]", blocs[k + 1].texte)):
            continue
        nettoyes.append(b)
    blocs = nettoyes
    # 3. paragraphes coupés (colonne, page) : la suite commence par une minuscule
    res = []
    for b in blocs:
        suite_ref = (b.genre == "p" and b.lignes and re.match(r"^\d", b.texte) and res and res[-1].lignes
                     and re.search(r"(?:\(|\b(?:cf|voir|v|vv|p)\.?|[,;])\s*$", res[-1].texte))
        if b.genre == "p" and b.lignes and (re.match(r"^[a-zàâäéèêëîïôöùûüç(«]", b.texte) or suite_ref):
            cible = None
            if res and res[-1].genre in ("p", "num", "lettre", "puce") and res[-1].lignes:
                cible = res[-1]
            elif len(res) >= 2 and res[-1].genre in ("citation", "image") and res[-2].genre in ("p", "num", "lettre", "puce") and res[-2].lignes:
                cible = res[-2]
            if cible is not None and (suite_ref or not cible.texte.endswith(FIN_PHRASE)):
                cible.lignes += b.lignes
                continue
        res.append(b)
    blocs = res
    # 4. questions
    participant = role != "animateur"
    a_traits = sum(1 for b in blocs if b.genre == "traits") >= 2
    for i, b in enumerate(blocs):
        if b.genre not in ("p", "num") or not b.lignes:
            continue
        t = b.texte
        suivant = blocs[i + 1] if i + 1 < len(blocs) else None
        interrogatif = est_interrogatif(t)
        traits_apres = suivant is not None and suivant.genre == "traits" and (suivant.nb_traits >= 2 or interrogatif)
        if re.match(r"(?i)^\s*(la\s+)?semaine\s+prochaine", t):
            continue
        if b.genre == "num":
            m = RE_QUESTION_MOT.match(t) or RE_NUM.match(t)
            b.marque = m.group(1)
            corps_q = t[m.end():] if m else t
            if (traits_apres or interrogatif or (RE_CONSIGNE.match(corps_q) and len(t) < 400) or RE_QUESTION_MOT.match(t)
                    or (numerotees and "?" in corps_q[:250])):
                b.genre = "q"
            elif not participant and "?" in corps_q[:300]:
                b.genre = "q"        # guide de l'animateur : la réponse suit la question dans le même paragraphe
        elif traits_apres or (interrogatif and len(t) < 400 and not a_traits and not numerotees):
            b.genre = "q"
        if b.genre == "q":
            b.nb_traits = suivant.nb_traits if traits_apres else 0
            m_et = RE_ETIQUETTE_FIN.search(t)
            if m_et:
                b.label_apres = m_et.group(1)
    # 4 ter. « La Bible répond : » suivi de lignes : c'est la zone de réponse de la question au-dessus
    res, k = [], 0
    while k < len(blocs):
        b = blocs[k]
        m_seule = RE_ETIQUETTE_SEULE.fullmatch(b.texte) if (b.genre in ("q", "p") and b.lignes) else None
        if m_seule and (b.genre == "q" or (k + 1 < len(blocs) and blocs[k + 1].genre == "traits")):
            j = len(res) - 1
            while j >= 0 and res[j].genre == "traits":
                j -= 1
            if j >= 0 and res[j].genre == "q" and not res[j].label_apres:
                res[j].label_apres = m_seule.group(1)
                res[j].nb_traits = max(res[j].nb_traits, b.nb_traits,
                                       blocs[k + 1].nb_traits if k + 1 < len(blocs) and blocs[k + 1].genre == "traits" else 0)
                del res[j + 1:]                      # traits entre la question et l'étiquette : absorbés
                k += 1
                if k < len(blocs) and blocs[k].genre == "traits":
                    k += 1                           # les lignes de la réponse
                continue
            b.genre, b.etiquette = "etiquette", m_seule.group(1)
        res.append(b)
        k += 1
    blocs = res
    # 4 quater. glossaire « Agneau = Jésus/sacrifice » (séries NUMEROTEES) : lignes en gras, pas des intertitres
    if numerotees:
        for b in blocs:
            if b.genre == "titre" and b.lignes and " = " in b.texte:
                b.genre = "p"
    # 4 bis. titre courant répété en haut de la page suivante : un seul suffit
    res, dernier = [], None
    for b in blocs:
        if b.genre == "titre" and b.lignes:
            k = cle_texte(b.texte)
            if k and k == dernier:
                continue
            dernier = k
        res.append(b)
    blocs = res
    # 5. lignes de références seules (« Texte biblique – Marc 1:40 ») : rattachées à la question au-dessus
    res = []
    for b in blocs:
        if ((b.genre == "p" or (numerotees and b.genre == "titre" and res and res[-1].genre == "q"))
                and b.lignes and res and res[-1].genre in ("q", "p", "num") and res[-1].lignes):
            t = b.texte
            m = re.search(r"\s*R[ée]ponses?\s*:?\s*$", t)
            coeur = t[:m.start()] if m else t
            if coeur.strip() and refs_seules(coeur):
                res[-1].lignes += b.lignes
                res[-1].fin_reponse = bool(m)
                if m:
                    e = Bloc("etiquette"); e.etiquette = "Réponse"
                    res.append(e)
                continue
        res.append(b)
    return res


RE_EDITEUR = re.compile(r"(?i)©|copyright|www\.|https?://|courriel|e-?mail|@|adapté|actualisé|mise à jour|développé|"
                        r"tradu|éditions?\b|tous droits|version \d|\brue\b")


RE_DROITS = re.compile(r"(?i)©|copyright|www\.|courriel|tous droits|développé par|adapté par|traduit par|"
                       r"mise à jour\s*:|actualisé\s*:|\b\d+,? rue\b")


def couverture(blocs, credits, nb_pages, titres_connus):
    """Première page qui n'est qu'une couverture (titres, éditeur, droits) : son texte rejoint les mentions de fin.
    Puis, en tête de ce qui reste, le nom de la série répété et les lignes de droits sont retirés de même."""
    mentions, ids = [], set()
    p0 = [b for b in blocs if b.lignes and b.lignes[0].page == 0 and b.genre not in ("image", "traits")]
    if (nb_pages >= 3 and p0 and not any(b.genre in ("q", "num", "lettre", "puce", "coche", "table") for b in p0)
            and sum(len(b.texte) for b in p0) <= 700 and all(len(b.texte) <= 220 for b in p0)
            and any(RE_EDITEUR.search(b.texte) for b in p0)):
        ids = {id(b) for b in p0 if not (b.genre == "citation" and REF_TOUT.search(b.texte))}
        mentions = [b.texte for b in p0 if id(b) in ids]
    # en tête du document : nom de la série répété, lignes d'éditeur et de droits
    for b in blocs:
        if id(b) in ids or b.genre in ("image", "traits"):
            continue
        if (not b.lignes or b.lignes[0].page > (1 if ids else 0) or b.genre not in ("titre", "p", "etiquette")
                or len(b.texte) > 160):
            break
        if RE_DROITS.search(b.texte):
            mentions.append(b.texte)
            ids.add(id(b))
        elif ids and titre_connu(b.texte, titres_connus):
            ids.add(id(b))
        elif ids:
            break
    if not ids:
        return blocs, credits
    if os.environ.get("LECTURE_TRACE"):
        print("  couverture →", " | ".join(mentions)[:400])
    return [b for b in blocs if id(b) not in ids], mentions + list(credits)


RE_ETIQUETTE_SEULE = re.compile(r"\s*(La Bible répond|Réponses?|Ma réponse|Votre réponse)\s*:?\s*", re.I)
RE_ETIQUETTE_FIN = re.compile(r"\s*(La Bible répond|Réponses?|Ma réponse|Votre réponse|Notes?)\s*:\s*$")


RE_CONSIGNE = re.compile(r"(?i)^\s*(?:<[^>]+>)?\s*(?:décri|décrivez|expliquez|comparez|notez|citez|énumérez|enumerez|identifiez|"
                         r"trouvez|complétez|completez|résumez|resumez|indiquez|nommez|listez|relevez|lisez|écrivez|ecrivez|"
                         r"définissez|definissez|donnez|précisez|precisez|partagez|discutez|réfléchissez|reflechissez|"
                         r"racontez|soulignez|dites|montrez|cherchez|imaginez|pensez|choisissez)")


class _Refs:
    """Références bibliques, en toutes lettres (Jean 3:16) ou abrégées (Matt 11:27)."""
    @staticmethod
    def sub(repl, t):
        return REF_ABREGE.sub(repl, REF_ENTIER.sub(repl, t))

    @staticmethod
    def search(t):
        return REF_ENTIER.search(t) or REF_ABREGE.search(t)


REF_TOUT = _Refs()


def refs_seules(t):
    reste = re.sub(r"\([^)]*\)", " ", t)
    reste = REF_TOUT.sub(" ", reste)
    reste = re.sub(r"(?i)textes? bibliques?|lire|lisez|voir|cf\.?|\bet\b|versets?|\bv\.|\bp\.\s*\d+", " ", reste)
    return not re.search(r"[A-Za-zÀ-ÿ]{3,}", reste) and bool(REF_TOUT.search(t))


def est_interrogatif(t):
    """La phrase finit par une question (suivie au plus de références ou d'une parenthèse)."""
    if "?" not in t:
        return False
    apres = t[t.rindex("?") + 1:]
    if re.match(r"^\s*[»”\"]", apres):
        return False
    reste = re.sub(r"\([^)]*\)", " ", apres)
    reste = REF_TOUT.sub(" ", reste)
    reste = re.sub(r"(?i)textes? bibliques?|lire|lisez|voir|cf\.?|\bet\b|versets?|\bv\.", " ", reste)
    return len(re.findall(r"[A-Za-zÀ-ÿ]{3,}", reste)) <= 3


RE_BLANC = re.compile(r"_{4,}|\.{8,}|…{3,}")


RE_BLANC_COURT = re.compile(r"_{2,}|\.{8,}|…{3,}")   # « ___ ________ » : un trait par mot (séries NUMEROTEES)
motif_blanc = [RE_BLANC]


def blancs(h, participant, compteur):
    if not participant:
        return h
    def champ(m):
        compteur[0] += 1
        n = compteur[0]
        largeur = min(14, max(5, len(m.group(0)) // 2))
        return (f'<input class="lec-blanc" type="text" data-b="{n}" size="{largeur}" '
                f'aria-label="Mot à compléter" autocomplete="off" spellcheck="false">')
    parts = re.split(r"(<[^>]+>)", h)
    return "".join(x if x.startswith("<") else motif_blanc[0].sub(champ, x) for x in parts)


RE_ROMAIN_EN_LIGNE = re.compile(r"\s(?:i{1,3}|iv|vi{0,3}|ix|x)\.\s+[«\"“A-ZÀ-Ý]")
ROMAINS = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"]
RE_MARQUE = re.compile(r"(?:(?<=\s)|^)(?P<ouv><(?:strong|em)>)?((?:x{0,1}(?:ix|iv|v?i{0,3}))|[a-zA-Z]|\d{1,2})([.)])"
                       r"(?P<ferm></(?:strong|em)>)?\s+(?=(?:<[^>]+>)*[«\"“A-ZÀ-Ý])")


class PlanDetaille:
    """Document rédigé en plan détaillé, où plusieurs points se suivent sur une même ligne :
    chaque point est remis sur sa ligne, en retrait selon son niveau (A. › 1. › i. › a. › 1))."""
    NIVEAUX = {"maj": 1, "chiffre": 2, "romain": 3, "min": 4, "chiffre)": 5}

    def __init__(self):
        self.dernier = {}
        self.niveau = 1

    @staticmethod
    def detecter(blocs):
        n = sum(len(RE_ROMAIN_EN_LIGNE.findall(" " + b.texte)) for b in blocs if b.lignes and b.genre != "q")
        return PlanDetaille() if n >= 12 else None

    @staticmethod
    def genre_marque(m):
        v, sep = m.group(2), m.group(3)
        if v.isdigit():
            return ("chiffre)" if sep == ")" else "chiffre"), int(v)
        if v in ROMAINS:
            return "romain", ROMAINS.index(v) + 1
        if len(v) == 1 and v.isupper():
            return "maj", ord(v) - 64
        if len(v) == 1:
            return "min", ord(v) - 96
        return None, 0

    def accepte(self, genre, rang, debut, avant):
        if genre is None:
            return False
        if debut:
            return True
        if rang == self.dernier.get(genre, 0) + 1:
            return True
        return rang == 1 and bool(re.search(r"[.!?:;)»”]\s*$", avant))

    def noter(self, genre, rang):
        self.dernier[genre] = rang
        niv = self.NIVEAUX[genre]
        for g, n in self.NIVEAUX.items():          # un point de niveau supérieur relance la numérotation au-dessous
            if n > niv:
                self.dernier.pop(g, None)
        self.niveau = niv

    def rendre(self, h, genre_bloc, finir):
        morceaux, pos, courant, prefixe = [], 0, None, ""
        for m in RE_MARQUE.finditer(h):
            g, rang = self.genre_marque(m)
            debut = not re.sub(r"<[^>]+>", "", h[:m.start()]).strip()
            if not self.accepte(g, rang, debut, re.sub(r"<[^>]+>", "", h[pos:m.start()])):
                continue
            avant = prefixe + h[pos:m.start()]
            if m.group("ferm") and not m.group("ouv"):
                avant += m.group("ferm")           # la marque fermait un gras ouvert plus haut
            if avant.strip() or courant:
                morceaux.append((courant, avant))
            self.noter(g, rang)
            courant = (m.group(2) + m.group(3), self.NIVEAUX[g])
            prefixe = m.group("ouv") if (m.group("ouv") and not m.group("ferm")) else ""   # gras qui continue
            pos = m.end()
        morceaux.append((courant, prefixe + h[pos:]))
        res = []
        for marque, texte in morceaux:
            texte = texte.strip()
            if not texte:
                continue
            if marque:
                res.append(f'<p class="lec-plan n{marque[1]}"><b class="lec-marque">{marque[0]}</b> {finir(texte)}</p>')
            elif genre_bloc == "puce":
                texte = re.sub(r"^\s*(?:<(?:strong|em)>)?\s*(?:[" + re.escape(PUCES) + r"]|o(?= ))\s*", "", texte)
                res.append(f'<p class="lec-plan n{min(5, self.niveau + 1)}"><b class="lec-marque">–</b> {finir(texte)}</p>')
            else:
                res.append(f'<p class="lec-plan n{self.niveau}">{finir(texte)}</p>')
        return res


def rendu_html(blocs, f, dossier_img, doc, role, credits):
    plan_detaille = PlanDetaille.detecter(blocs)
    compteur_blancs = [0]
    out = []
    nq = 0
    sections = 0
    i = 0
    liste = None   # (balise, items)
    participant = role != "animateur"

    def fermer_liste():
        nonlocal liste
        if liste:
            balise, items = liste
            if balise == "coches":
                out.append('<ul class="lec-coches">' + "".join(f"<li>{x}</li>" for x in items) + "</ul>")
            elif balise in ("ol-a", "ol-A"):
                out.append(f'<ol class="lec-liste" type="{balise[-1]}">' + "".join(items) + "</ol>")
            elif balise == "ol":
                out.append('<ol class="lec-liste">' + "".join(items) + "</ol>")
            else:
                out.append(f'<{balise} class="lec-liste">' + "".join(f"<li>{x}</li>" for x in items) + f"</{balise}>")
            liste = None

    n_img = 0
    while i < len(blocs):
        b = blocs[i]
        g = b.genre
        if g == "coche":
            h = html_lignes(b.lignes)
            h = re.sub(r"^\s*(?:<(?:strong|em)>)?\s*(?:\[\s?\]|☐|□|❑|❒|\uf06f|\uf0a8|\uf071)\s*", "", h)
            if liste and liste[0] != "coches":
                fermer_liste()
            if not liste:
                liste = ("coches", [])
            compteur_blancs[0] += 1
            n = compteur_blancs[0]
            liste[1].append(f'<label><input type="checkbox" data-c="{n}"><span>{lier(h)}</span></label>' if participant else lier(h))
            i += 1
            continue
        if g in ("puce", "lettre") or (g == "num" and not b.genre == "q"):
            h = html_lignes(b.lignes)
            if plan_detaille:
                fermer_liste()
                out.extend(plan_detaille.rendre(h, g, lambda x: lier(blancs(x, participant, compteur_blancs))))
                i += 1
                continue
            valeur = None
            if g == "puce":
                h = re.sub(r"^\s*(?:<(?:strong|em)>)?\s*(?:[" + re.escape(PUCES) + r"]|o(?= ))\s*", "", h)
                balise = "ul"
            else:
                m_v = re.match(r"^\s*(?:<(?:strong|em)>)?\s*(\d{1,2}|[a-hA-H])\s*[.)]\s*", h)
                if m_v:
                    v = m_v.group(1)
                    valeur = int(v) if v.isdigit() else ord(v.lower()) - 96
                    h = h[:m_v.start(1)] + h[m_v.end():] if h[:m_v.start(1)].strip() else h[m_v.end():]
                balise = "ol" if g != "lettre" else ("ol-A" if m_v and m_v.group(1).isupper() else "ol-a")
            if liste and liste[0] != balise:
                fermer_liste()
            if not liste:
                liste = (balise, [])
            contenu = lier(blancs(h, participant, compteur_blancs))
            if balise == "ul":
                liste[1].append(contenu)
            else:
                liste[1].append(f'<li value="{valeur}">{contenu}</li>' if valeur else f"<li>{contenu}</li>")
            i += 1
            continue
        fermer_liste()
        if g == "titre":
            sections += 1
            niv = b.niveau
            out.append(f'<h{niv} id="s{sections}">{lier(html_lignes(b.lignes))}</h{niv}>')
        elif g == "p" and plan_detaille:
            out.extend(plan_detaille.rendre(html_lignes(b.lignes), g, lambda x: lier(blancs(x, participant, compteur_blancs))))
        elif g == "p":
            out.append(f"<p>{lier(blancs(html_lignes(b.lignes), participant, compteur_blancs))}</p>")
        elif g == "q":
            nq += 1
            h = html_lignes(b.lignes)
            num = b.marque
            m_lab = re.match(r"^\s*(?:<strong>)?\s*([^<:?]{2,60}?)\s*:\s*(?:</strong>)?\s*(?:<strong>)?\s*(\d{1,2})\s*[.)]\s+", h)
            if not num and m_lab:
                sections += 1
                out.append(f'<h3 id="s{sections}">{m_lab.group(1).strip()}</h3>')
                num = m_lab.group(2)
                h = h[m_lab.end():]
                if h.startswith("</strong>"):
                    h = h[len("</strong>"):]
                elif "</strong>" in h[:200] and "<strong>" not in h[:h.index("</strong>")]:
                    h = "<strong>" + h
            if num:
                # le numéro est dans la pastille : retiré du texte, styles gardés (les balises vides partent ensuite)
                m_n = re.match(r"^\s*((?:<(?:strong|em)>\s*)*)(?:(?:Question|Q)\s*)?\d{1,2}\s*[.):–-]?\s*", h, flags=re.I)
                if m_n:
                    h = m_n.group(1) + h[m_n.end():].lstrip()
            h = re.sub(r"\s*_{4,}[\s_]*$", "", h)
            if b.fin_reponse:
                h = re.sub(r"\s*(?:<strong>)?\s*R[ée]ponses?\s*:?\s*(?:</strong>)?\s*$", "", h)
            if b.label_apres:
                h = re.sub(r"\s*(?:<strong>)?\s*" + re.escape(b.label_apres) + r"\s*:?\s*(?:</strong>)?\s*$", "", h)
            badge = f'<span class="lec-q-num" aria-hidden="true">{html.escape(num)}</span>' if num else '<span class="lec-q-num lec-q-puce" aria-hidden="true"></span>'
            lignes = b.nb_traits
            zone = ""
            # texte à trous : la question se remplit dans ses blancs ou dans ceux du verset qui la suit
            a_trous = f.split("/")[0] in NUMEROTEES and not lignes and (
                RE_BLANC.search(b.texte) or (i + 1 < len(blocs) and blocs[i + 1].genre == "p" and blocs[i + 1].lignes
                                             and RE_BLANC.search(blocs[i + 1].texte)))
            if (participant or lignes) and not a_trous:
                rangs = min(12, max(2, lignes or 3))
                etiq = (f'<label class="lec-rep-titre" for="q{nq}">{html.escape(b.label_apres)}</label>' if b.label_apres
                        else f'<label class="lec-cache" for="q{nq}">Votre réponse</label>')
                zone = etiq + f'<textarea id="q{nq}" data-q="{nq}" rows="{rangs}" placeholder="Votre réponse"></textarea>'
            out.append(f'<div class="lec-q">{badge}<div class="lec-q-corps"><p>{lier(blancs(h, participant, compteur_blancs))}</p>{zone}</div></div>')
            if b.label_apres and not zone:
                out.append(f'<p class="lec-etiquette">{html.escape(b.label_apres)}</p>')
            if i + 1 < len(blocs) and blocs[i + 1].genre == "traits":
                i += 1
        elif g == "citation":
            out.append(f'<blockquote class="lec-citation"><p>{lier(html_lignes(b.lignes))}</p></blockquote>')
        elif g == "etiquette":
            out.append(f'<p class="lec-etiquette">{html.escape(b.etiquette)}</p>')
        elif g == "traits":
            if b.nb_traits >= 2 and participant:
                nq += 1
                rangs = min(12, b.nb_traits)
                out.append(f'<div class="lec-q lec-q-libre"><div class="lec-q-corps"><label class="lec-cache" for="q{nq}">Vos notes</label>'
                           f'<textarea id="q{nq}" data-q="{nq}" rows="{rangs}" placeholder="Vos notes"></textarea></div></div>')
        elif g == "image":
            x, r = b.img
            n_img += 1
            nom = enregistrer_image(doc, x, dossier_img, n_img) if x else enregistrer_zone(doc, *r, dossier_img, n_img)
            if nom:
                w, hh = nom[1]
                out.append(f'<figure class="lec-img"><img src="lecture/{f}/{nom[0]}" alt="" width="{w}" height="{hh}" loading="lazy" decoding="async"></figure>')
        elif g == "table":
            rangs = b.table
            corps_t = []
            for k, rang in enumerate(rangs):
                cellules = "".join(f"<td>{lier(html.escape(typo(c)).replace(chr(10), '<br>'))}</td>" for c in rang)
                corps_t.append(f"<tr>{cellules}</tr>")
            out.append('<div class="lec-table"><table>' + "".join(corps_t) + "</table></div>")
        i += 1
    fermer_liste()
    # images côte à côte : regroupées en galerie
    texte = "\n".join(out)
    texte = re.sub(r'((?:<figure class="lec-img">.*?</figure>\n){2,})',
                   lambda m: '<div class="lec-galerie">' + m.group(1).replace("\n", "") + "</div>\n", texte)
    if credits:
        texte += "\n" + '<p class="lec-credits">' + "<br>".join(html.escape(typo(c)) for c in credits) + "</p>"
    return texte, nq, sections


# logos d'éditeur, reconnus à leur empreinte visuelle : ce ne sont pas des illustrations
LOGOS = {
    0xe0a0f069e0f070b0: "FAST (lettres en colonne, leçons FAST)",
    0x344c1e963368070f: "Gateway Adventist Centre (carré orange)",
    0x1080a0a8a8929600: "Gateway Adventist Centre (bandeau)",
}


def empreinte(im):
    """Empreinte visuelle sur 64 bits (différences de luminosité sur une vignette 9 × 8)."""
    px = im.convert("L").resize((9, 8), Image.LANCZOS).tobytes()
    h = 0
    for y in range(8):
        for x in range(8):
            h = (h << 1) | (px[y * 9 + x] > px[y * 9 + x + 1])
    return h


def est_logo(im):
    h = empreinte(im)
    return any(bin(h ^ l).count("1") <= 6 for l in LOGOS)


def enregistrer_image(doc, xref, dossier, n):
    try:
        pix = fitz.Pixmap(doc, xref)
        info = doc.extract_image(xref)
        smask = info.get("smask") if info else 0
        if smask:
            try:
                pix = fitz.Pixmap(pix, fitz.Pixmap(doc, smask))
            except Exception:
                pass
        if pix.colorspace and pix.colorspace.n not in (1, 3):
            pix = fitz.Pixmap(fitz.csRGB, pix)
        mode = "RGBA" if pix.alpha else ("L" if pix.n == 1 else "RGB")
        im = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    except Exception:
        return None
    if im.width < 60 or im.height < 60:
        return None
    im.thumbnail((900, 900))
    if est_logo(im):
        return None
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGB")
    dossier.mkdir(parents=True, exist_ok=True)
    nom = f"img-{n}.webp"
    im.save(dossier / nom, "WEBP", quality=72, method=6)
    return nom, (im.width, im.height)


def enregistrer_zone(doc, page, zone, dossier, n):
    """Schéma tracé : la zone de la page, rendue en image (texte des étiquettes compris)."""
    pix = doc[page].get_pixmap(dpi=200, clip=zone)
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
    im.thumbnail((1100, 1100))
    dossier.mkdir(parents=True, exist_ok=True)
    nom = f"img-{n}.webp"
    im.save(dossier / nom, "WEBP", quality=80, method=6)
    return nom, (im.width, im.height)


# ---------------------------------------------------------------- un document

def convertir(f, titres_connus, role, ecrire=True, plan=False):
    chemin = DOCS / f"{f}.pdf"
    motif_blanc[0] = RE_BLANC_COURT if f.split("/")[0] in NUMEROTEES else RE_BLANC
    doc = fitz.open(chemin)
    nb = doc.page_count
    # pas de texte dans le PDF (pages numérisées) : reconnaissance des caractères, si les pages sont peu nombreuses
    ocr = sum(len(p.get_text().strip()) for p in doc) < 200 and nb <= 6
    compteur = collections.Counter()
    for p in doc:
        for info in p.get_image_info(xrefs=True):
            if info.get("xref"):
                compteur[info["xref"]] += 1
    dossier_img = SORTIE / f
    pages_lignes, hauteurs, tailles = [], [], collections.Counter()
    for num, page in enumerate(doc):
        W = page.rect.width
        nv = VOLETS.get(f.split("/")[0], 1) if W > page.rect.height else 1
        coupures = [W * k / nv for k in range(1, nv)]
        numerotees = f.split("/")[0] in NUMEROTEES
        lt = lignes_texte(page, num, ocr, coupures, ecarts=not numerotees)
        if nv > 1:
            lt = [l for l in lt if not RE_CODE_VOLET.match(l.texte)]
        if numerotees:
            lt = [numero_colle(l) for l in meme_ligne(lt, coupures)]
        tb = tables(page, num, lt)
        if tb:
            dedans = lambda l: any(t.x0 - 2 <= (l.x0 + l.x1) / 2 <= t.x1 + 2 and t.y0 - 2 <= l.cy <= t.y1 + 2 for t in tb)
            lt = [l for l in lt if not dedans(l)]
        tr = traits(page, num, lt)
        if f.startswith("fast-"):
            lt, tr = lignes_fast(lt, tr)
        if tb:
            tr = [t for t in tr if not any(x.x0 - 2 <= t.x0 and t.x1 <= x.x1 + 2 and x.y0 - 2 <= t.y0 <= x.y1 + 2 for x in tb)]
        im = [] if ocr else images(doc, page, num, compteur, dossier_img, f, nb)
        if nv > 1:      # fonds d'encadrés (texture grise sous le texte) : pas des illustrations
            im = [i for i in im if sum(i.x0 <= (l.x0 + l.x1) / 2 <= i.x1 and i.y0 <= l.cy <= i.y1 for l in lt) < 2]
            # cadre d'une illustration, filet au-dessus des mentions de droits : pas des lignes-réponses
            tr = [t for t in tr
                  if not any(i.x0 - 8 <= t.x0 and t.x1 <= i.x1 + 8 and i.y0 - 6 <= t.y0 <= i.y1 + 6 for i in im)
                  and not any("©" in l.texte and 0 <= l.y0 - t.y1 < 40 and l.x0 < t.x1 and l.x1 > t.x0 for l in lt)]
        if nv > 1:
            for zone, pris in schemas(page, lt, coupures, im, corps_page(lt)):
                for t in [t for t in tb if t.x1 > zone.x0 and t.x0 < zone.x1 and t.y1 >= zone.y0 - 20 and t.y0 <= zone.y1 + 20]:
                    zone |= fitz.Rect(t.x0, t.y0, t.x1, t.y1)      # tableau qui fait partie du schéma (calcul)
                    tb.remove(t)
                lt = [l for l in lt if id(l) not in pris]
                tr = [t for t in tr if not zone.intersects(fitz.Rect(t.x0, t.y0 - 1, t.x1, t.y1 + 1))]
                im = [i for i in im if not zone.intersects(fitz.Rect(i.x0, i.y0, i.x1, i.y1))]
                fig = Ligne(num, (zone.x0, zone.y0, zone.x1, zone.y1), genre="image")
                fig.img = (None, (num, zone))
                im.append(fig)
        tout = lt + tr + im + tb
        if nv > 1:
            for k in range(nv):
                volet = [l for l in tout if sum((l.x0 + l.x1) / 2 >= x for x in coupures) == k]
                for l in volet:
                    l.page = len(pages_lignes)
                pages_lignes.append(volet)
                hauteurs.append(page.rect.height)
        else:
            if page.rect.width > page.rect.height:
                tout = doublon_demi_page(tout, page.rect.width)
            for l in tout:
                l.page = len(pages_lignes)
            pages_lignes.append(tout)
            hauteurs.append(page.rect.height)
        for l in lt:
            for s in l.spans:
                if s[0].strip():
                    tailles[round(s[3])] += len(s[0].strip())
    texte_total = sum(tailles.values())
    if texte_total < 200:
        return None
    corps = tailles.most_common(1)[0][0] if tailles else 11
    pages_lignes = [encadres_lateraux(ls, corps) for ls in pages_lignes]
    pages_lignes, credits = entetes_pieds(pages_lignes, hauteurs)
    pages_lignes, credits = bas_de_page(pages_lignes, hauteurs, corps, credits)
    ordre = []
    for ls in pages_lignes:
        ordre += ordonner(ls)
    blocs = construire_blocs(ordre, corps)
    blocs = classer(blocs, corps, titres_connus, role, numerotees=f.split("/")[0] in NUMEROTEES)
    blocs, credits = couverture(blocs, credits, nb, titres_connus)
    if plan:
        for b in blocs:
            print(f"{b.genre:6s} {('#' + str(b.marque)) if b.marque else '':4s} {('[' + str(b.nb_traits) + ']') if b.nb_traits else '':4s} {b.texte[:110]!r}" if b.lignes else f"{b.genre:6s} {b.nb_traits or ''}")
        return None
    if ecrire and dossier_img.exists():
        for vieux in dossier_img.glob("img-*.webp"):
            vieux.unlink()
    h, nq, ns = rendu_html(blocs, f, dossier_img, doc, role, credits)
    h = corriger_references(h, f)
    if ecrire:
        sortie = SORTIE / f"{f}.html"
        sortie.parent.mkdir(parents=True, exist_ok=True)
        sortie.write_text(h + "\n", encoding="utf-8")
    return {"q": nq, "s": ns, "o": len(h.encode())}


def catalogue():
    src = (RACINE / "donnees" / "bibliotheque.js").read_text(encoding="utf-8")
    data = json.loads(src[src.index("{"):src.rindex("}") + 1])
    res = []
    for s in data["series"]:
        for l in s["lecons"]:
            for d in l["docs"]:
                res.append((s, l, d))
        for d in s["ressources"]:
            res.append((s, None, d))
    return res


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    plan = "--plan" in sys.argv
    index = {}
    if INDEX.exists() and args:
        src = INDEX.read_text(encoding="utf-8")
        index = json.loads(src[src.index("{"):src.rindex("}") + 1])
    stats = collections.Counter()
    for s, l, d in catalogue():
        f = d.get("f")
        if not f or (args and f not in args):
            continue
        if d.get("format") in EXCLUS_FORMATS or f in EXCLUS:
            stats["exclus"] += 1
            index.pop(f, None)
            continue
        titres = ([s["titre"]] + ([l["titre"]] if l else []) + ([d.get("titre")] if d.get("titre") else [])
                  + ([d["libelle"]] if d.get("libelle") else []) + ["Fiche du participant", "Guide de l’animateur", "Guide de l'animateur"])
        role = "animateur" if (d.get("role") == "animateur" or "réponses" in (d.get("libelle") or "").lower()) else "participant"
        if f.startswith("fast-leaders/") or (f.startswith("fast-") and l is None):
            role = "animateur"      # manuel, couverture, illustrations FAST : à lire, rien à remplir
        try:
            r = convertir(f, titres, role, plan=plan)
        except Exception as e:  # noqa: BLE001
            print("ÉCHEC", f, e)
            stats["echec"] += 1
            continue
        if plan:
            continue
        if not r:
            stats["sans texte"] += 1
            index.pop(f, None)
            continue
        index[f] = {"q": r["q"], "s": r["s"]}
        stats["ok"] += 1
    if not plan:
        INDEX.write_text("/* Généré par outils/lecture/convertir.py : documents qui ont une version lecture. */\n"
                         "window.LECTURE = " + json.dumps(dict(sorted(index.items())), ensure_ascii=False, separators=(",", ":")) + ";\n",
                         encoding="utf-8")
    print(dict(stats))


if __name__ == "__main__":
    main()
