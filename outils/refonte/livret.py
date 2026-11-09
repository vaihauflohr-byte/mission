"""Livrets imposés (feuilles de deux pages côte à côte) : remet chaque page à part, dans l'ordre de lecture.

Une feuille paysage porte deux pages du livret (8|1, 2|7, 6|3, 4|5 pour 8 pages).
Chaque page devient une page PDF à part : copie de la feuille, rotation retirée,
cadre (CropBox) sur la moitié voulue, texte de l'autre moitié supprimé.
Le numéro de chaque moitié est lu sur la page elle-même (petit nombre seul en bas ou en haut).
"""
import re
import sys

import pymupdf


def numero(page):
    """Numéro imprimé sur la page : nombre seul (1 à 2 chiffres), le plus près d'un bord."""
    H = page.rect.height
    meilleur = None
    for x0, y0, x1, y1, mot, *_ in page.get_text('words', clip=page.rect):
        if not re.fullmatch(r'\d{1,2}', mot):
            continue
        bord = min(y0, H - y1)
        if bord < 70 and (meilleur is None or bord < meilleur[0]):
            meilleur = (bord, int(mot))
    return meilleur[1] if meilleur else None


def pages_du_livret(chemin):
    """Renvoie un document PDF : une page par page du livret, dans l'ordre de lecture."""
    src = pymupdf.open(chemin)
    tmp = pymupdf.open()
    for i in range(src.page_count):
        tmp.insert_pdf(src, from_page=i, to_page=i)
        tmp.insert_pdf(src, from_page=i, to_page=i)
    moities = []
    for i in range(tmp.page_count):
        p = tmp[i]
        if p.rotation:
            # remove_rotation() retire aussi la CropBox : on la retrouve grâce à un mot repère,
            # vu à l'écran avant (coordonnées tournées) et sur la page sans rotation après
            vue = p.rect
            tous = [w[4] for w in p.get_text('words')]
            repere = next(w for w in p.get_text('words') if len(w[4]) >= 5 and tous.count(w[4]) == 1)
            avant = pymupdf.Rect(repere[:4]) * p.rotation_matrix
            p.set_cropbox(p.mediabox)  # sinon remove_rotation() décale le contenu
            p.remove_rotation()
            apres = next(pymupdf.Rect(w[:4]) for w in p.get_text('words') if w[4] == repere[4]
                         and abs(pymupdf.Rect(w[:4]).width - avant.width) < 1)
            cb = pymupdf.Rect(apres.x0 - avant.x0, apres.y0 - avant.y0, 0, 0)
            cb.x1, cb.y1 = cb.x0 + vue.width, cb.y0 + vue.height
            p.set_cropbox(cb & p.mediabox)
        cb = p.cropbox
        milieu = (cb.x0 + cb.x1) / 2
        gauche = i % 2 == 0
        garder = pymupdf.Rect(cb.x0, cb.y0, milieu, cb.y1) if gauche else pymupdf.Rect(milieu, cb.y0, cb.x1, cb.y1)
        # texte de l'autre moitié : supprimé (images et dessins gardés, hors cadre)
        W = p.rect.width
        autre = pymupdf.Rect(W / 2, -50, W + 50, p.rect.height + 50) if gauche else pymupdf.Rect(-50, -50, W / 2, p.rect.height + 50)
        p.add_redact_annot(autre, fill=False)
        p.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
        p.set_cropbox(garder)
        moities.append((numero(p), i))
    nums = [n for n, _ in moities]
    attendu = list(range(1, len(moities) + 1))
    if sorted(n for n in nums if n) != sorted(set(n for n in nums if n)) or None in nums:
        # numéros manquants ou en double : ordre d'imposition classique
        n = len(moities)
        ordre_imp = []
        for f in range(n // 2):
            g, d = (n - f, f + 1) if f % 2 == 0 else (f + 1, n - f)
            ordre_imp += [g, d]
        nums = ordre_imp
    out = pymupdf.open()
    for n in attendu:
        out.insert_pdf(tmp, from_page=nums.index(n), to_page=nums.index(n))
    return out, nums


if __name__ == '__main__':
    doc, nums = pages_du_livret(sys.argv[1])
    print('numéros lus :', nums)
    doc.save(sys.argv[2], garbage=4, deflate=True)
