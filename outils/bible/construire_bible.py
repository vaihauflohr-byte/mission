"""Construit le texte de la Bible (Louis Segond 1910) affiché quand on touche une référence.

Texte : l’édition USFM de la Louis Segond 1910 publiée par l’Alliance biblique universelle
(https://github.com/BibleCorps/FRA-B-LSG1910-PD-UBS, domaine public), soignée (accents sur les
majuscules, apostrophes, retours à la ligne de la poésie). On ne garde que le texte des versets :
ni introductions, ni titres de section, ni renvois.

Numérotation : celle de BibleGateway et YouVersion (titres des psaumes dans le verset 1,
Ésaïe 9.6 « un enfant nous est né », Ecclésiaste 12.13 « Écoutons la fin du discours »…),
que suivent la plupart des études, traduites de l’anglais. Elle est prise dans le fichier
FrenchBible.xml du dépôt https://github.com/Beblia/Holy-Bible-XML-Format (même Segond 1910) :
on aligne les deux textes mot à mot et on recoupe le texte soigné selon ces versets.
Pour chaque chapitre où la Segond imprimée numérote autrement, le fichier du livre garde la
correspondance (« imprimee ») : une référence qui n’existe que dans l’imprimée y est retrouvée.

    git clone --depth 1 https://github.com/BibleCorps/FRA-B-LSG1910-PD-UBS /tmp/lsg
    git clone --depth 1 --filter=blob:none --sparse https://github.com/Beblia/Holy-Bible-XML-Format /tmp/beblia
    git -C /tmp/beblia sparse-checkout set --no-cone FrenchBible.xml
    python3 outils/bible/construire_bible.py /tmp/lsg/p.sfm /tmp/beblia/FrenchBible.xml

Produit donnees/bible/01.json … 66.json, un livre par fichier, chargé à la demande par
assets/bible.js : {"livre": nom, "chapitres": [[verset, …], …], "imprimee": {chapitre: [[c, v], …]}}.
Dans un verset, « \n » marque un retour à la ligne (poésie, nouveau paragraphe).
"""
import bisect
import difflib
import json
import re
import sys
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent.parent
SORTIE = RACINE / "donnees" / "bible"

# marqueurs de paragraphe : le verset suivant commence une nouvelle ligne
COUPURES = {"p", "m", "pi", "pi1", "pi2", "q", "q1", "q2", "q3", "b", "nb", "li", "li1", "mi", "pc", "qc"}
# marqueurs de caractère : on garde le texte qu’ils encadrent
CARACTERES = {"wj", "it", "qs", "ord", "add", "nd", "bk", "em", "bd", "sc", "tl", "k", "w"}
# marqueurs de ligne dont le texte n’est pas celui des versets (titres, renvois, notes de l’éditeur)
IGNORES = {"s", "s1", "s2", "s3", "r", "ms", "ms1", "ms2", "mr", "d", "sp", "rem", "cl", "sd", "sd1", "sd2", "sd3",
           "h", "mte", "mte1", "mte2", "mte7", "mte9"}


# noms courts, tels qu’on les écrit dans les références
NOMS = [
    "Genèse", "Exode", "Lévitique", "Nombres", "Deutéronome", "Josué", "Juges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Rois", "2 Rois", "1 Chroniques", "2 Chroniques", "Esdras", "Néhémie", "Esther", "Job", "Psaumes", "Proverbes",
    "Ecclésiaste", "Cantique des cantiques", "Ésaïe", "Jérémie", "Lamentations", "Ézéchiel", "Daniel", "Osée", "Joël",
    "Amos", "Abdias", "Jonas", "Michée", "Nahum", "Habacuc", "Sophonie", "Aggée", "Zacharie", "Malachie",
    "Matthieu", "Marc", "Luc", "Jean", "Actes", "Romains", "1 Corinthiens", "2 Corinthiens", "Galates", "Éphésiens",
    "Philippiens", "Colossiens", "1 Thessaloniciens", "2 Thessaloniciens", "1 Timothée", "2 Timothée", "Tite",
    "Philémon", "Hébreux", "Jacques", "1 Pierre", "2 Pierre", "1 Jean", "2 Jean", "3 Jean", "Jude", "Apocalypse",
]
CODES = ("GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN "
         "HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI "
         "2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV").split()

