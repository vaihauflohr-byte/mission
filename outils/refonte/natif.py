"""Études complémentaires de « En quête de certitude » (livrets A à G, PDF d'origine en texte) :
le français est posé sur la mise en page anglaise, page par page.

  python3 natif.py apercu a      unités de texte du livret A (clé « page.k »)
  python3 natif.py a [b …]       construit sortie/sfc-a.pdf
  python3 natif.py voir a [p…]   original et français côte à côte (/tmp/sfca-vP.png)
  python3 natif.py planche a     planche des 8 pages (/tmp/sfca-planche.png)

textes/sfc-a.json :
  titre, soustitre       titre de l'étude (catalogue et propriétés du PDF)
  u                      {"page.k": valeur} ; valeur = texte HTML, "=" (garder l'anglais), null (effacer),
                         ou {"html": …, "aligne": "droite"|"centre"|"gauche", "taille": pt, "interligne": pt,
                             "droite": x, "bas": y, "gauche": x, "reduction": 0.8, "ligne": true, "css": "…"}
                         « ligne » : tenir sur une ligne (taille réduite si besoin).
                         Des soulignés en fin de texte (« ___ ») sont allongés jusqu'au bout de la ligne anglaise.
  zones                  {"page": [{"rect": [x0, y0, x1, y1], "html": …, "css": "…"}]}  texte en plus
Une unité absente est signalée et gardée telle quelle.
"""
import glob
import json
import os
import re
import statistics
import sys
from pathlib import Path

import numpy as np
import pymupdf
from scipy import ndimage

from livret import pages_du_livret
from refaire_scan import boite_sans_defaut
from typo import NBSP, cesure, fr, refs

ICI = Path(__file__).resolve().parent
import chemins  # noqa: E402
ORIGINAUX = str(chemins.ORIGINAUX / 'quete-certitude')
POL = str(chemins.POLICES) + '/'
LIBE = str(chemins.LIBERATION) + '/'

SYMBOLE = re.compile(r'(?i)wingdings|symbol|dingbat')
MARQUEUR = re.compile(r'^\s*(\d{1,2}\.?|[a-h][.)]?|•|-|–)\s*$')
NUMERO_EN_TETE = re.compile(r'^\d{1,2}\.')

CROS = str(chemins.CALADEA) + '/'
FICHIERS = {
    ('caladea', ''): CROS + 'Caladea-Regular.ttf', ('caladea', 'b'): CROS + 'Caladea-Bold.ttf',
    ('caladea', 'i'): CROS + 'Caladea-Italic.ttf', ('caladea', 'bi'): CROS + 'Caladea-BoldItalic.ttf',
    ('source', ''): POL + 'SourceSans3-Regular-c.ttf', ('source', 'b'): POL + 'SourceSans3-Bold-c.ttf',
    ('source', 'i'): POL + 'SourceSans3-Italic-c.ttf', ('source', 'bi'): POL + 'SourceSans3-BoldItalic-c.ttf',
    ('sourcenoir', ''): POL + 'SourceSans3-Black-c.ttf', ('script', ''): POL + 'MrDafoe-Regular-c.ttf',
    ('corps', ''): POL + 'DejaVuSans-c.ttf', ('corps', 'b'): POL + 'DejaVuSans-Bold-c.ttf',
    ('corps', 'i'): POL + 'DejaVuSans-Oblique-c.ttf', ('corps', 'bi'): POL + 'DejaVuSans-BoldOblique-c.ttf',
    ('serif', ''): LIBE + 'LiberationSerif-Regular.ttf', ('serif', 'b'): LIBE + 'LiberationSerif-Bold.ttf',
    ('serif', 'i'): LIBE + 'LiberationSerif-Italic.ttf', ('serif', 'bi'): LIBE + 'LiberationSerif-BoldItalic.ttf',
    ('gill', ''): POL + 'GilliusADF-Regular-c.otf', ('gill', 'b'): POL + 'GilliusADF-Bold-c.otf',
    ('gill', 'i'): POL + 'GilliusADF-Italic-c.otf', ('gill', 'bi'): POL + 'GilliusADF-BoldItalic-c.otf',
    ('anton', ''): POL + 'Anton-Regular.ttf', ('archivo', ''): POL + 'ArchivoBlack-Regular.ttf',
}
CSS_POLICES = ''.join(
    f"@font-face {{font-family: {fam}; src: url({Path(f).name});"
    + (' font-weight: bold;' if 'b' in st else '') + (' font-style: italic;' if 'i' in st else '') + '}\n'
    for (fam, st), f in FICHIERS.items())
_FONTES = {}
REGLAGES = {}          # réglages du document (JSON « reglages ») : cadre_colonnes…


def fonte(fam, st=''):
    cle = (fam, ''.join(sorted(st)))
    if cle not in _FONTES:
        _FONTES[cle] = pymupdf.Font(fontfile=FICHIERS.get(cle, FICHIERS[(fam, '')]))
    return _FONTES[cle]


def archive():
    a = pymupdf.Archive()
    for d in (POL, LIBE, CROS):
        a.add(d)
    return a


# police d'origine (expression régulière sur son nom) -> famille de remplacement
POLICES = [(r'(?i)times', 'serif'), (r'(?i)cambria', 'caladea'), (r'(?i)myriad.*black', 'sourcenoir'), (r'(?i)twcen', 'source'),
           (r'(?i)myriad', 'source'), (r'(?i)verdana', 'corps')]
POLICES_DOC = []           # réglages du document en cours (champ « polices » du JSON), prioritaires


def famille_police(nom):
    for motif, fam in POLICES_DOC + POLICES:
        if re.search(motif, nom):
            return fam
    return 'corps'


def original(lettre):
    return glob.glob(f'{ORIGINAUX}/SFC_{lettre}_*.pdf')[0]


ORIG_RACINE = str(chemins.ORIGINAUX)


def document(nom):
    """(JSON, PDF d'origine, livret imposé ?, PDF de sortie) d'un document.
    « a » … « g » : études complémentaires de « En quête de certitude » ; sinon textes/<nom>.json,
    dont le champ « source » donne le PDF d'origine (relatif à ORIG_RACINE)."""
    if len(nom) == 1:
        return ICI / 'textes' / f'sfc-{nom}.json', original(nom), True, ICI / 'sortie' / f'sfc-{nom}.pdf'
    j = ICI / 'textes' / f'{nom}.json'
    T = json.load(open(j, encoding='utf-8'))
    return j, f"{ORIG_RACINE}/{T['source']}", T.get('livret', False), ICI / 'sortie' / f'{nom}.pdf'


