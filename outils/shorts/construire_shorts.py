#!/usr/bin/env python3
"""Shorts des études : outils/shorts/shorts.txt → donnees/shorts.json

Pour chaque étude : l’idée clé, la référence du verset clé et son texte (Segond 1910, donnees/bible/),
et le document ouvert au toucher (#/lire/<f>). Le verset doit être cité dans ce document, et l’idée
doit être une phrase de l’étude, mot pour mot (phrases.py) : le script le vérifie dans le mode lecture
(lecture/<f>.html) et s’arrête sinon.

    python3 outils/shorts/construire_shorts.py

Ensuite, monter VERSION_SHORTS dans assets/app.js.
"""
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from phrases import trouve  # noqa: E402

RACINE = Path(__file__).resolve().parents[2]
SOURCE = RACINE / "outils/shorts/shorts.txt"
SORTIE = RACINE / "donnees/shorts.json"


def liste_js(nom):
    """Un tableau de chaînes de assets/bible.js (NOMS, ANGLAIS) : les mêmes noms que le site."""
    js = (RACINE / "assets/bible.js").read_text(encoding="utf-8")
    corps = re.search(r"const %s = \[(.*?)\];" % nom, js, re.S).group(1)
    return re.findall(r'"([^"]+)"', corps)


NOMS = liste_js("NOMS")
ANGLAIS = liste_js("ANGLAIS")
UN_CHAPITRE = {31, 57, 63, 64, 65}  # Abdias, Philémon, 2 et 3 Jean, Jude
assert len(NOMS) == len(ANGLAIS) == 66


def donnees_js(chemin):
    t = (RACINE / chemin).read_text(encoding="utf-8")
    return json.loads(t[t.index("{"): t.rstrip().rstrip(";").rindex("}") + 1])


def lire_reference(r):
    """« Jean 3:16 », « Marc 2:27-28 », « 3 Jean 4 » → (livre, chapitre, premier, dernier)."""
    m = re.fullmatch(r"(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?", r)
    if not m or m.group(1) not in NOMS:
        raise ValueError(f"référence illisible : {r!r}")
    nom, a, b, c = m.groups()
    livre = NOMS.index(nom) + 1
    if b is None:
        if livre not in UN_CHAPITRE:
            raise ValueError(f"verset manquant : {r!r}")
        return livre, 1, int(a), int(a)
    return livre, int(a), int(b), int(c) if c else int(b)


TITRE_PSAUME = re.compile(r"(Au chef des chantres|Psaume|Cantique|Hymne|Prière|Maskil|Michtam|Louange|De David|"
                          r"Des fils de Koré|D’Asaph|De Salomon|Chant)")


def texte(livre, chap, premier, dernier):
    d = json.loads((RACINE / f"donnees/bible/{livre:02d}.json").read_text(encoding="utf-8"))
    versets = d["chapitres"][chap - 1][premier - 1: dernier]
    if len(versets) != dernier - premier + 1:
        raise ValueError(f"verset absent : {NOMS[livre - 1]} {chap}:{premier}-{dernier}")
    morceaux = []
    for n, v in enumerate(versets, premier):
        lignes = [l.strip() for l in v.split("\n") if l.strip()]
        # titre d’un psaume, rangé dans le verset 1 (numérotation des Bibles anglaises)
        if livre == 19 and n == 1 and len(lignes) > 1 and lignes[0].endswith(".") and TITRE_PSAUME.match(lignes[0]):
            lignes = lignes[1:]
        morceaux.append("\n".join(lignes))
    # poésie : une ligne par vers ; prose : les versets à la suite
    return ("\n" if any("\n" in m for m in morceaux) else " ").join(morceaux)


def couverts(passage):
    """Versets d’un lien BibleGateway (« Psalms 12:7, 8; Matthew 13:3-8, 18-23 ») :
    ({(livre, chapitre, verset)}, {(livre, chapitre) cités en entier})."""
    versets, chapitres = set(), set()
    livre = chap = None
    for part in passage.split(";"):
        part = part.strip()
        for i, nom in sorted(enumerate(ANGLAIS, 1), key=lambda x: -len(x[1])):
            if part.lower().startswith(nom.lower()):
                livre, chap, part = i, None, part[len(nom):].strip()
                break
        if livre is None:
            continue
        for item in part.replace("–", "-").split(","):
            m = re.fullmatch(r"\s*(\d+)(?:\s*:\s*(\d+))?(?:\s*-\s*(\d+)(?:\s*:\s*(\d+))?)?\s*[a-z]?\s*", item)
            if not m:
                continue
            a, b, c, d = (int(x) if x else None for x in m.groups())
            if b is not None:
                chap = a
                if d is not None:  # 4:29-5:19
                    chapitres.update((livre, x) for x in range(a, c + 1))
                else:
                    versets.update((livre, chap, v) for v in range(b, (c or b) + 1))
            elif livre in UN_CHAPITRE:
                versets.update((livre, 1, v) for v in range(a, (c or a) + 1))
            elif chap is None:  # « Daniel 2 », « Matthieu 24-25 »
                chapitres.update((livre, x) for x in range(a, (c or a) + 1))
            else:  # « 13:3-8, 18-23 »
                versets.update((livre, chap, v) for v in range(a, (c or a) + 1))
    return versets, chapitres


