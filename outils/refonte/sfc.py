"""Livrets scannés « Search for Certainty » → « En quête de certitude » (études 2 à 30).

Gabarit commun à la série (couverture, bandeaux, dos) + traduction propre à chaque livret, textes/sfc-NN.json :
{
  "titre": "...", "soustitre": "...",       couverture et bandeaux des pages (<sup>e</sup> permis)
  "intro": ["<p>...</p>", ...],             introduction ; le 1er paragraphe commence par la lettrine
  "citation": "...",                        citation en marge de la couverture
  "p": {"2.1": "...", ...},                 paragraphes par « page.indice » (python3 sfc.py apercu N)
                                              null : effacé sans remplacement ; "=" : laissé tel quel ;
                                              liste : une valeur par ligne du paragraphe ;
                                              MY DECISION : {"titre": "MA DÉCISION :", "texte": "..."}
  "styles": {"5.7": "question"},            styles imposés (noms de refaire_scan.STYLES ou css)
  "remplacer": {"5": [["Breast and Arms", "Poitrine et bras", "tableau"], ...]},  petits textes isolés
  "marges": {"3": 680}                      bord droit des réponses d'une page (sinon mesuré)
}
Usage : python3 sfc.py apercu N  |  python3 sfc.py N  |  python3 sfc.py voir N
"""
import json, re, sys, types
from pathlib import Path
import numpy as np
import pymupdf
from PIL import Image
from scipy import ndimage
import refaire_scan as R
from typo import fr
R.FILTRE_ICONES = False          # les icônes sont retirées par leur forme (sans_icones)

import chemins  # noqa: E402
CACHE = chemins.OCR_CACHE
POL = str(chemins.POLICES) + '/'
ARCHIVO, GOUDY, GILL = POL + 'ArchivoBlack-Regular.ttf', POL + 'SortsMillGoudy-Regular-c.ttf', POL + 'GilliusADF-Regular-c.otf'
SOMBRE = 110
PX = R.PX

R.STYLES.update({
    'note': "font-family: gill; font-size: 7.9pt; line-height: 9.6pt; text-indent: 1em;",
    'suite': "font-family: gill; font-size: 9.7pt; line-height: 11.3pt;",
    'tableau': "font-family: gill; font-size: 9.7pt; line-height: 11pt;",
    'tableau-titre': "font-family: gill; font-style: italic; font-size: 9.7pt; line-height: 11pt;",
    'intertitre': "font-family: gill; font-weight: bold; font-size: 11pt; line-height: 12.5pt;",
    'decision': "font-family: gill; font-style: italic; font-size: 9.7pt; line-height: 11.3pt;",
    'graphique': "font-family: gill; font-size: 7.4pt; line-height: 8.4pt;",
    'graphique-gras': "font-family: gill; font-weight: bold; font-size: 7.6pt; line-height: 8.6pt;",
    'cellule': "font-family: gillc; font-size: 9pt; line-height: 9pt;",
    'cellule-gras': "font-family: gillc; font-weight: bold; font-size: 9.6pt; line-height: 9.6pt;",
    'titre-tableau': "font-family: gill; font-size: 10pt; line-height: 11pt;",
    'intertitre-gras': "font-family: gill; font-weight: bold; font-size: 10.8pt; line-height: 12.5pt;",
    'cadre-titre': "font-family: gill; font-weight: bold; font-size: 10.5pt; line-height: 12pt;",
    'liste': "font-family: gill; font-size: 9.7pt; line-height: 11.3pt; padding-left: 16pt; text-indent: -16pt;",
    'titre-annexe': "font-family: goudy; font-weight: bold; font-size: 11pt; line-height: 12.5pt;",
    'citation-texte': "font-family: gill; font-size: 9.7pt; line-height: 11.3pt; text-indent: 1.1em;",
})

ETIQUETTE = re.compile(r'^[|~_\s]*(The Bible (answer|says)|The answer)', re.I)
QUESTION = re.compile(r'(^|\s)(\d{1,2}[.,]\s?[A-Z‘“"]|\|[.,]\s|[A-H][.,]\s)')
GARDER = re.compile(r'(?i)^(notes|p\.?\s?o\.?,?\s|box|thousand|copyright|printed|sfc\s?[\dosil|]{2}\b|\S{1,3}\s+is\s+written\b|[|‘\'’]?thousand)')
DOS = [
    (re.compile(r'(?i)^(name|nawe|nae|n?a?me)(\s*·)*$'), '<b><i>NOM</i></b>', 'left'),
    (re.compile(r'(?i)^(address|appress|aooress|adoress)(\s*·)*$'), '<b><i>ADRESSE</i></b>', 'left'),
    (re.compile(r'(?i)^(phone|prone|pnone)(\s*·)*$'), '<b><i>TÉLÉPHONE</i></b>', 'right'),
]
STYLE_DOS = 'font-family: gill; font-size: 8.4pt; letter-spacing: 0.5pt;'


NBSP = '\u00a0'
NOWRAP = '<span style="white-space: nowrap">{}</span>'
def refs(html):
    """Typographie : références bibliques insécables (« Daniel 2:44, 45 », « 2 Pierre 1:21 »), dates
    (« 539 av. J.-C. »), pronoms inversés (« est-elle », « a-t-il ») et nombres (« 2 500 ») sans coupure."""
    if not isinstance(html, str):
        return html
    html = re.sub(r'(?<=[A-Za-zéèêëïîÉ]) (?=\d+:\d)', NBSP, html)
    html = re.sub(r'\b([1-3]) (?=[A-ZÉ][a-zéèêëï]+' + NBSP + r'\d)', r'\1' + NBSP, html)
    html = re.sub(r'(\d+:\d+(?:-\d+)?), (?=\d)', r'\1,' + NBSP, html)
    html = re.sub(r'(\d+) (av\.|apr\.) J\.-C\.', lambda m: NOWRAP.format(f'{m.group(1)}{NBSP}{m.group(2)}{NBSP}J.-C.'), html)
    html = re.sub(r"(?<![\w’'-])([\wÀ-ÿ’']+(?:-t)?-(?:il|ils|elle|elles|on|je|tu|nous|vous|ce|là|ci|même|mêmes))(?![\w-])",
                  lambda m: NOWRAP.format(m.group(1)), html)
    html = re.sub(r'\b(Y) (?=<span style="white-space: nowrap">a-t-il)', r'\1' + NBSP, html)
    html = re.sub(r'(?<=\d) (?=\d{3}\b)', NBSP, html)
    return html


def charger(n):
    D = json.load(open(CACHE / f'sfc-{n:02d}.json'))
    pages = [Image.open(CACHE / f'sfc-{n:02d}-p{d["page"]}.png').convert('L') for d in D]
    return pages, [d['mots'] for d in D]


def style_auto(p):
    t = p['texte']
    if ETIQUETTE.match(t):
        return 'etiquette'
    if QUESTION.search(t[:14]):
        return 'question'
    return 'reponse'


