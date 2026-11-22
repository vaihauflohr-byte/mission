"""Références bibliques en français : repérage dans le texte et lien vers la Bible Segond 1910 (BibleGateway).

Les noms anglais servent à l'adresse du passage : BibleGateway les comprend toujours, et affiche
le texte en français avec version=LSG. Sur le site, assets/bible.js lit cette adresse et affiche
le passage dans un panneau, sans quitter l’étude ; BibleGateway reste le recours (Ctrl-clic, hors ligne).
"""
import re
from urllib.parse import quote

# nom français (et variantes) -> nom anglais
LIVRES = {
    "Genèse": "Genesis", "Exode": "Exodus", "Lévitique": "Leviticus", "Nombres": "Numbers",
    "Deutéronome": "Deuteronomy", "Josué": "Joshua", "Juges": "Judges", "Ruth": "Ruth",
    "1 Samuel": "1 Samuel", "2 Samuel": "2 Samuel", "1 Rois": "1 Kings", "2 Rois": "2 Kings",
    "1 Chroniques": "1 Chronicles", "2 Chroniques": "2 Chronicles", "Esdras": "Ezra", "Néhémie": "Nehemiah",
    "Esther": "Esther", "Job": "Job", "Psaumes": "Psalms", "Psaume": "Psalms", "Proverbes": "Proverbs",
    "Ecclésiaste": "Ecclesiastes", "Cantique des cantiques": "Song of Songs", "Cantique des Cantiques": "Song of Songs",
    "Ésaïe": "Isaiah", "Esaïe": "Isaiah", "Isaïe": "Isaiah", "Jérémie": "Jeremiah", "Lamentations": "Lamentations",
    "Ézéchiel": "Ezekiel", "Ezéchiel": "Ezekiel", "Daniel": "Daniel", "Osée": "Hosea", "Joël": "Joel",
    "Amos": "Amos", "Abdias": "Obadiah", "Jonas": "Jonah", "Michée": "Micah", "Nahum": "Nahum",
    "Habacuc": "Habakkuk", "Sophonie": "Zephaniah", "Aggée": "Haggai", "Zacharie": "Zechariah",
    "Malachie": "Malachi",
    "Matthieu": "Matthew", "Marc": "Mark", "Luc": "Luke", "Jean": "John", "Actes": "Acts",
    "Romains": "Romans", "1 Corinthiens": "1 Corinthians", "2 Corinthiens": "2 Corinthians",
    "Galates": "Galatians", "Éphésiens": "Ephesians", "Ephésiens": "Ephesians", "Philippiens": "Philippians",
    "Colossiens": "Colossians", "1 Thessaloniciens": "1 Thessalonians", "2 Thessaloniciens": "2 Thessalonians",
    "1 Timothée": "1 Timothy", "2 Timothée": "2 Timothy", "Tite": "Titus", "Philémon": "Philemon",
    "Hébreux": "Hebrews", "Jacques": "James", "1 Pierre": "1 Peter", "2 Pierre": "2 Peter",
    "1 Jean": "1 John", "2 Jean": "2 John", "3 Jean": "3 John", "Jude": "Jude", "Apocalypse": "Revelation",
}
# abréviations courantes : reconnues seulement suivies de « chapitre:verset »
ABREGES = {
    "Gn": "Genesis", "Gen": "Genesis", "Ex": "Exodus", "Lv": "Leviticus", "Nb": "Numbers", "Dt": "Deuteronomy",
    "Jos": "Joshua", "Jg": "Judges", "Rt": "Ruth", "1 S": "1 Samuel", "2 S": "2 Samuel", "1 R": "1 Kings",
    "2 R": "2 Kings", "1 Ch": "1 Chronicles", "2 Ch": "2 Chronicles", "Esd": "Ezra", "Né": "Nehemiah",
    "Est": "Esther", "Ps": "Psalms", "Pr": "Proverbs", "Prov": "Proverbs", "Ec": "Ecclesiastes", "Ecc": "Ecclesiastes",
    "Ct": "Song of Songs", "Es": "Isaiah", "És": "Isaiah", "Esa": "Isaiah", "És.": "Isaiah", "Is": "Isaiah", "Jr": "Jeremiah",
    "Jér": "Jeremiah", "Lm": "Lamentations", "Ez": "Ezekiel", "Éz": "Ezekiel", "Dn": "Daniel", "Dan": "Daniel",
    "Os": "Hosea", "Jl": "Joel", "Am": "Amos", "Ab": "Obadiah", "Jon": "Jonah", "Mi": "Micah", "Na": "Nahum",
    "Ha": "Habakkuk", "So": "Zephaniah", "Ag": "Haggai", "Za": "Zechariah", "Ml": "Malachi", "Mal": "Malachi",
    "Mt": "Matthew", "Matt": "Matthew", "Mc": "Mark", "Lc": "Luke", "Jn": "John", "Ac": "Acts", "Rm": "Romans",
    "Rom": "Romans", "Ro": "Romans", "1 Co": "1 Corinthians", "2 Co": "2 Corinthians", "1 Cor": "1 Corinthians",
    "2 Cor": "2 Corinthians", "Ga": "Galatians", "Gal": "Galatians", "Ep": "Ephesians", "Ép": "Ephesians",
    "Eph": "Ephesians", "Éph": "Ephesians", "Ph": "Philippians", "Phil": "Philippians", "Col": "Colossians",
    "1 Th": "1 Thessalonians", "2 Th": "2 Thessalonians", "1 Tm": "1 Timothy", "2 Tm": "2 Timothy",
    "1 Tim": "1 Timothy", "2 Tim": "2 Timothy", "Tt": "Titus", "Phm": "Philemon", "Hé": "Hebrews",
    "Héb": "Hebrews", "He": "Hebrews", "Jc": "James", "Jac": "James", "1 P": "1 Peter", "2 P": "2 Peter",
    "1 Pi": "1 Peter", "2 Pi": "2 Peter", "1 Jn": "1 John", "2 Jn": "2 John", "3 Jn": "3 John", "Jd": "Jude",
    "Ap": "Revelation", "Apo": "Revelation", "Apoc": "Revelation",
    # abréviations à l'anglaise que l'on trouve dans certaines fiches (Vers Jésus…)
    "Mat": "Matthew", "Psa": "Psalms", "Exo": "Exodus", "Deut": "Deuteronomy", "Lév": "Leviticus",
    "Jer": "Jeremiah", "Heb": "Hebrews", "Act": "Acts", "Jas": "James", "Rev": "Revelation",
}