# coquilles de la source (code du livre, texte fautif, texte corrigé)
CORRECTIONS = [
    ("PSA", "\\v 11 5Éloignez-vous", "\\v 115 Éloignez-vous"),
    # vers répété dans la Segond 1910, omis par cette édition
    ("ISA", "\\q Préparez-vous au combat, et vous serez brisés;\n",
     "\\q Préparez-vous au combat, et vous serez brisés;\n\\q Préparez-vous au combat, et vous serez brisés!\n"),
    # texte de 1910 (BibleGateway, YouVersion) là où cette édition l’a modifié
    ("ACT", "tout le mal que cet homme a fait à tes saints", "tous les maux que cet homme a faits à tes saints"),
    ("ROM", "en tant qu’apôtre des païens je suis,", "en tant que je suis apôtre des païens,"),
    ("HAB", "\\v 1 Oracle révélé à Habacuc,", "\\v 1 Oracle révélé à Habakuk,"),
]


def lire_livre(chemin):
    brut = chemin.read_text(encoding="utf-8-sig")
    for livre, faux, juste in CORRECTIONS:
        if f"\\id {livre} " in brut:
            if faux not in brut:
                raise ValueError(f"{chemin.name} : correction introuvable : {faux}")
            brut = brut.replace(faux, juste)
    nom = re.search(r"^\\toc1 (.+)$", brut, re.M).group(1).strip()
    court = re.search(r"^\\toc2 (.+)$", brut, re.M).group(1).strip()
    code = re.match(r"\\id (\w+)", brut).group(1)
    brut = re.sub(r"\\x .*?\\x\*", "", brut, flags=re.S)  # renvois
    brut = re.sub(r"\\f .*?\\f\*", "", brut, flags=re.S)  # notes
    debut = re.search(r"^\\c 1\s*$", brut, re.M)
    corps = brut[debut.start():]
    chapitres = {}
    chap = vers = None
    ligne_neuve = False  # le prochain texte commence une ligne
    for ligne in corps.splitlines():
        m = re.match(r"\\(\w+)\s?(.*)$", ligne)
        marque, reste = (m.group(1), m.group(2)) if m else (None, ligne)
        if marque in IGNORES:
            continue
        if marque == "c":
            chap = int(reste.split()[0])
            chapitres[chap] = {}
            vers = None
            ligne_neuve = True
            continue
        if marque in COUPURES:
            ligne_neuve = True
            if not reste.strip():
                continue
        elif marque and marque not in ("v",) and marque not in CARACTERES:
            raise ValueError(f"{chemin.name} : marqueur inattendu \\{marque} : {ligne[:80]}")
        texte = reste if marque in COUPURES else ligne
        # versets et texte de la ligne
        for morceau in re.split(r"(\\v \d+ )", texte):
            mv = re.fullmatch(r"\\v (\d+) ", morceau)
            if mv:
                vers = int(mv.group(1))
                if vers in chapitres[chap]:
                    raise ValueError(f"{chemin.name} {chap}:{vers} en double")
                chapitres[chap][vers] = "\n" if ligne_neuve else ""
                ligne_neuve = False
                continue
            propre = re.sub(r"\\\+?(\w+)\*?", "", morceau)  # marqueurs de caractère
            propre = re.sub(r"\|[^\\\s]*", "", propre)  # attributs (\w mot|strong="…"\w*)
            if not propre.strip():
                continue
            if vers is None:
                raise ValueError(f"{chemin.name} {chap} : texte avant le premier verset : {propre[:60]}")
            v = chapitres[chap][vers]
            if ligne_neuve and v.strip():
                v += "\n"
            elif v and not v.endswith(("\n", " ")):
                v += " "
            chapitres[chap][vers] = v + propre.strip()
            ligne_neuve = False
    livre = []
    for c in range(1, max(chapitres) + 1):
        versets = chapitres.get(c)
        if not versets:
            raise ValueError(f"{chemin.name} : chapitre {c} manquant")
        if sorted(versets) != list(range(1, max(versets) + 1)):
            raise ValueError(f"{chemin.name} {c} : versets non continus")
        livre.append([re.sub(r"[ \t]+", " ", versets[n]).replace(" \n", "\n") for n in range(1, len(versets) + 1)])
    return code, nom, court, livre