def reparer_metriques(doc):
    """Polices aux métriques aberrantes (Cambria déclarée avec Ascent 3117 / Descent -2463, celles de
    Cambria Math) : les cadres des caractères débordent de 30 pt et l'effacement du texte anglais
    emporte les lignes voisines. On remet des valeurs normales dans le descripteur de police."""
    for xref in range(1, doc.xref_length()):
        try:
            if doc.xref_get_key(xref, 'Type')[1] != '/FontDescriptor':
                continue
            a, d = doc.xref_get_key(xref, 'Ascent'), doc.xref_get_key(xref, 'Descent')
        except Exception:
            continue
        if a[0] == 'int' and (int(a[1]) > 1500 or int(d[1]) < -800):
            doc.xref_set_key(xref, 'Ascent', '950')
            doc.xref_set_key(xref, 'Descent', '-222')


def pages_source(chemin, livret):
    if livret:
        return pages_du_livret(chemin)[0]
    out = pymupdf.open()
    out.insert_pdf(pymupdf.open(chemin))
    reparer_metriques(out)
    return out


# ------------------------------------------------------------------ lecture des lignes et des unités

def style(font):
    f = font.lower()
    return ('b' if 'bold' in f or 'black' in f else '') + ('i' if 'italic' in f or 'oblique' in f else '')


def lignes(page):
    """Lignes de texte de la page (cadre réel de l'encre : les espaces de tête ou de fin ne comptent pas)."""
    out = []
    zone = page.rect + (-2, -2, 2, 2)
    for b in page.get_text('rawdict')['blocks']:
        if b['type'] != 0:
            continue
        for l in b['lines']:
            spans = []
            for s in l['spans']:
                texte = ''.join(c['c'] for c in s['chars'])
                encre = [c for c in s['chars'] if c['c'].strip()]
                if not encre:
                    continue
                bb = pymupdf.Rect(encre[0]['bbox'])
                for c in encre[1:]:
                    bb |= pymupdf.Rect(c['bbox'])
                spans.append({'s': s, 'texte': texte, 'bbox': bb, 'origine': encre[0]['origin']})
            if not spans:
                continue
            taille_max = max(sp['s']['size'] for sp in spans)
            for sp in spans:
                if sp['bbox'].height > 1.6 * sp['s']['size'] and abs(l['dir'][0] - 1) < 0.01:
                    b = sp['origine'][1]
                    sp['bbox'] = pymupdf.Rect(sp['bbox'].x0, b - 0.8 * sp['s']['size'], sp['bbox'].x1, b + 0.22 * sp['s']['size'])
            r = pymupdf.Rect(spans[0]['bbox'])
            for sp in spans[1:]:
                r |= sp['bbox']
            if not zone.contains(pymupdf.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)):
                continue
            textes = [sp for sp in spans if not SYMBOLE.search(sp['s']['font'])]
            ref = textes[0] if textes else spans[0]
            out.append({
                'bbox': [round(v, 2) for v in r],
                'base': round(ref['origine'][1], 2),
                'origine': [round(v, 2) for v in ref['origine']],
                'dir': l['dir'],
                'texte': ''.join('•' if SYMBOLE.search(sp['s']['font']) else sp['texte'] for sp in spans).strip(),
                'taille': round(max(sp['s']['size'] for sp in textes or spans), 1),
                'police': ref['s']['font'], 'couleur': ref['s']['color'],
                'spans': [{'bbox': list(sp['bbox']), 'texte': sp['texte'], 'police': sp['s']['font'],
                           'quad': pymupdf.recover_quad(l['dir'], sp['s']),
                           'style': style(sp['s']['font']), 'symbole': bool(SYMBOLE.search(sp['s']['font']))}
                          for sp in spans],
                'symbole': not textes,
            })
    out.sort(key=lambda l: (round(l['bbox'][1]), l['bbox'][0]))
    return out


def italique(l):
    t = [s for s in l['spans'] if not s['symbole']]
    return bool(t) and all('i' in s['style'] for s in t)


def gras(l):
    t = [s for s in l['spans'] if not s['symbole'] and s['texte'].strip()]
    return bool(t) and all('b' in s['style'] for s in t)


def unites(page):
    res = []
    for l in lignes(page):
        if l['symbole'] or MARQUEUR.match(l['texte']):
            res.append({'marqueur': True, 'lignes': [l]})
            continue
        trouve = None
        for u in reversed(res[-10:]):
            if u['marqueur']:
                continue
            der, prem = u['lignes'][-1], u['lignes'][0]
            if abs(l['taille'] - der['taille']) > 0.6 or l['couleur'] != der['couleur'] or italique(l) != italique(der):
                continue
            ecart = l['bbox'][1] - der['bbox'][3]
            if not -0.4 * l['taille'] <= ecart < 0.6 * l['taille']:
                continue
            dx = l['bbox'][0] - der['bbox'][0]
            meme_colonne = abs(dx) < 3
            suspendu = len(u['lignes']) == 1 and NUMERO_EN_TETE.match(prem['texte']) and 5 < dx < 40
            larg = lambda x: x['bbox'][2] - x['bbox'][0]
            retrait = (len(u['lignes']) == 1 and -25 < dx < -4 and larg(der) > 100 and larg(l) > 100
                       and abs(der['bbox'][2] - l['bbox'][2]) < 40)      # alinéa : première ligne en retrait
            if gras(l) != gras(der):
                continue
            if (meme_colonne or suspendu or retrait) and l['bbox'][0] < der['bbox'][2] and l['bbox'][2] > der['bbox'][0]:
                trouve = u
                break
        if trouve:
            trouve['lignes'].append(l)
        else:
            res.append({'marqueur': False, 'lignes': [l]})
    return res


def texte_unite(u):
    return ' '.join(l['texte'] for l in u['lignes'])


