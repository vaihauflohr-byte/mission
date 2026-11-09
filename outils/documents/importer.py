"""Importe les documents des études dans le site, en PDF (documents/<série>/<nom>.pdf).

Lancé une fois par la tâche GitHub « Importer les documents » (.github/workflows/importer-documents.yml) :
  1. télécharge chaque fichier de outils/documents/liste.json depuis le Drive (dossiers partagés par lien) ;
  2. convertit Word, PowerPoint et Excel en PDF avec LibreOffice (polices de remplacement : polices.conf),
     les images réduites pour la lecture sur téléphone ;
  3. met le titre français dans les propriétés de chaque PDF ;
  4. garde à part les PowerPoint d’origine (pour projeter avec les animations) et le tableau Excel.

Usage : python3 outils/documents/importer.py [--source DOSSIER] [--seulement CHEMIN...]
  --source : prend les fichiers dans DOSSIER/<id>.<ext> au lieu du Drive (essais).
Résultat : documents/…, outils/documents/resultat.json, $ORIGINAUX (PowerPoint d’origine).
"""
import argparse
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pikepdf

RACINE = Path(__file__).resolve().parents[2]
ICI = Path(__file__).resolve().parent
DOCUMENTS = Path(os.environ.get("DOCUMENTS", RACINE / "documents"))
ORIGINAUX = Path(os.environ.get("ORIGINAUX", "/tmp/originaux"))
TRAVAIL = Path(os.environ.get("TRAVAIL", tempfile.gettempdir())) / "import-documents"
EXT = {"PDF": "pdf", "Word": "docx", "PowerPoint": "pptx", "Excel": "xlsx"}
FILTRE = {"Word": "writer_pdf_Export", "PowerPoint": "impress_pdf_Export", "Excel": "calc_pdf_Export"}
# images : 120 ppp pour les diapositives (lecture sur écran), 150 ppp pour les fiches (impression)
IMAGES = {"Word": (150, 80), "PowerPoint": (120, 75), "Excel": (150, 80)}
TROP_GROS = 45_000_000  # au-delà, nouvelle compression avec Ghostscript (GitHub refuse 100 Mo)
FEUILLES_MASQUEES = {"Formules", "Présentation"}  # feuilles techniques du tableau Excel
TRAVAILLEURS = int(os.environ.get("TRAVAILLEURS", "4"))

profils = queue.Queue()


def journal(*args):
    print(time.strftime("%H:%M:%S"), *args, flush=True)


def telecharger(ident, dest):
    url = f"https://drive.usercontent.google.com/download?id={ident}&export=download&confirm=t"
    erreur = None
    for essai in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (import mission.ka-ilei.com)"})
            with urllib.request.urlopen(req, timeout=300) as r, open(dest, "wb") as sortie:
                shutil.copyfileobj(r, sortie, 1 << 20)
            debut = open(dest, "rb").read(5)
            if debut.startswith(b"%PDF") or debut.startswith(b"PK"):
                return
            erreur = "réponse inattendue : " + open(dest, "rb").read(200).decode("latin1", "replace")
        except Exception as e:  # réseau, quota…
            erreur = repr(e)
        time.sleep(10 * (essai + 1))
    raise RuntimeError(f"téléchargement impossible : {erreur}")


def accepter_revisions(src, dest):
    """Word : accepte les modifications suivies (sinon LibreOffice les montre soulignées)."""
    with zipfile.ZipFile(src) as zi, zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zo:
        for item in zi.infolist():
            data = zi.read(item.filename)
            if item.filename.startswith("word/") and item.filename.endswith(".xml"):
                x = data.decode("utf-8")
                y = re.sub(r"<w:ins\b[^>]*/>", "", x)
                y = re.sub(r"<w:ins\b[^>]*>", "", y).replace("</w:ins>", "")
                y = re.sub(r"<w:del\b[^>]*/>", "", y)
                y = re.sub(r"<w:del\b[^>]*>.*?</w:del>", "", y, flags=re.S)
                if y != x:
                    data = y.encode("utf-8")
            zo.writestr(item, data)


