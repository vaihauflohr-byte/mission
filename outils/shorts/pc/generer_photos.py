# -*- coding: utf-8 -*-
"""Photos des shorts de mission.ka-ilei.com, faites depuis ce PC avec ta clé fal.ai.

Double-clique « Lancer les photos des shorts.bat » : ce script lit demandes.json (préparé par
Claude), demande chaque photo à fal.ai et l'enregistre dans le dossier « photos », à côté.
Le compte rendu va dans resultats.json.

La clé est lue dans « fal.ai Key.txt », dans ce dossier puis sur le bureau (la variable FAL_KEY du PC
seulement à défaut) :
elle n'est envoyée qu'à fal.ai et n'est écrite nulle part ailleurs. Si le fichier contient autre chose
que la clé seule (une étiquette, l'identifiant et le secret sur deux lignes…), les formes possibles sont
essayées tour à tour sur la première photo ; un refus de fal.ai ne coûte rien.
Une photo déjà faite n'est pas refaite, sauf si demandes.json la marque « refaire ».
Python seul suffit : aucun module à installer.
"""
import concurrent.futures as cf
import json
import os
import re
import time
import urllib.error
import urllib.request
from pathlib import Path

ICI = Path(__file__).resolve().parent
PHOTOS = ICI / "photos"
DEMANDES = ICI / "demandes.json"
RESULTATS = ICI / "resultats.json"
NOMS_CLE = ("fal.ai Key.txt", "fal.ai key.txt", "fal.ai Key.txt.txt", "fal key.txt")
PRIX = 0.025  # $ par photo de moins d'un mégapixel avec fal-ai/flux/dev
SIGNES = r"[A-Za-z0-9_\-]"


class Arret(Exception):
    pass


def fichier_cle():
    """(chemin, texte) du fichier de clé du bureau, ou (None, None)."""
    accueil = Path.home()
    for dossier in (ICI, ICI.parent, accueil / "OneDrive" / "Bureau", accueil / "OneDrive" / "Desktop",
                    accueil / "Desktop"):
        for nom in NOMS_CLE:
            f = dossier / nom
            try:
                if f.is_file():
                    return f, f.read_text(encoding="utf-8-sig", errors="replace")
            except OSError as e:
                print(f"{f} illisible : {e}")
    return None, None


def candidats(texte):
    """Les formes de clé possibles dans le fichier, la plus probable d'abord (« identifiant:secret »)."""
    vus, res = set(), []

    def ajouter(c):
        c = c.strip().strip("\"'`<>")
        if len(c) >= 20 and c not in vus:
            vus.add(c)
            res.append(c)

    lignes = [l.strip() for l in texte.replace("﻿", "").splitlines() if l.strip()]
    valeurs = []
    for l in lignes:
        # « Étiquette : valeur » ou « ETIQUETTE=valeur »
        m = re.match(r"^[^\s:=]{1,30}(?:\s[^\s:=]{1,30}){0,3}\s*(?::\s+|=\s*)(\S+)$", l)
        valeurs.append(m.group(1) if m else l)
    for v in valeurs:
        for m in re.finditer(rf"{SIGNES}{{6,}}(?::{SIGNES}{{6,}})+", v):
            morceaux = m.group(0).split(":")
            ajouter(m.group(0))
            if len(morceaux) > 2:
                ajouter(":".join(morceaux[-2:]))
            if not re.search(r"\d", morceaux[0]):  # « etiquette:valeur » collés
                ajouter(":".join(morceaux[1:]))
    simples = [v for v in valeurs if ":" not in v and " " not in v and len(v) >= 6]
    if len(simples) == 2:  # identifiant et secret sur deux lignes
        ajouter(f"{simples[0]}:{simples[1]}")
    for v in valeurs:
        if " " not in v:
            ajouter(v)
    for j in re.split(r"[\s\"'=;,]+", texte):
        ajouter(j)
    return res[:8]


def empreinte(cle):
    """De quoi reconnaître une clé sans l'afficher : ses 4 premiers signes et sa longueur."""
    return f"{cle[:4]}… ({len(cle)} signes)"


def forme(ligne):
    """La forme d'une ligne sans son contenu : lettres et chiffres → x (les 4 premiers signes restent)."""
    return (ligne[:4] + re.sub(r"[A-Za-z0-9]", "x", ligne[4:]))[:110]