def apercu(nom, livret=None):
    if nom.endswith('.pdf'):
        doc = pages_source(nom, bool(livret))
    else:
        _, src, liv, _ = document(nom)
        doc = pages_source(src, liv)
    for i, page in enumerate(doc):
        print(f'=== page {i + 1}')
        for k, u in enumerate(unites(page)):
            L = u['lignes']
            st = ''.join(sorted({c for l in L for s in l['spans'] if not s['symbole'] for c in s['style']}))
            print(f"  {i + 1}.{k:02d} {'M' if u['marqueur'] else ' '} {L[0]['taille']:4.1f}{st:2s} "
                  f"{[round(v) for v in L[0]['bbox'][:2]]} {len(L)}l  {texte_unite(u)}")


# ------------------------------------------------------------------ obstacles autour d'une unité

def segments(page):
    """Traits, cadres et aplats de la page (un rectangle par trait ; les aplats blancs sont ignorés)."""
    out = []
    for d in page.get_drawings():
        plein = d.get('fill') is not None and d.get('type') in ('f', 'fs')
        blanc = plein and d['fill'] is not None and min(d['fill']) > 0.95
        trace = d.get('type') in ('s', 'fs')
        for it in d['items']:
            if it[0] == 'l':
                out.append(pymupdf.Rect(it[1], it[2]).normalize() + (-0.2, -0.2, 0.2, 0.2))
            elif it[0] == 're':
                r = pymupdf.Rect(it[1]).normalize()
                if plein and not blanc and (r.width > 2 and r.height > 2):
                    out.append(r)
                elif trace or r.width <= 2 or r.height <= 2:
                    if r.width <= 2 or r.height <= 2:
                        out.append(r + (-0.2, -0.2, 0.2, 0.2))
                    else:
                        out += [pymupdf.Rect(r.x0, r.y0, r.x1, r.y0 + 0.3), pymupdf.Rect(r.x0, r.y1 - 0.3, r.x1, r.y1),
                                pymupdf.Rect(r.x0, r.y0, r.x0 + 0.3, r.y1), pymupdf.Rect(r.x1 - 0.3, r.y0, r.x1, r.y1)]
            elif it[0] == 'qu':
                r = it[1].rect
                if plein and not blanc:
                    out.append(r)
                else:
                    out += [pymupdf.Rect(r.x0, r.y0, r.x1, r.y0 + 0.3), pymupdf.Rect(r.x0, r.y1 - 0.3, r.x1, r.y1),
                            pymupdf.Rect(r.x0, r.y0, r.x0 + 0.3, r.y1), pymupdf.Rect(r.x1 - 0.3, r.y0, r.x1, r.y1)]
            elif it[0] == 'c' and not blanc:
                xs = [p.x for p in it[1:]]
                ys = [p.y for p in it[1:]]
                out.append(pymupdf.Rect(min(xs), min(ys), max(xs), max(ys)))
    return [r for r in out if r.intersects(page.rect)]


def images_visibles(page):
    return [pymupdf.Rect(i['bbox']) for i in page.get_image_info() if pymupdf.Rect(i['bbox']).intersects(page.rect)
            and pymupdf.Rect(i['bbox']).width < page.rect.width * 0.9]


# ------------------------------------------------------------------ mise en place du français

_BASE = {}


def decalage_base(fam, st, taille, il, arch):
    """Distance entre le haut d'une boîte HTML et la ligne de base de sa première ligne."""
    cle = (fam, st, taille, il)
    if cle not in _BASE:
        d = pymupdf.open()
        p = d.new_page(width=300, height=200)
        css = CSS_POLICES + f"* {{font-family: {fam}; font-size: {taille}pt; line-height: {il}pt; margin: 0; padding: 0;}}"
        html = 'Hx'
        if 'b' in st:
            html = f'<b>{html}</b>'
        if 'i' in st:
            html = f'<i>{html}</i>'
        p.insert_htmlbox(pymupdf.Rect(10, 50, 290, 150), html, css=css, archive=arch)
        s = [s for b in p.get_text('dict')['blocks'] for l in b.get('lines', []) for s in l['spans']][0]
        _BASE[cle] = s['origin'][1] - 50
    return _BASE[cle]


def interligne(u):
    L = u['lignes']
    if len(L) > 1:
        return round(statistics.median(L[i + 1]['base'] - L[i]['base'] for i in range(len(L) - 1)), 2)
    return round(L[0]['taille'] * 1.21, 2)


def famille(u):
    if any('times' in l['police'].lower() for l in u['lignes']) and not POLICES_DOC:
        return 'serif'
    return famille_police(u['lignes'][0]['police'])


def style_commun(u):
    sts = [s['style'] for l in u['lignes'] for s in l['spans'] if not s['symbole'] and s['texte'].strip()]
    b = bool(sts) and all('b' in s for s in sts)
    i = bool(sts) and all('i' in s for s in sts)
    return ('b' if b else '') + ('i' if i else '')


def sans_balises(html):
    return re.sub(r'<[^>]+>', '', html).replace('&nbsp;', ' ')


def largeur_html(html, fam, st, taille):
    """Largeur approchée d'un texte HTML d'une ligne (gras et italique des balises pris en compte)."""
    total = 0
    pile = set(st)
    for morceau in re.split(r'(<[^>]+>)', html):
        if morceau.startswith('<'):
            m = re.match(r'<(/?)(b|i|strong|em)\b', morceau)
            if m:
                c = 'b' if m.group(2) in ('b', 'strong') else 'i'
                (pile.discard if m.group(1) else pile.add)(c)
            continue
        total += fonte(fam, ''.join(sorted(pile))).text_length(morceau.replace('&nbsp;', ' '), fontsize=taille)
    return total


def allonger_traits(html, u, fam, st, taille, x0):
    """« La Bible répond : ___ » : soulignés allongés jusqu'au bout de la ligne anglaise."""
    m = re.search(r'_{3,}\s*$', html)
    if not m:
        return html
    tete = html[:m.start()]
    fin = max(l['bbox'][2] for l in u['lignes'])
    place = fin - x0 - largeur_html(tete, fam, st, taille)
    n = max(3, int(place / fonte(fam, st).text_length('_', fontsize=taille)))
    return tete + '_' * n


