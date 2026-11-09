"""Découpe un PDF natif en unités de texte (paragraphes) à traduire, avec leurs lignes et leur style."""
import json, re, sys
import pymupdf

MARQUEUR = re.compile(r'^\s*(\d{1,2}\.|\[\s*\]|[a-h]\)|•|-)\s*$')

def style(span):
    f = span['font'].lower()
    return ('b' if 'bold' in f else '') + ('i' if 'italic' in f or 'oblique' in f else '')

def lignes(page):
    out = []
    for b in page.get_text('dict')['blocks']:
        if b['type'] != 0:
            continue
        for l in b['lines']:
            spans = [s for s in l['spans'] if s['text'].strip()]
            if not spans:
                continue
            texte = ''.join(s['text'] for s in l['spans'])
            out.append({'bbox': [round(v, 1) for v in l['bbox']], 'texte': texte.strip(),
                        'taille': round(max(s['size'] for s in spans), 1),
                        'police': spans[0]['font'], 'couleur': spans[0]['color'],
                        'spans': [(style(s), s['text']) for s in l['spans'] if s['text']]})
    out.sort(key=lambda l: (round(l['bbox'][1]), l['bbox'][0]))
    return out

def unites(page):
    L = lignes(page)
    res, cur = [], None
    for l in L:
        if MARQUEUR.match(l['texte']):
            res.append({'marqueur': True, 'lignes': [l]})
            cur = None
            continue
        if cur and abs(l['bbox'][0] - cur['lignes'][-1]['bbox'][0]) < 3 \
                and -0.4 * l['taille'] <= l['bbox'][1] - cur['lignes'][-1]['bbox'][3] < 0.6 * l['taille'] \
                and abs(l['taille'] - cur['lignes'][-1]['taille']) < 0.6:
            cur['lignes'].append(l)
        else:
            cur = {'marqueur': False, 'lignes': [l]}
            res.append(cur)
    return res

def soulignes(page, u):
    """Mots soulignés (trait horizontal juste sous le mot) dans une unité."""
    traits = [d['rect'] for d in page.get_drawings() if d['rect'].height <= 1.6 and d['rect'].width >= 4]
    mots = []
    for w in page.get_text('words'):
        r = pymupdf.Rect(w[:4])
        if not any(abs(r.y0 - l['bbox'][1]) < 2 and r.x0 >= l['bbox'][0] - 1 and r.x1 <= l['bbox'][2] + 1 for l in u['lignes']):
            continue
        for t in traits:
            if r.y1 - 2 < t.y0 < r.y1 + 3 and t.x0 - 1 <= (r.x0 + r.x1) / 2 <= t.x1 + 1:
                mots.append(w[4]); break
    return mots

if __name__ == '__main__':
    d = pymupdf.open(sys.argv[1])
    for pg in d:
        print('=== page', pg.number)
        for k, u in enumerate(unites(pg)):
            t = ' '.join(l['texte'] for l in u['lignes'])
            print(f"  {pg.number}.{k:02d} {'M' if u['marqueur'] else ' '} {u['lignes'][0]['taille']:4.1f} {[round(v) for v in u['lignes'][0]['bbox'][:2]]} {t[:110]}")
            sous = soulignes(pg, u)
            if sous:
                print('        soulignés :', sous)
