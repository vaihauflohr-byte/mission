"""Refait un livret scanné en français : texte anglais effacé sur le scan, français écrit à sa place.

Le livret est décrit par un fichier textes/<nom>.py qui fournit :
  ORIGINAL : chemin du PDF scanné (relatif à originaux/sortie/pdf)
  TITRE    : titre du PDF
  PAGES    : {numéro de page (1..n): {'zones': [...], 'auto': {indice_paragraphe: html}, 'garder': [rects]}}
  FLUX     : [{'style': ..., 'html': ..., 'zones': [(page, rect), ...]}]
Coordonnées en pixels de l'image de page (150 ppp).
"""
import io, json, os, re, sys
from pathlib import Path
import numpy as np
import pymupdf
from PIL import Image, ImageDraw
from ocr import pages_livret, ocr, paragraphes
from typo import fr, cesure

PX = 72 / 150
import chemins  # noqa: E402
DOSSIERS_POLICES = [str(chemins.POLICES)] + [str(d) for d in chemins.SYSTEME if d.exists()]
FACES = """
@font-face {font-family: goudy; src: url(SortsMillGoudy-Regular-c.ttf);}
@font-face {font-family: goudy; src: url(SortsMillGoudy-Italic-c.ttf); font-style: italic;}
@font-face {font-family: goudy; src: url(EBGaramond-700-c.ttf); font-weight: bold;}
@font-face {font-family: gill; src: url(GilliusADF-Regular-c.otf);}
@font-face {font-family: gill; src: url(GilliusADF-Bold-c.otf); font-weight: bold;}
@font-face {font-family: gill; src: url(GilliusADF-Italic-c.otf); font-style: italic;}
@font-face {font-family: gill; src: url(GilliusADF-BoldItalic-c.otf); font-weight: bold; font-style: italic;}
@font-face {font-family: gillc; src: url(GilliusADF-Cond-c.otf);}
@font-face {font-family: gillc; src: url(GilliusADF-BoldCond-c.otf); font-weight: bold;}
@font-face {font-family: anton; src: url(Anton-Regular.ttf);}
@font-face {font-family: archivo; src: url(ArchivoBlack-Regular.ttf);}
"""
STYLES = {
    'corps':     "font-family: goudy; font-size: 9.4pt; line-height: 11.75pt; text-align: justify;",
    'question':  "font-family: gill; font-weight: bold; font-size: 11pt; line-height: 12.5pt;",
    'reponse':   "font-family: gill; font-size: 9.7pt; line-height: 11.3pt; text-indent: 1.1em;",
    'etiquette': "font-family: goudy; font-weight: bold; font-size: 11pt; line-height: 12.5pt;",
    'puces':     "font-family: gill; font-style: italic; font-size: 9.6pt; line-height: 11.9pt;",
    'citation':  "font-family: gill; font-style: italic; font-size: 13.4pt; line-height: 17pt; color: #333;",
    'entete':    "font-family: goudy; font-size: 7.6pt; line-height: 9pt; color: #fff;",
}

def archive():
    a = pymupdf.Archive()
    for d in DOSSIERS_POLICES:
        a.add(d)
    return a

FILTRE_ICONES = True     # mots « icône » reconnus par leur forme (sinon : filtrés ailleurs)
ICONE = re.compile(r'^[\(\)0O|?®©]{1,4}\)?$')
TRAIT = re.compile(r'^_+$')

def para_utiles(im, mots=None):
    """Paragraphes OCR avec boîte recalculée sans les icônes ni les traits."""
    mots = ocr(im) if mots is None else mots
    P = paragraphes(mots)
    for p in P:
        bons = [m for m in mots if (m['bloc'], m['par']) == p['cle'] and not TRAIT.match(m['texte'])
                and not (FILTRE_ICONES and ICONE.match(m['texte']) and '.' not in m['texte'])]
        if bons:
            p['bbox'] = [min(m['x0'] for m in bons), min(m['y0'] for m in bons), max(m['x1'] for m in bons), max(m['y1'] for m in bons)]
            L = {}
            for m in bons:
                L.setdefault(m['ligne'], []).append(m)
            p['lignes'] = [[min(m['x0'] for m in v), min(m['y0'] for m in v), max(m['x1'] for m in v), max(m['y1'] for m in v)]
                           for k, v in sorted(L.items())]
            p['premier'] = min(bons, key=lambda m: (m['ligne'], m['x0']))['texte']
    return P