def poser_tourne(page, cle, u, opt, pb):
    """Ligne de texte inclinée (étiquette le long d'une flèche) : écrite dans la même direction."""
    import math
    L = u['lignes']
    dx, dy = L[0]['dir']
    alpha = math.degrees(math.atan2(dy, dx))
    fam = opt.get('famille', famille(u))
    st = style_commun(u)
    taille = opt.get('taille', L[0]['taille'])
    texte = sans_balises(opt['html'])
    o = pymupdf.Point(L[0]['origine'])
    c = L[0]['couleur']
    rgb = ((c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255)
    fichier = FICHIERS.get((fam, st), FICHIERS[(fam, '')])
    page.insert_text(o, texte, fontsize=taille, fontfile=fichier, fontname=f'F{fam}{st}', color=rgb,
                     morph=(o, pymupdf.Matrix(-alpha)))


def chevauche_v(r, haut, bas, part=0.5):
    """r recouvre verticalement [haut, bas] sur au moins « part » de sa propre hauteur (ou de l'intervalle)."""
    commun = min(r.y1, bas) - max(r.y0, haut)
    return commun > part * min(r.height, bas - haut)


TRAIT_REPONSE = re.compile(r'\s*([a-h]\)\s*)?[_.\s]{5,}')


def rect_obstacle(l):
    """Rectangle d'une ligne anglaise vue comme obstacle. Avec le réglage « traits_fins », une ligne-réponse
    (soulignés seuls) ne compte que pour son trait, posé sur la ligne de base, pas pour la hauteur de la police."""
    r = pymupdf.Rect(l['bbox'])
    if REGLAGES.get('traits_fins') and TRAIT_REPONSE.fullmatch(l['texte']) and '_' in l['texte']:
        r.y0 = max(r.y0, l['base'] - 3)
    return r


def decaler_unite(u, dy):
    """Copie de l'unité descendue de dy points (bbox, ligne de base, origine des lignes et des spans)."""
    def bb(b):
        return (b[0], b[1] + dy, b[2], b[3] + dy)
    lignes = []
    for l in u['lignes']:
        l2 = dict(l, bbox=bb(l['bbox']), base=l['base'] + dy, origine=(l['origine'][0], l['origine'][1] + dy))
        l2['spans'] = [dict(sp, bbox=bb(sp['bbox'])) for sp in l['spans']]
        lignes.append(l2)
    return dict(u, lignes=lignes)


def poser(page, cle, u, opt, U, obst_segments, obst_images, arch, pb, poses):
    L = u['lignes']
    if abs(L[0]['dir'][0] - 1) > 0.01:
        return poser_tourne(page, cle, u, opt, pb)
    html = opt['html']
    fam = opt.get('famille', famille(u))
    st = style_commun(u)
    taille = opt.get('taille', L[0]['taille'])
    il = opt.get('interligne', interligne(u) * taille / L[0]['taille'])
    couleur = '#%06x' % L[0]['couleur']
    texte_anglais = texte_unite(u)
    entete = '•' in texte_anglais and L[0]['bbox'][1] < 70 and len(L) == 1
    aligne = opt.get('aligne')
    if aligne is None and entete:
        c = (L[0]['bbox'][0] + L[0]['bbox'][2]) / 2
        aligne = 'droite' if c > page.rect.width / 2 else 'gauche'
    titre = len(L) == 1 and L[0]['taille'] >= 14          # titre et sous-titre de la couverture
    une_ligne = opt.get('ligne', entete or titre or (len(L) == 1 and len(sans_balises(html)) < 60 and aligne is not None))

    x0 = opt.get('gauche', min(l['bbox'][0] for l in L))
    propre_droite = max(l['bbox'][2] for l in L)
    haut, bas_anglais = L[0]['bbox'][1], L[-1]['bbox'][3]
    autres = [rect_obstacle(l) for v in U if v is not u for l in v['lignes']]
    durs = obst_images + obst_segments + poses          # obstacles : images, traits, français déjà posé

    # limite à droite : premier obstacle à droite sur la hauteur de l'unité, sinon bord du texte de la page
    a_droite = [r for r in autres if chevauche_v(r, haut, bas_anglais)] + \
               [r for r in durs if r.y0 < bas_anglais - 1 and r.y1 > haut + 1 and r.height > 2]
    a_droite = [r for r in a_droite if r.x0 >= propre_droite - 1]
    corps_page = [l['bbox'][2] for v in U for l in v['lignes'] if l['bbox'][1] > 40]
    citation = italique(L[0]) and L[0]['taille'] >= 12 and len(L) > 2      # citation en exergue
    bord_page = (max(corps_page + [propre_droite]) + 1) if corps_page and not (entete or citation) else page.rect.width - 30
    droite = min([r.x0 - 5 for r in a_droite] + [bord_page])
    if a_droite and REGLAGES.get('cadre_colonnes'):
        # cadre de la colonne : le bord droit des lignes anglaises de la même colonne, pas l'obstacle lui-même
        colonne = [l['bbox'][2] for v in U for l in v['lignes']
                   if l['bbox'][0] < droite and l['bbox'][2] <= droite + 5 and abs(l['dir'][0] - 1) < 0.01]
        if colonne:
            droite = min(droite, max(colonne) + 1)
    droite = max(droite, propre_droite + 0.5)
    if 'droite' in opt:
        droite = opt['droite']

    # limite en bas : premier obstacle sous l'unité qui la chevauche horizontalement
    dessous = [r for r in autres + durs if r.y0 > L[-1]['base'] - 1 and r.x0 < droite and r.x1 > x0]
    bas = min([r.y0 - 1.5 for r in dessous] + [max(page.rect.height - 14, bas_anglais + 2)])
    if 'bas' in opt:
        bas = opt['bas']

    html = allonger_traits(html, u, fam, st, taille, x0)
    if une_ligne:
        dispo = droite - x0
        a_gauche = [r for r in autres if chevauche_v(r, haut, bas_anglais)] + \
                   [r for r in durs if r.y0 < bas_anglais - 1 and r.y1 > haut + 1 and r.height > 2]
        gauche_lim = max([r.x1 + 5 for r in a_gauche if r.x1 <= L[0]['bbox'][0] + 1] + [14])
        if aligne == 'droite':
            dispo = propre_droite - gauche_lim
        elif aligne == 'centre':
            c = (min(l['bbox'][0] for l in L) + propre_droite) / 2
            dispo = 2 * min(c - gauche_lim, droite - c)
        lg = largeur_html(html, fam, st, taille)
        if lg > dispo - 1:
            nouvelle = max(taille * dispo / (lg + 2), taille * 0.7)
            pb.append(f'une ligne réduite à {nouvelle / taille:.0%} : {cle}')
            il *= nouvelle / taille
            taille = round(nouvelle, 2)
            lg = largeur_html(html, fam, st, taille)
        if aligne == 'droite':
            rect = pymupdf.Rect(propre_droite - lg - 4, 0, propre_droite + 0.5, 0)
        elif aligne == 'centre':
            c = (min(l['bbox'][0] for l in L) + propre_droite) / 2
            rect = pymupdf.Rect(c - lg / 2 - 3, 0, c + lg / 2 + 3, 0)
        else:
            rect = pymupdf.Rect(x0, 0, max(droite, x0 + lg + 3), 0)
    else:
        rect = pymupdf.Rect(x0, 0, droite, 0)

    decal = decalage_base(fam, st, taille, il, arch)
    rect.y0 = L[0]['base'] - decal
    if titre and L[0]['couleur'] < 0x404040 and L[0]['bbox'][1] < 150 and re.search(r'[gjpqyQJç,;]', sans_balises(html)):
        rect.y0 -= 0.18 * taille        # jambages : le titre remonte un peu pour ne pas toucher le bandeau noir
    rect.y1 = max(bas, rect.y0 + il + 1)

    css = CSS_POLICES + (f"* {{font-family: {fam}; font-size: {taille}pt; line-height: {il}pt; margin: 0; padding: 0;"
                         f" color: {couleur};}}")
    css += {'droite': ' body {text-align: right;}', 'centre': ' body {text-align: center;}'}.get(aligne, '')
    if une_ligne:
        css += ' body {white-space: nowrap;}'
    elif len(L) > 1 and L[1]['bbox'][0] - L[0]['bbox'][0] > 4 and NUMERO_EN_TETE.match(L[0]['texte']):
        d = L[1]['bbox'][0] - L[0]['bbox'][0]
        css += f' body {{padding-left: {d:.1f}pt; text-indent: -{d:.1f}pt;}}'
    elif len(L) > 1 and L[0]['bbox'][0] - L[1]['bbox'][0] > 4:
        d = L[0]['bbox'][0] - L[1]['bbox'][0]
        rect.x0 = L[1]['bbox'][0]
        css += f' body {{text-indent: {d:.1f}pt;}}'
    css += ' ' + opt.get('css', '')
    if 'b' in st and '<b>' not in html:
        html = f'<b>{html}</b>'
    if 'i' in st and '<i>' not in html:
        html = f'<i>{html}</i>'
    if not une_ligne and len(sans_balises(html)) >= 40 and opt.get('cesure', True):
        h = cesure(html)
        h = re.sub(r'[A-Za-zÀ-ÿ\u00ad]+(?=' + NBSP + r'\d)', lambda m: m.group(0).replace('\u00ad', ''), h)
        html = boite_sans_defaut(rect, h, css, arch)
    reste, echelle = page.insert_htmlbox(rect, html, css=css, archive=arch, scale_low=opt.get('reduction', 0.8))
    if os.environ.get('DEBUG_CLE') == cle:
        print('DEBUG', cle, rect, 'bas', round(bas, 1), 'il', round(il, 2), 'reste', round(reste, 1), 'echelle', echelle,
              [(round(r.x0), round(r.y0), round(r.x1), round(r.y1)) for r in dessous][:6])
    if reste < 0:
        pb.append(f'DÉBORDE : {cle}')
    else:
        if echelle < 0.999:
            pb.append(f'réduit à {echelle:.0%} : {cle}')
        occupe = pymupdf.Rect(rect.x0, rect.y0, rect.x1, rect.y1 - reste)
        if une_ligne:
            lg = largeur_html(html, fam, st, taille * echelle)
            if aligne == 'droite':
                occupe.x0 = rect.x1 - lg - 1
            elif aligne == 'centre':
                occupe.x0, occupe.x1 = (rect.x0 + rect.x1 - lg) / 2, (rect.x0 + rect.x1 + lg) / 2
            else:
                occupe.x1 = rect.x0 + lg + 1
        poses.append(occupe)
        if bas - occupe.y1 < 4 and bas - bas_anglais > 9 and not une_ligne:
            pb.append(f'serré : {cle} ({bas - occupe.y1:.0f} pt au lieu de {bas - bas_anglais:.0f})')


def preparer_html(v):
    if v is None or v == '=':
        return v
    return refs(fr(v))


def construire(lettre, sortie=None):
    fichier_json, src, livret, sortie_defaut = document(lettre)
    T = json.load(open(fichier_json, encoding='utf-8'))
    POLICES_DOC[:] = list(T.get('polices', {}).items())
    REGLAGES.clear()
    REGLAGES.update(T.get('reglages', {}))
    doc = pages_source(src, livret)
    arch = archive()
    pb = []
    for i, page in enumerate(doc):
        pn = i + 1
        U = unites(page)
        dessins = T.get('effacer_dessins', {}).get(str(pn), [])
        if dessins:
            # dessins vectoriels à retirer (titres manuscrits…) : avant les textes, sans toucher au texte
            for r in dessins:
                page.add_redact_annot(pymupdf.Rect(r), fill=False)
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                                  graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED, text=pymupdf.PDF_REDACT_TEXT_NONE)
        obst_segments = segments(page)
        obst_images = images_visibles(page)
        a_poser = []
        remplacer = {}
        for k, u in enumerate(U):
            cle = f'{pn}.{k:02d}'
            if cle not in T['u']:
                if not u['marqueur']:
                    pb.append(f'non traduite : {cle} {texte_unite(u)[:70]}')
                continue
            v = T['u'][cle]
            if v == '=':
                continue
            opt = dict(v) if isinstance(v, dict) else {'html': v}
            opt['html'] = preparer_html(opt.get('html'))
            if v is None:
                remplacer[id(u)] = []            # effacée : n'est plus un obstacle
            for l in u['lignes']:
                debut = True
                for s in l['spans']:
                    if s['symbole'] and debut and not opt.get('symboles'):
                        continue
                    debut = False
                    if abs(l['dir'][0] - 1) > 0.01:
                        page.add_redact_annot(s['quad'], fill=False)
                        continue
                    r = pymupdf.Rect(s['bbox'])
                    page.add_redact_annot(pymupdf.Rect(r.x0 - 0.3, r.y0 + 1, r.x1 + 0.3, r.y1 - 1), fill=False)
            if 'decoupe' in opt:
                # unité coupée en morceaux (lignes [a, b[) posés chacun dans leur propre boîte
                parts = []
                for j, part in enumerate(opt['decoupe']):
                    a, b = part['lignes']
                    sous = {'marqueur': False, 'lignes': u['lignes'][a:b]}
                    o = dict(part)
                    o['html'] = preparer_html(part.get('html'))
                    if o['html'] is not None:
                        parts.append(sous)
                        a_poser.append((f'{cle}/{j}', sous, o))
                remplacer[id(u)] = parts
            elif opt['html'] is not None:
                if opt.get('decaler'):
                    # unité descendue de « decaler » points (colonne qui s'allonge) : obstacle à sa nouvelle place
                    u = decaler_unite(u, opt['decaler'])
                    remplacer[id(U[k])] = [u]
                a_poser.append((cle, u, opt))
        page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
        U2 = [w for v in U for w in remplacer.get(id(v), [v])]
        poses = []
        for cle, u, opt in a_poser:
            poser(page, cle, u, opt, U2, obst_segments, obst_images, arch, pb, poses)
        for im in T.get('images', {}).get(str(pn), []):
            retoucher_image(page, im, pb)
        for t in T.get('textes', {}).get(str(pn), []):
            fam, st = t.get('police', ['corps', ''])
            ecrire(page, t['x'], t['base'], t['texte'], FICHIERS[(fam, st)], t['taille'], tuple(t.get('couleur', (0, 0, 0))),
                   espacement=t.get('espacement', 0.0), aligne=t.get('aligne', 'gauche'))
        for z in T.get('zones', {}).get(str(pn), []):
            css = CSS_POLICES + "* {font-family: corps; margin: 0; padding: 0;} " + z.get('css', '')
            reste, ech = page.insert_htmlbox(pymupdf.Rect(z['rect']), preparer_html(z['html']), css=css, archive=arch,
                                             scale_low=z.get('reduction', 0.8))
            if reste < 0:
                pb.append(f'DÉBORDE : zone page {pn}')
            elif ech < 0.999:
                pb.append(f'zone réduite à {ech:.0%} : page {pn}')
    if T.get('couverture', 'sfc' if len(lettre) == 1 else None) == 'sfc':
        couverture(doc, T, arch, pb)      # après le texte : ses mots ne doivent pas décaler les clés
    titre = T['titre']
    doc.set_metadata({'title': titre, 'author': T.get('auteur', 'It Is Written — traduction française'),
                      'subject': 'En quête de certitude — Mission, études bibliques pour les petits groupes',
                      'creator': 'mission.ka-ilei.com', 'producer': 'PyMuPDF'})
    sortie = sortie or sortie_defaut
    doc.subset_fonts()                    # seulement les caractères employés (polices entières : 1 Mo de plus)
    doc.save(sortie, garbage=4, deflate=True)
    return pb


