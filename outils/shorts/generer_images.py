#!/usr/bin/env python3
"""Images des shorts avec fal.ai : outils/shorts/images.txt → assets/images/shorts/<clé>.webp

Une photo verticale (720 × 1280) par short, d’après la scène écrite dans images.txt, elle-même tirée du
verset clé et de l’idée clé du short (shorts.txt). Style des couvertures comme « Vivre avec Jésus » :
photographie douce et symbolique, personnages surtout en silhouette ou par des détails (mains), en couleur
(choix d’Olivier, 27 nov. 2026 ; --teinte pose la bichromie bleue de la couverture). Le sujet est dans le
haut de l’image : le bas reçoit le texte du short. La photo brute est gardée à part (BRUT), pour refaire
les images du site sans fal.ai (--refaire-webp, avec ou sans --teinte).

    FAL_KEY=… python3 outils/shorts/generer_images.py                 # toutes les images qui manquent
    FAL_KEY=… python3 outils/shorts/generer_images.py --essai 8       # un essai : 8 images variées
    FAL_KEY=… python3 outils/shorts/generer_images.py historacles-7   # celles-là seulement
    FAL_KEY=… python3 outils/shorts/generer_images.py --refaire historacles-7 daniel-8
    python3 outils/shorts/generer_images.py --planches                # planches contact pour relire
    python3 outils/shorts/generer_images.py --vignettes               # après construire_shorts.py
    python3 outils/shorts/generer_images.py --refaire-webp            # images du site refaites depuis les photos brutes

Si l’espace de travail ne joint pas fal.run, les photos se font sur un PC (outils/shorts/pc/) :
    python3 outils/shorts/generer_images.py --demandes demandes.json [clés, --essai, --refaire]
    (sur le PC : demandes.json à côté de generer_photos.py, double-clic sur « Lancer les photos des shorts.bat »)
    python3 outils/shorts/generer_images.py --importer <dossier du PC>   # photos/*.jpg + resultats.json

La clé fal.ai vient de FAL_KEY (ou de ~/.fal_key) : jamais dans le dépôt. Le modèle, la graine et la
scène de chaque image sont notés dans outils/shorts/images.json, pour pouvoir refaire la même.
Ensuite : python3 outils/shorts/construire_shorts.py (les shorts prennent leur image), puis monter
VERSION_SHORTS dans assets/app.js.
"""
import argparse
import concurrent.futures as cf
import io
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

RACINE = Path(__file__).resolve().parents[2]
ICI = RACINE / "outils/shorts"
DOSSIER = RACINE / "assets/images/shorts"
JOURNAL = ICI / "images.json"
LARGEUR, HAUTEUR = 720, 1280  # moins d’un mégapixel : fal facture au mégapixel entamé

STYLE = ("Cinematic photograph, soft natural light, gentle haze, shallow depth of field, subtle film grain, "
         "quiet and reverent mood, minimal symbolic composition in the spirit of a Bible study booklet cover. "
         "People mostly seen in silhouette, from behind or through details such as hands, faces not the focus; "
         "for biblical scenes, historically accurate ancient Near Eastern clothing and setting; everyone modestly dressed. "
         "Tall vertical composition: the main subject placed high in the frame, heads and key details in the upper third, "
         "the lower half calm and simple, plain ground, water or soft shadow with nothing important in it. "
         "No text, no letters, no words, no captions, no logos, no watermark.")
# bichromie bleue claire, relevée sur la couverture de « Vivre avec Jésus » : ombres bleu acier, clairs presque blancs
TEINTE = {"black": "#3f5f82", "mid": "#98b1c9", "white": "#f0f4f7", "midpoint": 115}
BRUT = Path.home() / "travail/shorts-brut"  # photos en couleur, hors du dépôt


def teinter(img):
    gris = ImageOps.autocontrast(ImageOps.grayscale(img), cutoff=1)
    return ImageOps.colorize(gris, **TEINTE)
TAHITI = ("Tahitian Polynesian people of today, modestly dressed in t-shirts, shirts and long pareos, "
          "lush green mountains and turquoise lagoon of Tahiti, ")


