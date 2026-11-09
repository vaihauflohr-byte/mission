"""Télécharge les photos des étapes (outils/photos/photos.json) en 800 × 600, au format WebP.

Lancé par la tâche GitHub « Photos des étapes » : la photo principale de chaque étape remplace
assets/images/<nom>.webp ; les autres propositions vont dans outils/photos/autres/.
"""
import io
import json
import urllib.request
from pathlib import Path

from PIL import Image

ICI = Path(__file__).resolve().parent
IMAGES = ICI.parent.parent / "assets" / "images"

for p in json.load(open(ICI / "photos.json", encoding="utf-8"))["photos"]:
    url = p["url"] + "?w=1600&h=1200&fit=crop&crop=entropy&fm=jpg&q=90"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (mission.ka-ilei.com)"})
    data = urllib.request.urlopen(req, timeout=120).read()
    im = Image.open(io.BytesIO(data)).convert("RGB")
    im = im.resize((800, 600), Image.LANCZOS)
    dest = (ICI / "autres" if p.get("autre") else IMAGES) / f"{p['nom']}.webp"
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=82, method=6)
    print(p["nom"], im.size, dest.stat().st_size, "octets")