# ------------------------------------------------------------------ couverture : bannière et étiquettes en image

def niveaux_gris(pix):
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    if pix.n != 1:
        pix = pymupdf.Pixmap(pymupdf.csGRAY, pix)
    return np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w).astype(int)


def composantes(masque, min_px=4):
    lab, n = ndimage.label(masque)
    out = []
    for k, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None:
            continue
        taille = int((lab[sl] == k).sum())
        if taille >= min_px:
            out.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop, taille))
    return out


def analyser_banniere(G):
    """Repère, dans l'image de la bannière (gris), les lettres de « SEARCH FOR », la case « Certainty »
    (lettres et curseur), le texte fantôme du bandeau du titre et la ligne « It Is Written television presents »."""
    H, W = G.shape
    # case blanche « Certainty » : grande composante blanche, plus large que haute, dans la moitié droite
    blancs = composantes(G > 200, 50)
    cases = [c for c in blancs if c[0] > W * 0.45 and 70 < c[2] - c[0] < 150 and 12 < c[3] - c[1] < 40
             and (c[2] - c[0]) > 3 * (c[3] - c[1])]
    case = min(cases, key=lambda c: c[1])
    cx0, cy0, cx1, cy1 = case[:4]
    # lettres de « SEARCH FOR » : composantes blanches de même hauteur alignées, à gauche de la case
    zone = G[cy0 - 8:cy1 + 8, :cx0 - 3]
    lettres = [c for c in composantes(zone > 150, 20) if 12 < c[3] - c[1] < 40 and c[2] - c[0] < 40]
    hauts = statistics.median(c[1] for c in lettres)
    bas_ = statistics.median(c[3] for c in lettres)
    lettres = [c for c in lettres if abs(c[1] - hauts) <= 3 and abs(c[3] - bas_) <= 3]
    lettres.sort()
    # le logo : on garde la dernière suite de lettres régulièrement espacées (au moins 8)
    suite = [lettres[-1]]
    for c in reversed(lettres[:-1]):
        if suite[-1][0] - c[2] < 18:
            suite.append(c)
        else:
            break
    suite.reverse()
    sf = (min(c[0] for c in suite), cy0 - 8 + min(c[1] for c in suite),
          max(c[2] for c in suite), cy0 - 8 + max(c[3] for c in suite))
    # lettres « Certainty » et curseur dans la case
    interieur = G[cy0:cy1, cx0:cx1]
    sombres = composantes(interieur < 130, 3)
    hi, wi = interieur.shape
    fins = [c for c in sombres if c[2] - c[0] <= 8 and c[3] - c[1] >= 0.6 * hi and c[0] > 15]
    curseur = [max(fins, key=lambda c: c[0])] if fins else []        # le plus à droite (pas le « y »)
    lim = min([c[0] for c in curseur] + [wi])
    mots = [c for c in sombres if c[2] <= lim and c[3] - c[1] >= 3 and c[0] > 0 and c[1] > 0
            and c[2] < wi and c[3] < hi]
    ce = (cx0 + min(c[0] for c in mots), cy0 + min(c[1] for c in mots), cx0 + max(c[2] for c in mots),
          cy0 + max(c[3] for c in mots))
    # ligne de base de « Certainty » : bas le plus fréquent des lettres
    base_ce = cy0 + statistics.median(c[3] for c in mots)
    haut_ce = cy0 + min(c[1] for c in mots if c[0] == min(m[0] for m in mots))  # haut du « C »
    # bandeau du titre : grande composante blanche sous la barre
    bandeaux = [c for c in blancs if c[1] > cy1 and c[2] - c[0] > W * 0.25 and c[3] - c[1] > 15]
    bandeau = max(bandeaux, key=lambda c: c[4]) if bandeaux else None
    # « It Is Written television presents » : pixels sombres au-dessus de la barre noire
    noir = (G[:, sf[0]:cx1] < 90).mean(axis=1)
    y_barre = next(y for y in range(H) if noir[y] > 0.6)
    iw = None
    if y_barre > 8:
        ys, xs = np.nonzero(G[:y_barre - 1, :] < 170)
        if len(xs) > 30:
            iw = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    return {'sf': sf, 'case': (cx0, cy0, cx1, cy1), 'certainty': ce, 'base_ce': base_ce, 'haut_ce': haut_ce,
            'bandeau': bandeau[:4] if bandeau else None, 'iw': iw}