def cite(f, livre, chap, premier, dernier):
    page = (RACINE / f"lecture/{f}.html").read_text(encoding="utf-8")
    versets, chapitres = set(), set()
    for href in re.findall(r'<a class="ref" href="([^"]+)"', page):
        q = parse_qs(urlparse(html.unescape(href)).query).get("search", [""])[0]
        v, c = couverts(q)
        versets |= v
        chapitres |= c
    return (livre, chap) in chapitres or all((livre, chap, v) in versets for v in range(premier, dernier + 1))


def lire_source():
    serie, lignes = None, []
    for n, brut in enumerate(SOURCE.read_text(encoding="utf-8").splitlines(), 1):
        ligne = brut.strip()
        if not ligne or ligne == "#" or ligne.startswith("# "):  # « #3 » : 3e étude de la série
            continue
        m = re.fullmatch(r"\[([a-z0-9-]+)\]", ligne)
        if m:
            serie = m.group(1)
            continue
        morceaux = [x.strip() for x in ligne.split("|")]
        if len(morceaux) != 3 or not serie:
            raise SystemExit(f"shorts.txt, ligne {n} : « numéro | verset | idée » attendu")
        lignes.append((n, serie, *morceaux))
    return lignes


def etude(s, cle, lecture):
    """(rang de l’étude dans la série, ses documents en mode lecture) ; rang None si la clé ne mène à rien.
    Clé : « - » pour l’étude unique, « #3 » pour la 3e, sinon le numéro de l’étude."""
    if cle == "-":
        i = next((k for k, l in enumerate(s["lecons"]) if l["docs"]), None)
    elif cle.startswith("#"):
        i = int(cle[1:]) - 1 if cle[1:].isdigit() and 0 < int(cle[1:]) <= len(s["lecons"]) else None
    else:
        i = next((k for k, l in enumerate(s["lecons"]) if str(l.get("num")) == cle), None)
    return i, ([d for d in s["lecons"][i]["docs"] if d.get("f") in lecture] if i is not None else [])


def main():
    B = donnees_js("donnees/bibliotheque.js")
    lecture = donnees_js("donnees/lecture.js")
    series = {s["id"]: s for s in B["series"]}
    rang = {s["id"]: i for i, s in enumerate(B["series"])}
    shorts, erreurs, vus = [], [], set()
    for n, sid, cle, ref, idee in lire_source():
        s = series.get(sid)
        if not s:
            erreurs.append(f"ligne {n} : série inconnue {sid!r}")
            continue
        i, docs = etude(s, cle, lecture)
        if i is None:
            erreurs.append(f"ligne {n} : pas d’étude {cle!r} dans {sid}")
            continue
        d = next((d for d in docs if d.get("role") != "animateur"), docs[0] if docs else None)
        if not d:
            erreurs.append(f"ligne {n} : l’étude {cle} de {sid} n’a pas de mode lecture")
            continue
        # l’idée est une phrase de l’étude, mot pour mot (version des participants ou de l’animateur)
        if not any(trouve(x["f"], idee) for x in docs):
            erreurs.append(f"ligne {n} : idée introuvable dans l’étude {d['f']} : {idee}")
        try:
            livre, chap, premier, dernier = lire_reference(ref)
            t = texte(livre, chap, premier, dernier)
        except ValueError as e:
            erreurs.append(f"ligne {n} : {e}")
            continue
        if not cite(d["f"], livre, chap, premier, dernier):
            erreurs.append(f"ligne {n} : {ref} n’est pas cité dans {d['f']}")
        if (sid, i) in vus:
            erreurs.append(f"ligne {n} : étude {cle} de {sid} en double")
        vus.add((sid, i))
        x = {"s": sid, "n": i, "f": d["f"], "r": ref, "t": t, "i": idee}
        # son image, peinte pour lui (outils/shorts/generer_images.py) ; sinon, le site prend celle de l’étude
        k = f"{sid}-{'1' if cle == '-' else cle.lstrip('#')}".lower()
        if (RACINE / f"assets/images/shorts/{k}.webp").exists():
            x["p"] = k
        shorts.append(x)
    if erreurs:
        print("\n".join(erreurs), file=sys.stderr)
        raise SystemExit(1)
    shorts.sort(key=lambda x: (rang[x["s"]], x["n"]))
    SORTIE.write_text(json.dumps({"shorts": shorts}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    longs = sorted(shorts, key=lambda x: -len(x["t"]))[:5]
    print(f"{len(shorts)} shorts → {SORTIE.relative_to(RACINE)} ({SORTIE.stat().st_size // 1024} ko), "
          f"{sum('p' in x for x in shorts)} avec leur propre image")
    print("versets les plus longs :", ", ".join(f"{x['r']} ({len(x['t'])})" for x in longs))
    print("idées les plus longues :", ", ".join(f"{x['s']} {x['n'] + 1} ({len(x['i'])})"
                                             for x in sorted(shorts, key=lambda x: -len(x["i"]))[:5]))


if __name__ == "__main__":
    main()
