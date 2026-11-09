"""Emplacements utilisés par les outils de refonte.

Les originaux anglais et les polices restent hors du dépôt : leurs dossiers se règlent par
variables d'environnement (valeurs par défaut : l'espace de travail où les documents ont été refaits).
    REFONTE_ORIGINAUX   PDF anglais d'origine, rangés par série (quete-certitude/, prendre-vie/…)
    REFONTE_POLICES     polices « -c » (voir LISEZMOI.md) et polices libres d'appoint
    REFONTE_OCR_CACHE   texte OCR des livrets anglais numérisés (ocr_lot.py), lu par sfc.py
"""
import os
from pathlib import Path

ICI = Path(__file__).resolve().parent              # outils/refonte
MISSION = ICI.parents[1]                           # racine du dépôt du site
DOCUMENTS = MISSION / "documents"
TEXTES = ICI / "textes"
SORTIE = ICI / "sortie"

ORIGINAUX = Path(os.environ.get("REFONTE_ORIGINAUX", "/home/claude/mission-work/originaux/sortie/pdf"))
POLICES = Path(os.environ.get("REFONTE_POLICES", "/home/claude/mission-work/polices/ttf"))
# texte OCR des livrets anglais numérisés (ocr_lot.py), utilisé par sfc.py : dérivé des originaux, hors du dépôt
OCR_CACHE = Path(os.environ.get("REFONTE_OCR_CACHE", "/home/claude/mission-work/refonte/ocr-cache"))

# polices libres installées par le système (paquets Debian fonts-crosextra-caladea, fonts-liberation,
# fonts-adf-gillius, fonts-ebgaramond, fonts-dejavu)
CALADEA = Path("/usr/share/fonts/truetype/crosextra")
LIBERATION = Path("/usr/share/fonts/truetype/liberation")
SYSTEME = [Path(d) for d in ("/usr/share/fonts/truetype/adf", "/usr/share/fonts/opentype/ebgaramond",
                             "/usr/share/fonts/truetype/dejavu")]
