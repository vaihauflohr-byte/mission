"""Génère les images du site avec fal.ai (FLUX dev).

python3 generer_images.py [id ...]
Lit prompts.json (produit à partir de scenes.py) et écrit out/<id>.webp (800 x 600 au plus).
"""
import json, os, sys, time, io, concurrent.futures as cf, urllib.request
from PIL import Image
KEY = open(os.path.expanduser('~/.fal_key')).read().strip()  # clé fal.ai : jamais dans le dépôt
P = json.load(open('prompts.json'))
os.makedirs('out', exist_ok=True)
def gen(it):
    dst = f"out/{it['id']}.webp"
    if os.path.exists(dst):
        return it['id'], 'deja'
    body = json.dumps({"prompt": it['prompt'], "image_size": "landscape_4_3", "num_inference_steps": 28,
                       "guidance_scale": 3.5, "num_images": 1, "enable_safety_checker": True,
                       "output_format": "jpeg"}).encode()
    err = ''
    for essai in range(3):
        try:
            req = urllib.request.Request("https://fal.run/fal-ai/flux/dev", data=body,
                                         headers={"Authorization": "Key " + KEY, "Content-Type": "application/json"})
            r = json.load(urllib.request.urlopen(req, timeout=180))
            if (r.get("has_nsfw_concepts") or [False])[0]:
                return it['id'], 'FILTRE'
            url = r["images"][0]["url"]
            img = Image.open(io.BytesIO(urllib.request.urlopen(url, timeout=120).read())).convert("RGB")
            img.thumbnail((800, 600))
            img.save(dst, "WEBP", quality=74, method=6)
            return it['id'], 'ok'
        except Exception as e:
            err = repr(e)[:200]
            time.sleep(3 * (essai + 1))
    return it['id'], 'ECHEC ' + err
ids = sys.argv[1:]
items = [i for i in P['images'] if not ids or i['id'] in ids]
with cf.ThreadPoolExecutor(6) as ex:
    for id_, st in ex.map(gen, items):
        print(id_, st, flush=True)
print('FIN', flush=True)
