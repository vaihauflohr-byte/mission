#!/usr/bin/env python3
"""Les phrases d’une étude, pour choisir l’idée de son short.

L’idée d’un short est une phrase de l’étude, mot pour mot : on peut la raccourcir en coupant
le début ou la fin, jamais en changeant un mot. construire_shorts.py vérifie avec trouve().

    python3 outils/shorts/phrases.py daniel '#3'      les phrases les plus fortes d’une étude
    python3 outils/shorts/phrases.py daniel '#3' 40   les 40 premières
"""
import html
import re
import sys
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
REF, BLANC, CITATION = "⟦r⟧", "⟦_⟧", "⟦c⟧"


def blocs(f):
    """Les paragraphes de lecture/<f>.html, en texte : références → REF, cases à remplir → BLANC,
    citations mises en avant → préfixe CITATION. Sans les étiquettes, crédits ni zones de réponse."""
    t = (RACINE / f"lecture/{f}.html").read_text(encoding="utf-8")
    t = re.sub(r"<textarea\b.*?</textarea>|<label\b.*?</label>", " ", t, flags=re.S)
    t = re.sub(r'<span class="lec-q-num[^"]*"[^>]*>.*?</span>|<b class="lec-marque">.*?</b>', " ", t, flags=re.S)
    t = re.sub(r'<p class="lec-(?:etiquette|credits)"[^>]*>.*?</p>', "\n", t, flags=re.S)
    t = re.sub(r'<input class="lec-blanc"[^>]*>', BLANC, t)
    t = re.sub(r'<a class="ref"[^>]*>.*?</a>', REF, t, flags=re.S)
    # une citation mise en avant déborde parfois sur le paragraphe suivant, en italique
    t = re.sub(r'<blockquote class="lec-citation">(.*?)</blockquote>(\s*<p><em>.*?</em></p>)?',
               lambda m: "\n" + CITATION + re.sub(r"<[^>]+>|\s+", " ", m.group(1) + (m.group(2) or "")) + "\n", t, flags=re.S)
    t = re.sub(r"<br\s*/?>", " ", t)
    t = re.sub(r"</?(?:p|li|ol|ul|h\d|div|td|tr|th|table|blockquote|figure|figcaption)\b[^>]*>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", "", t))
    t = t.replace(" ", " ").replace(" ", " ")
    return [re.sub(r"\s+", " ", b).strip() for b in t.split("\n") if b.strip()]


def normaliser(s):
    s = unicodedata.normalize("NFC", s).replace("’", "'").replace("‘", "'")
    s = re.sub(r"[«»“”„\"]", '"', s)
    s = re.sub(r"\s+", " ", s.replace(" ", " ").replace(" ", " "))
    s = re.sub(r"\s+([:;?!.,»\"])", r"\1", s)
    s = re.sub(r"\s*([—–])\s*", r"\1", s)
    s = re.sub(r'"\s+', '"', s)
    return s.strip().lower()


def texte_cherchable(f):
    """Le texte de l’étude, sans les références ni les parenthèses qui les entourent."""
    t = " ".join(b.replace(CITATION, "") for b in blocs(f))
    t = re.sub(r"\((?:[^()]*?)%s(?:[^()]*?)\)" % re.escape(REF), "", t)
    return normaliser(t.replace(REF, " ").replace(BLANC, " "))


def trouve(f, idee):
    """L’idée est-elle dans l’étude, mot pour mot (au début et à la fin coupés près) ?
    « … » marque une coupure au milieu : chaque morceau doit s’y trouver, dans l’ordre."""
    t = texte_cherchable(f)
    pos = 0
    for morceau in re.split(r"\s*…\s*", idee.strip()):
        m = normaliser(morceau).strip(" .!;:,")
        if not m:
            continue
        i = t.find(m, pos)
        if i < 0:
            return False
        pos = i + len(m)
    return True


ABREV = re.compile(r"\b(?:J\.-C|av|apr|env|etc|p|pp|M|Mme|Dr|St|cf|v|vv|chap|ch|n°|ex|éd|trad|vol)\.$|\b[A-Z]\.$")
FIN = re.compile(r"(?<=[.!?…])[»\"”)]?\s+(?=[«\"“(]?[A-ZÀ-ÖØ-Þ0-9])")


def phrases(f):
    """[(phrase, citation mise en avant ?, rang du paragraphe)] : les phrases de l’étude, découpées."""
    sortie = []
    for nb, b in enumerate(blocs(f)):
        cit = b.startswith(CITATION)
        b = b.replace(CITATION, "").strip()
        morceaux, debut = [], 0
        for m in FIN.finditer(b):
            avant = b[debut:m.start()].rstrip()
            if ABREV.search(avant.rstrip("»\"”)").rstrip()):
                continue
            morceaux.append(b[debut:m.end()].strip())
            debut = m.end()
        morceaux.append(b[debut:].strip())
        sortie += [(p, cit, nb) for p in morceaux if p]
    return sortie


CONSIGNE = re.compile(r"^(?:Lisez|Lire|Relisez|Relire|Notez|Noter|Écrivez|Écrire|Répondez|Comparez|Expliquez|Complétez|"
                      r"Cochez|Soulignez|Mémorisez|Mémoriser|Méditez|Méditer|Partagez|Discutez|Résumez|Recopiez|"
                      r"Prenez|Prendre|Regardez|Voir|Voyez|Consultez|Remplissez|Indiquez|Choisissez|Réfléchissez|"
                      r"Commencez|Continuez|Terminez|Mettez|Mettre|Identifiez|Dressez|Faites une liste|Texte biblique)\b")