def couleur_fond(a, r):
    x0, y0, x1, y1 = [int(v) for v in r]
    h, w = a.shape
    x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, w), min(y1, h)
    anneau = np.concatenate([a[max(y0 - 3, 0):y0, x0:x1].ravel(), a[y1:min(y1 + 3, h), x0:x1].ravel(),
                             a[y0:y1, max(x0 - 3, 0):x0].ravel(), a[y0:y1, x1:min(x1 + 3, w)].ravel()])
    return int(np.median(anneau)) if anneau.size else 255

def dominante(a, r):
    x0, y0, x1, y1 = [int(v) for v in r]
    zone = a[max(y0, 0):y1, max(x0, 0):x1]
    if zone.size == 0:
        return 255
    h = np.bincount((zone // 32).ravel(), minlength=8)
    return int(h.argmax() * 32 + 16)

def bande(a, r):
    """Resserre un rectangle sur les lignes sombres d'un bandeau (texte blanc sur fond noir)."""
    x0, y0, x1, y1 = [int(v) for v in r]
    lignes = [y for y in range(y0, y1) if a[y, x0:x1].mean() < 110]
    return [x0, min(lignes) + 1, x1, max(lignes)] if lignes else r

def effacer(im, rects, garder=(), forcer=()):
    a = np.array(im)
    d = ImageDraw.Draw(im)
    for r in rects:
        if len(r) > 4:
            v = r[4]
        else:
            v = dominante(a, r)
            v = 255 if v > 150 else (0 if v < 100 else v)
        d.rectangle([int(r[0]), int(r[1]), int(r[2]), int(r[3])], fill=int(v))
    # remettre les zones protégées
    src = Image.fromarray(a)
    for g in garder:
        g = [int(v) for v in g]
        im.paste(src.crop(g), (g[0], g[1]))
    for f in forcer:                      # effacements prioritaires sur les zones protégées
        d.rectangle([int(f[0]), int(f[1]), int(f[2]), int(f[3])], fill=int(f[4]) if len(f) > 4 else 255)
    return im

def pt(r):
    return pymupdf.Rect(r[0] * PX, r[1] * PX, r[2] * PX, r[3] * PX)

def css_de(style, extra='', regles=''):
    return FACES + f"* {{margin: 0; padding: 0;}} html, body {{margin: 0; padding: 0;}} body {{{STYLES.get(style, style)} {extra}}} p {{margin: 0;}} {regles}"

def couler(doc, arch, html, css, zones, reduction=1.0):
    """Fait couler un texte dans plusieurs zones successives (page, rect en px). Renvoie True s'il déborde."""
    buf = io.BytesIO()
    w = pymupdf.DocumentWriter(buf)
    story = pymupdf.Story(html=html, user_css=css, archive=arch)
    poses, plus = [], True
    for (num, r) in zones:
        R = pt(r)
        loc = pymupdf.Rect(0, 0, R.width, R.height)
        dev = w.begin_page(loc)
        plus, _ = story.place(loc)
        story.draw(dev)
        w.end_page()
        poses.append((num, R))
        if not plus:
            break
    w.close()
    tmp = pymupdf.open('pdf', buf.getvalue())
    for k, (num, R) in enumerate(poses):
        doc[num - 1].show_pdf_page(R, tmp, k)
    return plus

def trouver_icone(a, b):
    """Bord droit de l'icône « ? » (anneau noir) à gauche d'une question, ou None."""
    from scipy import ndimage
    y0, y1 = max(b[1] - 25, 0), min(b[3] + 25, a.shape[0])
    x0, x1 = max(b[0] - 90, 0), b[0] + 30
    zone = a[y0:y1, x0:x1] < 110
    lab, n = ndimage.label(zone)
    if n == 0:
        return None
    meilleur, taille = None, 0
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 30 <= h <= 70 and 30 <= w <= 70:
            t = int((lab[sl] == k).sum())
            if t > taille:
                meilleur, taille = sl, t
    if meilleur is None:            # icône collée au numéro : composante plus large, bord droit ~ x0 + hauteur
        for k, sl in enumerate(ndimage.find_objects(lab), start=1):
            h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
            if 30 <= h <= 70 and 70 < w <= 140:
                return x0 + sl[1].start + int(h * 1.05)
        return None
    return x0 + meilleur[1].stop

def icone_haut(a, b):
    """Haut de l'icône « ? » à gauche d'une question, ou None."""
    from scipy import ndimage
    y0, y1 = max(b[1] - 25, 0), min(b[3] + 25, a.shape[0])
    x0, x1 = max(b[0] - 90, 0), b[0] + 30
    lab, n = ndimage.label(a[y0:y1, x0:x1] < 110)
    for k, sl in enumerate(ndimage.find_objects(lab), start=1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if 30 <= h <= 70 and 30 <= w <= 140:
            return y0 + sl[0].start
    return None


_ARCH = None
def tient_boite(r, html, style, extra, arch):
    """Vrai si le texte tient à sa taille normale dans le cadre r (pixels)."""
    d = pymupdf.open()
    p = d.new_page(width=900, height=900)
    h = fr(html)
    reste, ech = p.insert_htmlbox(pt(r), h, css=css_de(style, extra), archive=arch, scale_low=0.75)
    return reste >= 0 and ech >= 0.999


def filets(a, zones_bande=()):
    """Traits horizontaux fins (filets des réponses) à protéger de l'effacement : longue suite de pixels
    sombres sur une ligne, avec du blanc juste au-dessus et juste au-dessous."""
    res = []
    sombre = a < 165
    h = a.shape[0]
    for y in range(4, h - 5):
        ligne = sombre[y] | sombre[y + 1]          # tolère un filet légèrement penché (marche d'un pixel)
        if ligne.sum() < 120:
            continue
        x, n = 0, len(ligne)
        while x < n:
            if ligne[x]:
                d = x
                while x < n and ligne[x]:
                    x += 1
                # filet = trait fin : juste au-dessus (y-2) et juste au-dessous (y+3), presque pas d'encre
                # (le pied d'une ligne de texte gras, lui, a les fûts des lettres au-dessus)
                if x - d >= 80 and sombre[y - 2, d:x].mean() < 0.25 and sombre[y + 3, d:x].mean() < 0.25:
                    res.append([d, y - 1, x, y + 3])
            else:
                x += 1
    return res

def css_flux(f, echelle):
    st = STYLES.get(f['style'], f['style'])
    st = re.sub(r'font-size: ([\d.]+)pt', lambda m: f'font-size: {float(m.group(1)) * echelle:.2f}pt', st)
    st = re.sub(r'line-height: ([\d.]+)pt', lambda m: f'line-height: {float(m.group(1)) * echelle:.2f}pt', st)
    return css_de(st, f.get('css', ''), f.get('regles', ''))

def couper_premiere_ligne(f, html, echelle):
    """Sort du début du premier paragraphe les mots qui tiennent sur la première ligne (à côté de la lettrine).
    Les balises (<span style="...">, <i>...) comptent comme du texte sans largeur et ne sont jamais coupées."""
    m = re.match(r'<p>(.*?)</p>', html)
    jetons = re.findall(r'<[^>]+>|[^ \t\n<]+|[ \t\n]+', m.group(1))      # l'espace insécable reste dans le mot
    mots, cur = [], ''
    for j in jetons:
        if j.strip(' \t\n') == '' and not j.startswith('<'):
            if cur:
                mots.append(cur)
            cur = ''
        else:
            cur += j
    if cur:
        mots.append(cur)
    taille = float(re.search(r'font-size: ([\d.]+)pt', STYLES[f['style']]).group(1)) * echelle
    police = pymupdf.Font(fontfile=str(chemins.POLICES / 'SortsMillGoudy-Regular.ttf'))
    largeur = pt(f['premiere_ligne'][1]).width - 2
    nu = lambda s: re.sub(r'<[^>]+>', '', s).replace('\u00ad', '')
    n = 1
    while n < len(mots) and police.text_length(nu(' '.join(mots[:n + 1])), fontsize=taille) <= largeur:
        n += 1
    ligne = ' '.join(mots[:n])
    # refermer dans la ligne les balises ouvertes, les rouvrir dans la suite
    ouvertes = []
    for t in re.findall(r'<(/?)(\w+)[^>]*>', ligne):
        if t[0]:
            if ouvertes and ouvertes[-1][0] == t[1]:
                ouvertes.pop()
        else:
            ouvertes.append((t[1], None))
    ouv_txt = re.findall(r'<\w+[^>]*>', ligne)
    fermer = ''.join(f'</{o[0]}>' for o in reversed(ouvertes))
    rouvrir = ''.join(ouv_txt[-len(ouvertes):]) if ouvertes else ''
    reste = '<p class="suite">' + rouvrir + ' '.join(mots[n:]) + '</p>' + html[m.end():]
    return ligne + fermer, reste


def tient(f, echelle, arch):
    html = cesure(fr(f['html']))
    if f.get('premiere_ligne'):
        _, html = couper_premiere_ligne(f, html, echelle)
    buf = io.BytesIO()
    w = pymupdf.DocumentWriter(buf)
    story = pymupdf.Story(html=html, user_css=css_flux(f, echelle), archive=arch)
    plus = True
    for (num, r) in f['zones']:
        R = pt(r)
        loc = pymupdf.Rect(0, 0, R.width, R.height)
        dev = w.begin_page(loc)
        plus, _ = story.place(loc)
        story.draw(dev)
        w.end_page()
        if not plus:
            break
    w.close()
    return not plus

SHY = '\u00ad'
def coupures_sans_tiret(lignes, html):
    """Coupures faites à un trait d'union conditionnel sans que le tiret soit dessiné (défaut de MuPDF quand
    « fragment + tiret » ne tient pas mais que le fragment seul tient) : renvoie les (avant, après)."""
    res = []
    for a, b in zip(lignes, lignes[1:]):
        a, b = a.rstrip(), b.lstrip()
        if not a or not b or a[-1] in '-‐‑' or not a[-1].isalpha() or not b[0].isalpha():
            continue
        avant = re.findall(r"[\w’']+$", a)
        apres = re.findall(r"^[\w’']+", b)
        if not avant or not apres:
            continue
        motif = (SHY + '?').join(map(re.escape, avant[0])) + SHY + (SHY + '?').join(map(re.escape, apres[0]))
        if re.search(motif, html):
            res.append((avant[0], apres[0]))
    return res


def sans_coupure(html, avant, apres):
    """Retire le trait d'union conditionnel placé entre « avant » et « après » (toutes les occurrences)."""
    motif = '(' + (SHY + '?').join(map(re.escape, avant)) + ')' + SHY + '(' + (SHY + '?').join(map(re.escape, apres)) + ')'
    return re.sub(motif, r'\1\2', html)


def lignes_boite(rect, html, css, arch):
    d = pymupdf.open()
    p = d.new_page(width=rect.x1 + 20, height=rect.y1 + 400)
    reste, ech = p.insert_htmlbox(rect, html, css=css, archive=arch, scale_low=0.75)
    lignes = [''.join(s['text'] for s in l['spans']) for b in p.get_text('dict')['blocks'] for l in b.get('lines', [])]
    return lignes


def tirets_hors_boite(rect, html, css, arch):
    """Coupures dont le tiret dépasse le bord droit de la boîte (MuPDF le dessine quand même, rogné) :
    renvoie les (avant, après) à ne plus couper."""
    d = pymupdf.open()
    p = d.new_page(width=rect.x1 + 20, height=rect.y1 + 400)
    p.insert_htmlbox(rect, html, css=css, archive=arch, scale_low=0.75)
    lignes = []
    for b in p.get_text('rawdict')['blocks']:
        for l in b.get('lines', []):
            cs = [c for s in l['spans'] for c in s['chars']]
            if cs:
                lignes.append((''.join(c['c'] for c in cs), cs[-1]['bbox'][2]))
    res = []
    for (a, x1), (b, _) in zip(lignes, lignes[1:]):
        a, b = a.rstrip(), b.lstrip()
        if not a.endswith('-') or x1 <= rect.x1 + 0.2 or not b or not b[0].isalpha():
            continue
        avant = re.findall(r"[\w’']+(?=-$)", a)
        apres = re.findall(r"^[\w’']+", b)
        if not avant or not apres:
            continue
        motif = (SHY + '?').join(map(re.escape, avant[0])) + SHY + (SHY + '?').join(map(re.escape, apres[0]))
        if re.search(motif, html):
            res.append((avant[0], apres[0]))
    return res


def boite_sans_defaut(rect, html, css, arch):
    """Corrige le html (traits d'union conditionnels fautifs) jusqu'à ce que toutes les coupures aient leur tiret,
    et que ce tiret tienne dans la boîte."""
    for _ in range(12):
        fautes = coupures_sans_tiret(lignes_boite(rect, html, css, arch), html) or (
            [] if os.environ.get('SANS_TIRET_HORS') else tirets_hors_boite(rect, html, css, arch))
        if not fautes:
            break
        for av, ap in fautes:
            html = sans_coupure(html, av, ap)
    return html


def flux_sans_defaut(html, css, zones, arch):
    for _ in range(12):
        buf = io.BytesIO()
        w = pymupdf.DocumentWriter(buf)
        story = pymupdf.Story(html=html, user_css=css, archive=arch)
        for (num, r) in zones:
            R_ = pt(r)
            loc = pymupdf.Rect(0, 0, R_.width, R_.height)
            dev = w.begin_page(loc)
            plus, _ = story.place(loc)
            story.draw(dev)
            w.end_page()
            if not plus:
                break
        w.close()
        tmp = pymupdf.open('pdf', buf.getvalue())
        lignes = [''.join(s['text'] for s in l['spans']) for pg in tmp for b in pg.get_text('dict')['blocks'] for l in b.get('lines', [])]
        fautes = coupures_sans_tiret(lignes, html)
        if not fautes:
            break
        for av, ap in fautes:
            html = sans_coupure(html, av, ap)
    return html


def refaire_scan(nom, sortie=None, apercu=False):
    import importlib.util
    spec = importlib.util.spec_from_file_location('t', f'textes/{nom}.py')
    T = importlib.util.module_from_spec(spec); spec.loader.exec_module(T)
    pages = pages_livret(str(chemins.ORIGINAUX / T.ORIGINAL))
    return composer(pages, None, T, sortie or f'sortie/{nom}.pdf')

def composer(pages, mots_pages, T, sortie):
    """pages : images des pages dans l'ordre de lecture ; mots_pages : mots OCR par page (ou None)."""
    arch = archive()
    doc = pymupdf.open()
    textes = {}   # page -> liste (rect_px, html, style, extra)
    pb = []
    styles_forces = getattr(T, 'STYLES_FORCES', {})
    for i, im in enumerate(pages, start=1):
        P = T.PAGES.get(i, {})
        para = para_utiles(im, mots_pages[i - 1] if mots_pages else None) if P.get('auto') else []
        a_effacer, a_ecrire = [], []
        for k, html in P.get('auto', {}).items():
            p = para[k]
            b = p['bbox']
            style = styles_forces.get(f'{i}.{k}') or (T.STYLE_AUTO(p) if hasattr(T, 'STYLE_AUTO') else 'reponse')
            x0 = b[0]
            if style == 'question':
                icone = trouver_icone(np.array(im), b)
                if icone is not None:
                    x0 = icone + 3          # tout ce qui suit l'icône sur la ligne est du texte
                    if re.match(r'^(\d{1,2}|[|lI!])[.,]$', p.get('premier', '')):
                        x0 = max(x0, b[0] - 4)
            for k_l, l in enumerate(p['lignes']):
                a_effacer.append([(x0 if k_l == 0 else l[0]) - 3, l[1] - 1, l[2] + 3, l[3] + 2])
            if html is None:          # paragraphe effacé sans remplacement
                continue
            ignores = getattr(T, 'FUSION', {}).get((i, k), [])          # paragraphes absorbés par celui-ci
            for kq in ignores:
                bq = para[kq]['bbox']
                b = [min(b[0], bq[0]), min(b[1], bq[1]), max(b[2], bq[2]), max(b[3], bq[3])]
            suivants = [q['bbox'][1] for kq, q in enumerate(para) if kq not in ignores and q['bbox'][1] > b[3] - 2 and q['bbox'][0] < b[2] and q['bbox'][2] > b[0]]
            bas = min(suivants + [b[3] + 60, im.height - 10]) - 6
            marges = getattr(T, 'MARGE_DROITE', {})
            if style == 'question' and getattr(T, 'MARGE_QUESTION', None):
                marges = T.MARGE_QUESTION
            droite = max(b[2], marges.get(i, b[2])) if style not in ('etiquette', 'court') else b[2] + 30
            extra = ''
            if style == 'question' and getattr(T, 'SUSPENDU', False):      # retrait suspendu après le numéro
                m = re.match(r'^((\d{1,2}|[A-H])\.\s)', html)
                if m:
                    retrait = pymupdf.Font(fontfile=str(chemins.POLICES / 'GilliusADF-Bold-c.otf')).text_length(m.group(1), fontsize=11)
                    extra = f'padding-left: {retrait:.1f}pt; text-indent: -{retrait:.1f}pt;'
            boite_ = [x0 - 1, b[1] - (1 if style == 'reponse' else 3), droite + 2, max(bas, b[3] + 4)]
            if style == 'question' and html and not tient_boite(boite_, html, style, extra, arch):
                haut_icone = icone_haut(np.array(im), b)
                dessus = [q['bbox'][3] for kq, q in enumerate(para) if q['bbox'][3] < b[1] - 2 and q['bbox'][0] < b[2] and q['bbox'][2] > b[0]]
                limite = (max(dessus) + 6) if dessus else boite_[1] - 20
                if haut_icone is not None:
                    boite_[1] = min(boite_[1], max(haut_icone + 2, limite))
            a_ecrire.append((boite_, html, style, extra))
        a_img = np.array(im)
        for z in P.get('zones', []):
            if z.get('bande'):
                r = bande(a_img, z['rect'])
                z = dict(z, rect=r, effacer_rects=[[r[0], r[1] + 1, r[2], r[3] - 1]])
                hauteur = r[3] - r[1]
                z['texte_rect'] = [z['texte_rect'][0], r[1] + hauteur / 2 - 9, z['texte_rect'][2], r[1] + hauteur / 2 + 11]
            if z.get('effacer', True):
                a_effacer.extend(z.get('effacer_rects', [z['rect']]))
            if z.get('html') is not None:
                a_ecrire.append((z.get('texte_rect', z['rect']), z['html'], z.get('style', 'reponse'), z.get('css', '')))
        for f in T.FLUX:
            if f.get('premiere_ligne') and f['premiere_ligne'][0] == i:
                a_effacer.append(f.get('effacer_ligne', f['premiere_ligne'][1]))
            for (num, r) in f['zones']:
                if num == i:
                    a_effacer.append(f.get('effacer', {}).get((num, tuple(r)), r))
        a_effacer.extend(P.get('effacer', []))
        proteges = P.get('garder', []) + filets(np.array(im))
        # un texte ne commence pas sur un filet conservé : son cadre descend sous le filet
        for n_, (r_, h_, st_, ex_) in enumerate(a_ecrire):
            for g in proteges:
                if g[2] - g[0] > 60 and min(r_[2], g[2]) - max(r_[0], g[0]) > 40 and r_[1] - 2 <= g[1] <= r_[1] + 9:
                    r_ = [r_[0], g[3] + 2, r_[2], max(r_[3], g[3] + 20)]
            a_ecrire[n_] = (r_, h_, st_, ex_)
        im = effacer(im.copy(), a_effacer, proteges, P.get('forcer', []))
        w, h = im.size
        page = doc.new_page(width=w * PX, height=h * PX)
        buf = io.BytesIO(); im.save(buf, 'JPEG', quality=84, optimize=True)
        page.insert_image(page.rect, stream=buf.getvalue())
        textes[i] = a_ecrire
        for d in P.get('dessins', []):      # lettrines redessinées, etc.
            page.insert_htmlbox(pt(d['rect']), d['html'], css=css_de(d['style']), archive=arch, scale_low=0.5)
    for i, L in textes.items():
        page = doc[i - 1]
        for r, html, style, extra in L:
            h = cesure(fr(html)) if style in ('reponse', 'corps', 'suite') else fr(html)
            if SHY in h:
                h = boite_sans_defaut(pt(r), h, css_de(style, extra), arch)
            reste, echelle = page.insert_htmlbox(pt(r), h, css=css_de(style, extra), archive=arch, scale_low=0.75)
            if reste < 0:
                pb.append(f'p{i} déborde : {html[:40]}')
            elif echelle < 0.9:
                pb.append(f'p{i} réduit à {echelle:.0%} : {html[:40]}')
    echelle = 1.0
    for f in T.FLUX:          # plus grande taille commune qui fait tenir tous les flux
        while echelle > 0.8 and not tient(f, echelle, arch):
            echelle -= 0.01
    for f in T.FLUX:
        html, ligne = cesure(fr(f['html'])), None
        if f.get('premiere_ligne'):
            ligne, html = couper_premiere_ligne(f, html, echelle)
            r = f['premiere_ligne']
            doc[r[0] - 1].insert_htmlbox(pt(r[1]), ligne, css=css_flux(f, echelle).replace('text-align: justify;', ''), archive=arch)
        html = flux_sans_defaut(html, css_flux(f, echelle), f['zones'], arch)
        if couler(doc, arch, html, css_flux(f, echelle), f['zones']):
            pb.append(f"flux {f.get('nom', '')} : texte trop long pour les zones")
    if echelle < 0.999:
        pb.append(f'texte courant réduit à {echelle:.0%}')
    doc.set_metadata({'title': T.TITRE, 'author': getattr(T, 'AUTEUR', 'It Is Written — traduction française'), 'creator': 'mission.ka-ilei.com'})
    doc.save(sortie, garbage=4, deflate=True)
    return pb

if __name__ == '__main__':
    for p in refaire_scan(sys.argv[1]):
        print(' ', p)