def masquer_feuilles(src, dest):
    """Excel : n’imprime pas les feuilles techniques (formules, description du classeur)."""
    with zipfile.ZipFile(src) as zi, zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zo:
        for item in zi.infolist():
            data = zi.read(item.filename)
            if item.filename == "xl/workbook.xml":
                x = data.decode("utf-8")
                feuilles = re.findall(r"<sheet [^>]*/>", x)
                visibles = []
                for i, f in enumerate(feuilles):
                    nom = re.search(r'name="([^"]*)"', f).group(1)
                    if nom in FEUILLES_MASQUEES:
                        g = (re.sub(r'state="[^"]*"', 'state="hidden"', f) if "state=" in f
                             else f.replace("<sheet ", '<sheet state="hidden" ', 1))
                        x = x.replace(f, g)
                    elif 'state="hidden"' not in f and 'state="veryHidden"' not in f:
                        visibles.append(i)
                if visibles:
                    if "activeTab=" in x:
                        x = re.sub(r'activeTab="\d+"', f'activeTab="{visibles[0]}"', x)
                    else:
                        x = x.replace("<workbookView ", f'<workbookView activeTab="{visibles[0]}" ', 1)
                    x = re.sub(r'firstSheet="\d+"', f'firstSheet="{visibles[0]}"', x)
                data = x.encode("utf-8")
            zo.writestr(item, data)


def libreoffice(src, source, dossier):
    resolution, qualite = IMAGES[source]
    options = {
        "ReduceImageResolution": {"type": "boolean", "value": "true"},
        "MaxImageResolution": {"type": "long", "value": str(resolution)},
        "Quality": {"type": "long", "value": str(qualite)},
        "UseLosslessCompression": {"type": "boolean", "value": "false"},
        "UseTaggedPDF": {"type": "boolean", "value": "true"},
        "ExportBookmarks": {"type": "boolean", "value": "true"},
        "ExportNotes": {"type": "boolean", "value": "false"},
        "ExportHiddenSlides": {"type": "boolean", "value": "false"},
        "EmbedStandardFonts": {"type": "boolean", "value": "true"},
    }
    profil = profils.get()
    try:
        cmd = ["soffice", f"-env:UserInstallation=file://{profil}", "--headless", "--invisible", "--nologo",
               "--norestore", "--nolockcheck", "--nodefault",
               "--convert-to", f"pdf:{FILTRE[source]}:" + json.dumps(options, separators=(",", ":")),
               "--outdir", str(dossier), str(src)]
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
    finally:
        profils.put(profil)
    pdf = dossier / (src.stem + ".pdf")
    if not pdf.exists():
        raise RuntimeError(f"LibreOffice n’a pas produit de PDF : {p.stdout[-300:]} {p.stderr[-300:]}")
    return pdf


def ghostscript(src, dest, resolution=100):
    subprocess.run(["gs", "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.7",
                    "-dDetectDuplicateImages=true", "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true",
                    f"-dColorImageResolution={resolution}", f"-dGrayImageResolution={resolution}",
                    "-dColorImageDownsampleThreshold=1.0", "-dGrayImageDownsampleThreshold=1.0",
                    "-dAutoFilterColorImages=false", "-dColorImageFilter=/DCTEncode",
                    "-dAutoFilterGrayImages=false", "-dGrayImageFilter=/DCTEncode", "-dJPEGQ=70",
                    f"-sOutputFile={dest}", str(src)], check=True, timeout=1800)


def finaliser(src, dest, titre, sujet):
    """Titre français dans les propriétés, langue du document ; renvoie le nombre de pages."""
    with pikepdf.open(src) as pdf:
        if pdf.is_encrypted:
            n = len(pdf.pages)
            shutil.copyfile(src, dest)
            return n
        with pdf.open_metadata(set_pikepdf_as_editor=False) as meta:
            meta["dc:title"] = titre
            meta["dc:description"] = sujet
        pdf.docinfo["/Title"] = titre
        pdf.docinfo["/Subject"] = sujet
        pdf.Root.Lang = pikepdf.String("fr-FR")
        preferences = pdf.Root.get("/ViewerPreferences")
        if not isinstance(preferences, pikepdf.Dictionary):
            preferences = pikepdf.Dictionary()
        preferences.DisplayDocTitle = True
        pdf.Root.ViewerPreferences = preferences
        pdf.save(dest)
        return len(pdf.pages)


def polices(pdf):
    try:
        sortie = subprocess.run(["pdffonts", str(pdf)], capture_output=True, text=True, timeout=120).stdout
    except Exception:
        return []
    noms = set()
    for ligne in sortie.splitlines()[2:]:
        if ligne.strip():
            noms.add(re.sub(r"^[A-Z]{6}\+", "", ligne.split()[0]))
    return sorted(noms)