def lire(fichier):
    """[série] puis « clé | … | … » : {(série, clé): [champs]}"""
    serie, lignes = None, {}
    for n, brut in enumerate((ICI / fichier).read_text(encoding="utf-8").splitlines(), 1):
        ligne = brut.strip()
        if not ligne or ligne == "#" or ligne.startswith("# "):
            continue
        m = re.fullmatch(r"\[([a-z0-9-]+)\]", ligne)
        if m:
            serie = m.group(1)
            continue
        champs = [x.strip() for x in ligne.split("|")]
        if not serie or len(champs) < 2:
            raise SystemExit(f"{fichier}, ligne {n} : « clé | … » attendu")
        if (serie, champs[0]) in lignes:
            raise SystemExit(f"{fichier}, ligne {n} : {serie} {champs[0]} en double")
        lignes[(serie, champs[0])] = champs[1:]
    return lignes


def cle_image(serie, cle):
    """« historacles », « 7 » → historacles-7 ; « #3 » → daniel-3 ; « - » → vers-jesus-1."""
    c = "1" if cle == "-" else cle.lstrip("#")
    return f"{serie}-{c}".lower()


def scenes():
    shorts, images = lire("shorts.txt"), lire("images.txt")
    manque = sorted(set(shorts) - set(images))
    trop = sorted(set(images) - set(shorts))
    if manque or trop:
        raise SystemExit("images.txt ne suit pas shorts.txt :\n"
                         + "".join(f"  sans scène : {s} {c}\n" for s, c in manque)
                         + "".join(f"  scène sans short : {s} {c}\n" for s, c in trop))
    res = []
    for (serie, cle), (scene,) in images.items():
        texte = TAHITI + scene[len("TAHITI:"):].strip() if scene.startswith("TAHITI:") else scene
        res.append({"cle": cle_image(serie, cle), "prompt": f"{texte[0].upper()}{texte[1:]}. {STYLE}"})
    return res


def charger_journal():
    return json.loads(JOURNAL.read_text(encoding="utf-8")) if JOURNAL.exists() else {}


def enregistrer(img, cle, teinte=False):
    """La photo brute à part ; dans le site, la photo en couleur (ou teintée avec --teinte)."""
    if img.size != (LARGEUR, HAUTEUR):
        img = img.resize((LARGEUR, HAUTEUR), Image.LANCZOS)
    BRUT.mkdir(parents=True, exist_ok=True)
    img.save(BRUT / f"{cle}.jpg", quality=92)
    DOSSIER.mkdir(parents=True, exist_ok=True)
    (teinter(img) if teinte else img).save(DOSSIER / f"{cle}.webp", "WEBP", quality=72, method=6)


