"""Pages de partage : un lien qui montre un aperçu (titre, phrase, image) dans WhatsApp, Messenger, Facebook.

Le site s’ouvre par des adresses en « #/… », que les aperçus de liens ne lisent pas. Chaque série et chaque
document reçoit donc une petite page fixe, avec ses balises og: et son image, qui renvoie aussitôt au site :

    p/<série>.html          ->  /#/serie/<série>       image p/img/<série>.jpg
    p/<série>/<doc>.html    ->  /#/lire/<série>/<doc>  image p/img/<série>/<doc>.jpg (celle du short de l’étude),
                                                       sinon celle de la série
    p/inviter.html          ->  /                      image p/img/inviter.jpg

La page renvoie au site par un script (sans « meta refresh » : l’aperçu de Facebook le suivrait jusqu’à
l’accueil et prendrait son titre). Les images (1200 × 630) reprennent la peinture du short, ou la photo de la série, avec la phrase de l’étude.
Lancer après outils/shorts/construire_shorts.py et outils/generer_bibliotheque.py :
    python3 outils/partage/construire_partage.py          (ne refait que les images qui manquent)
    python3 outils/partage/construire_partage.py --tout   (refait toutes les images)
"""
import html
import io
import json
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont

RACINE = Path(__file__).resolve().parents[2]
SITE = "https://mission.ka-ilei.com"
SORTIE = RACINE / "p"
L, H = 1200, 630


def lire_js(chemin):
    t = chemin.read_text(encoding="utf-8")
    return json.loads(t[t.index("{"):t.rindex("}") + 1])


def polices():
    """Les polices du site (woff2) converties pour Pillow, dans un dossier temporaire."""
    dossier = Path(tempfile.mkdtemp(prefix="polices-"))
    sortie = {}
    for nom in ["alegreya-latin-600-normal", "atkinson-hyperlegible-latin-400-normal", "atkinson-hyperlegible-latin-700-normal"]:
        t = TTFont(RACINE / "assets/fonts" / f"{nom}.woff2")
        t.flavor = None
        t.save(dossier / f"{nom}.ttf")
        sortie[nom] = str(dossier / f"{nom}.ttf")
    return dossier, sortie


def insecables(t):
    for c in ":;?!»":
        t = t.replace(" " + c, " " + c)
    return t.replace("« ", "« ")


def couper(d, texte, police, largeur):
    lignes = []
    for para in texte.split("\n"):
        ligne = ""
        for mot in para.split(" "):
            essai = f"{ligne} {mot}" if ligne else mot
            if ligne and d.textlength(essai, font=police) > largeur:
                lignes.append(ligne)
                ligne = mot
            else:
                ligne = essai
        lignes.append(ligne)
    return lignes


def fond(chemin, focus_y=0.38):
    """La photo, recadrée pour remplir 1200 × 630, et assombrie à gauche pour le texte."""
    if chemin and chemin.exists():
        im = Image.open(chemin).convert("RGB")
        k = max(L / im.width, H / im.height)
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        x = (im.width - L) // 2
        y = int(min(max(0, im.height * focus_y - H / 2), im.height - H))
        im = im.crop((x, y, x + L, y + H))
    else:
        im = Image.new("RGB", (L, H), (30, 61, 58))
    a = np.asarray(im).astype(np.float32)
    xs = np.linspace(0, 1, L)[None, :, None]
    ys = np.linspace(0, 1, H)[:, None, None]
    voile = np.clip(0.95 - 0.95 * np.clip((xs - 0.38) / 0.55, 0, 1) ** 0.9, 0.18, 0.95)
    voile = np.maximum(voile, 0.55 * np.clip((ys - 0.72) / 0.28, 0, 1))
    teinte = np.array([10, 26, 24], np.float32)
    a = a * (1 - voile) + teinte * voile
    return Image.fromarray(a.astype(np.uint8))


def image_partage(sortie, photo, haut, phrase, ref, P, focus_y=0.38):
    im = fond(photo, focus_y)
    d = ImageDraw.Draw(im)
    x, largeur = 70, 640
    petite = ImageFont.truetype(P["atkinson-hyperlegible-latin-700-normal"], 26)
    marque = ImageFont.truetype(P["atkinson-hyperlegible-latin-400-normal"], 24)
    marque_g = ImageFont.truetype(P["atkinson-hyperlegible-latin-700-normal"], 24)
    refp = ImageFont.truetype(P["atkinson-hyperlegible-latin-700-normal"], 29)
    phrase = insecables(phrase)
    for taille in range(60, 33, -2):
        grande = ImageFont.truetype(P["alegreya-latin-600-normal"], taille)
        lignes = couper(d, phrase, grande, largeur)
        if len(lignes) <= (4 if taille > 44 else 6):
            break
    pas = round(taille * 1.17)
    haut_l = couper(d, insecables(haut), petite, largeur)[:2]
    total = len(haut_l) * 36 + 26 + len(lignes) * pas + (54 if ref else 0)
    y = max(56, (H - 70 - total) // 2)
    for t in haut_l:
        d.text((x, y), t, font=petite, fill=(207, 231, 223))
        y += 36
    y += 26
    for t in lignes:
        d.text((x, y), t, font=grande, fill=(255, 255, 255))
        y += pas
    if ref:
        d.text((x, y + 18), insecables(ref), font=refp, fill=(240, 194, 75))
    d.text((x, H - 62), "Mission", font=marque_g, fill=(255, 255, 255))
    d.text((x + d.textlength("Mission  ", font=marque_g), H - 62), "mission.ka-ilei.com", font=marque, fill=(214, 226, 222))
    sortie.parent.mkdir(parents=True, exist_ok=True)
    im.save(sortie, "JPEG", quality=80, optimize=True, progressive=True)


def page(chemin, titre, description, image, adresse_site, lien_page):
    e = lambda s: html.escape(s, quote=True)
    chemin.parent.mkdir(parents=True, exist_ok=True)
    chemin.write_text(f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titre)}</title>