_ESP = r"[   ]"
_PREFIXE = r"(?:(?P<num>[123])(?:er|re|e)?" + _ESP + r"?)?"


def _motif(noms):
    # les noms commençant par un chiffre sont repris sans leur chiffre (le préfixe le lit)
    bases = sorted({re.sub(r"^[123] ", "", n) for n in noms}, key=len, reverse=True)
    return "|".join(re.escape(b).replace(r"\ ", _ESP) for b in bases)


_VERSETS = (r"\d{1,3}[a-c]?(?:" + _ESP + r"?[-–]" + _ESP + r"?\d{1,3}[a-c]?)?"
            r"(?:" + _ESP + r"?[,.]" + _ESP + r"?\d{1,3}[a-c]?(?:" + _ESP + r"?[-–]" + _ESP + r"?\d{1,3}[a-c]?)?"
            r"(?![0-9])(?!" + _ESP + r"*[A-ZÉÈÀÂÎ])(?!" + _ESP + r"?[:.]\d))*")
REF = re.compile(
    r"(?<![\w-])" + _PREFIXE + r"(?P<livre>" + _motif(LIVRES) + r")" + _ESP + r"(?P<chap>\d{1,3})"
    r"(?:" + _ESP + r"?[:.,]" + _ESP + r"?(?P<vers>" + _VERSETS + r"))?(?![\w:])"
)
REF_ABREGE = re.compile(
    r"(?<![\w-])" + _PREFIXE + r"(?P<livre>" + _motif(ABREGES) + r")\.?" + _ESP + r"(?P<chap>\d{1,3})"
    + _ESP + r"?[:.]" + _ESP + r"?(?P<vers>" + _VERSETS + r")(?![\w:])"
)


def _anglais(m, table):
    livre = m.group("livre").replace(" ", " ").replace(" ", " ")
    num = m.group("num")
    cle = f"{num} {livre}" if num else livre
    if cle not in table:
        return None
    return table[cle]


def adresse(m, table):
    en = _anglais(m, table)
    if not en:
        return None
    passage = f"{en} {m.group('chap')}"
    if m.group("vers"):
        v = re.sub(r"[   ]", "", m.group("vers")).replace("–", "-").replace(".", ",")
        v = re.sub(r"(\d)[a-c]", r"\1", v)
        passage += ":" + v
    return "https://www.biblegateway.com/passage/?search=" + quote(passage) + "&version=LSG"


