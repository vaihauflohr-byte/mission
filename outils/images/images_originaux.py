"""Images de la série « Historacles et Prophéties » tirées des documents d’origine (pas d’image générée).

Usage : python3 outils/images/images_originaux.py
Pour chaque étude, l’illustration du récit (page 1, colonne de gauche) est posée au centre
d’un fond fait de la même image, agrandie et floutée : assets/images/historacles-<n>.webp (800 × 600).
L’image de la série reprend le titre gravé dans la pierre de la couverture : serie-historacles.webp.
"""
import io
from pathlib import Path

import pymupdf
from PIL import Image, ImageEnhance, ImageFilter

RACINE = Path(__file__).resolve().parents[2]
DOCS = RACINE / "documents" / "historacles"
SORTIE = RACINE / "assets" / "images"
L, H = 800, 600


def image_xref(doc, xref):
    pix = pymupdf.Pixmap(doc, xref)
    if pix.alpha or pix.colorspace.n not in (1, 3):
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def illustration(doc):
    """La plus grande image de la colonne de gauche, hors fond de couverture."""
    page = doc[0]
    tiers = page.rect.width / 3
    choix = []
    for info in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = info["bbox"]
        if x1 > tiers or (y1 - y0) > page.rect.height * 0.8 or not info["xref"]:
            continue
        choix.append(((x1 - x0) * (y1 - y0), info["xref"]))
    return image_xref(doc, max(choix)[1]) if choix else None


def fond_couverture(doc):
    page = doc[0]
    for info in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = info["bbox"]
        if (y1 - y0) > page.rect.height * 0.8 and x1 < page.rect.width / 2:
            return image_xref(doc, info["xref"])
    return None


def composer(im, hauteur):
    """L’image nette au centre, sur un fond de la même image agrandie, floutée et adoucie."""
    fond = im.copy()
    k = max(L / fond.width, H / fond.height)
    fond = fond.resize((round(fond.width * k), round(fond.height * k)), Image.LANCZOS)
    g, h = (fond.width - L) // 2, (fond.height - H) // 2
    fond = fond.crop((g, h, g + L, h + H)).filter(ImageFilter.GaussianBlur(18))
    fond = ImageEnhance.Brightness(fond).enhance(0.62)
    k = hauteur / im.height
    net = im.resize((round(im.width * k), hauteur), Image.LANCZOS)
    fond.paste(net, ((L - net.width) // 2, (H - hauteur) // 2))
    return fond


def main():
    SORTIE.mkdir(parents=True, exist_ok=True)
    n = 0
    for pdf in sorted(DOCS.glob("[0-9][0-9]-*.pdf")):
        doc = pymupdf.open(pdf)
        im = illustration(doc)
        if im is None:
            print("pas d’illustration :", pdf.name)
            continue
        num = int(pdf.name[:2])
        composer(im, 430).save(SORTIE / f"historacles-{num}.webp", "WEBP", quality=80, method=6)
        n += 1
    # image de la série : le haut de la couverture (titre gravé), sur toute la largeur
    doc = pymupdf.open(sorted(DOCS.glob("01-*.pdf"))[0])
    couv = fond_couverture(doc)
    if couv is not None:
        titre = couv.crop((0, 0, couv.width, round(couv.width * 0.42)))
        composer(titre, round(L * titre.height / titre.width)).save(
            SORTIE / "serie-historacles.webp", "WEBP", quality=80, method=6)
        n += 1
    print(n, "images ->", SORTIE)


if __name__ == "__main__":
    main()