def generer(it, cle):
    """(photo demandée, état, détail de l'erreur)"""
    dst = PHOTOS / f"{it['cle']}.jpg"
    modele = it.get("modele", "fal-ai/flux/dev")
    corps = {"prompt": it["prompt"],
             "image_size": {"width": it.get("largeur", 720), "height": it.get("hauteur", 1280)},
             "num_images": 1, "seed": it["graine"], "enable_safety_checker": True, "output_format": "jpeg"}
    if modele == "fal-ai/flux/dev":
        corps.update(num_inference_steps=28, guidance_scale=3.5)
    erreur = ""
    for essai in range(3):
        try:
            req = urllib.request.Request(f"https://fal.run/{modele}", data=json.dumps(corps).encode("utf-8"),
                                         headers={"Authorization": f"Key {cle}",
                                                  "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=240) as rep:
                r = json.load(rep)
            if (r.get("has_nsfw_concepts") or [False])[0]:
                return it, "filtrée par fal.ai", ""
            with urllib.request.urlopen(r["images"][0]["url"], timeout=120) as rep:
                donnees = rep.read()
            provisoire = dst.with_suffix(".part")
            provisoire.write_bytes(donnees)
            provisoire.replace(dst)
            return it, "ok", ""
        except urllib.error.HTTPError as e:
            erreur = f"HTTP {e.code} : {e.read()[:300].decode('utf-8', 'replace')}"
            if e.code == 401:
                return it, "clé refusée", erreur
            if 400 <= e.code < 500 and e.code != 429:
                break  # 403 : crédit épuisé, compte bloqué… ; 422 : demande refusée
        except Exception as e:  # réseau, délai…
            erreur = repr(e)[:300]
        time.sleep(5 * (essai + 1))
    return it, "échec", erreur


def noter(resultats, it, etat, erreur):
    resultats[it["cle"]] = {"etat": etat, "erreur": erreur, "graine": it["graine"],
                            "modele": it.get("modele", "fal-ai/flux/dev"), "prompt": it["prompt"],
                            "quand": time.strftime("%Y-%m-%d %H:%M:%S")}
    RESULTATS.write_text(json.dumps(resultats, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
                         encoding="utf-8")


def main():
    print("Photos des shorts - mission.ka-ilei.com\n")
    demandes = json.loads(DEMANDES.read_text(encoding="utf-8"))["photos"]
    PHOTOS.mkdir(exist_ok=True)
    resultats = json.loads(RESULTATS.read_text(encoding="utf-8")) if RESULTATS.exists() else {}
    def deja_faite(it):
        # « refaire » : une seule fois, avec la nouvelle graine ; une relance ne la refait pas
        note = resultats.get(it["cle"], {})
        if it.get("refaire"):
            return note.get("etat") == "ok" and note.get("graine") == it["graine"]
        return (PHOTOS / f"{it['cle']}.jpg").exists()

    a_faire = [it for it in demandes if not deja_faite(it)]
    if not a_faire:
        print("Rien à faire : toutes les photos demandées sont déjà dans le dossier « photos ».")
        return
    chemin, texte = fichier_cle()
    if chemin:
        essais = candidats(texte)
        print(f"Clé fal.ai lue dans {chemin} ({len(essais)} forme(s) possible(s)).")
    elif os.environ.get("FAL_KEY", "").strip():
        essais = [os.environ["FAL_KEY"].strip()]
        print("Clé fal.ai lue dans la variable FAL_KEY de ce PC.")
    else:
        raise Arret("Clé fal.ai introuvable : pas de « fal.ai Key.txt » sur le bureau.")
    print(f"{len(a_faire)} photo(s) à faire, environ {len(a_faire) * PRIX:.2f} $ chez fal.ai.\n", flush=True)

    # 1re photo : elle sert aussi à trouver la bonne forme de clé (un refus ne coûte rien)
    premiere, cle = a_faire[0], None
    for c in essais:
        it, etat, erreur = generer(premiere, c)
        if etat == "clé refusée":
            print(f"  clé {empreinte(c)} refusée par fal.ai : {erreur[11:120]}")
            continue
        cle = c
        noter(resultats, it, etat, erreur)
        print(f"  clé {empreinte(c)} acceptée.\n\n    1/{len(a_faire)}  {it['cle']:<30} {etat}"
              + (f"  ({erreur})" if erreur else ""), flush=True)
        break
    if not cle:
        print("\nfal.ai refuse la clé. Ce que contient « fal.ai Key.txt » (forme seulement, sans la clé) :")
        for ligne in (texte or "").replace("﻿", "").splitlines():
            if ligne.strip():
                print("   ", forme(ligne.strip()))
        print("\nEnvoie une capture de cette fenêtre à Claude. Ou bien : sur fal.ai/dashboard/keys, crée une"
              "\nnouvelle clé, copie-la en entier (elle contient « : ») et colle-la seule dans « fal.ai Key.txt ».")
        return

    faites = int(resultats[premiere["cle"]]["etat"] == "ok")
    echecs = 1 - faites
    with cf.ThreadPoolExecutor(5) as ex:
        futurs = [ex.submit(generer, it, cle) for it in a_faire[1:]]
        for n, fu in enumerate(cf.as_completed(futurs), 2):
            it, etat, erreur = fu.result()
            faites, echecs = faites + (etat == "ok"), echecs + (etat != "ok")
            noter(resultats, it, etat, erreur)
            print(f"  {n:>3}/{len(a_faire)}  {it['cle']:<30} {etat}" + (f"  ({erreur})" if erreur else ""),
                  flush=True)
    print(f"\nTerminé : {faites} photo(s) faite(s), {echecs} en échec.")
    print("Tu peux fermer cette fenêtre et dire à Claude : « c'est fait ».")


if __name__ == "__main__":
    try:
        main()
    except Arret as e:
        print(f"\n{e}")
    except Exception as e:  # pour lire l'erreur avant que la fenêtre se ferme
        print(f"\nErreur : {e!r}")
