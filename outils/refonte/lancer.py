"""Lance la refonte d'un document décrit dans textes/<nom>.py."""
import importlib.util, json, sys, tempfile
from pathlib import Path
from typo import fr
from refaire import refaire

import chemins  # noqa: E402
ORIG = chemins.ORIGINAUX
nom = sys.argv[1]
spec = importlib.util.spec_from_file_location('t', f'textes/{nom}.py')
t = importlib.util.module_from_spec(spec); spec.loader.exec_module(t)
J = {'ordre': t.ORDRE, 'titre': t.TITRE, 'options': getattr(t, 'OPTIONS', {}),
     'unites': {k: fr(v) for k, v in t.UNITES.items()}}
tmp = Path(tempfile.gettempdir()) / f'{nom}.json'
tmp.write_text(json.dumps(J, ensure_ascii=False), encoding='utf-8')
Path('sortie').mkdir(exist_ok=True)
pb = refaire(str(ORIG / t.ORIGINAL), str(tmp), f'sortie/{nom}.pdf')
print(nom, 'problèmes :', pb if pb else 'aucun')
