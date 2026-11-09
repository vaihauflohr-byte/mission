"""Prépare une police « -c » : la même police sans sa table GSUB.

MuPDF applique mal certaines substitutions (ligatures, formes contextuelles) dans insert_htmlbox ;
les outils de refonte utilisent donc des copies sans GSUB, nommées NOM-c.ttf / NOM-c.otf.

    python3 polices.py SOURCE.ttf [SOURCE.otf …]     -> $REFONTE_POLICES/SOURCE-c.ttf …
(une source .woff / .woff2 est enregistrée en .ttf)
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

import chemins


def sans_gsub(source, dossier=chemins.POLICES):
    source = Path(source)
    police = TTFont(source)
    police.flavor = None                       # woff / woff2 -> sfnt
    if "GSUB" in police:
        del police["GSUB"]
    ext = ".otf" if source.suffix.lower() == ".otf" else ".ttf"
    dest = Path(dossier) / f"{source.stem}-c{ext}"
    police.save(dest)
    return dest


if __name__ == "__main__":
    for s in sys.argv[1:]:
        print(sans_gsub(s))