def etiquettes_dos(G):
    """Étiquettes « NAME », « ADDRESS », « PHONE » au dos (moitié gauche de la feuille) : au-dessus de traits longs."""
    H, W = G.shape
    sombre = G < 110
    traits = []
    for y in range(int(H * 0.6), H):
        run = (G[y, :] < 200).sum()
        if run > W * 0.55 and (not traits or y - traits[-1] > 4):
            traits.append(y)
    out = []
    for y in traits[:3]:
        bande = (G < 170)[y - 15:y - 1, 20:W - 10]
        cs = [c for c in composantes(bande, 2) if c[3] - c[1] >= 3]
        if not cs:
            continue
        x0 = min(c[0] for c in cs) + 20
        x1 = max(c[2] for c in cs) + 20
        y0 = min(c[1] for c in cs) + y - 15
        y1 = max(c[3] for c in cs) + y - 15
        out.append((x0, y0, x1, y1))
    return out


def retoucher_image(page, im, pb):
    """Peint des rectangles (coordonnées en pixels de l'image) dans l'image placée sur la page à im['bbox'].
    Couleur : [r, g, b] (0-255) ou « auto » (couleur médiane du pourtour)."""
    cible = pymupdf.Rect(im['bbox'])
    infos = [i for i in page.get_image_info(xrefs=True) if i['xref']
             and abs(pymupdf.Rect(i['bbox']).x0 - cible.x0) < 3 and abs(pymupdf.Rect(i['bbox']).y0 - cible.y0) < 3]
    if not infos:
        pb.append(f'image introuvable : {im["bbox"]}')
        return
    xref = infos[0]['xref']
    pix = pymupdf.Pixmap(page.parent, xref)
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    if pix.n != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    A = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, 3).copy()
    for x0, y0, x1, y1, couleur in im['peindre']:
        if couleur == 'auto':
            anneau = np.concatenate([A[max(y0 - 3, 0):y0, x0:x1].reshape(-1, 3), A[y1:y1 + 3, x0:x1].reshape(-1, 3),
                                     A[y0:y1, max(x0 - 3, 0):x0].reshape(-1, 3), A[y0:y1, x1:x1 + 3].reshape(-1, 3)])
            couleur = np.median(anneau, axis=0)
        A[y0:y1, x0:x1] = couleur
    page.replace_image(xref, pixmap=pymupdf.Pixmap(pymupdf.csRGB, pix.w, pix.h, A.tobytes(), False))


