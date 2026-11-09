"""Refait une traduction sur la mise en page de l'original anglais (PDF natif).

Usage : python3 refaire.py ORIGINAL.pdf TRADUCTION.json SORTIE.pdf
TRADUCTION.json : {"ordre": [1,2,3,0], "titre": "...", "unites": {"1.02": "<html>", "1.16": null, ...},
                   "options": {"1.00": {"centre": true}}}
Une unité absente ou à null est gardée telle quelle (numéros, cases, copyright…).
"""
import json, statistics, sys
import pymupdf
from unites import unites

import chemins  # noqa: E402
POLICES = str(chemins.SYSTEME[-1])
CSS_POLICES = """
@font-face {font-family: corps; src: url(DejaVuSans.ttf);}
@font-face {font-family: corps; src: url(DejaVuSans-Bold.ttf); font-weight: bold;}
@font-face {font-family: corps; src: url(DejaVuSans-Oblique.ttf); font-style: italic;}
@font-face {font-family: corps; src: url(DejaVuSans-BoldOblique.ttf); font-weight: bold; font-style: italic;}
"""

def interligne(u):
    L = u['lignes']
    if len(L) > 1:
        return statistics.median(L[i + 1]['bbox'][1] - L[i]['bbox'][1] for i in range(len(L) - 1))
    return round(L[0]['taille'] * 1.21, 2)

def style_unite(u):
    styles = [st for l in u['lignes'] for st, t in l['spans'] if t.strip()]
    return 'i' if styles and all('i' in s for s in styles) else ''

def refaire(original, traduction, sortie, rapport=None):
    T = json.load(open(traduction, encoding='utf-8'))
    src = pymupdf.open(original)
    out = pymupdf.open()
    arch = pymupdf.Archive(POLICES)
    pb = []
    for num in T['ordre']:
        out.insert_pdf(src, from_page=num, to_page=num)
        page = out[-1]
        U = unites(src[num])
        # éléments qui bornent les zones de texte : toutes les lignes et les images
        images = [pymupdf.Rect(b['bbox']) for b in src[num].get_text('dict')['blocks'] if b['type'] == 1]
        bord_droit = max(l['bbox'][2] for u in U for l in u['lignes'] if not u['marqueur']) + 3
        a_faire = []
        for k, u in enumerate(U):
            cle = f'{num}.{k:02d}'
            if u['marqueur']:
                continue
            if cle not in T['unites']:
                pb.append(f'non traduite : {cle} {u["lignes"][0]["texte"][:60]}')
                continue
            html = T['unites'][cle]
            if html is None:
                continue
            for l in u['lignes']:
                r = pymupdf.Rect(l['bbox'])
                page.add_redact_annot(pymupdf.Rect(r.x0 - 0.5, r.y0 + 1, r.x1 + 0.5, r.y1 - 1), fill=False)
            a_faire.append((cle, u, html))
        page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
        # soulignements de l'anglais : petits traits horizontaux sous les lignes remplacées
        traits = []
        for dr in src[num].get_drawings():
            r = dr['rect']
            if r.height > 1.6 or r.width < 4:
                continue
            for cle, u, html in a_faire:
                if any(l['bbox'][1] < r.y0 < l['bbox'][3] + 3 and r.x0 >= l['bbox'][0] - 2 and r.x1 <= l['bbox'][2] + 2
                       for l in u['lignes']):
                    traits.append(r)
                    break
        if traits:
            for r in traits:
                page.add_redact_annot(pymupdf.Rect(r.x0 - 0.8, r.y0 - 0.8, r.x1 + 0.8, r.y1 + 0.8), fill=False)
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE,
                                  graphics=pymupdf.PDF_REDACT_LINE_ART_REMOVE_IF_COVERED,
                                  text=pymupdf.PDF_REDACT_TEXT_NONE)
        for cle, u, html in a_faire:
            opt = T.get('options', {}).get(cle, {})
            L = u['lignes']
            x0 = min(l['bbox'][0] for l in L); y0 = L[0]['bbox'][1]
            x1 = opt.get('droite', bord_droit)
            # bas : premier élément situé dessous qui chevauche horizontalement la zone
            bas = page.rect.height - 18
            for v in U:
                if v is u:
                    continue
                for l in v['lignes']:
                    b = l['bbox']
                    if b[1] > L[-1]['bbox'][1] + 1 and b[0] < x1 and b[2] > x0:
                        bas = min(bas, b[1] - 1)
            for im in images:
                if im.y0 > L[-1]['bbox'][1] + 1 and im.x0 < x1 and im.x1 > x0:
                    bas = min(bas, im.y0 - 2)
            if opt.get('centre'):
                c = (min(l['bbox'][0] for l in L) + max(l['bbox'][2] for l in L)) / 2
                demi = opt.get('demi_largeur', max(c - 20, page.rect.width - c - 20))
                x0, x1 = c - demi, c + demi
            if 'bas' in opt:
                bas = opt['bas']
            taille = L[0]['taille']
            css = CSS_POLICES + f"* {{font-family: corps; font-size: {taille}pt; line-height: {opt.get('interligne', interligne(u))}pt; margin: 0; padding: 0; color: #000;}}"
            if opt.get('centre'):
                css += " body {text-align: center;}"
            if style_unite(u) == 'i' and not html.lstrip().startswith('<i>'):
                html = f'<i>{html}</i>'
            if L[0]['police'].lower().find('bold') >= 0 and all('b' in st for l in L for st, t in l['spans'] if t.strip()) and '<b>' not in html:
                html = f'<b>{html}</b>'
            rect = pymupdf.Rect(x0, y0 - 0.5, x1, max(bas, y0 + taille * 1.3))
            reste, echelle = page.insert_htmlbox(rect, html, css=css, archive=arch, scale_low=opt.get('reduction', 0.8))
            if reste < 0:
                pb.append(f'déborde : {cle}')
            elif echelle < 0.999:
                pb.append(f'réduit à {echelle:.0%} : {cle}')
    out.set_metadata({'title': T.get('titre', ''), 'author': 'Gateway Adventist Centre — traduction française',
                      'subject': T.get('sujet', ''), 'creator': 'mission.ka-ilei.com', 'producer': 'PyMuPDF'})
    out.save(sortie, garbage=4, deflate=True)
    if rapport is not None:
        rapport.extend(pb)
    return pb

if __name__ == '__main__':
    for p in refaire(sys.argv[1], sys.argv[2], sys.argv[3]):
        print(' ', p)
