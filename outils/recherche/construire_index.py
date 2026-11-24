"""Index de recherche dans le texte des études (mode lecture).

Pour chaque document de donnees/lecture.js, on lit lecture/<f>.html et on compte ses mots :
minuscules, sans accents, sans les petits mots (« dans », « pour »…). La page Chercher charge
donnees/recherche.json la première fois qu’on cherche, puis le garde hors ligne.

    python3 outils/recherche/construire_index.py

À relancer après chaque conversion de documents (outils/lecture/convertir.py), puis augmenter
VERSION_RECHERCHE dans assets/app.js.

Format : {"docs": [f, …], "mots": {mot: [n° du document, nombre, n°, nombre, …], …}}.
"""
import collections
import gzip
import json
import re
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent

# mots trop courants pour aider à trouver une étude (écrits sans accents)
VIDES = set("""
les des une aux mais donc car que qui quoi dont cet cette ces son ses sur sous leur leurs mon mes ton tes notre nos
votre vos ils elles nous vous lui pas plus moins tres bien tout tous toute toutes est sont etait etaient ete etre
avoir ont avait avaient sera seront fait faire peut doit dans par pour avec sans entre vers chez comme quand comment
pourquoi alors aussi ainsi meme encore deja ici cela ceci celui celle ceux celles quel quelle quels quelles autre autres
elle une ses aux non oui car apres avant puis ceux cet etc lorsque parce selon chaque peu fois fait faits dit dire
""".split())
# parties sans intérêt pour la recherche : crédits, textes réservés aux lecteurs d’écran, réponses
SAUTER = {"lec-credits", "lec-cache"}
MOT = re.compile(r"[^\W_]+")


def normaliser(texte):
    t = unicodedata.normalize("NFD", texte.lower().replace("œ", "oe").replace("æ", "ae"))
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


class Texte(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pile = []  # pour chaque balise ouverte : est-elle à sauter ?
        self.morceaux = []

    def handle_starttag(self, tag, attrs):
        if tag in ("br", "img", "input", "hr", "meta", "link", "source", "wbr"):
            return
        classes = set((dict(attrs).get("class") or "").split())
        self.pile.append(tag in ("script", "style", "textarea") or bool(classes & SAUTER))

    def handle_endtag(self, tag):
        if tag in ("br", "img", "input", "hr", "meta", "link", "source", "wbr"):
            return
        if self.pile:
            self.pile.pop()

    def handle_data(self, data):
        if not any(self.pile):
            self.morceaux.append(data)


def mots_de(chemin):
    p = Texte()
    p.feed(chemin.read_text(encoding="utf-8"))
    compte = collections.Counter()
    for m in MOT.finditer(normaliser(" ".join(p.morceaux))):
        w = m.group()
        if w.isdigit():
            if len(w) >= 3:
                compte[w] += 1
        elif len(w) >= 3 and w not in VIDES:
            compte[w] += 1
    return compte


def main():
    brut = (RACINE / "donnees" / "lecture.js").read_text(encoding="utf-8")
    docs = list(json.loads(brut[brut.index("{"):brut.rstrip().rstrip(";").rindex("}") + 1]))
    mots = collections.defaultdict(list)
    for n, f in enumerate(docs):
        for w, k in sorted(mots_de(RACINE / "lecture" / f"{f}.html").items()):
            mots[w] += [n, k]
    donnees = {"docs": docs, "mots": dict(sorted(mots.items()))}
    sortie = RACINE / "donnees" / "recherche.json"
    texte = json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
    sortie.write_text(texte, encoding="utf-8")
    print(f"{len(docs)} documents, {len(mots)} mots, {len(texte.encode()) // 1024} Ko "
          f"({len(gzip.compress(texte.encode())) // 1024} Ko compressé) -> {sortie.relative_to(RACINE)}")


if __name__ == "__main__":
    main()