<meta name="description" content="{e(description)}">
<meta property="og:site_name" content="Mission">
<meta property="og:type" content="article">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="{e(titre)}">
<meta property="og:description" content="{e(description)}">
<meta property="og:url" content="{e(lien_page)}">
<meta property="og:image" content="{e(image)}">
<meta property="og:image:width" content="{L}">
<meta property="og:image:height" content="{H}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1E3D3A">
<link rel="icon" href="/assets/icones/favicon.svg" type="image/svg+xml">
<script>location.replace({json.dumps(adresse_site)});</script>
</head>
<body>
<p><a href="{e(adresse_site)}">{e(titre)}</a></p>
</body>
</html>
""", encoding="utf-8")


def main():
    tout = "--tout" in sys.argv
    B = lire_js(RACINE / "donnees/bibliotheque.js")
    shorts = {x["f"]: x for x in json.loads((RACINE / "donnees/shorts.json").read_text(encoding="utf-8"))["shorts"]}
    niveaux = {n["id"]: n for n in B["niveaux"]}
    dossier, P = polices()
    faites = 0
    pages = 0
    try:
        def img(nom_jpg, *args, **kw):
            nonlocal faites
            sortie = SORTIE / "img" / nom_jpg
            if tout or not sortie.exists():
                image_partage(sortie, *args, P, **kw)
                faites += 1
            return f"{SITE}/p/img/{nom_jpg}"

        for s in B["series"]:
            n = niveaux[s["niveau"]]
            photo = RACINE / "assets/images" / f"{s['image']}.webp" if s.get("image") else None
            nb = len(s["lecons"])
            compte = f"{nb} études" if nb > 1 else ("Une étude" if nb else "Documents pour l’animateur")
            image_s = img(f"{s['id']}.jpg", photo, f"Étape {n['num']} · {n['verbe']}", s["titre"], compte, focus_y=0.5)
            page(SORTIE / f"{s['id']}.html", f"{s['titre']} — Mission", s["texte"], image_s,
                 f"/#/serie/{s['id']}", f"{SITE}/p/{s['id']}.html")
            pages += 1
            docs = []
            for l in s["lecons"]:
                for d in l["docs"]:
                    docs.append((d, l, None))
                for j in l.get("jours") or []:
                    for d in j["docs"]:
                        docs.append((d, l, j))
            for d in s["ressources"]:
                docs.append((d, None, None))
            for d, l, j in docs:
                f = d.get("f")
                if not f:
                    continue
                if j:
                    titre = f"{j['nom']}{' : ' + j['titre'] if j.get('titre') else ''} — semaine {l['num']}, {l['titre']}"
                elif l:
                    titre = (f"Étude {l['num']} · " if l.get("num") else "") + l["titre"]
                    if len(l["docs"]) > 1:
                        titre += f" ({d['libelle'].lower()})"
                else:
                    titre = d.get("titre") or s["titre"]
                x = shorts.get(f)
                if x:
                    peinture = RACINE / "assets/images/shorts" / f"{x['p']}.webp" if x.get("p") else None
                    if not (peinture and peinture.exists()):
                        nom = (l or {}).get("image") or s.get("image")
                        peinture = RACINE / "assets/images" / f"{nom}.webp" if nom else None
                    haut = s["titre"] + (f" · étude {l['num']}" if l and l.get("num") else "")
                    image_d = img(f"{f}.jpg", peinture, haut, x["i"], x["r"])
                    description = f"{x['i']} {x['r']}"
                else:
                    image_d = image_s
                    description = s["texte"]
                page(SORTIE / f"{f}.html", f"{titre} — {s['titre']}", description, image_d, f"/#/lire/{f}", f"{SITE}/p/{f}.html")
                pages += 1

        # la page « Inviter un ami » : le site entier
        image_i = img("inviter.jpg", RACINE / "assets/images/niveau-connaitre.webp", "Mission · études bibliques",
                      "Des études bibliques à lire sur son téléphone, seul ou en petit groupe.", "Rencontrer, grandir, mûrir en Jésus-Christ",
                      focus_y=0.5)
        page(SORTIE / "inviter.html", "Mission — études bibliques pour les petits groupes",
             "Rencontrer, grandir, mûrir en Jésus-Christ : des études bibliques en français, à lire sur téléphone ou sur ordinateur.",
             image_i, "/", f"{SITE}/p/inviter.html")
        pages += 1
    finally:
        shutil.rmtree(dossier, ignore_errors=True)
    print(f"{pages} pages, {faites} images refaites")


if __name__ == "__main__":
    main()