META = re.compile(r"\b(?:leçon|étude|question|questionnaire|ci-dessous|ci-dessus|page|paragraphe|exercice|animateur|"
                  r"participants?|réponses?|N\.B|étape|tableau|chapitre suivant|carte|fiche|vidéo|DVD)\b", re.I)
LIEN = re.compile(r"^(?:Ainsi|Par conséquent|En effet|C['’]est pourquoi|Donc|Cependant|De plus|Toutefois|Pourtant|"
                  r"Enfin|Alors|Puis|Ensuite|Par exemple|En outre|D['’]autre part|D['’]abord|Premièrement|Deuxièmement|"
                  r"Troisièmement|Mais|Et|Or|Car|Bref|De même)\b")
PRONOM = re.compile(r"^(?:Il|Elle|Ils|Elles|Cela|Ceci|Ce|Celui|Celle|Ceux|Lui|Eux|Leur|Là|Cet|Cette|Ces)\b")


def note(p, cit, idee=""):
    """Plus c’est haut, plus la phrase a des chances d’être percutante seule."""
    n, l = 0.0, len(p)
    n += 3 if 30 <= l <= 85 else 1 if 20 <= l <= 105 else -3 if l > 130 else 0
    if cit:
        n += 4
    if re.search(r"\bn['’]?\w*\b.{0,40}\bpas\b.{0,60}\b(?:mais|c['’]est|il|elle)\b", p) or re.search(r"\bnon pas\b|\bnon\b.{0,30}\bmais\b", p):
        n += 3
    if re.search(r",\s*mais\b|\bplutôt que\b|\bau lieu de\b", p):
        n += 1.5
    n += 1.2 * min(2, len(re.findall(r"\b(?:jamais|toujours|rien|tout|tous|toute|personne|aucun|aucune|seul|seule|seuls|plus jamais)\b", p, re.I)))
    if re.search(r"\b(?:vous|votre|vos|tu|ton|ta|tes|toi|nous|notre|nos)\b", p, re.I):
        n += 1
    if re.search(r"\b(?:Dieu|Jésus|Christ|Seigneur|Esprit|Éternel|Père)\b", p):
        n += 1
    if "!" in p:
        n += 0.8
    if re.search(r"[:;] ", p):
        n += 0.4
    if LIEN.match(p):
        n -= 2
    if PRONOM.match(p):
        n -= 1
    if p.startswith(("«", "\"", "“")) and p.rstrip(" .").endswith(("»", "\"", "”")):
        n -= 1.5
    if idee:
        a = {w for w in re.findall(r"\w{4,}", normaliser(p))}
        b = {w for w in re.findall(r"\w{4,}", normaliser(idee))}
        if a and b:
            n += 6 * len(a & b) / len(a | b)
    return round(n, 1)


def candidates(docs, idee="", combien=25):
    """Les phrases (et paires de phrases qui se suivent) les mieux notées des documents d’une étude ;
    « A » : seulement dans la version de l’animateur."""
    vues, sortie = set(), []
    cites = {normaliser(p) for d in docs for p, c, _ in phrases(d["f"]) if c}

    def propre(p):
        if BLANC in p or re.search(r"(?<!\()%s(?![^()]*\))" % re.escape(REF), p):
            return None
        p = re.sub(r"\s*\([^()]*%s[^()]*\)" % re.escape(REF), "", p).strip()
        # « Remarque : … » : on garde ce qui suit (couper le début est permis)
        p = re.sub(r"^(?:Remarque|Note|N\.B\.|Important|Rappel|Conclusion|En résumé)\s*:\s*", "", p)
        p = p[:1].upper() + p[1:]
        if (len(p) < 18 or len(p.split()) < 4 or p.rstrip().endswith("?") or CONSIGNE.match(p)
                or META.search(p) or p.upper() == p):
            return None
        return p

    for d in sorted(docs, key=lambda d: d.get("role") == "animateur"):
        anim = d.get("role") == "animateur"
        liste = phrases(d["f"])
        for j, (p, cit, nb) in enumerate(liste):
            essais = [(propre(p), cit, 0)]
            # deux phrases courtes qui se suivent : souvent le meilleur « choc »
            if j + 1 < len(liste) and liste[j + 1][2] == nb and len(p) + len(liste[j + 1][0]) < 105:
                q = propre(p + " " + liste[j + 1][0])
                if q and propre(p) and propre(liste[j + 1][0]) is not None:
                    essais.append((q, cit or liste[j + 1][1], 0.5))
            for q, c, bonus in essais:
                if not q:
                    continue
                k = normaliser(q)
                if k in vues:
                    continue
                vues.add(k)
                n = note(q, c or k in cites, idee) + bonus - (1 if anim else 0) - (1 if "=" in q else 0)
                sortie.append((round(n, 1), "A" if anim else " ", q))
    sortie.sort(key=lambda x: -x[0])
    return sortie[:combien]


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    from construire_shorts import donnees_js, etude, lire_source  # noqa: E402
    B = donnees_js("donnees/bibliotheque.js")
    lecture = donnees_js("donnees/lecture.js")
    series = {s["id"]: s for s in B["series"]}
    serie = sys.argv[1] if len(sys.argv) > 1 else None
    cle = sys.argv[2] if len(sys.argv) > 2 else None
    combien = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    for n, sid, c, ref, idee in lire_source():
        if (serie and sid != serie) or (cle and c != cle):
            continue
        i, docs = etude(series[sid], c, lecture)
        print(f"\n[{sid}] {c} | {ref} | {series[sid]['lecons'][i]['titre']}\n    actuelle : {idee}")
        for k, (s_, a, p) in enumerate(candidates(docs, idee, combien), 1):
            print(f"  {k:2d}.{a}({s_:4.1f}) {p}")
