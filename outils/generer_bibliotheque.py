"""Construit donnees/bibliotheque.js à partir de l'inventaire du dossier Drive
« Eglise / Etude petit groupe ».

Usage : python3 outils/generer_bibliotheque.py inventaire.json

inventaire.json : dictionnaire {id: fichier} tel que renvoyé par l'API Drive
(champs id, title, mimeType, parentId). Chaque série du site correspond à un
dossier Drive (SERIES ci-dessous) ; les sous-dossiers sont parcourus.
"""
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

NIVEAUX = [
    {
        "id": "connaitre",
        "verbe": "Connaître",
        "titre": "Pour connaître Jésus",
        "texte": "Pour découvrir la Bible et Jésus. Convient à un invité.",
    },
    {
        "id": "grandir",
        "verbe": "Grandir",
        "titre": "Pour grandir en Jésus",
        "texte": "Pour approfondir la foi : la vie avec Jésus, le sanctuaire, les prophéties. Convient aussi à un invité.",
    },
    {
        "id": "murir",
        "verbe": "Mûrir",
        "titre": "Mûrir en Jésus",
        "texte": "Pour la vie chrétienne de chaque jour : excellence, couple, enfants, pureté, doctrine.",
    },
]

# Une entrée par série : dossier Drive, niveau, titre affiché, présentation.
SERIES = [
    # Connaître
    ("connaitre", "fiabilite-bible", "1g0Yp_7Xc-khemL90fz1kvQPprEjxZRjW", "Fiabilité de la Bible",
     "Pourquoi peut-on faire confiance à la Bible ? Une étude pour commencer."),
    ("connaitre", "prendre-vie", "1kpDORy1UeaUvHsgIF5KLhq-bJt7UFoBF", "Prendre vie avec Jésus",
     "Les premiers pas avec Jésus : la tentation, l’étude de la Bible, la prière, l’obéissance, la communion fraternelle."),
    ("connaitre", "vers-jesus", "1Okjg9du2O2E66o_4RW6QBKkrbesu1T2v", "Vers Jésus",
     "Fiches d’étude pour lire le livre Vers Jésus."),
    ("connaitre", "quete-certitude", "12URWhX0ZaE5mIjQQN3V7oKJ3RPxcpIu2", "En quête de certitude",
     "30 études sur les grandes questions : la Bible, les prophéties, le retour du Christ, la mort, le jugement, l’Église. Six études complémentaires en plus."),
    ("connaitre", "explorateur", "12QzizinAah_SguLWZ_LT7Xcu4dALKZ0B", "Classe Explorateur",
     "18 études sur les bases de la foi, de la Bible jusqu’au baptême."),
    # Grandir
    ("grandir", "vivre-avec-jesus", "1_7vAlyGMjeBn3nFKpn674Lb_8UONxHoC", "Vivre avec Jésus",
     "15 études : le retour de Jésus, la mort, le baptême, le sabbat, le temps, les biens et le corps confiés au Seigneur."),
    ("grandir", "rencontre-avec-jesus", "1v69bBz7RBdYJmrTbaFDOmH6cpcusykQD", "Rencontre avec Jésus",
     "30 rencontres de Jésus dans les Évangiles, du lépreux à Pierre au bord de la mer de Tibériade."),
    ("grandir", "cep-sarment", "1BPY3p971IPJ9xsx9G0pH0Dv_pM0FzcQN", "Le cep et le sarment",
     "10 études sur Jean 15 : demeurer en Christ, porter du fruit, refléter son amour."),
    ("grandir", "daniel", "1tq4cWC0nn6A7qYtZqdyrPleTqLyzEhHq", "Daniel verset par verset",
     "Les clés du royaume : le livre de Daniel, chapitre après chapitre."),
    ("grandir", "sanctuaire", "1IdaXfxs0ztdqZxNFzdeHs5Fh6oQJjm1x", "Le sanctuaire, le plan céleste",
     "12 études, de l’autel des holocaustes à Jésus, notre souverain sacrificateur."),
    ("grandir", "decouvrir", "1eHc4kEWUbZu0rzhq-hErlVOzDWyOGodZ", "Découvrir : les trois anges et la perfection par la foi",
     "Ressources pour l’animateur sur le message des trois anges d’Apocalypse 14."),
    ("grandir", "secrets-prophetie", "1GI-AI6hrKS-5WmSsHYYiBf8r0et7nsM8", "Les secrets de la prophétie",
     "Présentations à projeter sur les prophéties de Daniel et de l’Apocalypse."),
    ("grandir", "sept-eglises", "1QiKRIZOr90H3Zd8oym8oXHVgWoXe3sNu", "Les sept Églises de l’Apocalypse",
     "Étude des lettres aux sept Églises, d’Apocalypse 2 et 3."),
    # Mûrir
    ("murir", "excellence", "1TN40N-S-d4xYHz-dO7SXDmXI1Y3box0g", "L’excellence dans la vie",
     "7 études : le besoin, la clé, les objectifs, les étapes et le chemin de l’excellence, jusque dans les relations."),
    ("murir", "frequentations", "1l0vy8Qipo-RE31ZOvoiODAzVsK6bW4F7", "Fréquentations et relations",
     "9 études pour les jeunes et les couples : trouver l’âme sœur, bien choisir son conjoint, rester pur."),
    ("murir", "enfants", "19209wGsV-ki3RVmEP8Grz1pM36s-fif0", "Élever ses enfants dans la foi",
     "12 études pour les parents : amour et confiance, discipline, culte de famille, sabbat, éducation."),
    ("murir", "homme-de-dieu", "1J1O_fQifhxs239hyQiE2_NgnNvYb5no_", "Être un homme de Dieu",
     "5 études pour les hommes : le but du mariage, l’autorité, le prêtre du foyer."),
    ("murir", "convoitise", "1zIm3_5JR6fk00aMXs_RF3hF9-nU6W7_C", "Vaincre la convoitise",
     "Rançon et réconciliation : 7 études, du sanctuaire à la maîtrise de soi."),
    ("murir", "trinite", "1XaIjFEQc_GomQJP1C5T72zEcpiEB4XU-", "La Trinité et la Divinité",
     "Études bibliques et articles sur la Divinité et le Saint-Esprit."),
]