# ======================================================================= détections sur l'image
def bandeau(a, cote_icones=None):
    """Bandeau noir du haut des pages 2 à 8 : rangées, boîte du texte blanc, place libre (hors icônes)."""
    lignes = [y for y in range(8, 112) if (a[y, 60:760] < SOMBRE).mean() > 0.5]
    if not lignes:
        return None
    y0, y1 = min(lignes), max(lignes)
    # étendue de la bande : plus long segment sombre de la rangée du milieu (trous des lettres ≤ 20 px comblés)
    xs = np.where(a[(y0 + y1) // 2] < SOMBRE)[0]
    segs, d_, p_ = [], xs[0], xs[0]
    for x in list(xs[1:]) + [10 ** 6]:
        if x - p_ > 20:
            segs.append((d_, p_))
            d_ = x
        p_ = x
    x0, x1 = map(int, max(segs, key=lambda s_: s_[1] - s_[0]))
    x0, x1 = x0 + 5, x1 - 5                 # bords arrondis de la bande (anticrénelage) exclus
    zone = a[y0 + 1:y1, x0 + 2:x1 - 2] > 160
    cols = np.where(zone.any(axis=0))[0]
    if cols.size == 0:
        return None
    groupes, deb, prec = [], cols[0], cols[0]
    for c in cols[1:]:
        if c - prec > 12:
            groupes.append((deb, prec)); deb = c
        prec = c
    groupes.append((deb, prec))
    g = max(groupes, key=lambda g: g[1] - g[0])
    tx0, tx1 = x0 + 2 + int(g[0]), x0 + 2 + int(g[1]) + 1
    gauche = [h for h in groupes if x0 + 2 + h[1] < tx0]
    droite = [h for h in groupes if x0 + 2 + h[0] > tx1]
    cote = cote_icones if cote_icones else ('gauche' if len(gauche) >= len(droite) else 'droite')
    if cote == 'gauche':          # icônes à gauche : les groupes à droite du texte sont du texte
        icones = [h for h in gauche if x0 + 2 + h[0] < x0 + 110]
        texte = [h for h in groupes if h not in icones]
    else:
        icones = [h for h in droite if x0 + 2 + h[1] > x1 - 110]
        texte = [h for h in groupes if h not in icones]
    tx0, tx1 = x0 + 2 + int(min(h[0] for h in texte)), x0 + 2 + int(max(h[1] for h in texte)) + 1
    rws = np.where((a[y0 + 1:y1, tx0:tx1] > 160).any(axis=1))[0]
    return {'rangs': [y0, y1], 'texte': [tx0, y0 + 1 + int(rws.min()), tx1, y0 + 1 + int(rws.max()) + 1],
            'icones': cote,
            'libre': [(x0 + 2 + int(max(h[1] for h in icones)) + 1) if (cote == 'gauche' and icones) else x0,
                      (x0 + 2 + int(min(h[0] for h in icones))) if (cote == 'droite' and icones) else x1]}


def effacer_entete(img, bd):
    """Repeint en noir le texte blanc du bandeau (trous de la bande, jambages compris) ; renvoie la ligne de base."""
    tb = bd['texte']
    y0, y1 = bd['rangs'][0] - 6, bd['rangs'][1] + 7
    x0, x1 = tb[0] - 4, tb[2] + 5
    zone = img[y0:y1, x0:x1]
    lab, n = ndimage.label(zone > 160)
    bas = [y0 + sl[0].stop for k, sl in enumerate(ndimage.find_objects(lab), start=1)
           if 7 <= sl[0].stop - sl[0].start <= 16 and sl[1].stop - sl[1].start < 40 and sl[0].start > 0 and sl[0].stop < zone.shape[0]]
    base = float(np.median(bas)) if bas else bd['rangs'][1] - 4
    m = zone < 110
    ferme = ndimage.binary_closing(m, structure=np.ones((7, 7))) | m
    plein = ndimage.binary_fill_holes(ferme)
    noir = int(np.median(zone[m])) if m.any() else 20
    trous = ndimage.binary_dilation(plein & ~m, iterations=2) & plein      # avec le liseré gris des lettres
    zone[trous] = noir
    return base


def banniere(a):
    """Décalage (dx, dy) de la bannière « SEARCH FOR Certainty » par rapport à l'étude 1."""
    top = next((y for y in range(5, 130) if (a[y, 250:700] < SOMBRE).mean() > 0.6), 31)
    xs = np.where(a[top + 25] < SOMBRE)[0]
    return (int(xs.min()) - 109 if xs.size else 0), top - 31


def case_certitude(a, dx, dy):
    """Boîte des lettres de « Certainty » dans la case blanche de la bannière (sans le curseur « I »)."""
    x0, y0 = 500 + dx, max(40 + dy, 0)
    zone = a[y0:105 + dy, x0:730 + dx] < 120
    lab, n = ndimage.label(zone)
    lettres = []
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 6 <= h <= 34 and w <= 40 and not (h >= 20 and w <= 7):
            lettres.append([x0 + sl[1].start, y0 + sl[0].start, x0 + sl[1].stop, y0 + sl[0].stop])
    if not lettres:
        return [513 + dx, 54 + dy, 660 + dx, 92 + dy]
    # garder la rangée principale (le mot) : composantes alignées verticalement avec la plus grande
    cy = np.median([(l[1] + l[3]) / 2 for l in lettres])
    lettres = [l for l in lettres if abs((l[1] + l[3]) / 2 - cy) < 14]
    return [min(l[0] for l in lettres) - 3, min(l[1] for l in lettres) - 3, max(l[2] for l in lettres) + 3, max(l[3] for l in lettres) + 3]


def cartouche(a, dx=0):
    """Cartouche du titre : boîte et ligne de base du titre (noir sur blanc) et du sous-titre (blanc sur noir)."""
    frac = (a[100:280, 330 + dx:640 + dx] < SOMBRE).mean(axis=1)
    blocs, deb = [], None
    for y, s in zip(range(100, 280), frac > 0.45):
        if s and deb is None:
            deb = y
        if not s and deb is not None:
            blocs.append((deb, y - 1)); deb = None
    if deb is not None:
        blocs.append((deb, 279))
    blocs = [b for b in blocs if b[1] >= 165]
    bande = max(blocs, key=lambda b: b[1] - b[0])
    # titre : petites composantes sombres au-dessus de la bande
    y0z = 115
    X0 = 100 + dx
    lab, n = ndimage.label(a[y0z:bande[0], X0:730 + dx] < 130)
    comps = []
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h <= 70 and w <= 120 and (lab[sl] == k).sum() >= 6 and sl[0].start > 2 and X0 + sl[1].stop < 700 + dx:
            comps.append((X0 + sl[1].start, y0z + sl[0].start, X0 + sl[1].stop, y0z + sl[0].stop))
    cy = np.median([(c[1] + c[3]) / 2 for c in comps])
    comps = [c for c in comps if abs((c[1] + c[3]) / 2 - cy) < 30]
    titre = [min(c[0] for c in comps), min(c[1] for c in comps), max(c[2] for c in comps), max(c[3] for c in comps)]
    grands = [c for c in comps if c[3] - c[1] >= 12]
    base_titre = float(np.median([c[3] for c in grands])) if grands else titre[3]
    # sous-titre : lettres blanches = trous de la bande noire (le blanc de l'intérieur du cartouche, relié
    # à l'extérieur, n'en fait pas partie)
    y0b, y1b = bande[0] - 4, bande[1] + 5
    x0b = 100 + dx
    zone = a[y0b:y1b, x0b:min(790 + dx, a.shape[1])]
    m = zone < 110
    ferme = ndimage.binary_closing(m, structure=np.ones((5, 5))) | m
    trous = ndimage.binary_fill_holes(ferme) & ~m
    lab, n = ndimage.label(trous)
    comps = []
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        if (lab[sl] == k).sum() >= 4 and sl[0].stop - sl[0].start >= 3:
            comps.append((x0b + sl[1].start, y0b + sl[0].start, x0b + sl[1].stop, y0b + sl[0].stop))
    pleines = np.where((a[bande[0]:bande[1] + 1, 380 + dx:min(770 + dx, a.shape[1])] < SOMBRE).mean(axis=0) > 0.8)[0]
    fin_bande = 380 + dx + int(pleines.max()) if pleines.size else 720 + dx
    comps = [c for c in comps if c[2] <= fin_bande - 1]
    st = [min(c[0] for c in comps), min(c[1] for c in comps), max(c[2] for c in comps), max(c[3] for c in comps)] if comps else None
    grands = [c for c in comps if c[3] - c[1] >= 10]
    base_st = float(np.median([c[3] for c in grands])) if grands else (st[3] if st else bande[1] - 6)
    # profil de la bande, colonne par colonne (bord haut et bas lissés : les jambages qui touchent la bande sont ignorés)
    haut, bas = np.full(a.shape[1], np.nan), np.full(a.shape[1], np.nan)
    for x in range(100, min(770 + max(dx, 0), a.shape[1])):
        col = a[bande[0] - 20:bande[1] + 20, x] < 110
        best, deb = (0, 0, 0), None
        for y, v in enumerate(list(col) + [False]):
            if v and deb is None:
                deb = y
            if not v and deb is not None:
                if y - deb > best[0]:
                    best = (y - deb, deb, y)
                deb = None
        # colonne propre : une longue zone sombre qui descend jusqu'au bas de la bande (pas de lettre blanche dedans) ;
        # elle peut être plus haute que la bande au milieu (coin arrondi du cartouche)
        H = bande[1] - bande[0]
        fin = bande[0] - 20 + best[2]
        if 0.8 * H <= best[0] <= 3 * H and abs(fin - (bande[1] + 1)) <= 5:
            haut[x], bas[x] = bande[0] - 20 + best[1], fin
    def lisser(v):
        out = v.copy()
        for x in range(100, min(770 + max(dx, 0), a.shape[1])):
            for r in (20, 60, 120):
                w = v[max(x - r, 0):x + r + 1]
                w = w[~np.isnan(w)]
                if w.size >= 3:
                    out[x] = np.median(w)
                    break
            else:
                out[x] = np.nan
        return out
    # bord haut de la bande : droit (sauf coins) ; là où des lettres l'entament, on garde la valeur commune
    centre = haut[200 + dx:650 + dx]
    haut_const = float(np.nanpercentile(centre, 20)) if np.isfinite(centre).any() else bande[0]
    bas_l = lisser(bas)
    haut_l = lisser(haut)
    haut_l = np.where(np.isnan(haut_l), haut_l, np.minimum(haut_l, haut_const))
    # sous-titre (2e méthode) : pixels clairs à l'intérieur de la bande
    bas_const = float(np.nanmedian(bas[200 + dx:650 + dx])) if np.isfinite(bas[200 + dx:650 + dx]).any() else bande[1]
    yi0, yi1 = int(haut_const) + 2, int(bas_const) - 2
    if yi1 > yi0:
        lab, n = ndimage.label(a[yi0:yi1, 140 + dx:fin_bande - 3] > 160)
        for k, sl in enumerate(ndimage.find_objects(lab), start=1):
            if (lab[sl] == k).sum() >= 4:
                comps.append((140 + dx + sl[1].start, yi0 + sl[0].start, 140 + dx + sl[1].stop, yi0 + sl[0].stop))
        if comps:
            st = [min(c[0] for c in comps), min(c[1] for c in comps), max(c[2] for c in comps), max(c[3] for c in comps)]
            grands = [c for c in comps if c[3] - c[1] >= 10]
            base_st = float(np.median([c[3] for c in grands])) if grands else st[3]
    return {'bande': [int(bande[0]), int(bande[1])], 'titre': titre, 'base_titre': base_titre,
            'soustitre': st, 'base_soustitre': base_st, 'fin_bande': fin_bande, 'haut': haut_l, 'bas': bas_l}


def lettrine(a):
    """Lettrine de la couverture : boîte de la lettre et filet qui en part vers la droite."""
    y0z, x0z = 250, 80
    m = a[y0z:430, x0z:300] < 225
    lab, n = ndimage.label(ndimage.binary_opening(m, structure=np.ones((4, 4))))
    cands = [(sl, int((lab[sl] == k).sum())) for k, sl in enumerate(ndimage.find_objects(lab), start=1)]
    cands = [c for c in cands if c[1] >= 120]
    gauche = [c for c in cands if c[0][1].start < 70 and 30 <= c[0][0].stop - c[0][0].start <= 100]
    if not gauche:
        return None, None
    sl = max(gauche, key=lambda c: c[1])[0]
    b = [sl[1].start, sl[0].start, sl[1].stop, sl[0].stop]
    for s2, aire in cands:          # autres morceaux de la même lettre
        if s2[0].start >= b[1] - 8 and s2[0].stop <= b[3] + 8 and s2[1].start <= b[2] + 10:
            b = [min(b[0], s2[1].start), min(b[1], s2[0].start), max(b[2], s2[1].stop), max(b[3], s2[0].stop)]
    sub = m[max(b[1] - 3, 0):b[3] + 3, max(b[0] - 3, 0):b[2] + 3]
    rows, cols = np.where(sub.sum(axis=1) >= 3)[0], np.where(sub.sum(axis=0) >= 3)[0]
    L = [x0z + max(b[0] - 3, 0) + int(cols.min()), y0z + max(b[1] - 3, 0) + int(rows.min()),
         x0z + max(b[0] - 3, 0) + int(cols.max()) + 1, y0z + max(b[1] - 3, 0) + int(rows.max()) + 1]
    filet = None
    for y in range(L[1] - 10, L[1] + 30):
        if (a[y, L[2] + 12:L[2] + 72] < 185).mean() > 0.8:
            filet = [y, y + 1] if filet is None else [filet[0], y + 1]
    # traits fins de la lettre à droite de la boîte (bras du W...) : colonnes encrées dans le haut de la lettre
    haut = (L[1], L[1] + int((L[3] - L[1]) * 0.6))
    x = L[2]
    while x < L[2] + 45:
        col = a[haut[0]:haut[1], x] < 200
        if filet:
            col[max(filet[0] - 1 - haut[0], 0):filet[1] + 1 - haut[0]] = False
        if not col.any():
            break
        x += 1
    L[2] = x
    return L, filet


def photo_couverture(a, dx=0):
    """Cadre de la photo de couverture (colonne de droite) : plus grande composante sombre."""
    x0z, y0z = 380 + dx, 250
    zone = a[y0z:860, x0z:min(770 + dx, a.shape[1])] < 170
    lab, n = ndimage.label(zone)
    best, aire_best = None, 0
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h > 150 and w > 150 and h * w > aire_best:
            best, aire_best = sl, h * w
    ph = None if best is None else [x0z + best[1].start, y0z + best[0].start, x0z + best[1].stop, y0z + best[0].stop]
    # cadre fin (photos sur fond blanc) : longues lignes grises verticales et horizontales
    gris = a < 200
    def plus_longue(v):
        best_, cur = 0, 0
        for b_ in v:
            cur = cur + 1 if b_ else 0
            best_ = max(best_, cur)
        return best_
    xs = [x for x in range(380 + dx, 490 + dx) if plus_longue(gris[260:870, x]) >= 220]
    ys = [y for y in range(480, 880) if plus_longue(gris[y, 400 + dx:min(745 + dx, a.shape[1])]) >= 200]
    if xs and ys:
        cadre = [min(xs), 260, 720 + dx, max(ys)]
        if ph is None:
            ph = cadre
        else:
            ph = [min(ph[0], cadre[0]), ph[1], ph[2], max(ph[3], cadre[3]) if cadre[3] - ph[3] < 120 else ph[3]]
    return ph or [425 + dx, 270, 720 + dx, 635]


def colonnes_couverture(mots, L, ligne1_bas, dx=0, photo=None):
    """Zones de l'introduction : colonne à côté de la photo puis pleine largeur sous la photo."""
    ph = photo or [430 + dx, 280, 705 + dx, 800]
    bons = [m for m in mots if m['conf'] > 30 and m['y0'] > ligne1_bas - 2 and m['x0'] < 556 + dx
            and not (m['x0'] >= ph[0] - 12 and m['y1'] <= ph[3] + 4)]
    lignes = {}
    for m in bons:
        lignes.setdefault((m['bloc'], m['par'], m['ligne']), []).append(m)
    lignes = sorted(([min(m['x0'] for m in v), min(m['y0'] for m in v), max(m['x1'] for m in v), max(m['y1'] for m in v)]
                     for v in lignes.values()), key=lambda l: l[1])
    larges = [l for l in lignes if l[2] > ph[0] + 20 and l[0] < 250 + dx and l[1] > ph[3] - 40]
    limite = min([ph[3] + 3] + [larges[0][1] - 5] if larges else [ph[3] + 3])
    gauche = min([l[0] for l in lignes] + [L[0] if L else 104]) - 2
    col1 = min(max([l[2] for l in lignes if l[1] < limite and l[0] < 300 + dx] + [400 + dx]) + 2, ph[0] - 8)
    col2 = max([l[2] for l in larges] + [545 + dx]) + 2
    return gauche, col1, limite, min(col2, 566 + dx)


def icones_page(a):
    """Icônes « ? » des questions : anneaux sombres de 30 à 70 px (éventuellement collés au numéro qui suit)."""
    lab, n = ndimage.label(a < 110)
    res = []
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 30 <= h <= 70 and 30 <= w <= 140 and sl[1].start < 400:
            aire = (lab[sl] == k).sum() / (h * min(w, h))
            if 0.15 < aire < 0.8:
                res.append([sl[1].start, sl[0].start, sl[1].start + min(w, int(h * 1.05)), sl[0].stop])
    return res


def cases_page(a):
    """Cases à cocher (carrés creux de 16 à 27 px, ombrés en haut et à droite)."""
    lab, n = ndimage.label(a < 140)
    res = []
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 16 <= h <= 27 and 16 <= w <= 27 and 0.75 <= w / h <= 1.33:
            m = lab[sl] == k            # case ombrée : bord haut et bord droit épais, intérieur vide
            if m[:4].mean() > 0.6 and m[:, -4:].mean() > 0.6 and m[5:-3, 3:-5].mean() < 0.08:
                res.append([sl[1].start - 2, sl[0].start, sl[1].stop, sl[0].stop + 1])
    return res


def filets_pales(a):
    """Filets clairs ou pointillés (lignes de réponse) : suites de pixels gris sur une rangée, trous ≤ 6 px,
    longues d'au moins 150 px, avec du blanc juste au-dessus et juste au-dessous. Rectangles à protéger."""
    res = []
    m = a < 200
    h = a.shape[0]
    for y in range(60, h - 4):
        xs = np.where(m[y])[0]
        if xs.size < 60:
            continue
        d_, p_ = xs[0], xs[0]
        for x in list(xs[1:]) + [10 ** 6]:
            if x - p_ > 6:
                if p_ - d_ >= 150:
                    seg = m[y, d_:p_ + 1]
                    if seg.mean() > 0.4 and m[y - 3, d_:p_ + 1].mean() < 0.15 and m[y + 3, d_:p_ + 1].mean() < 0.15:
                        res.append([int(d_), y - 1, int(p_) + 1, y + 2])
                d_ = x
            p_ = x
    return res


def traits_verticaux(a):
    """Filets verticaux (bord de page) : composantes fines et hautes."""
    lab, n = ndimage.label(a < 140)
    return [[sl[1].start, sl[0].start, sl[1].stop, sl[0].stop] for sl in ndimage.find_objects(lab)
            if sl[0].stop - sl[0].start > 60 and sl[1].stop - sl[1].start <= 8]


def sans_icones(mots, ics, traits=()):
    """Retire les « mots » OCR qui sont en fait l'icône (ou l'icône collée au numéro), ou un bord de page."""
    out = []
    for m in mots:
        aire = max((m['x1'] - m['x0']) * (m['y1'] - m['y0']), 1)
        recouvre = max([max(0, min(m['x1'], i[2]) - max(m['x0'], i[0])) * max(0, min(m['y1'], i[3]) - max(m['y0'], i[1]))
                        for i in list(ics) + list(traits)] + [0])
        if recouvre / aire < 0.4:
            # petit signe isolé à gauche d'une icône (bord de page) : à ignorer
            if len(m['texte']) <= 2 and any(m['x1'] <= i[0] + 2 and min(m['y1'], i[3]) - max(m['y0'], i[1]) > 0 for i in ics):
                continue
            out.append(m)
    # trait vertical isolé en début de ligne (bord de page lu « | ») : à ignorer
    lignes = {}
    for m in out:
        lignes.setdefault((m['bloc'], m['par'], m['ligne']), []).append(m)
    for L in lignes.values():
        L.sort(key=lambda m: m['x0'])
        while len(L) > 1 and (L[0]['texte'] in ('|', '!', 'l', 'I', '{', '}', '[', ']', '(', ')') or re.match(r'^[_~\-–—]+$', L[0]['texte'])) \
                and L[1]['x0'] - L[0]['x1'] > 10:
            out.remove(L.pop(0))
        # ligne réduite à un trait (bord de page) : à ignorer
        if all(re.match(r'^[|{}\[\]()_~\-–—!]+$', m['texte']) or (m['x1'] - m['x0'] <= 4 and len(m['texte']) <= 2) for m in L):
            for m in L:
                if m in out:
                    out.remove(m)
    return out


def completer(a, mots, haut=0, icones=()):
    """Ajoute des « mots » pour l'encre que l'OCR a manquée : glyphes isolés au bout d'une ligne reconnue
    (rattachés à cette ligne) et lignes entières oubliées (rattachées au paragraphe voisin)."""
    lab, n = ndimage.label(a < 140)
    grands, glyphes = [], []
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if h > 60 or w > 120:
            grands.append([sl[1].start, sl[0].start, sl[1].stop, sl[0].stop])
        elif 5 <= h <= 30 and w <= 60 and sl[0].start >= haut:       # (les tirets d'un pointillé, plus bas, sont ignorés)
            glyphes.append([sl[1].start, sl[0].start, sl[1].stop, sl[0].stop])
    boites = [[m['x0'] - 3, m['y0'] - 3, m['x1'] + 3, m['y1'] + 3] for m in mots]
    seuls = []
    for g in glyphes:
        cx, cy = (g[0] + g[2]) / 2, (g[1] + g[3]) / 2
        if any(b[0] <= cx <= b[2] and b[1] <= cy <= b[3] for b in boites):
            continue
        if any(b[0] - 3 <= g[0] and g[2] <= b[2] + 3 and b[1] - 3 <= g[1] and g[3] <= b[3] + 3 for b in grands):
            continue
        if any(ic[0] - 2 <= cx <= ic[2] + 2 and ic[1] - 2 <= cy <= ic[3] + 2 for ic in icones):
            continue
        seuls.append(g)
    ajout = []
    restants = list(seuls)
    ancres = list(mots)
    for _ in range(60):                   # glyphes collés à un mot reconnu de la même ligne (de proche en proche)
        encore = []
        for g in restants:
            cy = (g[1] + g[3]) / 2
            voisin = None
            for m in ancres:
                if abs((m['y0'] + m['y1']) / 2 - cy) <= 8 and (-2 <= g[0] - m['x1'] <= 30 or -2 <= m['x0'] - g[2] <= 30):
                    voisin = m
                    break
            if voisin:
                nouveau = dict(voisin, x0=g[0], y0=g[1], x1=g[2], y1=g[3], conf=0.0, texte='·')
                ajout.append(nouveau)
                ancres.append(nouveau)
            else:
                encore.append(g)
        if len(encore) == len(restants):
            break
        restants = encore
    restants.sort(key=lambda g: (g[1] + g[3]) / 2)
    lignes = []
    for g in restants:                    # lignes entières oubliées
        cy = (g[1] + g[3]) / 2
        for L in lignes:
            if abs(L['cy'] - cy) <= 8 and g[0] - L['b'][2] <= 40 and L['b'][0] - g[2] <= 40:
                L['b'] = [min(L['b'][0], g[0]), min(L['b'][1], g[1]), max(L['b'][2], g[2]), max(L['b'][3], g[3])]
                L['n'] += 1
                break
        else:
            lignes.append({'cy': cy, 'b': list(g), 'n': 1})
    fusion = []
    for L in sorted(lignes, key=lambda L: L['b'][0]):
        for F in fusion:
            if abs(F['cy'] - L['cy']) <= 8 and L['b'][0] <= F['b'][2] + 40:
                F['b'] = [min(F['b'][0], L['b'][0]), min(F['b'][1], L['b'][1]), max(F['b'][2], L['b'][2]), max(F['b'][3], L['b'][3])]
                F['n'] += L['n']
                break
        else:
            fusion.append(L)
    paras = {}
    for m in mots:
        paras.setdefault((m['bloc'], m['par']), []).append(m)
    for L in fusion:
        b = L['b']
        if L['n'] < 4 or b[2] - b[0] < 40:
            continue
        meilleur, dist = None, 30
        for cle, ms in paras.items():
            pb = [min(m['x0'] for m in ms), min(m['y0'] for m in ms), max(m['x1'] for m in ms), max(m['y1'] for m in ms)]
            if min(b[2], pb[2]) - max(b[0], pb[0]) < 40:
                continue
            d = pb[1] - b[3] if pb[1] >= b[3] - 4 else (b[1] - pb[3] if b[1] >= pb[3] - 4 else None)
            if d is not None and d < dist:
                meilleur, dist = (cle, ms, pb[1] >= b[3] - 4), d
        if meilleur:
            cle, ms, dessus = meilleur
            ligne = (min(m['ligne'] for m in ms) - 1) if dessus else (max(m['ligne'] for m in ms) + 1)
            ajout.append({'bloc': cle[0], 'par': cle[1], 'ligne': ligne, 'x0': b[0], 'y0': b[1], 'x1': b[2], 'y1': b[3], 'conf': 0.0, 'texte': '·'})
        # sinon : encre isolée (titre NOTES non reconnu, décor) laissée telle quelle
    return mots + ajout


def a_icone(a, p):
    """Vrai si une icône « ? » (anneau sombre de 30 à 70 px) se trouve juste à gauche de la 1re ligne du paragraphe."""
    l = p['lignes'][0]
    y0, y1 = max(l[1] - 30, 0), min(l[3] + 30, a.shape[0])
    x0, x1 = max(p['bbox'][0] - 90, 0), p['bbox'][0] + 50
    lab, n = ndimage.label(a[y0:y1, x0:x1] < 110)
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        cy = y0 + (sl[0].start + sl[0].stop) / 2
        if 30 <= h <= 70 and 30 <= w <= 70 and l[1] - 14 <= cy <= l[3] + 14:
            return True
    return False


# ======================================================================= écriture directe (titres, lettrine)
_polices = {}
def police(f):
    if f not in _polices:
        _polices[f] = pymupdf.Font(fontfile=f)
    return _polices[f]

def largeur(html, f, fs):
    W = 0
    for s in re.split(r'(<sup>.*?</sup>)', fr(html)):
        if s.startswith('<sup>'):
            W += police(f).text_length(s[5:-6], fontsize=fs * 0.62)
        elif s:
            W += police(f).text_length(s, fontsize=fs)
    return W

def ecrire(page, html, f, nom, fs, x, base, aligne='left', couleur=(0, 0, 0)):
    """Écrit une ligne (avec <sup>) : x et base en points ; aligne à droite si demandé."""
    cx = x - largeur(html, f, fs) if aligne == 'right' else x
    for s in re.split(r'(<sup>.*?</sup>)', fr(html)):
        if not s:
            continue
        sup = s.startswith('<sup>')
        t = s[5:-6] if sup else s
        taille = fs * 0.62 if sup else fs
        page.insert_text((cx, base - (fs * 0.36 if sup else 0)), t, fontsize=taille, fontfile=f, fontname=nom, color=couleur)
        cx += police(f).text_length(t, fontsize=taille)


# ======================================================================= aperçu pour la traduction
def preparer(pages, mots):
    """Mots OCR nettoyés (icônes, bords de page) et complétés (encre oubliée), pages 2 et suivantes."""
    for i in range(1, len(pages)):
        a_ = np.array(pages[i])
        bd_ = bandeau(a_)
        ics_ = icones_page(a_)
        tv_ = [[t_[0] - 3, t_[1], t_[2] + 3, t_[3]] for t_ in traits_verticaux(a_)]
        mots[i] = completer(a_, sans_icones(mots[i], ics_, tv_), (bd_['rangs'][1] + 8) if bd_ else 0, ics_ + cases_page(a_) + tv_)
    return mots


def empreinte(t):
    """Signature d'un paragraphe anglais (pour détecter un décalage des indices)."""
    return re.sub(r'[^a-z]', '', t.lower().replace('|', 'i'))[:24]


def cles_pages(J):
    cles = set(J['p'])
    for v in J['p'].values():
        if isinstance(v, dict):
            for g in v.get('decoupe', []):
                if g.get('jusqua'):
                    cles.add(g['jusqua'])
    for k, v in J.get('fusion', {}).items():
        cles.add(k)
        cles.update(v)
    return cles


def empreintes(n):
    """Enregistre dans textes/sfc-NN.json la signature anglaise de chaque paragraphe traduit."""
    chemin = f'textes/sfc-{n:02d}.json'
    J = json.load(open(chemin, encoding='utf-8'))
    pages, mots = charger(n)
    mots = preparer(pages, mots)
    E = {}
    paras = {}
    for cle in sorted(cles_pages(J), key=lambda c: tuple(map(int, c.split('.')))):
        i, k = map(int, cle.split('.'))
        if i not in paras:
            paras[i] = R.para_utiles(pages[i - 1], mots[i - 1])
        if k < len(paras[i]):
            E[cle] = empreinte(paras[i][k]['texte'])
    J['_en'] = E
    json.dump(J, open(chemin, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return len(E)


def apercu(n):
    pages, mots = charger(n)
    mots = preparer(pages, mots)
    a1 = np.array(pages[0])
    print(f'=== SFC {n}')
    L, _ = lettrine(a1)
    print('[lettrine]', L)
    bas = [m for m in mots[0] if m['y0'] > 280 and m['conf'] > 20]
    lignes = {}
    for m in bas:
        lignes.setdefault((m['bloc'], m['par'], m['ligne']), []).append(m)
    for k, v in sorted(lignes.items(), key=lambda kv: (min(m['y0'] for m in kv[1]) // 12, min(m['x0'] for m in kv[1]))):
        v.sort(key=lambda m: m['x0'])
        print(f"   {v[0]['x0']:4d} {v[0]['y0']:4d} | {' '.join(m['texte'] for m in v)}")
    for i in range(2, len(pages) + 1):
        a = np.array(pages[i - 1])
        b = bandeau(a)
        print(f'--- page {i}')
        for k, p in enumerate(R.para_utiles(pages[i - 1], mots[i - 1])):
            if b and p['bbox'][3] <= b['rangs'][1] + 6:
                continue
            st = 'ques' if (style_auto(p) == 'reponse' and a_icone(a, p)) else style_auto(p)[:4]
            print(f"   {i}.{k} [{st}] {p['texte']}")


# ======================================================================= construction
def zone_texte(b, html, style, largeur_min=160, aligne='left'):
    r = [b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3]
    if aligne == 'right':
        t = [b[2] - max(largeur_min, b[2] - b[0] + 40), b[1] - 4, b[2] + 1, b[3] + 6]
    else:
        t = [b[0] - 1, b[1] - 4, b[0] + max(largeur_min, (b[2] - b[0]) * 1.6), b[3] + 6]
    return {'rect': r, 'html': html, 'style': style, 'texte_rect': t, 'css': f'text-align: {aligne};'}


def lignes_de(mots, cle):
    L = {}
    for m in mots:
        if (m['bloc'], m['par']) == cle:
            L.setdefault(m['ligne'], []).append(m)
    return [sorted(v, key=lambda m: m['x0']) for k, v in sorted(L.items())]


def boite(ms):
    return [min(m['x0'] for m in ms), min(m['y0'] for m in ms), max(m['x1'] for m in ms), max(m['y1'] for m in ms)]


def normal(t):
    return re.sub(r'[^a-z0-9]', '', t.lower())


def chercher(mots, texte):
    """Mots OCR consécutifs (même ligne) correspondant à un texte anglais court : de préférence une ligne
    entière, sinon une correspondance exacte (casse et ponctuation), sinon la première trouvée."""
    cible = texte.split()
    tri = sorted(mots, key=lambda m: (m['bloc'], m['par'], m['ligne'], m['x0']))
    lignes = {}
    for m in tri:
        lignes.setdefault((m['bloc'], m['par'], m['ligne']), []).append(m)
    trouve = []
    for k in range(len(tri) - len(cible) + 1):
        seq = tri[k:k + len(cible)]
        if all(normal(m['texte']) == normal(c) for m, c in zip(seq, cible)) and len({(m['bloc'], m['par'], m['ligne']) for m in seq}) == 1:
            ligne = lignes[(seq[0]['bloc'], seq[0]['par'], seq[0]['ligne'])]
            trouve.append((len(ligne) == len(seq), all(m['texte'] == c for m, c in zip(seq, cible)), -k, seq))
    return max(trouve, key=lambda t: t[:3])[3] if trouve else None


def construire(n, sortie=None):
    J = json.load(open(f'textes/sfc-{n:02d}.json', encoding='utf-8'))
    pages, mots = charger(n)
    mots = preparer(pages, mots)
    T = types.SimpleNamespace(TITRE=f"En quête de certitude — {n}. {re.sub('<[^>]+>', '', J['titre'])}", PAGES={}, FLUX=[],
                              MARGE_DROITE={}, MARGE_QUESTION={}, STYLE_AUTO=style_auto, STYLES_FORCES={}, SUSPENDU=True, FUSION={})
    entete = f"{J['titre']} <span style=\"font-family: gill\">• {J['soustitre']}</span>"
    pb, apres = [], {}          # apres : dessins faits après la composition (page -> liste)
    a1 = np.array(pages[0])

    # ---------------- couverture
    dx, dy = banniere(a1)
    def d(r):
        return [r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy]
    # teinte de la bannière (noire ou tramée) entre « SEARCH FOR » et la case blanche
    echant = a1[43 + dy:83 + dy, 473 + dx:499 + dx]
    fond_banniere = int(np.clip(np.mean(echant), 0, 120)) if echant.size else 0
    z1 = [
        {'rect': d([140, 6, 472, 29]), 'html': '<b><i>IT IS WRITTEN TÉLÉVISION PRÉSENTE :</i></b>',
         'style': 'font-family: gill; font-size: 8.6pt; letter-spacing: 0.4pt;', 'texte_rect': d([144, 8, 520, 30])},
        {'rect': d([243, 47, 471, 99]), 'effacer': False, 'html': 'EN QUÊTE DE', 'style': 'font-family: anton; font-size: 24.5pt; line-height: 34pt; color: #fff;',
         'texte_rect': d([246, 31, 505, 103])},
        {'rect': case_certitude(a1, dx, dy), 'html': 'Certitude', 'style': 'font-family: archivo; font-size: 15.5pt; line-height: 18pt;',
         'texte_rect': d([517, 59, 668, 93])},
    ]
    c = cartouche(a1, dx)
    t, s = c['titre'], c['soustitre']
    img = a1.copy()                     # retouches au pixel près sur l'image de la couverture
    # « SEARCH FOR » : recouvert par la trame de la bannière prise juste au-dessus des lettres
    x0b, y0b, x1b, y1b = d([243, 47, 471, 99])
    # bande de trame sans lettres : rangées entre le haut de la bannière et le haut des lettres
    haut_ban = 31 + dy
    lettres = [y for y in range(y0b - 4, y1b) if (a1[y, x0b + 20:x1b - 20] > 160).mean() > 0.04]
    y_let = min(lettres) if lettres else y0b
    src0, src1 = haut_ban + 4, max(haut_ban + 8, y_let - 2)
    trame = a1[src0:src1, x0b:x1b]
    if trame.size:
        for y in range(max(min(y0b, y_let - 2), 0), y1b):
            img[y, x0b:x1b] = trame[(y - y0b) % trame.shape[0]]
    for x in range(t[0] - 3, t[2] + 4):           # titre : tout ce qui est au-dessus de la bande devient blanc
        if not np.isnan(c['haut'][x]):
            img[t[1] - 3:int(c['haut'][x]) - 1, x] = 255
    if s:                                         # sous-titre : l'intérieur de la bande reprend sa trame
        src0, src1 = 160 + dx, s[0] - 10          # colonnes de bande sans lettres, à gauche du sous-titre
        larg_src = src1 - src0
        for x in range(s[0] - 2, s[2] + 3):
            if not np.isnan(c['haut'][x]):
                h_, b_ = int(c['haut'][x]), int(c['bas'][x]) - 1
                if larg_src >= 20:
                    xs = src0 + (x - s[0]) % larg_src
                    colonne = a1[h_:b_, xs].copy()
                    colonne[colonne > 150] = 18           # au cas où la source toucherait un blanc
                    img[h_:b_, x] = colonne
                else:
                    img[h_:b_, x] = 18
    L, filet = lettrine(a1)
    if not L:
        raise SystemExit('lettrine introuvable')
    img[L[1] - 2:L[3] + 2, L[0] - 2:L[2] + 2] = 255
    pages[0] = Image.fromarray(img)
    fs = 20.5
    dispo = (697 + dx - t[0]) * PX
    fs = min(fs, fs * dispo / largeur(J['titre'], GOUDY, fs))
    apres.setdefault(1, []).append(('texte', J['titre'], GOUDY, 'goudy', fs, t[0] * PX, c['base_titre'] * PX, 'left', (0, 0, 0)))
    if fs < 16:
        pb.append(f'titre réduit à {fs:.1f} pt')
    if s:
        fs2 = 12.2
        dispo = (s[2] - 150) * PX
        fs2 = min(fs2, fs2 * dispo / largeur(J['soustitre'], GILL, fs2))
        apres[1].append(('texte', J['soustitre'], GILL, 'gill', fs2, s[2] * PX, c['base_soustitre'] * PX, 'right', (1, 1, 1)))
    # lettrine et première ligne
    intro = list(J['intro'])
    initiale = re.sub(r'<[^>]+>', '', intro[0]).strip()[0]
    intro[0] = intro[0].replace(initiale, '', 1)
    taille = (L[3] - L[1]) * PX / 0.688
    lg = police(ARCHIVO).text_length(initiale, fontsize=taille) / PX          # en px
    if filet:                   # filet : partie épaisse à gauche de la lettre, trait fin ensuite
        yc = (filet[0] + filet[1]) / 2
        apres[1].append(('rect', [L[0] - 1, yc - 2, L[0] + lg * 0.45, yc + 2], (0, 0, 0)))
        apres[1].append(('rect', [L[0] + lg * 0.45, filet[0], L[2] + 3, max(filet[1], filet[0] + 1.5)], (0.3, 0.3, 0.3)))
    apres[1].append(('texte', initiale, ARCHIVO, 'archivo', taille, L[0] * PX, L[3] * PX, 'left', (0, 0, 0)))
    prem = [m for m in mots[0] if m['x0'] > L[2] - 6 and m['x0'] < 420 and L[1] + (L[3] - L[1]) * 0.4 < (m['y0'] + m['y1']) / 2 < L[3] + 8 and m['conf'] > 10]
    y0l = min([m['y0'] for m in prem] + [L[3] - 17])
    y1l = max([m['y1'] for m in prem] + [L[3] + 4])
    photo = photo_couverture(a1, dx)
    gauche, col1, limite, col2 = colonnes_couverture(mots[0], L, y1l, dx, photo)
    effacer_ligne = [L[2] + 1, y0l - 3, col1, y1l + 3]
    ligne1 = [L[0] + lg + 5, y0l - 3, col1, y1l + 3]
    haut = y1l + 2
    zones = [(1, [gauche, haut, col1, limite]), (1, [gauche, limite, col2, 1112])]
    # citation en marge
    cit = [m for m in mots[0] if m['x0'] > 556 + dx and m['y0'] > limite - 40 and m['conf'] > 20]
    if cit and J.get('citation'):
        b = boite(cit)
        x0c = max(b[0] - 12, col2 + 4)
        lab_, n_ = ndimage.label(a1[b[1] - 10:1112, x0c:min(745 + dx, a1.shape[1])] < 150)
        for sl in ndimage.find_objects(lab_):           # lignes de la citation que l'OCR a mal lues
            h_, w_ = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            y_ = b[1] - 10 + sl[0].start
            if 4 <= h_ <= 40 and w_ <= 120 and y_ <= b[3] + 60:
                b = [min(b[0], x0c + sl[1].start), min(b[1], y_), max(b[2], x0c + sl[1].stop), max(b[3], b[1] - 10 + sl[0].stop)]
        z1.append({'rect': [max(b[0] - 6, 562 + dx), b[1] - 8, 735 + dx, b[3] + 8], 'html': refs(J['citation']), 'style': 'citation',
                   'texte_rect': [max(b[0] - 4, 566 + dx), b[1] - 4, 735 + dx, min(max(b[3] + 40, b[1] + 260), 1114)]})
    # bande sous la lettrine, au-dessus de la 1re zone (haut des lettres de la 2e ligne anglaise)
    T.PAGES[1] = {'zones': z1, 'effacer': [[gauche, L[3] + 1, L[2] + 4, haut + 2]]}

    # ---------------- pages 2 à 8
    remplacer = J.get('remplacer', {})
    for i in range(2, len(pages) + 1):
        a = np.array(pages[i - 1])
        P = {'zones': [], 'auto': {}}
        bd = bandeau(a, 'gauche' if i % 2 == 0 else 'droite')
        if bd:
            img = a.copy()
            base = effacer_entete(img, bd)
            pages[i - 1] = Image.fromarray(img)
            tb = bd['texte']
            if bd['icones'] == 'gauche':          # le disque gris du numéro dépasse le chiffre blanc d'environ 10 px
                apres.setdefault(i, []).append(('entete', base, bd['libre'][0] + 16, tb[2], 'right'))
            else:
                apres.setdefault(i, []).append(('entete', base, tb[0], bd['libre'][1] - 16, 'left'))
        para = R.para_utiles(pages[i - 1], mots[i - 1])
        for cle_, emp_ in J.get('_en', {}).items():          # indices décalés depuis la traduction ?
            pg_, k_ = map(int, cle_.split('.'))
            if pg_ == i and (k_ >= len(para) or empreinte(para[k_]['texte']) != emp_):
                pb.append(f'DÉCALAGE {cle_} : « {para[k_]["texte"][:40] if k_ < len(para) else "?"} »')
        dos_vus = {}
        # petits textes isolés
        couverts = set()
        for item in remplacer.get(str(i), []):
            en, html = item[0], item[1]
            st = item[2] if len(item) > 2 else 'tableau'
            seq = chercher(mots[i - 1], en)
            if not seq:
                pb.append(f'p{i} introuvable : {en}')
                continue
            couverts.update(id(m) for m in seq)
            al_ = item[3] if len(item) > 3 else 'left'
            b_ = boite(seq)
            P['zones'].append(zone_texte(b_, refs(html), st, aligne=al_))
            if st in ('tableau', 'suite', 'reponse'):
                larg = police(GILL).text_length(re.sub('<[^>]+>', '', html), fontsize=9.7) / PX
                if al_ == 'left' and b_[0] + larg + 4 > b_[2] + 3:
                    P.setdefault('forcer', []).append([b_[2] + 2, b_[1] - 2, b_[0] + larg + 8, b_[3] + 5, 255])
                if al_ == 'right' and b_[2] - larg - 4 < b_[0] - 3:
                    P.setdefault('forcer', []).append([b_[2] - larg - 8, b_[1] - 2, b_[0] - 2, b_[3] + 5, 255])
        for z in J.get('zones', {}).get(str(i), []):            # zones explicites : libellés de graphiques...
            r_ = z['rect']
            al = z.get('aligne', 'left')
            w_ = r_[2] - r_[0]
            marge = z.get('marge', max(60, w_ * 0.6))
            tr = {'left': [r_[0] - 1, r_[1] - 4, r_[2] + marge, r_[3] + 6],
                  'right': [r_[0] - marge, r_[1] - 4, r_[2] + 1, r_[3] + 6],
                  'center': [r_[0] - marge / 2, r_[1] - 4, r_[2] + marge / 2, r_[3] + 6]}[al]
            P['zones'].append({'rect': list(r_) + [255], 'html': refs(z['html']), 'style': z.get('style', 'tableau'),
                               'css': f'text-align: {al};' + z.get('css', ''), 'texte_rect': z.get('texte_rect', tr)})
        larges = [p['bbox'][2] for p in para if style_auto(p) == 'reponse' and len(p['lignes']) > 1 and p['bbox'][0] < 300]
        T.MARGE_DROITE[i] = int(J.get('marges', {}).get(str(i), max(larges) if larges else 700))
        regles = [f_[2] for f_ in R.filets(a) if f_[2] - f_[0] >= 200]
        T.MARGE_QUESTION[i] = max(T.MARGE_DROITE[i], (max(regles) - 2) if regles else 0)
        for k, p in enumerate(para):
            cle = f'{i}.{k}'
            if bd and (p['bbox'][3] <= bd['rangs'][1] + 6 or (p['bbox'][1] <= bd['rangs'][1] - 4 and p['bbox'][3] <= bd['rangs'][1] + 30)):
                continue
            mots_p = [m for m in mots[i - 1] if (m['bloc'], m['par']) == p['cle']]
            if mots_p and all(id(m) in couverts or re.match(r'^[_\W]+$', m['texte']) for m in mots_p):
                continue
            t = p['texte'].strip()
            if cle in J.get('styles', {}):
                T.STYLES_FORCES[cle] = J['styles'][cle]
            elif style_auto(p) == 'reponse' and a_icone(a, p):
                T.STYLES_FORCES[cle] = 'question'
            elif style_auto(p) == 'reponse' and re.match(r'^[a-z]', t) and not [q for q in para[:k] if not (bd and q['bbox'][3] <= bd['rangs'][1] + 6)]:
                T.STYLES_FORCES[cle] = 'suite'          # suite d'un paragraphe commencé à la page précédente
            val = J['p'].get(cle, '?')
            if val == '=':
                continue
            dos = next(((h, al) for rx, h, al in DOS if rx.match(t)), None)
            if dos and val == '?':
                P['zones'].append(zone_texte(p['bbox'], dos[0], STYLE_DOS + f' text-align: {dos[1]};', aligne=dos[1]))
                dos_vus[dos[0]] = p['bbox']
                continue
            if t.startswith('For more information') and val == '?':
                b = boite(lignes_de(mots[i - 1], p['cle'])[0])
                taille_ = min(max((b[3] - b[1]) * PX / 0.95, 7), 10)
                P['zones'].append({'rect': [b[0] - 3, b[1] - 3, b[2] + 4, b[3] + 3], 'html': 'Pour en savoir plus sur ces études bibliques, contactez :',
                                   'style': f'font-family: goudy; font-size: {taille_:.1f}pt;', 'texte_rect': [b[0], b[1] - 3, b[0] + 420, b[3] + 6]})
                continue
            if isinstance(val, dict) and 'decoupe' in val:      # un paragraphe OCR = plusieurs éléments
                groupes = val['decoupe']
                for gi, g in enumerate(groupes):
                    ls = [p['lignes'][j] for j in g['lignes'] if j < len(p['lignes'])]
                    if not ls:
                        continue
                    for l_ in ls:
                        P['effacer'] = P.get('effacer', []) + [[l_[0] - 3, l_[1] - 1, l_[2] + 3, l_[3] + 2]]
                    st_g = g.get('style', 'reponse')
                    x0g, y0g = min(l_[0] for l_ in ls), min(l_[1] for l_ in ls)
                    if st_g == 'reponse':                  # alinéa : le bord gauche est celui des lignes suivantes
                        bords = [l_[0] for l_ in p['lignes']]
                        if g.get('jusqua'):
                            bords.append(para[int(g['jusqua'].split('.')[1])]['bbox'][0])
                        x0g = min([x0g] + [b_ for b_ in bords if b_ >= x0g - 45])
                    if st_g == 'question' and gi > 0:
                        prec = [p['lignes'][j] for j in groupes[gi - 1]['lignes'] if j < len(p['lignes'])]
                        ic_ = [c_ for c_ in icones_page(a) if c_[2] <= x0g + 5 and c_[1] <= ls[0][3] and c_[3] >= ls[0][1]]
                        haut_ = (ic_[0][1] + 3) if ic_ else y0g - 12      # aligné sur le haut de l'icône
                        if prec:
                            y0g = max(min(y0g, haut_), max(l_[3] for l_ in prec) + 8)
                    if gi + 1 < len(groupes):
                        suiv = [p['lignes'][j] for j in groupes[gi + 1]['lignes'] if j < len(p['lignes'])]
                        basg = min(l_[1] for l_ in suiv) - 3
                    else:
                        basg = max(l_[3] for l_ in ls) + 4
                        if g.get('jusqua'):
                            kq = int(g['jusqua'].split('.')[1])
                            basg = para[kq]['bbox'][3] + 4
                            P['auto'][kq] = None
                        # dernier groupe : il peut descendre jusqu'au paragraphe suivant
                        sous = [q['bbox'][1] for q in para if q['bbox'][1] > basg - 6 and q['bbox'][0] < p['bbox'][2] and q['bbox'][2] > p['bbox'][0]]
                        basg = min(max(basg, min(sous + [basg + 40]) - 6), a.shape[0] - 8)
                    droite_g = {'question': T.MARGE_QUESTION[i], 'etiquette': x0g + 330}.get(st_g, T.MARGE_DROITE[i])
                    css_g = ''
                    if g.get('aligne') == 'center':                 # centré dans la largeur du paragraphe (cadre)
                        x0g, droite_g = p['bbox'][0], p['bbox'][2]
                        css_g = 'text-align: center;'
                    elif g.get('cadre'):                          # texte dans un cadre : largeur du paragraphe
                        x0g, droite_g = p['bbox'][0], p['bbox'][2] + 4
                    m_ = re.match(r'^((\d{1,2}|[A-H])\.\s)', g['texte'])
                    if st_g == 'question' and m_:
                        retrait = police(POL + 'GilliusADF-Bold-c.otf').text_length(m_.group(1), fontsize=11)
                        css_g = f'padding-left: {retrait:.1f}pt; text-indent: -{retrait:.1f}pt;'
                    P['zones'].append({'rect': [x0g - 1, y0g - 1, x0g, y0g], 'effacer': False, 'html': refs(g['texte']), 'style': st_g,
                                       'css': css_g + g.get('css', ''),
                                       'texte_rect': [x0g - 1, y0g - (3 if st_g in ('question', 'etiquette') else 1), droite_g + 2,
                                                      max(basg, y0g + (28 if st_g in ('question', 'etiquette') else 25))]})
                continue
            if isinstance(val, dict):        # intertitre + question, MA DÉCISION (titre et/ou texte)
                lg_ = lignes_de(mots[i - 1], p['cle'])
                tous = [m for l in lg_ for m in l]
                cs_ = cases_page(a)
                def case(m):
                    if any(min(m['x1'], c_[2]) - max(m['x0'], c_[0]) > 0.5 * min(m['x1'] - m['x0'], c_[2] - c_[0]) and
                           min(m['y1'], c_[3]) - max(m['y0'], c_[1]) > 0 for c_ in cs_):
                        return True
                    return bool(re.match(r'^[\[\(]?[JCO0☐❑|7Ll]{1,2}[\]\)]?$', m['texte'])) and m['x0'] < p['bbox'][0] + 25
                decision = bool(re.match(r'(?i)^my\b', t)) or 'decision' in val
                lab = []
                if 'titre' in val:
                    if decision:
                        lab = [m for m in lg_[0] if re.match(r'^[A-Z]{2,}:?$', m['texte']) or
                               re.match(r'(?i)^(my|decision|prayer|response|pledge|commitment):?$', m['texte'])]
                        st_t = 'font-family: goudy; font-weight: bold; font-size: 11.5pt; line-height: 12pt;'
                    else:
                        lab = [m for m in lg_[0] if not case(m)]
                        st_t = 'question'
                    if lab:
                        b = boite(lab)
                        P['zones'].append({'rect': [b[0] - 3, b[1] - 3, b[2] + 14, b[3] + 3], 'html': refs(val['titre']), 'style': st_t,
                                           'texte_rect': [b[0] - 1, b[1] - (5 if decision else 4), b[0] + 520, b[3] + 6]})
                texte = val.get('texte') or val.get('decision')
                reste = [m for m in tous if m not in lab and not case(m)]
                if texte and reste:
                    b = boite(reste)
                    zones_eff = [[b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3]]
                    if val.get('jusqua'):                 # le texte s'étend sur le paragraphe OCR suivant
                        kq = int(val['jusqua'].split('.')[1])
                        bq = para[kq]['bbox']
                        zones_eff.append([bq[0] - 3, bq[1] - 3, bq[2] + 3, bq[3] + 3])
                        b = [min(b[0], bq[0]), b[1], max(b[2], bq[2]), max(b[3], bq[3])]
                        P['auto'][kq] = None
                    suivants = [q['bbox'][1] for q in para if q['bbox'][1] > b[3] - 2 and q['bbox'][0] < b[2] and q['bbox'][2] > b[0]]
                    bas_ = min(suivants + [b[3] + 40, a.shape[0] - 8]) - 4
                    st_x = val.get('style', 'decision' if decision else 'question')
                    css_x = ''
                    m_ = re.match(r'^((\d{1,2}|[A-H])\.\s)', texte)
                    if st_x == 'question' and m_:
                        retrait = police(POL + 'GilliusADF-Bold-c.otf').text_length(m_.group(1), fontsize=11)
                        css_x = f'padding-left: {retrait:.1f}pt; text-indent: -{retrait:.1f}pt;'
                    css_x += val.get('css', '')
                    P['zones'].append({'rect': [b[0] - 3, b[1] - 3, b[2] + 3, b[3] + 3], 'effacer_rects': zones_eff, 'html': refs(texte), 'style': st_x, 'css': css_x,
                                       'texte_rect': [b[0] - 1, b[1] - (2 if decision else 3), max(b[2], (T.MARGE_DROITE if decision else T.MARGE_QUESTION)[i]) + 2, max(bas_, b[3] + 6)]})
                continue
            if isinstance(val, list):                     # une valeur par ligne
                for l_, h in zip(p['lignes'], val):
                    z_ = zone_texte(l_, refs(h), J.get('styles', {}).get(cle, 'tableau'))
                    z_['texte_rect'][2] = max(z_['texte_rect'][2], T.MARGE_DROITE[i] + 4)
                    P['zones'].append(z_)
                continue
            if val == '?':
                if ETIQUETTE.match(t):
                    val = 'La Bible répond :' if re.search('(?i)answer', t) else 'La Bible dit :'
                elif GARDER.match(t) or any(cle in v_ for v_ in J.get('fusion', {}).values()) or t in ('·?',) or \
                        any(g_.get('jusqua') == cle for v_ in J['p'].values() if isinstance(v_, dict) for g_ in v_.get('decoupe', [])) or \
                        any(isinstance(v_, dict) and v_.get('jusqua') == cle for v_ in J['p'].values()):
                    continue
                else:
                    pb.append(f'non traduit {cle} : {t[:60]}')
                    continue
            P['auto'][k] = refs(val)
        for cle_, abs_ in J.get('fusion', {}).items():          # « 3.7 » absorbe « 3.8 » : un seul texte français
            pg_, k_ = map(int, cle_.split('.'))
            if pg_ == i:
                T.FUSION[(i, k_)] = [int(x.split('.')[1]) for x in abs_]
                for x in abs_:
                    P['auto'][int(x.split('.')[1])] = None
        if '<b><i>ADRESSE</i></b>' in dos_vus and '<b><i>TÉLÉPHONE</i></b>' not in dos_vus:
            # « Phone » non reconnu : mot sombre à droite, juste au-dessus du premier filet sous l'adresse
            ya = dos_vus['<b><i>ADRESSE</i></b>'][3]
            regles = sorted([f_ for f_ in R.filets(a) if f_[2] - f_[0] > 400 and f_[1] > ya + 12], key=lambda f_: f_[1])
            if regles:
                f_ = regles[0]
                zx0, zy0 = f_[0] + 250, f_[1] - 30
                lab_, n_ = ndimage.label(a[zy0:f_[1] - 1, zx0:f_[2]] < 140)
                cs = [[zx0 + sl[1].start, zy0 + sl[0].start, zx0 + sl[1].stop, zy0 + sl[0].stop] for sl in ndimage.find_objects(lab_)
                      if 3 <= sl[0].stop - sl[0].start <= 25 and sl[1].stop - sl[1].start <= 40]
                if cs:
                    b_ = [min(c_[0] for c_ in cs), min(c_[1] for c_ in cs), max(c_[2] for c_ in cs), max(c_[3] for c_ in cs)]
                    P['zones'].append(zone_texte(b_, '<b><i>TÉLÉPHONE</i></b>', STYLE_DOS + ' text-align: right;', aligne='right'))
        P['garder'] = P.get('garder', []) + filets_pales(a)     # lignes de réponse claires à ne pas effacer
        P['effacer'] = P.get('effacer', []) + J.get('effacer', {}).get(str(i), [])
        T.PAGES[i] = P

    # la première ligne (à droite de la lettrine) est la première zone du flux : une ligne justifiée, avec césure
    z0 = [ligne1[0], ligne1[1], ligne1[2], ligne1[1] + 1.5 * 24.5]
    zones += [(int(pg_), r_) for pg_, r_ in J.get('intro_zones_extra', [])]      # suite de l'introduction (page 2...)
    eff_ = {(1, tuple(z0)): effacer_ligne}
    for pg_, r_ in zones:                       # la colonne du bas s'efface jusqu'au bord de la page
        if pg_ == 1 and r_[3] >= 1100:
            eff_[(1, tuple(r_))] = [r_[0], r_[1], r_[2], a1.shape[0] - 1]
    T.FLUX = [{'nom': 'introduction', 'style': 'corps', 'regles': 'p + p {text-indent: 1.4em;}',
               'effacer': eff_, 'zones': [(1, z0)] + zones, 'html': refs(''.join(intro))}]
    for f_ in J.get('flux', []):                                               # autres textes courants
        T.FLUX.append({'nom': f_.get('nom', 'suite'), 'style': f_.get('style', 'corps'), 'regles': f_.get('regles', 'p {text-indent: 1.4em;}'),
                       'zones': [(int(pg_), r_) for pg_, r_ in f_['zones']], 'html': refs(''.join(f_['html']))})
    sortie = sortie or f'sortie/sfc-{n:02d}.pdf'
    pb += R.composer(pages, mots, T, sortie)
    # ---------------- dessins après composition
    doc = pymupdf.open(sortie)
    for num, L_ in apres.items():
        page = doc[num - 1]
        for it in L_:
            if it[0] == 'rect':
                page.draw_rect(R.pt(it[1]), color=None, fill=it[2], overlay=True)
            elif it[0] == 'entete':
                _, base, xd, xf, al = it
                segs = [(J.get('entete_titre', J['titre']), GOUDY, 'goudy'), (' • ' + J.get('entete_soustitre', J['soustitre']), GILL, 'gill')]
                fs_ = 7.6
                total = sum(largeur(h, f, fs_) for h, f, _ in segs)
                dispo = (xf - xd) * PX
                if total > dispo:
                    fs_ *= dispo / total
                    total = dispo
                    if fs_ < 6.4:
                        pb.append(f'p{num} bandeau réduit à {fs_:.1f} pt')
                x = xf * PX - total if al == 'right' else xd * PX
                for h, f, nom in segs:
                    ecrire(page, h, f, nom, fs_, x, base * PX, 'left', (1, 1, 1))
                    x += largeur(h, f, fs_)
            else:
                _, html, f, nom, fs_, x, base, al, coul = it
                ecrire(page, html, f, nom, fs_, x, base, al, coul)
    doc.save(sortie + '.tmp', garbage=4, deflate=True)
    doc.close()
    Path(sortie + '.tmp').replace(sortie)
    return pb


def voir(n, pages_=None):
    """Planche : original (gauche) et version française (droite) pour chaque page."""
    orig, _ = charger(n)
    doc = pymupdf.open(f'sortie/sfc-{n:02d}.pdf')
    pages_ = pages_ or range(1, len(orig) + 1)
    ims = []
    for i in pages_:
        pix = doc[i - 1].get_pixmap(dpi=150, colorspace=pymupdf.csGRAY)
        fr_ = Image.frombytes('L', (pix.width, pix.height), pix.samples)
        o = orig[i - 1]
        W = Image.new('L', (o.width + fr_.width + 10, max(o.height, fr_.height)), 255)
        W.paste(o, (0, 0)); W.paste(fr_, (o.width + 10, 0))
        ims.append(W)
    for k, im in enumerate(ims):
        im.save(f'/tmp/sfc{n:02d}-v{list(pages_)[k]}.png')
    print('ok', [f'/tmp/sfc{n:02d}-v{i}.png' for i in pages_])


def planche(n, largeur_page=400):
    """Les 8 pages françaises sur une seule image (contrôle d'ensemble)."""
    doc = pymupdf.open(f'sortie/sfc-{n:02d}.pdf')
    ims = []
    for pg in doc:
        z = largeur_page / pg.rect.width
        pix = pg.get_pixmap(matrix=pymupdf.Matrix(z, z), colorspace=pymupdf.csGRAY)
        ims.append(Image.frombytes('L', (pix.width, pix.height), pix.samples))
    w, h = ims[0].size
    W = Image.new('L', (w * 4 + 15, h * 2 + 5), 128)
    for k, im in enumerate(ims):
        W.paste(im, ((k % 4) * (w + 5), (k // 4) * (h + 5)))
    W.save(f'/tmp/sfc{n:02d}-planche.png')
    print(f'/tmp/sfc{n:02d}-planche.png')


def verifier(n):
    """Contrôle de cohérence entre les clés de la traduction et les paragraphes OCR (numéros de question)."""
    J = json.load(open(f'textes/sfc-{n:02d}.json', encoding='utf-8'))
    pages, mots = charger(n)
    mots = preparer(pages, mots)
    alertes = []
    for cle, val in J['p'].items():
        i, k = map(int, cle.split('.'))
        para = R.para_utiles(pages[i - 1], mots[i - 1])
        if k >= len(para):
            alertes.append(f'{cle} : indice hors page')
            continue
        en = para[k]['texte'].replace('|', '1').replace('l', '1').replace('I', '1')
        texte = val if isinstance(val, str) else (val.get('texte') or val.get('decision') or '' if isinstance(val, dict) else '')
        m = re.match(r'^(\d{1,2})\.', texte or '')
        if m and not re.search(r'(^|\s|·)' + m.group(1) + r'[.,]', en[:40]) and not (m.group(1) in en[:40]):
            alertes.append(f'{cle} : question {m.group(1)} ≠ « {para[k]["texte"][:40]} »')
        if ETIQUETTE.match(para[k]['texte']) and isinstance(val, str) and not val.startswith('La Bible'):
            alertes.append(f'{cle} : étiquette « {para[k]["texte"][:30]} » traduite par « {val[:30]} »')
    return alertes


if __name__ == '__main__':
    if sys.argv[1] == 'apercu':
        apercu(int(sys.argv[2]))
    elif sys.argv[1] == 'empreintes':
        for n_ in sys.argv[2:]:
            print(n_, empreintes(int(n_)))
    elif sys.argv[1] == 'verifier':
        for n_ in sys.argv[2:]:
            print(n_, verifier(int(n_)))
    elif sys.argv[1] == 'planche':
        planche(int(sys.argv[2]))
    elif sys.argv[1] == 'voir':
        voir(int(sys.argv[2]), [int(x) for x in sys.argv[3:]] or None)
    else:
        for x in construire(int(sys.argv[1])):
            print(' ', x)
