"""Remplace les PDF faits avec LibreOffice par ceux exportés avec Word, PowerPoint et Excel.

Les PDF viennent du script Windows outils/documents/windows/convertir.ps1 (lancé sur un PC qui a
Microsoft Office) : un fichier par document, nommé <série>__<nom>.pdf.

Usage : python3 outils/documents/office.py DOSSIER_DES_PDF
Pour chaque PDF : titre français dans les propriétés, poids réduit avec Ghostscript au-delà de 15 Mo
(images à 110 ppp), copie dans documents/<série>/<nom>.pdf, mise à jour de resultat.json.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import pikepdf

RACINE = Path(__file__).resolve().parents[2]
ICI = Path(__file__).resolve().parent
LOURD = 15_000_000


def compresser(src, dest):
    subprocess.run(["gs", "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.7",
                    "-dDetectDuplicateImages=true", "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true",
                    "-dColorImageResolution=110", "-dGrayImageResolution=110",
                    "-dColorImageDownsampleThreshold=1.0", "-dGrayImageDownsampleThreshold=1.0",
                    "-dAutoFilterColorImages=false", "-dColorImageFilter=/DCTEncode",
                    "-dAutoFilterGrayImages=false", "-dGrayImageFilter=/DCTEncode", "-dJPEGQ=75",
                    f"-sOutputFile={dest}", str(src)], check=True, timeout=1800)


def main(dossier):
    dossier = Path(dossier)
    liste = {e["chemin"]: e for e in json.load(open(ICI / "liste.json", encoding="utf-8"))}
    fichier_resultat = ICI / "resultat.json"
    resultat = json.load(open(fichier_resultat, encoding="utf-8"))
    faits, absents = 0, []
    for chemin, e in liste.items():
        if e["source"] == "PDF":
            continue
        pdf = dossier / (chemin.replace("/", "__") + ".pdf")
        if not pdf.exists():
            absents.append(chemin)
            continue
        with tempfile.TemporaryDirectory() as tmp:
            travail = pdf
            if pdf.stat().st_size > LOURD:
                reduit = Path(tmp) / "reduit.pdf"
                compresser(pdf, reduit)
                if reduit.stat().st_size < pdf.stat().st_size:
                    travail = reduit
            dest = RACINE / "documents" / f"{chemin}.pdf"
            with pikepdf.open(travail) as doc:
                with doc.open_metadata(set_pikepdf_as_editor=False) as meta:
                    meta["dc:title"] = e["titre"]
                    meta["dc:description"] = e["sujet"]
                doc.docinfo["/Title"] = e["titre"]
                doc.docinfo["/Subject"] = e["sujet"]
                doc.Root.Lang = pikepdf.String("fr-FR")
                prefs = doc.Root.get("/ViewerPreferences")
                if not isinstance(prefs, pikepdf.Dictionary):
                    prefs = pikepdf.Dictionary()
                prefs.DisplayDocTitle = True
                doc.Root.ViewerPreferences = prefs
                pages = len(doc.pages)
                doc.save(dest)
        r = resultat.setdefault(chemin, {"source": e["source"]})
        r.update({"pages": pages, "octets": dest.stat().st_size, "moteur": "Microsoft Office"})
        r.pop("polices", None)
        r.pop("ghostscript", None)
        faits += 1
        print(f"{chemin} : {pages} p., {dest.stat().st_size / 1e6:.1f} Mo")
    fichier_resultat.write_text(json.dumps(dict(sorted(resultat.items())), ensure_ascii=False, indent=1) + "\n",
                                encoding="utf-8")
    print(f"{faits} PDF remplacés ; manquants : {len(absents)}")
    for a in absents:
        print("   manquant :", a)


if __name__ == "__main__":
    main(sys.argv[1])