# Fichiers laissés hors du site (doublons, documents propres à un autre pays, livres publiés).
EXCLURE = [
    "Source chinoise",
    "PolyU",
    "Se préparer à la vie professionnelle",
    "Se préparer à un mariage heureux",
    "Le sanctuaire expliqué simplement",
]

# Variantes reconnues en fin de nom de fichier, de la plus longue à la plus courte.
VARIANTES = [
    ("Avec réponses - Version 2", "Avec les réponses (version 2)", "animateur"),
    ("Fiche du participant", "Fiche du participant", "participant"),
    ("Guide de l’animateur", "Guide de l’animateur", "animateur"),
    ("Avec réponses", "Avec les réponses", "animateur"),
    ("Notes de la présentation", "Notes de présentation", "animateur"),
]

# Documents de la série plutôt que leçons.
RESSOURCES = {
    "Plan du cours": "Plan du cours",
    "Couverture et consignes": "Couverture et consignes",
    "Coordonnées des participants": "Feuille des coordonnées des participants",
    "Brochure": "Brochure de présentation",
    "Révision du cours": "Révision du cours",
    "Révision - Élever ses enfants dans la foi": "Révision du cours",
    "Élever les enfants de Dieu - Plan du cours": "Plan du cours",
    "Planification selon Stephen Covey": "Tableau de planification (Stephen Covey)",
    "Ressources pour l’animateur": "Ressources pour l’animateur",
}

