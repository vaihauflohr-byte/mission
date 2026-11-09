"""OCR de tous les livrets scannés d'« En quête de certitude » (cache JSON + images des pages)."""
import json, sys
from multiprocessing import Pool
from pathlib import Path
from ocr import pages_livret, ocr

import chemins  # noqa: E402
ORIG = str(chemins.ORIGINAUX / 'quete-certitude') + '/'
CACHE = chemins.OCR_CACHE

def traiter(n):
    nom = 'SFC1_How to understand the Bible.pdf' if n == 1 else f'SFC{n}.pdf'
    sortie = CACHE / f'sfc-{n:02d}.json'
    if sortie.exists():
        return n, 'déjà fait'
    pages = pages_livret(ORIG + nom)
    res = []
    for i, im in enumerate(pages, start=1):
        im.save(CACHE / f'sfc-{n:02d}-p{i}.png')
        res.append({'page': i, 'taille': im.size, 'mots': ocr(im)})
    sortie.write_text(json.dumps(res, ensure_ascii=False))
    return n, 'ok'

if __name__ == '__main__':
    with Pool(4) as p:
        for n, etat in p.imap_unordered(traiter, range(1, 31)):
            print(n, etat, flush=True)
