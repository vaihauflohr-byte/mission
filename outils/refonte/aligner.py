"""Prépare la traduction d'un document natif en reprenant le français déjà publié sur le site.

  python3 aligner.py NOM SOURCE CHEMIN [--livret]
    NOM     nom du document (textes/NOM.json, sortie/NOM.pdf)
    SOURCE  PDF anglais, relatif à originaux/sortie/pdf (ex. « prendre-vie/01 Being Born … .pdf »)
    CHEMIN  document du site (ex. « prendre-vie/01-une-nouvelle-relation-avec-jesus »)

Écrit textes/NOM.json (brouillon : unités anglaises -> paragraphes français alignés) et affiche
l'alignement pour relecture. Les lignes de soulignés et les marqueurs sont gardés tels quels.
"""
import json
import math
import re
import sys
from pathlib import Path

import pymupdf

import natif

ICI = Path(__file__).resolve().parent
import chemins  # noqa: E402
SITE = chemins.DOCUMENTS
SOULIGNE = re.compile(r'^[_\s.…]+$')
REF = re.compile(r'(\d+)\s*[:.]\s*(\d+)')


def refs(texte):
    return {f'{a}:{b}' for a, b in REF.findall(texte)}


# ------------------------------------------------------------------ anglais : unités dans l'ordre de lecture

def ordre_lecture(page, U):
    W, H = page.rect.width, page.rect.height
    cles = []
    for k, u in enumerate(U):
        L = u['lignes']
        x0 = min(l['bbox'][0] for l in L)
        cles.append((k, x0, L[0]['bbox'][1], u))
    corps = [c for c in cles if 40 < c[2] < H - 50]
    gauche = [c for c in corps if c[1] < W * 0.42]
    droite = [c for c in corps if c[1] >= W * 0.45]
    deux_colonnes = len(gauche) >= 3 and len(droite) >= 3

    def rang(c):
        k, x0, y0, u = c
        if y0 <= 40:
            return (0, y0, x0)
        if y0 >= H - 50:
            return (3, y0, x0)
        if deux_colonnes:
            return (1 if x0 < W * 0.45 else 2, y0, x0)
        return (1, y0, x0)
    return [c[0] for c in sorted(cles, key=rang)]


def unites_anglaises(doc):
    res, gardes = [], {}
    for i, page in enumerate(doc):
        U = natif.unites(page)
        for k in ordre_lecture(page, U):
            u = U[k]
            cle = f'{i + 1}.{k:02d}'
            t = natif.texte_unite(u)
            if u['marqueur'] or SOULIGNE.match(t):
                if not u['marqueur']:
                    gardes[cle] = '='
                continue
            res.append({'cle': cle, 'texte': t, 'taille': u['lignes'][0]['taille'],
                        'gras': natif.style_commun(u) == 'b' or 'b' in natif.style_commun(u)})
    return res, gardes


# ------------------------------------------------------------------ français : paragraphes du PDF du site

def paragraphes_francais(chemin):
    d = pymupdf.open(chemin)
    lignes = []
    for i, p in enumerate(d):
        H = p.rect.height
        for b in p.get_text('dict')['blocks']:
            for l in b.get('lines', []):
                spans = [s for s in l['spans'] if s['text'].strip()]
                if not spans:
                    continue
                t = ''.join(s['text'] for s in l['spans']).strip()
                lignes.append({'page': i, 'y0': l['bbox'][1], 'y1': l['bbox'][3], 'x0': l['bbox'][0], 'H': H, 'texte': t,
                               'taille': round(max(s['size'] for s in spans), 1),
                               'gras': all('bold' in s['font'].lower() or s['flags'] & 16 for s in spans),
                               'couleur': spans[0]['color']})
    # en-têtes et pieds de page : même texte (aux chiffres près) en haut ou en bas de plusieurs pages
    def norme(t):
        return re.sub(r'\d+', '#', t)
    from collections import Counter
    bords = Counter(norme(l['texte']) for l in lignes if l['y0'] < 70 or l['y1'] > l['H'] - 80)
    lignes = [l for l in lignes if not ((l['y0'] < 70 or l['y1'] > l['H'] - 80) and bords[norme(l['texte'])] >= 2)
              and not SOULIGNE.match(l['texte']) and not re.fullmatch(r'[•\-–]|\d+\s*/\s*\d+', l['texte'])]
    paras = []
    for l in lignes:
        p = paras[-1] if paras else None
        if (p and p['page'] == l['page'] and abs(p['taille'] - l['taille']) < 0.6 and p['gras'] == l['gras']
                and p['couleur'] == l['couleur'] and 0 <= l['y0'] - p['y1'] < 0.6 * l['taille']):
            p['texte'] += ' ' + l['texte']
            p['y1'] = l['y1']
        else:
            paras.append(dict(l))
    for p in paras:
        p['texte'] = re.sub(r'\s+', ' ', p['texte']).replace('- ', '-').strip() if False else re.sub(r'\s+', ' ', p['texte']).strip()
    return paras