MOT = re.compile(r"[^\W_]+")
OUVRANTS = "«(“[—–\"'"


def normaliser(mot):
    m = unicodedata.normalize("NFD", mot.lower().replace("œ", "oe").replace("æ", "ae"))
    return "".join(c for c in m if unicodedata.category(c) != "Mn")


def lire_numerotation(xml):
    """Versets de la Segond telle que la donnent BibleGateway et YouVersion : {livre: [[texte du verset, …], …]}."""
    racine = ET.parse(xml).getroot()
    livres = {}
    for b in racine.iter("book"):
        chapitres = []
        for c in b.iter("chapter"):
            versets = {int(v.get("number")): v.text or "" for v in c.iter("verse")}
            chapitres.append([versets[n] for n in range(1, max(versets) + 1)])
        livres[int(b.get("number"))] = chapitres
    return livres


def renumeroter(imprime, cible):
    """Recoupe le texte de l’édition imprimée selon les versets de la numérotation cible.

    Les deux textes sont la même Segond 1910 (quelques coquilles près) : on aligne les mots,
    puis on coupe le texte imprimé (accents, apostrophes, retours à la ligne) là où commence
    chaque verset de la cible. Renvoie les chapitres recoupés et, pour chaque verset imprimé,
    le verset de la cible où il commence.
    """
    # texte imprimé d’un seul tenant, avec la place de chaque mot
    texte, mots_i, debut_verset = "", [], []
    for ci, chap in enumerate(imprime, 1):
        for vi, v in enumerate(chap, 1):
            morceau = v if v.startswith("\n") or not texte else " " + v
            base = len(texte)
            texte += morceau
            debut_verset.append(((ci, vi), len(mots_i)))
            mots_i += [(normaliser(m.group()), base + m.start()) for m in MOT.finditer(morceau)]
    mots_c, debuts_c = [], []
    for ci, chap in enumerate(cible, 1):
        for vi, v in enumerate(chap, 1):
            debuts_c.append(((ci, vi), len(mots_c)))
            mots_c += [normaliser(m.group()) for m in MOT.finditer(v)]
    sm = difflib.SequenceMatcher(None, [m for m, _ in mots_i], mots_c, autojunk=False)
    vers_i = [None] * (len(mots_c) + 1)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            vers_i[b + k] = a + k
    vers_i[len(mots_c)] = len(mots_i)
    vers_c = [None] * len(mots_i)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            vers_c[a + k] = b + k
    debuts_i = [j for _, j in debut_verset]
    coupes = []
    for (cv, k) in debuts_c:
        d = 0
        while vers_i[k + d] is None:
            d += 1
        j = max(0, vers_i[k + d] - d)
        # mots imprimés absents de la cible juste avant la coupe (« à » perdu en tête de 2 Rois 19.15) :
        # s’ils ouvrent un verset de l’imprimée, ils ouvrent aussi celui-ci
        p = j - 1
        while p >= 0 and vers_c[p] is None:
            p -= 1
        dedans = [x for x in debuts_i[bisect.bisect_right(debuts_i, p):bisect.bisect_left(debuts_i, j)]]
        if dedans:
            j = dedans[-1]
        # l’autre édition perd souvent un « à » en tête de verset : il revient à ce verset
        while j > 0 and vers_c[j - 1] is None and mots_i[j - 1][0] == "a":
            j -= 1
        coupes.append(mots_i[j][1] if j < len(mots_i) else len(texte))
    coupes.append(len(texte))
    # un guillemet ou une parenthèse ouvrante reste avec le verset qu’elle ouvre
    for n in range(1, len(coupes) - 1):
        x = coupes[n]
        while x > coupes[n - 1] and (texte[x - 1] in OUVRANTS or (texte[x - 1] == " " and x - 2 >= 0 and texte[x - 2] in OUVRANTS)):
            x -= 1
        coupes[n] = x
    chapitres = [[] for _ in cible]
    for n, ((c, v), _) in enumerate(debuts_c):
        brut = texte[coupes[n]:coupes[n + 1]]
        ligne = brut.lstrip(" ").startswith("\n") or (n and texte[:coupes[n]].rstrip(" ").endswith("\n"))
        propre = re.sub(r" *\n *", "\n", brut).strip()
        chapitres[c - 1].append(("\n" if ligne and n else "") + propre)
    # verset de la cible où commence chaque verset imprimé
    debut_mot = [k for _, k in debuts_c]
    correspondance = {}
    for (ci, vi), j in debut_verset:
        # premier mot du verset imprimé repris dans la cible -> verset de la cible
        while j < len(mots_i) and vers_c[j] is None:
            j += 1
        if j < len(mots_i):
            correspondance[(ci, vi)] = debuts_c[bisect.bisect_right(debut_mot, vers_c[j]) - 1][0]
    return chapitres, correspondance


