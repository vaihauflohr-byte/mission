"""Pages d'un livret scanné (planches tournées de 2 pages) : redressement, découpe, ordre de lecture, OCR."""
import csv, io, subprocess
import pymupdf
from PIL import Image

def pages_livret(pdf, dpi=150, rotation=90):
    """Renvoie les pages du livret dans l'ordre de lecture (images PIL en niveaux de gris)."""
    d = pymupdf.open(pdf)
    moities = []
    for pg in d:
        pix = pg.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
        im = Image.frombytes('L', (pix.width, pix.height), pix.samples).rotate(rotation, expand=True)
        w, h = im.size
        moities.append((im.crop((0, 0, w // 2, h)), im.crop((w // 2, 0, w, h))))
    n = 2 * len(moities)
    # imposition d'un livret piqué : feuille k recto = [n-2k | 2k+1], verso = [2k+2 | n-2k-1] (pages comptées de 1)
    ordre = {}
    for k, (g, dr) in enumerate(moities):
        if k % 2 == 0:
            gauche, droite = n - k, k + 1
        else:
            gauche, droite = k + 1, n - k
        ordre[gauche] = g
        ordre[droite] = dr
    return [ordre[i] for i in range(1, n + 1)]

def ocr(im, psm=3):
    """Mots reconnus : dict(bloc, par, ligne, x0, y0, x1, y1, conf, texte)."""
    buf = io.BytesIO(); im.save(buf, 'PNG')
    out = subprocess.run(['tesseract', 'stdin', 'stdout', '--psm', str(psm), '-l', 'eng', 'tsv'],
                         input=buf.getvalue(), capture_output=True).stdout.decode()
    mots = []
    for r in csv.DictReader(io.StringIO(out), delimiter='\t', quoting=csv.QUOTE_NONE):
        if r['level'] != '5' or not r['text'].strip():
            continue
        x, y, w, h = int(r['left']), int(r['top']), int(r['width']), int(r['height'])
        mots.append({'bloc': int(r['block_num']), 'par': int(r['par_num']), 'ligne': int(r['line_num']),
                     'x0': x, 'y0': y, 'x1': x + w, 'y1': y + h, 'conf': float(r['conf']), 'texte': r['text']})
    return mots

def paragraphes(mots):
    P = {}
    for m in mots:
        k = (m['bloc'], m['par'])
        p = P.setdefault(k, {'mots': [], 'lignes': {}})
        p['mots'].append(m)
        p['lignes'].setdefault(m['ligne'], []).append(m)
    res = []
    for k, p in P.items():
        ws = p['mots']
        res.append({'cle': k, 'bbox': [min(w['x0'] for w in ws), min(w['y0'] for w in ws), max(w['x1'] for w in ws), max(w['y1'] for w in ws)],
                    'texte': ' '.join(w['texte'] for w in ws), 'conf': sum(w['conf'] for w in ws) / len(ws),
                    'lignes': [[min(w['x0'] for w in L), min(w['y0'] for w in L), max(w['x1'] for w in L), max(w['y1'] for w in L)] for L in p['lignes'].values()]})
    res.sort(key=lambda p: (p['bbox'][1], p['bbox'][0]))
    return res