def lier(html_echappe):
    """Ajoute les liens vers les versets dans un texte déjà échappé (pas de balises dans les références)."""
    def remplacer(table):
        def f(m):
            url = adresse(m, table)
            if not url:
                return m.group(0)
            return f'<a class="ref" href="{url.replace("&", "&amp;")}" target="_blank" rel="noopener">{m.group(0)}</a>'
        return f

    # on ne touche pas l'intérieur des balises déjà posées (<strong>, <em>…)
    morceaux = re.split(r"(<[^>]+>)", html_echappe)
    for i, m in enumerate(morceaux):
        if m.startswith("<"):
            continue
        m = REF.sub(remplacer(LIVRES), m)
        # abréviations : seulement hors des liens déjà faits
        parts = re.split(r"(<a class=\"ref\".*?</a>)", m)
        parts = [p if p.startswith("<a ") else REF_ABREGE.sub(remplacer(ABREGES), p) for p in parts]
        morceaux[i] = "".join(parts)
    return "".join(morceaux)


# Références fautives dans les documents d’origine (chiffres inversés, coquilles), vérifiées sur le
# texte cité autour : la version lecture donne la bonne ; le PDF d’origine reste tel quel.
# document -> [(texte fautif, texte juste)] ; un texte fautif qui est une référence liée est remplacé
# avec son lien, sinon c’est du texte simple.
CORRECTIONS = {
    "decouvrir/ressources-pour-l-animateur": [
        # « (Actes 1:50) » puis, à la ligne, « 8:1,4,5,27,29) – L’Évangile se répand parmi les Gentils »
        ("Actes 1:50", "Actes 8:1,4,5,27,29"),
        ("<p>8:1,4,5,27,29) – ", "<p>"),
    ],
    # « fait ce qu’il lui ordonne de faire » : Luc 6.46
    "fast-formation-de-base/01-l-appel-a-l-engagement": [("Luc 64.6", "Luc 6.46")],
    # les trois faits : versets 10, 11 et 12
    "historacles/17-l-histoire-des-deux-femmes": [("Apocalypse 12.20-12", "Apocalypse 12.10-12")],
    # « lavés de nos péchés par son propre sang » : Matthieu 26.28
    "sept-eglises/01-les-secrets-de-l-esperance-les-sept-eglises": [("Matthieu 28:26", "Matthieu 26:28")],
    # coquilles de l’article anglais de R. Dederen, reprises par la traduction
    "trinite/04-reflexion-sur-la-doctrine-de-la-trinite-raoul-dederen": [
        ("1 Corinthiens 31:16", "1 Corinthiens 3:16"),
        ("2 Thessaloniciens 21,16", "2 Thessaloniciens 2,16"),
        ("2 Rois 19:51", "2 Rois 19:15"),
    ],
    # « Voyez quel amour le Père nous a témoigné » : 1 Jean 3.1
    "trinite/15-jesus-le-premier-ne": [("1 Jean 13:1", "1 Jean 3:1")],
    # Vers Jésus, chapitre de la confession, cite Psaume 34.18
    "vers-jesus/01-vers-jesus-fiches-d-etude": [("Prov 34:18", "Ps 34:18")],
}


def corriger(page, document):
    """Applique les CORRECTIONS d’un document à son HTML de lecture. Relancer ne change rien."""
    import html as _html
    for faux, juste in CORRECTIONS.get(document, []):
        motif = re.escape(faux).replace(r"\ ", _ESP)
        lien = re.compile(r'<a class="ref" href="[^"]*"[^>]*>' + motif + "</a>")
        if lien.search(page):
            page = lien.sub(lambda m: lier(_html.escape(juste, quote=False)), page, count=1)
        elif faux.startswith("<") and faux in page:
            page = page.replace(faux, juste, 1)
        elif not re.search(re.escape(juste).replace(r"\ ", _ESP), page):
            raise ValueError(f"{document} : « {faux} » introuvable")
    return page


if __name__ == "__main__":
    essais = [
        "Que promet Jésus ? Jean 14:1-3 (remarquez surtout le verset 3)",
        "Matthieu 24:4-5, 23-24 et Matthieu 24:23, 26 ; Apocalypse 1:7",
        "Texte biblique – Marc 1:41 ; 1 Thessaloniciens 4:3 ; Jean 17:17",
        "Jean-Noël Adeline et Jean 3.16 puis 2 Pierre 1:3, 1 Jean 1:9 ; Ps 23:1 ; Actes 2",
        "Daniel 12:4 et Ésaïe 41:10, 2 Timothée 3:1-5. Romains 6:23, 2 Corinthiens 5:17",
    ]
    for e in essais:
        print(lier(e))
        print()