# Titres corrigés à la main (points d’interrogation perdus dans les noms de fichiers, auteurs…).
TITRES = {
    "Un Dieu bon, un monde mauvais pourquoi": "Un Dieu bon, un monde mauvais : pourquoi ?",
    "Rendez-vous avec le destin le jugement": "Rendez-vous avec le destin : le jugement",
    "Pourquoi la criminalité, la violence et l’immoralité augmentent-elles": "Pourquoi la criminalité, la violence et l’immoralité augmentent-elles ?",
    "Notre plus grand besoin un nouveau mode de vie": "Notre plus grand besoin : un nouveau mode de vie",
    "Qui est Jésus": "Qui est Jésus ?",
    "Qu’est-ce que la foi": "Qu’est-ce que la foi ?",
    "Pourquoi sommes-nous ici": "Pourquoi sommes-nous ici ?",
    "Pourquoi tant d’églises": "Pourquoi tant d’Églises ?",
    "Le baptême est-il nécessaire": "Le baptême est-il nécessaire ?",
    "Où êtes-vous après la mort": "Où êtes-vous après la mort ?",
    "Pourquoi tant de chrétiens célèbrent-ils le dimanche": "Pourquoi tant de chrétiens célèbrent-ils le dimanche ?",
    "Qui dominera le monde": "Qui dominera le monde ?",
    "Comment le monde finira-t-il": "Comment le monde finira-t-il ?",
    "Dieu se soucie-t-il de nous": "Dieu se soucie-t-il de nous ?",
    "Où se trouve l’enfer": "Où se trouve l’enfer ?",
    "Qui est l’Antichrist - 1re partie": "Qui est l’Antichrist ? (1re partie)",
    "Qui est l’Antichrist - 2e partie": "Qui est l’Antichrist ? (2e partie)",
    "Face au monde - Première partie": "Face au monde (1re partie)",
    "Face au monde - Deuxième partie": "Face au monde (2e partie)",
    "Le lieu saint — première partie": "Le lieu saint (1re partie)",
    "Le lieu saint — deuxième partie": "Le lieu saint (2e partie)",
    "Le jour des Expiations — le remède au péché": "Le jour des Expiations : le remède au péché",
    "Si je tombe - Quand le sanctuaire pourra-t-il fermer": "Si je tombe : quand le sanctuaire pourra-t-il fermer ?",
    "Résoudre le grand problème - Quelle est votre valeur": "Résoudre le grand problème : quelle est votre valeur ?",
    "Raoul Dederen - Réflexion sur la doctrine de la Trinité": "Réflexion sur la doctrine de la Trinité (Raoul Dederen)",
    "Pfandl - Les pionniers adventistes et la doctrine de la Trinité": "Les pionniers adventistes et la doctrine de la Trinité (Gerhard Pfandl)",
    "Amazing Facts - Le parler en langues": "Le parler en langues (Amazing Facts)",
    "Les pionniers adventistes et la Trinité - Français": "Les pionniers adventistes et la Trinité (présentation)",
    "Esprit de prophétie - Le Saint-Esprit et son œuvre - Torres": "Esprit de prophétie : le Saint-Esprit et son œuvre (Torres)",
    "Défendre la Divinité - Vance Ferrell": "Défendre la Divinité (Vance Ferrell)",
    "Fiabilité de la Bible": "Fiabilité de la Bible",
    "Vers Jésus - Fiches d’étude": "Vers Jésus : fiches d’étude",
    "Les secrets de l’espérance - Les sept Églises": "Les secrets de l’espérance : les sept Églises",
}

FORMATS = {
    "application/pdf": "PDF",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
    "application/msword": "Word",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PowerPoint",
    "application/vnd.ms-powerpoint": "PowerPoint",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
    "application/vnd.ms-excel": "Excel",
    "application/vnd.google-apps.document": "Google Docs",
    "application/vnd.google-apps.presentation": "Google Slides",
}


def sans_ext(nom):
    return re.sub(r"\.(pdf|docx?|pptx?|xlsx?|png|jpe?g)$", "", nom, flags=re.I).strip()


def joli(titre):
    """Titre affiché : correction manuelle, sinon « A - b » devient « A : b »."""
    titre = re.sub(r"\s+", " ", titre.replace("'", "’")).strip()
    if titre in TITRES:
        return TITRES[titre]
    if " - " in titre:
        tete, reste = titre.split(" - ", 1)
        reste = reste.replace(" - ", ", ")
        if reste[:1].isupper() and not reste.split(" ")[0].isupper():
            mot = reste.split(" ")[0]
            # garde la majuscule des noms propres courants
            if mot not in {"Jésus", "Dieu", "Christ", "Daniel", "Pierre", "Simon", "Pilate", "Esprit", "Écritures"}:
                reste = reste[0].lower() + reste[1:]
        return f"{tete} : {reste}"
    return titre


def cle_tri(num):
    m = re.match(r"(\d+)([A-Z]?)$", num)
    if m:
        return (0, int(m.group(1)), m.group(2))
    return (1, 0, num)