def traiter(entree, source_locale):
    chemin, source = entree["chemin"], entree["source"]
    debut = time.time()
    dossier = TRAVAIL / chemin.replace("/", "--")
    dossier.mkdir(parents=True, exist_ok=True)
    brut = dossier / f"original.{EXT[source]}"
    if source_locale:
        shutil.copyfile(source_locale / f"{entree['id']}.{EXT[source]}", brut)
    else:
        telecharger(entree["id"], brut)
    taille_originale = brut.stat().st_size
    resultat = {"source": source}
    dest = DOCUMENTS / f"{chemin}.pdf"
    dest.parent.mkdir(parents=True, exist_ok=True)
    if source == "PDF":
        pdf = brut
    else:
        a_convertir = dossier / f"{Path(chemin).name}.{EXT[source]}"
        if source == "Word":
            accepter_revisions(brut, a_convertir)
        elif source == "Excel":
            masquer_feuilles(brut, a_convertir)
        else:
            shutil.copyfile(brut, a_convertir)
        sortie = dossier / "pdf"
        sortie.mkdir(exist_ok=True)
        pdf = libreoffice(a_convertir, source, sortie)
        if pdf.stat().st_size > TROP_GROS:
            reduit = dossier / "reduit.pdf"
            ghostscript(pdf, reduit)
            resultat["ghostscript"] = True
            pdf = reduit
        resultat["polices"] = polices(pdf)
    try:
        resultat["pages"] = finaliser(pdf, dest, entree["titre"], entree["sujet"])
    except Exception as e:  # PDF abîmé : copié tel quel
        shutil.copyfile(pdf, dest)
        with pikepdf.open(dest) as p:
            resultat["pages"] = len(p.pages)
        resultat["remarque"] = f"propriétés non modifiées : {e!r}"
    resultat["octets"] = dest.stat().st_size
    if dest.stat().st_size > 95_000_000:
        raise RuntimeError(f"PDF trop gros pour GitHub : {dest.stat().st_size} octets")
    if entree.get("original"):
        nom = entree["original"]
        if source == "PowerPoint":
            ORIGINAUX.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(brut, ORIGINAUX / nom)
        else:
            shutil.copyfile(brut, DOCUMENTS / nom)
        resultat["original"] = {"nom": nom, "octets": taille_originale}
    resultat["secondes"] = round(time.time() - debut, 1)
    shutil.rmtree(dossier, ignore_errors=True)
    return resultat


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, help="dossier local contenant <id>.<ext> (essais)")
    ap.add_argument("--seulement", nargs="*", help="chemins à traiter (par défaut : tous)")
    args = ap.parse_args()
    liste = json.load(open(ICI / "liste.json", encoding="utf-8"))
    if args.seulement:
        liste = [e for e in liste if e["chemin"] in args.seulement]
    # les gros fichiers d’abord, pour finir plus tôt
    ordre = {"PowerPoint": 0, "Excel": 1, "Word": 2, "PDF": 3}
    liste.sort(key=lambda e: ordre[e["source"]])
    TRAVAIL.mkdir(parents=True, exist_ok=True)
    for i in range(TRAVAILLEURS):
        p = TRAVAIL / f"profil-libreoffice-{i}"
        p.mkdir(parents=True, exist_ok=True)
        profils.put(p)
    fichier = Path(os.environ.get("RESULTAT", ICI / "resultat.json"))
    resultats = json.load(open(fichier, encoding="utf-8")) if args.seulement and fichier.exists() else {}
    erreurs = {}

    def tache(entree):
        try:
            r = traiter(entree, args.source)
            journal("ok", entree["chemin"], entree["source"], f"{r['octets'] / 1e6:.1f} Mo", f"{r['pages']} p.",
                    f"{r['secondes']} s")
            return entree["chemin"], r, None
        except Exception as e:
            journal("ERREUR", entree["chemin"], repr(e)[:500])
            return entree["chemin"], None, repr(e)[:1000]

    with ThreadPoolExecutor(TRAVAILLEURS) as ex:
        for chemin, r, err in ex.map(tache, liste):
            if r:
                resultats[chemin] = r
                erreurs.pop(chemin, None)
            else:
                erreurs[chemin] = err
    resultats = dict(sorted(resultats.items()))
    if erreurs:
        resultats["_erreurs"] = erreurs
    fichier.write_text(json.dumps(resultats, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    total = sum(r["octets"] for k, r in resultats.items() if not k.startswith("_"))
    journal(f"{len(resultats) - (1 if erreurs else 0)} documents, {total / 1e6:.0f} Mo, {len(erreurs)} erreur(s)")


if __name__ == "__main__":
    main()
