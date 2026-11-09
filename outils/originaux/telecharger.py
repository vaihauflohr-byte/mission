"""Tâche temporaire : récupère les originaux anglais des études pour les comparer aux traductions du site.

1. télécharge chaque fichier de outils/originaux/liste.json depuis le Drive (dossiers partagés par lien) ;
2. convertit Word, PowerPoint et Excel en PDF avec LibreOffice (images réduites), pour la comparaison ;
3. range tout dans $SORTIE : pdf/<série>/<nom>.pdf, originaux/<série>/<nom> (fichiers non PDF de moins de 25 Mo)
   et manifeste.json.
L'archive est ensuite chiffrée par la tâche GitHub (clé publique outils/originaux/cle-publique.pem).
"""
import json
import os
import queue
import shutil
import subprocess
import tempfile
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ICI = Path(__file__).resolve().parent
SORTIE = Path(os.environ.get("SORTIE", "/tmp/sortie"))
TRAVAIL = Path(tempfile.gettempdir()) / "originaux-travail"
TRAVAILLEURS = int(os.environ.get("TRAVAILLEURS", "4"))
BUREAUTIQUE = {"doc", "docx", "ppt", "pptx", "xls", "xlsx"}
DIAPOS = {"ppt", "pptx"}
SIGNATURES = (b"%PDF", b"PK\x03\x04", b"\xd0\xcf\x11\xe0", b"\xff\xd8\xff", b"\x89PNG")
GARDER_MAX = 25_000_000
TROP_GROS = 40_000_000

profils = queue.Queue()


def journal(*args):
    print(time.strftime("%H:%M:%S"), *args, flush=True)


def telecharger(ident, dest):
    url = f"https://drive.usercontent.google.com/download?id={ident}&export=download&confirm=t"
    erreur = None
    for essai in range(5):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (comparaison mission.ka-ilei.com)"})
            with urllib.request.urlopen(req, timeout=600) as r, open(dest, "wb") as f:
                shutil.copyfileobj(r, f, 1 << 20)
            debut = open(dest, "rb").read(8)
            if debut.startswith(SIGNATURES):
                return
            erreur = "réponse inattendue : " + open(dest, "rb").read(200).decode("latin1", "replace")
        except Exception as e:
            erreur = repr(e)
        time.sleep(10 * (essai + 1))
    raise RuntimeError(f"téléchargement impossible : {erreur}")


def libreoffice(src, dossier, diapos):
    resolution, qualite = (100, 70) if diapos else (150, 80)
    options = {
        "ReduceImageResolution": {"type": "boolean", "value": "true"},
        "MaxImageResolution": {"type": "long", "value": str(resolution)},
        "Quality": {"type": "long", "value": str(qualite)},
        "UseLosslessCompression": {"type": "boolean", "value": "false"},
        "ExportNotes": {"type": "boolean", "value": "false"},
        "ExportHiddenSlides": {"type": "boolean", "value": "false"},
        "EmbedStandardFonts": {"type": "boolean", "value": "true"},
    }
    filtre = "impress_pdf_Export" if diapos else ("calc_pdf_Export" if src.suffix.lower().startswith(".xls")
                                                  else "writer_pdf_Export")
    profil = profils.get()
    try:
        cmd = ["soffice", f"-env:UserInstallation=file://{profil}", "--headless", "--invisible", "--nologo",
               "--norestore", "--nolockcheck", "--nodefault",
               "--convert-to", f"pdf:{filtre}:" + json.dumps(options, separators=(",", ":")),
               "--outdir", str(dossier), str(src)]
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=2400)
    finally:
        profils.put(profil)
    pdf = dossier / (src.stem + ".pdf")
    if not pdf.exists():
        raise RuntimeError(f"pas de PDF : {p.stdout[-300:]} {p.stderr[-300:]}")
    return pdf


def ghostscript(src, dest):
    subprocess.run(["gs", "-q", "-dNOPAUSE", "-dBATCH", "-dSAFER", "-sDEVICE=pdfwrite",
                    "-dDetectDuplicateImages=true", "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true",
                    "-dColorImageResolution=90", "-dGrayImageResolution=90",
                    "-dColorImageDownsampleThreshold=1.0", "-dGrayImageDownsampleThreshold=1.0",
                    "-dAutoFilterColorImages=false", "-dColorImageFilter=/DCTEncode",
                    "-dAutoFilterGrayImages=false", "-dGrayImageFilter=/DCTEncode", "-dJPEGQ=65",
                    f"-sOutputFile={dest}", str(src)], check=True, timeout=2400)


def traiter(e):
    debut = time.time()
    nom = Path(e["nom"])
    dossier = TRAVAIL / e["id"]
    dossier.mkdir(parents=True, exist_ok=True)
    brut = dossier / nom.name
    telecharger(e["id"], brut)
    r = {"octets": brut.stat().st_size}
    if e["ext"] == "pdf":
        dest = SORTIE / "pdf" / e["serie"] / nom
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(brut, dest)
        r["pdf"] = str(dest.relative_to(SORTIE))
    else:
        if brut.stat().st_size <= GARDER_MAX:
            garde = SORTIE / "originaux" / e["serie"] / nom
            garde.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(brut, garde)
            r["original"] = str(garde.relative_to(SORTIE))
        if e["ext"] in BUREAUTIQUE:
            sortie = dossier / "pdf"
            sortie.mkdir(exist_ok=True)
            pdf = libreoffice(brut, sortie, e["ext"] in DIAPOS)
            if pdf.stat().st_size > TROP_GROS:
                reduit = dossier / "reduit.pdf"
                ghostscript(pdf, reduit)
                pdf = reduit
            dest = SORTIE / "pdf" / e["serie"] / nom.with_name(nom.name + ".pdf")
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(pdf, dest)
            r["pdf"] = str(dest.relative_to(SORTIE))
    r["secondes"] = round(time.time() - debut, 1)
    shutil.rmtree(dossier, ignore_errors=True)
    return r


def main():
    liste = json.load(open(ICI / "liste.json", encoding="utf-8"))
    liste.sort(key=lambda e: -e["taille"])  # les gros d'abord
    SORTIE.mkdir(parents=True, exist_ok=True)
    for i in range(TRAVAILLEURS):
        p = TRAVAIL / f"profil-{i}"
        p.mkdir(parents=True, exist_ok=True)
        profils.put(p)
    manifeste = {}

    def tache(e):
        try:
            r = traiter(e)
            journal("ok", e["serie"], e["nom"], f"{r['octets'] / 1e6:.1f} Mo", f"{r['secondes']} s")
        except Exception as ex:
            r = {"erreur": repr(ex)[:800]}
            journal("ERREUR", e["serie"], e["nom"], r["erreur"][:300])
        r.update(serie=e["serie"], nom=e["nom"], id=e["id"], ext=e["ext"])
        return e["id"], r

    with ThreadPoolExecutor(TRAVAILLEURS) as ex:
        for ident, r in ex.map(tache, liste):
            manifeste[ident] = r
    (SORTIE / "manifeste.json").write_text(json.dumps(manifeste, ensure_ascii=False, indent=1), encoding="utf-8")
    erreurs = sum(1 for r in manifeste.values() if "erreur" in r)
    journal(f"{len(manifeste)} fichiers, {erreurs} erreur(s)")


if __name__ == "__main__":
    main()