def main(dossier, xml):
    # les fichiers FRT et INT ne contiennent que des introductions
    fichiers = sorted(p for p in Path(dossier).glob("*.sfm") if not re.search(r"-(FRT|INT)\.", p.name))
    if len(fichiers) != 66:
        sys.exit(f"66 livres attendus, {len(fichiers)} trouvés")
    numerotation = lire_numerotation(xml)
    SORTIE.mkdir(parents=True, exist_ok=True)
    index = []
    total = ecarts = 0
    for n, f in enumerate(fichiers, 1):
        code, _, _, imprime = lire_livre(f)
        if code != CODES[n - 1]:
            sys.exit(f"{f.name} : livre {code}, {CODES[n - 1]} attendu")
        nom = NOMS[n - 1]
        livre, correspondance = renumeroter(imprime, numerotation[n])
        # contrôle : chaque verset recoupé a les mêmes mots que celui de la cible
        for ci, (chap, chap_c) in enumerate(zip(livre, numerotation[n]), 1):
            for vi, (v, vc) in enumerate(zip(chap, chap_c), 1):
                a = [normaliser(m.group()) for m in MOT.finditer(v)]
                b = [normaliser(m.group()) for m in MOT.finditer(vc)]
                if a != b and difflib.SequenceMatcher(None, a, b, autojunk=False).ratio() < 0.9:
                    ecarts += 1
                    print(f"  {nom} {ci}:{vi} : {v[:60]!r} / {vc[:60]!r}", file=sys.stderr)
        # numérotation imprimée, là où elle diffère : verset imprimé -> [chapitre, verset] dans le texte
        imprimee = {}
        for ci, chap in enumerate(imprime, 1):
            liste = [list(correspondance.get((ci, vi), (0, 0))) for vi in range(1, len(chap) + 1)]
            if any(x != [ci, vi] for vi, x in enumerate(liste, 1)) or len(chap) != len(livre[ci - 1] if ci <= len(livre) else []):
                imprimee[str(ci)] = liste
        donnees = {"livre": nom, "chapitres": livre}
        if imprimee:
            donnees["imprimee"] = imprimee
        (SORTIE / f"{n:02d}.json").write_text(json.dumps(donnees, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index.append([nom, [len(c) for c in livre]])
        total += sum(len(c) for c in livre)
    print(f"66 livres, {sum(len(i[1]) for i in index)} chapitres, {total} versets, {ecarts} versets à vérifier -> {SORTIE}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