def sans_accents(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()


def main(chemin):
    fichiers = json.load(open(chemin, encoding="utf-8"))
    enfants = defaultdict(list)
    for f in fichiers.values():
        enfants[f.get("parentId")].append(f)

    def tous_les_fichiers(dossier):
        for f in enfants.get(dossier, []):
            if f["mimeType"].endswith(".folder"):
                yield from tous_les_fichiers(f["id"])
            else:
                yield f

    series = []
    oublies = []
    for niveau, slug, dossier, titre, texte in SERIES:
        lecons = {}
        ressources = []
        for f in tous_les_fichiers(dossier):
            nom = sans_ext(f["title"]).replace("'", "’")
            if any(x in nom for x in EXCLURE):
                continue
            fmt = FORMATS.get(f["mimeType"])
            if not fmt:
                oublies.append(f"{slug}: {f['title']} ({f['mimeType']})")
                continue
            doc = {"id": f["id"], "format": fmt}
            # numéro de leçon en tête : « 07 - », « A - », « Daniel 2A - »
            m = re.match(r"^(?:(\d{1,2})\.?|([A-G])|Daniel (\d{1,2}[AB]?)) - (.+)$", nom)
            corps = m.group(4) if m else nom
            num = (m.group(1) or m.group(2) or m.group(3)) if m else None
            if num and num.isdigit():
                num = str(int(num))
            # variante en fin de nom
            variante, role = None, None
            for suffixe, libelle, r in VARIANTES:
                if corps.endswith(" - " + suffixe):
                    corps = corps[: -len(suffixe) - 3]
                    variante, role = libelle, r
                    break
            # ressource de la série ?
            ress = None
            for motif, libelle in RESSOURCES.items():
                if corps.startswith(motif) or nom.startswith(motif) or (" - " + motif) in nom:
                    ress = libelle
                    break
            if ress or num == "0":
                doc["titre"] = ress or joli(corps)
                doc["_variante"] = variante
                ressources.append(doc)
                continue
            partie = re.match(r"^(.*) — partie (\d) sur \d$", corps)
            if partie:
                corps = partie.group(1)
                variante = "1re partie" if partie.group(2) == "1" else partie.group(2) + "e partie"
                role = "tous"
            tri = cle_tri(num or "ZZ" + corps)
            if slug == "daniel":
                m2 = re.match(r"(\d+)([AB]?)$", num)
                corps = f"Daniel {m2.group(1)}" + {"A": " (1re partie)", "B": " (2e partie)", "": ""}[m2.group(2)]
                num = None
            cle = tri
            le = lecons.setdefault(cle, {"num": num, "titre": joli(corps), "docs": [], "_tri": tri})
            doc["libelle"] = variante or ("Présentation" if fmt in ("PowerPoint", "Google Slides") else "Étude")
            doc["role"] = role or "tous"
            le["docs"].append(doc)
        ordre_role = {"participant": 0, "tous": 1, "animateur": 2}
        liste = []
        for le in sorted(lecons.values(), key=lambda x: x.pop("_tri")):
            le["docs"].sort(key=lambda d: (ordre_role[d["role"]], d["libelle"]))
            if le["num"] and not le["num"].isdigit() and slug == "quete-certitude":
                le["groupe"] = "Études complémentaires"
            liste.append(le)
        if not liste and not ressources:
            print(f"!! série vide : {slug}", file=sys.stderr)
        vus = defaultdict(int)
        for d in ressources:
            vus[d["titre"]] += 1
        for d in ressources:
            v = d.pop("_variante")
            if v and vus[d["titre"]] > 1:
                d["titre"] += f" ({v[0].lower() + v[1:]})"
        ressources.sort(key=lambda d: d["titre"])
        series.append({
            "id": slug, "niveau": niveau, "titre": titre, "texte": texte,
            "lecons": liste, "ressources": ressources,
        })

    # images (assets/images/<id>.webp) : étape, série, étude
    dossier_img = Path(__file__).resolve().parent.parent / "assets" / "images"
    def image(nom):
        return nom if (dossier_img / f"{nom}.webp").exists() else None
    niveaux = [dict(n) for n in NIVEAUX]
    for n in niveaux:
        if image(f"niveau-{n['id']}"):
            n["image"] = f"niveau-{n['id']}"
    for se in series:
        if image(f"serie-{se['id']}"):
            se["image"] = f"serie-{se['id']}"
        if len(se["lecons"]) > 1:
            for i, le in enumerate(se["lecons"], 1):
                nom = f"{se['id']}-{le['num'] or i}"
                if image(nom):
                    le["image"] = nom

    donnees = {"niveaux": niveaux, "series": series}
    sortie = Path(__file__).resolve().parent.parent / "donnees" / "bibliotheque.js"
    sortie.parent.mkdir(exist_ok=True)
    texte_js = ("/* Généré par outils/generer_bibliotheque.py à partir du Drive — ne pas modifier à la main. */\n"
                "window.BIBLIO = " + json.dumps(donnees, ensure_ascii=False, indent=1) + ";\n")
    sortie.write_text(texte_js, encoding="utf-8")
    n_lecons = sum(len(s["lecons"]) for s in series)
    n_docs = sum(len(l["docs"]) for s in series for l in s["lecons"]) + sum(len(s["ressources"]) for s in series)
    print(f"{len(series)} séries, {n_lecons} études, {n_docs} documents -> {sortie}")
    for o in oublies:
        print("   format ignoré :", o, file=sys.stderr)


if __name__ == "__main__":
    main(sys.argv[1])