# ------------------------------------------------------------------ alignement

def score(e, fs):
    """Ressemblance entre une unité anglaise et un ou deux paragraphes français."""
    f = ' '.join(x['texte'] for x in fs)
    le, lf = len(e['texte']), len(f)
    s = -abs(math.log((lf + 5) / (1.15 * le + 5))) * 2
    re_, rf = refs(e['texte']), refs(f)
    if re_ or rf:
        s += 3 * len(re_ & rf) - 1.5 * len(re_ ^ rf)
    if ('?' in e['texte']) == ('?' in f):
        s += 0.5
    if e['taille'] >= 13 and all(x['taille'] >= 12 or x['gras'] for x in fs):
        s += 1
    return s


def aligner(E, F):
    n, m = len(E), len(F)
    INF = float('-inf')
    best = [[INF] * (m + 1) for _ in range(n + 1)]
    pas = [[None] * (m + 1) for _ in range(n + 1)]
    best[0][0] = 0
    SAUT_E, SAUT_F = -2.5, -2.0
    for i in range(n + 1):
        for j in range(m + 1):
            b = best[i][j]
            if b == INF:
                continue
            cand = []
            if i < n and j < m:
                cand.append((i + 1, j + 1, b + score(E[i], [F[j]]), '1-1'))
            if i < n and j + 1 < m:
                cand.append((i + 1, j + 2, b + score(E[i], F[j:j + 2]) - 0.8, '1-2'))
            if i < n:
                cand.append((i + 1, j, b + SAUT_E, '1-0'))
            if j < m:
                cand.append((i, j + 1, b + SAUT_F, '0-1'))
            for a, c, v, t in cand:
                if v > best[a][c]:
                    best[a][c] = v
                    pas[a][c] = (i, j, t)
    i, j = n, m
    res = []
    while (i, j) != (0, 0):
        pi, pj, t = pas[i][j]
        res.append((pi, pj, t))
        i, j = pi, pj
    res.reverse()
    return res


def main(nom, source, chemin, livret=False):
    doc = natif.pages_source(f'{natif.ORIG_RACINE}/{source}', livret)
    E, gardes = unites_anglaises(doc)
    F = paragraphes_francais(SITE / f'{chemin}.pdf')
    chemin_json = ICI / 'textes' / f'{nom}.json'
    u = dict(gardes)
    lignes = []
    for i, j, t in aligner(E, F):
        if t == '1-1':
            u[E[i]['cle']] = F[j]['texte']
            lignes.append((E[i]['cle'], E[i]['texte'], F[j]['texte']))
        elif t == '1-2':
            u[E[i]['cle']] = F[j]['texte'] + ' ' + F[j + 1]['texte']
            lignes.append((E[i]['cle'], E[i]['texte'], F[j]['texte'] + ' ‖ ' + F[j + 1]['texte']))
        elif t == '1-0':
            lignes.append((E[i]['cle'], E[i]['texte'], '∅'))
        else:
            lignes.append(('  +', '', F[j]['texte']))
    T = {'source': source, 'chemin': chemin, 'livret': livret, 'titre': '', 'u': dict(sorted(u.items()))}
    if chemin_json.exists():
        print('!! existe déjà :', chemin_json, '(non remplacé ; brouillon dans /tmp)')
        chemin_json = Path('/tmp') / f'{nom}.json'
    json.dump(T, open(chemin_json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    for cle, en, fr in lignes:
        print(f'{cle:6s} {en[:70]:70s} | {fr[:90]}')
    print('->', chemin_json)


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    main(a[0], a[1], a[2], '--livret' in sys.argv)
