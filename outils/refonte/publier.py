"""Publie sur le site des documents refaits sur la mise en page d'origine (natif.py, sfc.py).

    python3 publier.py sfc 1 2 … 30 a b c d f g      « En quête de certitude »
    python3 publier.py pv 1 2 … 7                     « Prendre vie avec Jésus »

Copie outils/refonte/sortie/<préfixe>-NN.pdf à la place du PDF du site (même nom de fichier, mêmes liens),
avec les propriétés posées comme par outils/documents/importer.py (titre, sujet, auteur, langue),
puis met à jour donnees/bibliotheque.js, outils/documents/resultat.json et liste.json
(source « refonte » : importer.py et corriger.py ne touchent plus à ces documents).
"""
import json
import sys
from pathlib import Path

import pikepdf

import chemins  # noqa: E402

MISSION = chemins.MISSION
REFONTE = chemins.ICI

SERIES = {
    "sfc": {"id": "quete-certitude", "prefixe": "sfc",
            "sujet": "En quête de certitude — Mission, études bibliques pour les petits groupes",
            "auteur": "It Is Written — traduction française"},
    "pv": {"id": "prendre-vie", "prefixe": "pv",
           "sujet": "Prendre vie avec Jésus — Mission, études bibliques pour les petits groupes",
           "auteur": "PAPSDA — traduction française"},
    "vj": {"id": "vivre-avec-jesus", "prefixe": "vj",
           "sujet": "Vivre avec Jésus — Mission, études bibliques pour les petits groupes",
           "auteur": "PAPSDA — traduction française"},
}


def charger_js(chemin):
    texte = chemin.read_text(encoding="utf-8")
    tete, corps = texte.split("window.BIBLIO = ", 1)
    donnees = json.loads(corps.rstrip().rstrip(";"))
    assert ecrire_js(tete, donnees) == texte, "format du catalogue inattendu"
    return tete, donnees


def ecrire_js(tete, donnees):
    return tete + "window.BIBLIO = " + json.dumps(donnees, ensure_ascii=False, indent=1) + ";\n"


def json_site(objet):
    return json.dumps(objet, ensure_ascii=False, indent=1) + "\n"


def finaliser(src, dest, titre, sujet, auteur):
    with pikepdf.open(src) as pdf:
        with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
            meta["dc:title"] = titre
            meta["dc:description"] = sujet
            meta["dc:creator"] = [auteur]
        pdf.docinfo["/Title"] = titre
        pdf.docinfo["/Subject"] = sujet
        pdf.docinfo["/Author"] = auteur
        pdf.Root.Lang = pikepdf.String("fr-FR")
        preferences = pdf.Root.get("/ViewerPreferences")
        if not isinstance(preferences, pikepdf.Dictionary):
            preferences = pikepdf.Dictionary()
        preferences.DisplayDocTitle = True
        pdf.Root.ViewerPreferences = preferences
        pdf.save(dest, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
        return len(pdf.pages)


def main(code, numeros):
    S = SERIES[code]
    fichier_js = MISSION / "donnees" / "bibliotheque.js"
    tete, donnees = charger_js(fichier_js)
    fichier_res = MISSION / "outils" / "documents" / "resultat.json"
    resultat = json.loads(fichier_res.read_text(encoding="utf-8"))
    assert json_site(dict(sorted(resultat.items()))) == fichier_res.read_text(encoding="utf-8")
    fichier_liste = MISSION / "outils" / "documents" / "liste.json"
    liste = json.loads(fichier_liste.read_text(encoding="utf-8"))
    assert json_site(liste) == fichier_liste.read_text(encoding="utf-8")
    par_chemin = {e["chemin"]: e for e in liste}

    serie = next(s for s in donnees["series"] if s["id"] == S["id"])
    lecons = {le["num"]: le for le in serie["lecons"]}
    changes = {}
    for n in numeros:
        num = str(int(n)) if str(n).isdigit() else str(n).upper()
        nom = f"{S['prefixe']}-{int(n):02d}" if str(n).isdigit() else f"{S['prefixe']}-{str(n).lower()}"
        le = lecons[num]
        (doc,) = le["docs"]
        assert doc["format"] == "PDF"
        texte = json.loads((REFONTE / "textes" / f"{nom}.json").read_text(encoding="utf-8"))
        titre = texte["titre"]
        assert "<" not in titre, titre
        dest = MISSION / "documents" / f"{doc['f']}.pdf"
        assert dest.exists(), dest
        pages = finaliser(REFONTE / "sortie" / f"{nom}.pdf", dest, titre, S["sujet"], texte.get("auteur", S["auteur"]))
        octets = dest.stat().st_size
        if le["titre"] != titre:
            changes[doc["f"]] = (le["titre"], titre)
        le["titre"] = titre
        doc["o"], doc["p"] = octets, pages
        resultat[doc["f"]] = {"source": "refonte", "pages": pages, "octets": octets}
        par_chemin[doc["f"]]["titre"] = titre
        print(f"{nom:>7}  {pages} p.  {octets / 1e3:5.0f} ko  {titre}")

    fichier_js.write_text(ecrire_js(tete, donnees), encoding="utf-8")
    fichier_res.write_text(json_site(dict(sorted(resultat.items()))), encoding="utf-8")
    fichier_liste.write_text(json_site(liste), encoding="utf-8")
    if changes:
        print("\nTitres changés (à reporter dans TITRES_REFAITS de generer_bibliotheque.py) :")
        for chemin, (avant, apres) in changes.items():
            print(f'    "{chemin}": "{apres}",  # {avant}')


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