def ecrire(page, x, base, texte, fichier, taille, couleur, espacement=0.0, aligne='gauche'):
    f = pymupdf.Font(fontfile=fichier)
    largeurs = [f.text_length(c, fontsize=taille) for c in texte]
    total = sum(largeurs) + espacement * (len(texte) - 1)
    if aligne == 'droite':
        x -= total
    elif aligne == 'centre':
        x -= total / 2
    tw = pymupdf.TextWriter(page.rect)
    for c, w in zip(texte, largeurs):
        tw.append((x, base), c, font=f, fontsize=taille)
        x += w + espacement
    tw.write_text(page, color=couleur)
    return total


def couverture(doc, T, arch, pb):
    """Bannière « EN QUÊTE DE Certitude » (image retouchée) et, pour A, B, C, les étiquettes du dos."""
    p1 = doc[0]
    infos = [i for i in p1.get_image_info(xrefs=True) if i['xref']]
    cand = [i for i in infos if pymupdf.Rect(i['bbox']).y0 < 80 and pymupdf.Rect(i['bbox']).width > 300]
    if not cand:
        pb.append('bannière introuvable')
        return
    info = max(cand, key=lambda i: pymupdf.Rect(i['bbox']).width)
    xref, bb = info['xref'], pymupdf.Rect(info['bbox'])
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha:
        pix = pymupdf.Pixmap(pix, 0)
    if pix.n not in (1, 3):
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    G = niveaux_gris(pix)
    A = np.frombuffer(pix.samples, np.uint8).reshape(pix.h, pix.w, pix.n).copy()
    feuille = bb.width > p1.rect.width * 1.5        # A, B, C : la feuille entière (dos + couverture)
    ox = 0
    if feuille:
        ox = int(pix.w * (p1.rect.x0 - bb.x0) / bb.width)  # début de la page 1 dans l'image
        Gb = G[: pix.h // 3, ox:]
    else:
        Gb = G
    B = analyser_banniere(Gb)
    sx, sy = bb.width / pix.w, bb.height / pix.h

    def pt(x, y):
        return bb.x0 + (x + ox) * sx, bb.y0 + y * sy

    def peindre(r, valeur, seuil=None, marge=1):
        x0, y0, x1, y1 = r
        sl = A[max(y0 - marge, 0):y1 + marge, ox + x0 - marge:ox + x1 + marge]
        if seuil is None:
            sl[...] = valeur
        else:
            g = sl.mean(axis=2) if sl.ndim == 3 else sl
            sl[g > seuil] = valeur

    # « SEARCH FOR » : peint avec le noir de la barre ; « Certainty » : blanc ; texte fantôme du bandeau : blanc
    noir = int(np.median(Gb[B['sf'][1]:B['sf'][3], B['sf'][0] - 2:B['sf'][0]]))
    peindre(B['sf'], min(noir, 40), marge=2)
    peindre(B['certainty'], 255, marge=1)
    if B['bandeau']:
        x0, y0, x1, y1 = B['bandeau']
        peindre((x0 + 3, y0 + 3, x1 - 3, y1 - 3), 255, seuil=150, marge=0)
    if B['iw']:
        peindre(B['iw'], 255, marge=3)
    dos = []
    if feuille:
        Gd = G[:, :ox]
        dos = etiquettes_dos(Gd)
        for (x0, y0, x1, y1) in dos:
            A[y0 - 1:y1 + 1, x0 - 1:x1 + 1] = 255
    nouveau = pymupdf.Pixmap(pix.colorspace, pix.w, pix.h, A.tobytes(), False)
    p1.replace_image(xref, pixmap=nouveau)
    xref8, bb8 = None, None
    if feuille:
        # la page 8 (moitié gauche de la même feuille) a sa propre copie de l'image
        p8 = doc[len(doc) - 1]
        for i in p8.get_image_info(xrefs=True):
            r = pymupdf.Rect(i['bbox'])
            if i['xref'] and r.width > p8.rect.width * 1.5 and (i['width'], i['height']) == (pix.w, pix.h):
                xref8, bb8 = i['xref'], r
        if xref8 and xref8 != xref:
            p8.replace_image(xref8, pixmap=nouveau)

    # textes français de la bannière
    blanc, noir_ = (1, 1, 1), (0, 0, 0)
    x0, y0 = pt(B['sf'][0], B['sf'][1])
    x1, y1 = pt(B['sf'][2], B['sf'][3])
    xc, _ = pt(B['case'][0], 0)
    anton = FICHIERS[('anton', '')]
    h = y1 - y0
    taille = h / 0.859
    lg = fonte('anton').text_length('EN QUÊTE DE', fontsize=taille)
    place = xc - 5 - x0
    if lg > place:
        taille *= place / lg
    ecrire(p1, x0, y1, 'EN QUÊTE DE', anton, taille, blanc)
    cx0, base = pt(B['certainty'][0], B['base_ce'])
    _, haut_c = pt(0, B['haut_ce'])
    cx1, _ = pt(B['certainty'][2], 0)
    archivo = FICHIERS[('archivo', '')]
    taille = (base - haut_c) / 0.688
    lg = fonte('archivo').text_length('Certitude', fontsize=taille)
    if lg > (cx1 - cx0):
        taille *= (cx1 - cx0) / lg
    ecrire(p1, cx0, base, 'Certitude', archivo, taille, noir_)
    if B['iw']:
        ix0, iy0 = pt(B['iw'][0], B['iw'][1])
        ix1, iy1 = pt(B['iw'][2], B['iw'][3])
        gbi = FICHIERS[('gill', 'bi')]
        t = (iy1 - iy0) / 0.692
        texte = 'IT IS WRITTEN TÉLÉVISION PRÉSENTE :'.replace(' :', NBSP + ':')
        lg = fonte('gill', 'bi').text_length(texte, fontsize=t) + 0.4 * (len(texte) - 1)
        if lg > (ix1 - ix0) * 1.25:
            t *= (ix1 - ix0) * 1.25 / lg
        ecrire(p1, ix0, iy1, texte, gbi, t, noir_, espacement=0.4)
    if dos:
        # au dos (page 8), la même image est placée autrement : coordonnées prises sur la page 8
        p8 = doc[len(doc) - 1]
        gbi = FICHIERS[('gill', 'bi')]
        t = statistics.median([(y1 - y0) for (x0, y0, x1, y1) in dos]) * sy / 0.692
        for (x0, y0, x1, y1), nom in zip(dos, ['NOM', 'ADRESSE', 'TÉLÉPHONE']):
            Y1 = bb8.y0 + y1 * sy
            if nom == 'TÉLÉPHONE':
                ecrire(p8, bb8.x0 + x1 * sx, Y1, nom, gbi, t, noir_, espacement=0.5, aligne='droite')
            else:
                ecrire(p8, bb8.x0 + x0 * sx, Y1, nom, gbi, t, noir_, espacement=0.5)


# ------------------------------------------------------------------ contrôle visuel

def voir(lettre, pages=None):
    from PIL import Image
    _, src, livret, sortie = document(lettre)
    doc = pages_source(src, livret)
    fr_ = pymupdf.open(sortie)
    for k in pages or range(1, 9):
        a = doc[k - 1].get_pixmap(dpi=110)
        b = fr_[k - 1].get_pixmap(dpi=110)
        A = Image.frombytes('RGB', (a.w, a.h), a.samples)
        Bm = Image.frombytes('RGB', (b.w, b.h), b.samples)
        P = Image.new('RGB', (A.width + Bm.width + 10, max(A.height, Bm.height)), (200, 0, 0))
        P.paste(A, (0, 0))
        P.paste(Bm, (A.width + 10, 0))
        P.save(f'/tmp/sfc{lettre}-v{k}.png')
        print(f'/tmp/sfc{lettre}-v{k}.png')


def planche(lettre):
    from PIL import Image
    d = pymupdf.open(document(lettre)[3])
    ims = []
    for p in d:
        pm = p.get_pixmap(dpi=60)
        ims.append(Image.frombytes('RGB', (pm.w, pm.h), pm.samples))
    w, h = max(i.width for i in ims), max(i.height for i in ims)
    P = Image.new('RGB', (4 * (w + 8), ((len(ims) + 3) // 4) * (h + 8)), (120, 120, 120))
    for k, im in enumerate(ims):
        P.paste(im, ((k % 4) * (w + 8), (k // 4) * (h + 8)))
    P.save(f'/tmp/sfc{lettre}-planche.png')
    print(f'/tmp/sfc{lettre}-planche.png')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'apercu':
        for x in sys.argv[2:]:
            apercu(x)
    elif cmd == 'voir':
        voir(sys.argv[2], [int(p) for p in sys.argv[3:]] or None)
    elif cmd == 'planche':
        planche(sys.argv[2])
    else:
        for x in sys.argv[1:]:
            for p in construire(x):
                print(' ', x, p)
            print(x, 'ok')
