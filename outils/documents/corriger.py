"""Corrige quelques mots restés en anglais dans les PDF du site (après l’import).

Usage : python3 outils/documents/corriger.py
Chaque correction remplace une ligne de texte à sa place exacte, dans la même taille de lettres ;
outils/documents/resultat.json est mis à jour (poids des fichiers). Relancer le script ne change rien.
"""
import json
import unicodedata
from pathlib import Path

import pymupdf

RACINE = Path(__file__).resolve().parents[2]
POLICE = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"  # mêmes chasses que Times New Roman
INS = chr(0xA0)  # espace insécable, comme dans le PDF
TUC = chr(0xAD)  # trait d’union conditionnel, employé comme tiret dans le PDF


def ref(texte):
    """Écrit une référence avec les caractères du PDF : « _ » pour l’espace insécable, « ~ » pour le tiret."""
    return texte.replace("_", INS).replace("~", TUC)


# (document, page à partir de 1, ligne d’origine, ligne corrigée)
CORRECTIONS = [
    # tableau des références : le document abrège Genèse en « Ge » et Ésaïe en « És »
    ("quete-certitude/g-sept-ingredients-pour-le-bonheur", 3, ref("Gen_1:29,_2:16"), ref("Ge_1:29,_2:16")),
    ("quete-certitude/g-sept-ingredients-pour-le-bonheur", 3, ref("Gen_2:1~3"), ref("Ge_2:1-3")),
    ("quete-certitude/g-sept-ingredients-pour-le-bonheur", 3, ref("Is_66:22~23"), ref("És_66:22-23")),
    ("quete-certitude/g-sept-ingredients-pour-le-bonheur", 3,
     ref("Rév_21:1~2_;_Isa_11:6~9_;_65:25"), ref("Rév_21:1-2_;_És_11:6-9_;_65:25")),
]


def lignes(page):
    for bloc in page.get_text("dict")["blocks"]:
        for ligne in bloc.get("lines", []):
            if ligne["spans"]:
                # NFC : le PDF écrit parfois « ; » avec le point d’interrogation grec (U+037E)
                yield unicodedata.normalize("NFC", "".join(s["text"] for s in ligne["spans"])), ligne


def main():
    fichier_resultat = Path(__file__).resolve().parent / "resultat.json"
    resultat = json.load(open(fichier_resultat, encoding="utf-8"))
    par_doc = {}
    for chemin, page, ancien, nouveau in CORRECTIONS:
        par_doc.setdefault(chemin, []).append((page, ancien, nouveau))
    for chemin, liste in par_doc.items():
        if resultat.get(chemin, {}).get("source") == "refonte":
            print(chemin, ": refait sur l’original anglais, rien à corriger")
            continue
        pdf = RACINE / "documents" / f"{chemin}.pdf"
        doc = pymupdf.open(pdf)
        faites = deja = 0
        for numero, ancien, nouveau in liste:
            page = doc[numero - 1]
            textes = [t for t, _ in lignes(page)]
            if ancien not in textes:
                if nouveau in textes:
                    deja += 1
                continue
            ligne = next(l for t, l in lignes(page) if t == ancien)
            premier = ligne["spans"][0]
            page.add_redact_annot(pymupdf.Rect(ligne["bbox"]), fill=False)
            page.apply_redactions(images=pymupdf.PDF_REDACT_IMAGE_NONE, graphics=pymupdf.PDF_REDACT_LINE_ART_NONE)
            page.insert_text(premier["origin"], nouveau, fontsize=premier["size"],
                             fontname="liberation-serif", fontfile=POLICE, color=(0, 0, 0))
            faites += 1
        if faites + deja != len(liste):
            raise SystemExit(f"{chemin} : texte d’origine introuvable ({faites + deja} sur {len(liste)})")
        if not faites:
            print(chemin, ": déjà corrigé")
            continue
        temporaire = pdf.with_suffix(".tmp.pdf")
        doc.save(temporaire, garbage=3, deflate=True)
        doc.close()
        temporaire.replace(pdf)
        resultat[chemin]["octets"] = pdf.stat().st_size
        resultat[chemin]["corrections"] = len(liste)
        print(chemin, ":", faites, "correction(s)")
    fichier_resultat.write_text(json.dumps(resultat, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