def importer(dossier, teinte=False):
    """Photos faites sur un PC (outils/shorts/pc/) : <dossier>/photos/<clé>.jpg et <dossier>/resultats.json."""
    dossier = Path(dossier)
    res = json.loads((dossier / "resultats.json").read_text(encoding="utf-8"))
    journal, faites = charger_journal(), []
    for cle, note in sorted(res.items()):
        f = dossier / "photos" / f"{cle}.jpg"
        if note.get("etat") != "ok" or not f.exists():
            continue
        enregistrer(Image.open(f).convert("RGB"), cle, teinte)
        journal[cle] = {"modele": note["modele"], "graine": note["graine"], "prompt": note["prompt"], "teinte": teinte}
        faites.append(cle)
    JOURNAL.write_text(json.dumps(journal, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{len(faites)} photo(s) importée(s) depuis {dossier}")


def generer(it, modele, cle_fal, teinte=False):
    dst = DOSSIER / f"{it['cle']}.webp"
    graine = it.get("graine") or random.randrange(1, 2**31)
    corps = {"prompt": it["prompt"], "image_size": {"width": LARGEUR, "height": HAUTEUR}, "num_images": 1,
             "seed": graine, "enable_safety_checker": True, "output_format": "jpeg"}
    if modele == "fal-ai/flux/dev":
        corps.update(num_inference_steps=28, guidance_scale=3.5)
    erreur = ""
    for essai in range(3):
        try:
            req = urllib.request.Request(f"https://fal.run/{modele}", data=json.dumps(corps).encode(),
                                         headers={"Authorization": f"Key {cle_fal}", "Content-Type": "application/json"})
            r = json.load(urllib.request.urlopen(req, timeout=240))
            if (r.get("has_nsfw_concepts") or [False])[0]:
                return it["cle"], "FILTRÉE (refaire avec une autre scène)", None
            brut = urllib.request.urlopen(r["images"][0]["url"], timeout=120).read()
            enregistrer(Image.open(io.BytesIO(brut)).convert("RGB"), it["cle"], teinte)
            return it["cle"], "ok", {"modele": modele, "graine": graine, "prompt": it["prompt"], "teinte": teinte}
        except urllib.error.HTTPError as e:
            erreur = f"HTTP {e.code} {e.read()[:300]!r}"
            if 400 <= e.code < 500 and e.code != 429:
                break
        except Exception as e:  # réseau, délai…
            erreur = repr(e)[:300]
        time.sleep(4 * (essai + 1))
    return it["cle"], "ÉCHEC " + erreur, None


def planches(dossier_sortie, par_planche=24):
    """Planches contact (6 × 4 vignettes, avec leur clé) pour relire les images."""
    fichiers = sorted(DOSSIER.glob("*.webp"))
    dossier_sortie.mkdir(parents=True, exist_ok=True)
    try:
        police = ImageFont.truetype("DejaVuSans-Bold.ttf", 20)
    except OSError:
        police = ImageFont.load_default()
    l, h, marge = 240, 427, 34
    for p in range(0, len(fichiers), par_planche):
        lot = fichiers[p: p + par_planche]
        feuille = Image.new("RGB", (6 * l, 4 * (h + marge)), "white")
        d = ImageDraw.Draw(feuille)
        for i, f in enumerate(lot):
            x, y = (i % 6) * l, (i // 6) * (h + marge)
            feuille.paste(Image.open(f).convert("RGB").resize((l, h)), (x, y + marge))
            d.text((x + 6, y + 6), f.stem, fill="black", font=police)
        sortie = dossier_sortie / f"planche-{p // par_planche + 1:02d}.jpg"
        feuille.save(sortie, quality=82)
        print(sortie)


def cadrer(img):
    """Le bandeau 4:3 le plus parlant d’une photo verticale : celui où il y a le plus de détails (contours),
    avec une légère préférence pour le haut-milieu, où le sujet est placé."""
    l, h = img.size
    hb = l * 3 // 4
    contours = img.convert("L").resize((l // 4, h // 4)).filter(ImageFilter.FIND_EDGES)
    lignes = [sum(contours.crop((0, y, contours.width, y + 1)).getdata()) for y in range(contours.height)]
    meilleur, haut = -1, 0
    for y in range(0, h - hb + 1, 8):
        a, b = y // 4, (y + hb) // 4
        score = sum(lignes[a:b]) * (1 - 0.35 * abs((y + hb / 2) / h - 0.42))
        if score > meilleur:
            meilleur, haut = score, y
    return img.crop((0, haut, l, haut + hb))


def vignettes():
    """Études sans image (livrets FAST…) : leur vignette, 800 × 600, est découpée dans le haut de l’image de
    leur short, à l’endroit le plus parlant (cadrer). Elle est rangée sous le nom que lui donnerait outils/generer_bibliotheque.py
    (<série>-<numéro>), qui la reprendra donc à la prochaine reconstruction ; donnees/bibliotheque.js est
    complété tout de suite, sans autre changement."""
    shorts = json.loads((RACINE / "donnees/shorts.json").read_text(encoding="utf-8"))["shorts"]
    chemin = RACINE / "donnees/bibliotheque.js"
    t = chemin.read_text(encoding="utf-8")
    i = t.index("{")
    biblio = json.loads(t[i: t.rstrip().rindex(";")])
    series = {s["id"]: s for s in biblio["series"]}
    faites = []
    for x in shorts:
        s = series[x["s"]]
        l = s["lecons"][x["n"]]
        if "p" not in x or l.get("image") or len(s["lecons"]) < 2:
            continue
        nom = f"{s['id']}-{l.get('num') or x['n'] + 1}"
        dst = RACINE / f"assets/images/{nom}.webp"
        if not dst.exists():
            img = Image.open(DOSSIER / f"{x['p']}.webp").convert("RGB")
            cadrer(img).resize((800, 600), Image.LANCZOS).save(dst, "WEBP", quality=72, method=6)
        l["image"] = nom
        faites.append(nom)
    if faites:
        chemin.write_text(t[:i] + json.dumps(biblio, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    print(f"{len(faites)} vignette(s) d’étude tirée(s) des shorts" + (" : monter le ?v= de bibliotheque.js" if faites else ""))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cles", nargs="*", help="clés d’images (ex. historacles-7) ; toutes par défaut")
    ap.add_argument("--modele", default=os.environ.get("FAL_MODELE", "fal-ai/flux/dev"))
    ap.add_argument("--essai", type=int, help="n’en faire que quelques-unes, prises dans des séries différentes")
    ap.add_argument("--refaire", action="store_true", help="refaire les images demandées même si elles existent")
    ap.add_argument("--meme-graine", action="store_true", help="avec --refaire : garder la graine notée")
    ap.add_argument("--planches", nargs="?", const=str(Path.home() / "travail/planches"),
                    help="faire les planches contact (dans ce dossier) au lieu de générer")
    ap.add_argument("--paralleles", type=int, default=4)
    ap.add_argument("--teinte", action="store_true", help="poser la teinte bleue de la couverture (sinon : couleur)")
    ap.add_argument("--refaire-webp", action="store_true",
                    help="refaire les images du site depuis les photos brutes, sans fal.ai")
    ap.add_argument("--demandes", metavar="FICHIER",
                    help="écrire les photos à faire dans ce fichier, pour outils/shorts/pc/, au lieu d’appeler fal.ai")
    ap.add_argument("--importer", metavar="DOSSIER", help="importer les photos faites sur un PC (outils/shorts/pc/)")
    ap.add_argument("--vignettes", action="store_true",
                    help="donner aux études sans image une vignette tirée de leur short (après construire_shorts.py)")
    a = ap.parse_args()
    if a.planches:
        planches(Path(a.planches))
        return
    if a.vignettes:
        vignettes()
        return
    if a.refaire_webp:
        bruts = sorted(BRUT.glob("*.jpg"))
        for f in bruts:
            enregistrer(Image.open(f).convert("RGB"), f.stem, a.teinte)
        print(f"{len(bruts)} image(s) refaite(s) depuis {BRUT}" + (" (teintées)" if a.teinte else ""))
        return
    if a.importer:
        importer(a.importer, a.teinte)
        return
    toutes = scenes()
    par_cle = {it["cle"]: it for it in toutes}
    inconnues = [c for c in a.cles if c not in par_cle]
    if inconnues:
        raise SystemExit(f"clés inconnues : {', '.join(inconnues)}")
    choix = [par_cle[c] for c in a.cles] if a.cles else toutes
    if a.essai:
        vues, lot = set(), []
        for it in choix:
            serie = it["cle"].rsplit("-", 1)[0]
            if serie not in vues:
                vues.add(serie)
                lot.append(it)
        choix = lot[: a.essai]
    journal = charger_journal()
    DOSSIER.mkdir(parents=True, exist_ok=True)
    if not a.refaire:
        choix = [it for it in choix if not (DOSSIER / f"{it['cle']}.webp").exists()]
    elif a.meme_graine:
        choix = [dict(it, graine=journal.get(it["cle"], {}).get("graine")) for it in choix]
    if not choix:
        print("Rien à faire : toutes ces images existent (--refaire pour les refaire).")
        return
    if a.demandes:
        photos = [{"cle": it["cle"], "prompt": it["prompt"], "graine": it.get("graine") or random.randrange(1, 2**31),
                   "modele": a.modele, "largeur": LARGEUR, "hauteur": HAUTEUR, **({"refaire": True} if a.refaire else {})}
                  for it in choix]
        Path(a.demandes).write_text(json.dumps({"photos": photos}, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"{len(photos)} photo(s) demandée(s) dans {a.demandes} (environ {len(photos) * 0.025:.2f} $)")
        return
    fichier_cle = Path.home() / ".fal_key"
    cle_fal = os.environ.get("FAL_KEY") or (fichier_cle.read_text().strip() if fichier_cle.exists() else "")
    if not cle_fal:
        raise SystemExit("Clé fal.ai manquante : FAL_KEY=… python3 outils/shorts/generer_images.py (ou ~/.fal_key)")
    print(f"{len(choix)} image(s) avec {a.modele}, {LARGEUR} × {HAUTEUR}", flush=True)
    echecs = 0
    with cf.ThreadPoolExecutor(a.paralleles) as ex:
        for cle, etat, note in ex.map(lambda it: generer(it, a.modele, cle_fal, a.teinte), choix):
            print(cle, etat, flush=True)
            if note:
                journal[cle] = note
                JOURNAL.write_text(json.dumps(journal, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
                                   encoding="utf-8")
            else:
                echecs += 1
    print(f"fini : {len(choix) - echecs} faite(s), {echecs} en échec")
    sys.exit(1 if echecs else 0)


if __name__ == "__main__":
    main()
