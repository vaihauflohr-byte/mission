"""« Vivre avec Jésus » (Stay Alive with Jesus, PAPSDA) : textes français des 15 leçons sur la mise en page
d'origine. Même gabarit que « Prendre vie avec Jésus » (en bleu). Reprend la traduction publiée sur le site
(alignée par aligner.py, textes/brouillons/vj-NN.json), corrigée et ajustée ici.
    python3 series/vivre_avec_jesus.py [N …]  -> textes/vj-NN.json
"""
import glob
import json
import os
import re
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ICI))
import natif  # noqa: E402
from series import prendre_vie as PV  # noqa: E402

FONCE, CLAIR = [0.041, 0.461, 0.701], [0.644, 0.761, 0.86]
SERIE = 'vivre-avec-jesus'
SEULE_REF = re.compile(r'(?:\d\. )?(?:[1-3] )?[A-Z][a-z]+ \d+:\d+[\d:,\- ]*(?:,? ?(?:first|last|second) (?:part|phrase))?\.?')
REF = re.compile(r'((?:\b[1-3] )?[A-ZÉ][a-zéèêëïîôûç]+\.? \d+)\.(\d+)')


def deux_points(t):
    """« Jean 14.1-3 » -> « Jean 14:1-3 » (comme l'original et les autres séries du site)."""
    if not isinstance(t, str):
        return t
    t = REF.sub(r'\1:\2', t)
    return re.sub(r'(\d+:\d+(?:-\d+)?), (\d+)\.(\d+)', r'\1 ; \2:\3', t)


def brouillon(n):
    return json.load(open(ICI / 'textes' / 'brouillons' / f'vj-{n:02d}.json', encoding='utf-8'))['u']


def ecrire_lecon(n, u, extra=None, titre=None):
    """u : unités propres à la leçon ; les autres viennent du brouillon (titres de rubrique en capitales,
    références « 14:1 »), du pied de page commun et des lignes-réponses gardées."""
    en = glob.glob(f'{natif.ORIG_RACINE}/{SERIE}/{n:02d} *.pdf')[0]
    source = os.path.relpath(en, natif.ORIG_RACINE)
    chemin = os.path.relpath(glob.glob(f'{natif.chemins.DOCUMENTS}/{SERIE}/{n:02d}-*.pdf')[0],
                             natif.chemins.DOCUMENTS)[:-4]
    doc = natif.pages_source(en, False)
    B = brouillon(n)
    tout = {}
    for i, page in enumerate(doc):
        for k, un in enumerate(natif.unites(page)):
            cle = f'{i + 1}.{k:02d}'
            t = natif.texte_unite(un)
            if un['marqueur']:
                continue
            if re.fullmatch(r'[_\s.]+|[a-h]\)\s*_+', t):
                tout[cle] = '='
            elif t in PV.COMMUN:
                v = PV.COMMUN[t]
                tout[cle] = v if v == '=' or i < len(doc) - 1 or un['lignes'][0]['bbox'][1] < 700 else {'html': v, 'ligne': True}
            elif re.fullmatch(r'Lesson \d+:?', t):
                tout[cle] = f'Leçon {n} :'
            elif cle in B and B[cle] is not None:
                v = deux_points(B[cle])
                if SEULE_REF.fullmatch(t):          # une référence seule : pas de question ajoutée
                    v = re.sub(r'^(Que (dit|disent|montre|montrent) (ce|ces) (passages|passage|versets|verset|récits|récit)|Lisez aussi|Lisez|Et celui-ci)\s*[?:.]?\s*', '', v)
                if un['lignes'][0]['taille'] >= 14 and natif.style_commun(un).startswith('b') and i > 0:
                    v = v.upper()
                tout[cle] = v
    tout.update(u)
    for i, page in enumerate(doc):
        U = natif.unites(page)
        for k, un in enumerate(U):
            if un['marqueur'] or not re.search(r'\d-\s*$', natif.texte_unite(un)):
                continue
            der = un['lignes'][-1]
            for j, m in enumerate(U):
                l0 = m['lignes'][0]
                if m['marqueur'] and re.fullmatch(r'\d{1,3}', l0['texte'].strip()) and abs(l0['bbox'][0] - der['bbox'][0]) < 4 \
                        and der['bbox'][3] - 3 < l0['bbox'][1] < der['bbox'][3] + 12:
                    tout.setdefault(f'{i + 1}.{j:02d}', None)
    if titre:
        tout['1.01'] = {'html': titre, 'ligne': False} if '<br>' in titre else titre
        if '<br>' in titre:          # titre sur deux lignes : le reste de la couverture descend d'une ligne
            for k, un in enumerate(natif.unites(doc[0])):
                cle = f'1.{k:02d}'
                if un['lignes'][0]['bbox'][1] > 360 and cle in tout and tout[cle] not in (None, '='):
                    v = tout[cle]
                    tout[cle] = {**(v if isinstance(v, dict) else {'html': v}), 'decaler': 27}
    # listes à puces, à numéros ou à lettres d'un seul bloc : {'puces': [...]}, {'numeros': [...]} ou
    # {'lettres': [...]} (+ autres options) ; les marques d'origine sont effacées
    for cle, v in list(tout.items()):
        if not (isinstance(v, dict) and ('puces' in v or 'numeros' in v or 'lettres' in v)):
            continue
        p, k = map(int, cle.split('.'))
        U = natif.unites(doc[p - 1])
        un = U[k]
        x0 = min(l['bbox'][0] for l in un['lignes'])
        haut, bas = un['lignes'][0]['bbox'][1] - 3, un['lignes'][-1]['bbox'][3] + 3
        marques = [(f'{p}.{j:02d}', m) for j, m in enumerate(U) if m['marqueur'] and m['lignes'][0]['bbox'][1] >= haut
                   and m['lignes'][0]['bbox'][3] <= bas and m['lignes'][0]['bbox'][2] <= x0 + 1]
        for mk, _ in marques:
            tout[mk] = None
        gauche = min([m['lignes'][0]['bbox'][0] for _, m in marques] or [x0 - 18])
        autres = {a_: b_ for a_, b_ in v.items() if a_ not in ('puces', 'numeros', 'lettres')}
        if 'puces' in v:
            tout[cle] = {**PV.puces(v['puces'], gauche=gauche), **autres}
        else:
            items = v.get('numeros') or v['lettres']
            marques_ = [f'{i + 1}.' if 'numeros' in v else f'{chr(97 + i)}.' for i in range(len(items))]
            tout[cle] = {**PV.liste(items, marques_, gauche, retrait=x0 - gauche), **autres}
    # paragraphes justifiés dans l'original (couverture) : justifiés aussi en français
    for k, un in enumerate(natif.unites(doc[0])):
        cle = f'1.{k:02d}'
        L = un['lignes']
        v = tout.get(cle)
        if len(L) >= 3 and v not in (None, '=') and max(l['bbox'][2] for l in L[:-1]) - min(l['bbox'][2] for l in L[:-1]) < 1.5:
            v = v if isinstance(v, dict) else {'html': v}
            if 'css' not in v:
                tout[cle] = {**v, 'css': 'body {text-align: justify;}'}
    textes = [
        {'x': 222, 'base': 236, 'texte': 'Vivre', 'police': PV.SCRIPT, 'taille': 118, 'couleur': FONCE},
        {'x': 536, 'base': 261, 'texte': 'avec Jésus', 'police': PV.NOIR, 'taille': 17, 'couleur': CLAIR, 'aligne': 'droite'},
    ]
    titre = json.load(open(natif.chemins.MISSION / 'outils' / 'documents' / 'liste.json', encoding='utf-8'))
    titre = next(e['titre'] for e in titre if e['chemin'] == chemin)
    T = {'source': source, 'chemin': chemin, 'livret': False, 'titre': titre, 'auteur': 'PAPSDA — traduction française',
         'effacer_dessins': {'1': [[186, 106, 548, 275]]}, 'textes': {'1': textes},
         'reglages': {'cadre_colonnes': True, 'traits_fins': True}, 'u': dict(sorted(tout.items()))}
    for k, v in (extra or {}).items():
        if k in ('effacer_dessins', 'textes', 'zones'):
            for page, liste_ in v.items():
                T.setdefault(k, {}).setdefault(page, []).extend(liste_)
        else:
            T[k] = v
    json.dump(T, open(ICI / 'textes' / f'vj-{n:02d}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'vj-{n:02d}', len(T['u']), 'unités')


def numero(n, texte):
    """Point numéroté dont le numéro est en Myriad Black 14 pt bleu clair et le texte en Cambria 11 pt gris."""
    return {'html': f'<span class="n">{n}.</span> {texte}', 'famille': 'caladea', 'taille': 11, 'interligne': 13.3,
            'ligne': False, 'css': 'body, body * {color: #6d6e71;} .n {font-family: sourcenoir; font-size: 14pt; color: #a4c3dc;}'}


LECONS = {}


def lecon(n):
    def deco(f):
        LECONS[n] = f
        return f
    return deco


@lecon(1)
def l1():
    ecrire_lecon(1, {
        '1.04': {'decaler': 8, 'html': 'À mesure que votre amour pour Jésus grandira, votre désir de le voir grandira aussi.'},
        '1.02': 'Au fil des siècles, des familles ont vu partir un mari, une épouse, un père, une mère, un être aimé, un fils, une fille, un frère ou une sœur pour faire la guerre, explorer de nouvelles contrées ou gagner leur vie. Ceux qui restaient ont toujours gardé cet espoir : « Il reviendra. Elle reviendra. » L’amour pousse à guetter et à désirer le retour des absents.',
        '2.02': 'Que promet Jésus ? Jean 14:1-3 (remarquez surtout le verset 3)',
        '2.03': 'SIGNES DANS LE MONDE POLITIQUE',
        '2.06': 'Vous verrez aussi des signes dans le monde politique. Lesquels ? Matthieu 24:6-7',
        '2.13': 'Les disciples se demandaient quand Jésus reviendrait. Ils lui ont demandé : « Quel sera le signe de ton avènement et de la fin du monde ? » (Matthieu 24:3)',
        '2.14': 'Jésus a clairement indiqué qu’il ne pouvait pas donner de date précise : « Pour ce qui est du jour et de l’heure, personne ne le sait, ni les anges des cieux, mais le Père seul » (Matthieu 24:36). Il a pourtant répondu à ses disciples en leur décrivant des signes, comme des bornes sur la route, qui leur permettraient de voir que l’histoire avance vers son grand dénouement : le retour du Christ.',
        '2.15': 'SIGNES DANS LE MONDE INTELLECTUEL',
        '2.21': 'SIGNES DANS LE MONDE PHYSIQUE',
        '2.22': 'Daniel a mentionné deux choses qui marqueraient la fin des temps : des gens qui courent çà et là, et l’accroissement de la connaissance. Les spécialistes de la Bible l’interprètent de deux façons :',
        '2.23': 'Quels sont quelques-uns des signes dans le monde physique ? Matthieu 24:7, deuxième partie',
        '2.26': 'La connaissance des prophéties de Daniel, longtemps cachées, qui annoncent le retour du Christ, augmenterait.',
        '2.30': 'Les connaissances en général et les voyages se multiplieraient.',
        '2.28': 'Sur notre planète, 1,2 milliard de personnes n’ont pas les moyens de se procurer l’essentiel : nourriture, vêtements, logement. C’est près du quart de la population mondiale !',
        '2.31': 'La famine est un signe que le monde se rapproche du retour du Christ. Quand vous pensez aux grands tremblements de terre de ces dernières années, vous constatez une fois de plus',
        '2.01': 'qu’un autre des signes du retour du Christ est en train de s’accomplir.',
        '2.32': 'Quand on pense qu’en cent ans l’humanité est passée du cheval aux voyages dans l’espace, on reconnaît que la prophétie de Daniel s’est accomplie ! Et quand Daniel',
        '3.00': 'annonçait une augmentation des connaissances, il ne pouvait pas imaginer la « surcharge d’informations » que la plupart d’entre nous connaissent aujourd’hui. Les prophéties de Daniel sont des preuves frappantes que le Christ revient bientôt ; mais il y a encore d’autres signes à considérer.',
        '3.05': 'SIGNES DANS LE MONDE SOCIAL',
        '3.18': 'SIGNES DANS LE MONDE RELIGIEUX',
        '3.25': 'L’ÉVANGILE AU MONDE ENTIER',
        '3.01': 'Que faut-il faire, selon Jésus, quand vous entendez de tels enseignements ? Matthieu 24:26, dernière partie',
        '3.06': 'Pourquoi ? Matthieu 24:27-30 ; Apocalypse 1:7',
        '3.08': 'Comment 2 Timothée 3:1-5 décrit-il les hommes des derniers jours ?',
        '3.16': 'En plus des signes dans le monde physique, intellectuel et social, vous trouverez des signes dans le monde religieux.',
        '3.14': 'En relisant les signes que le Christ a donnés à ses disciples dans Matthieu 24, vous remarquerez qu’ils conduisent tous à son retour. Matthieu 24:6 dit, à la fin : « Il faut que ces choses arrivent. Mais ce ne sera pas encore la fin. » Mais il y a un signe dont Jésus a dit qu’une fois accompli, il reviendrait.',
        '3.20': 'Jésus a mis en garde contre une séduction qui aurait lieu avant son retour. De quelle séduction s’agit-il ? Matthieu 24:4-5, 23-24',
        '3.34': 'Aujourd’hui, beaucoup de gens enseignent que Jésus reviendra en secret ou qu’il est déjà venu.',
        '4.00': 'Des pays autrefois fermés aux idées nouvelles s’ouvrent ; des murs de séparation tombent : de grandes occasions s’offrent à la prédication de l’Évangile. Dieu a mille moyens d’accomplir son œuvre. Qui sait avec quelle rapidité il pourrait achever de répandre l’Évangile !',
        '4.03': 'Est-ce que j’attends avec joie le retour du Christ ? Pourquoi ?',
    })


@lecon(2)
def l2():
    ecrire_lecon(2, {
        '2.05': 'Matthieu 24:27',
        '2.08': 'Marc 13:26',
        '2.06': 'Le retour du Christ concernera toutes les personnes qui ont vécu sur la terre. Chacune fera partie de l’un de ces quatre groupes :',
        '2.09': '1. Les chrétiens vivants<br>2. Les chrétiens morts<br>3. Les non-chrétiens vivants<br>4. Les non-chrétiens morts',
        '2.13': 'Le retour de Jésus aura un effet différent sur chacun de ces groupes.',
        '2.14': 'La première fois, Jésus est venu sur la terre sans bruit. Il n’en sera pas ainsi la seconde fois : il viendra en roi, avec gloire et puissance. Sa première venue, quand il est né bébé, est passée inaperçue pour la plupart des gens. Combien de personnes le verront à son retour ? Apocalypse 1:7',
        '2.16': 'Qu’arrivera-t-il aux chrétiens encore vivants au retour de Jésus ? 1 Thessaloniciens 4:16-17 (surtout le verset 17)',
        '2.17': '« Tout œil le verra. » Vous le verrez. Vos voisins le verront. Partout sur la terre, tous les regards se tourneront vers Jésus, le Roi qui revient victorieux. Son retour ne sera pas un « enlèvement secret » connu de quelques chrétiens seulement : ce sera un événement public. Il ne viendra pas en cachette enlever les justes à l’insu de tous. D’ailleurs, le Christ a mis en garde contre l’enseignement d’un retour secret. Qu’a-t-il dit ? Matthieu 24:23-26',
        '2.33': 'Vous n’avez pas à craindre de manquer le',
        '2.01': 'retour de Jésus. Vous le verrez quand il reviendra !',
        '3.10': 'Jean 14:3',
        '3.12': 'Il veut que vous soyez avec lui : voilà pourquoi il revient ! L’amour est la raison de son retour.',
        '3.13': 'Que vivront ceux qui ont choisi de ne pas suivre le Christ ? Apocalypse 6:15-17',
        '3.15': None,
        '3.14': 'En plus d’une place auprès de lui pour toujours, que vous apportera Jésus à son retour ? 2 Timothée 4:8',
        '3.23': 'La couronne de justice symbolise la victoire complète sur le péché qui sera la vôtre, non parce que vous aurez vaincu l’ennemi, mais parce que le Christ l’a vaincu. Le combat contre le péché sera terminé. Vous ne serez plus jamais tenté. Vous porterez la couronne du vainqueur ! N’est-il pas incroyable que Jésus vous aime au point de :',
        '3.27': {'puces': ['prendre votre place sur la croix, afin que vous puissiez avoir une place avec lui dans son royaume ;',
                           'prendre votre défaite et vous donner sa victoire sur le péché ;',
                           'subir le châtiment de vos péchés et vous donner l’éternité avec lui : plus de péché, plus de maladie, plus de mort !']},
        '3.32': 'Cela ne vous donne-t-il pas envie de vous écrier : « Oui, viens, Seigneur Jésus ! » (Apocalypse 22:20)',
        '3.33': 'Les non-chrétiens morts avant le retour de Jésus',
        '3.34': 'La Bible ne mentionne aucun changement dans la situation des',
        '3.01': 'méchants déjà morts. Apparemment, ils restent morts.',
    })


@lecon(3)
def l3():
    ecrire_lecon(3, {
        '3.16': 'LES MILLE ANS D’APOCALYPSE 20',
        '2.11': 'N’aimez-vous pas ces mots : « Le Seigneur lui-même descendra » ? Sa présence visible et personnelle marque le début de l’éternité.',
        '2.28': 'Les méchants vivants sont tués par la puissance de sa venue. 2 Thessaloniciens 1:8-9 ; Apocalypse 6:15-17',
        '2.31': {'decaler': 12, 'html': 'Il y a encore un événement que vous n’avez pas étudié dans ces leçons. Lequel ? Apocalypse 20:1-3'},
        '3.17': 'Les événements du début',
        '3.19': {'puces': ['Le Christ revient', 'Les justes morts ressuscitent', 'Les justes vivants sont enlevés au ciel',
                           'Le corps des justes est transformé', 'Les méchants vivants sont tués', 'Satan est lié']},
        '3.28': 'Les événements pendant les mille ans',
        '3.30': {'puces': ['La terre est dévastée : l’abîme', 'Tous les méchants sont morts', 'Satan est confiné sur la terre',
                           'Les saints règnent et jugent avec Dieu']},
        '3.36': 'Les événements de la fin',
        '3.37': {'puces': ['Les méchants ressuscitent', 'Satan est relâché', 'Satan séduit les nations', 'La ville sainte descend',
                           'Les méchants entourent la ville', 'Les méchants sont détruits', 'La nouvelle terre']},
        '4.00': 'POUR VOTRE RÉFLEXION',
        '4.01': 'Est-ce que je me réjouis de passer l’éternité avec Jésus ? Quelle est l’une des premières choses que je veux lui dire ? Quelles autres personnes j’espère y retrouver ?',
    })


@lecon(4)
def l4():
    ecrire_lecon(4, {
        '2.35': 'Lisez Apocalypse 21 et 22 : vous y trouverez la description du nouveau gouvernement que Dieu va établir sur la terre, avec des détails intéressants sur sa capitale, la nouvelle Jérusalem. Mais la meilleure nouvelle, sur la nouvelle terre, c’est qu’il n’y aura plus de mauvaises nouvelles ! Qu’est-ce qui n’y sera pas ? Apocalypse 21:4, 8, 27 ;',
        '2.01': 'Apocalypse 22:15',
        '2.33': 'Vous serez « semblable à lui ». Quel était le corps de Jésus ressuscité ? Luc 24:36-43',
        '3.21': 'QUI SERA SUR LA NOUVELLE TERRE ?',
        '3.22': 'Avec un corps nouveau, vous ne serez plus malade, vous ne vieillirez pas et vous ne mourrez jamais.',
    }, titre='La nouvelle terre<br>que Dieu vous prépare')


@lecon(5)
def l5():
    ecrire_lecon(5, {
        '2.00': 'LE CORPS',
        '2.09': 'LE SOUFFLE (L’ESPRIT)',
        '2.11': 'Quand une personne meurt, que devient son souffle ? Pour répondre à cette question, il faut comprendre un peu le sens du mot « souffle » dans la Bible. Il y est employé indifféremment avec le mot « esprit ». On peut donc poser la question ainsi : que devient l’esprit quand une personne meurt ? Ecclésiaste 12:7',
        '2.17': 'Comment Genèse 2:7 décrit-il la création de l’être humain ?',
        '2.13': 'Mais que se passe-t-il entre la mort et la résurrection ? L’esprit ou l’âme va-t-il au ciel, ou ailleurs, pendant que le corps reste dans la tombe ? Ou la personne entière est-elle dans la tombe ? Pour comprendre ce qui se passe à la mort, examinons les éléments que Dieu a employés pour créer l’homme au commencement.',
        '2.20': {'aligne': 'centre', 'html': 'Poussière + souffle (esprit) = être vivant'},
        '2.22': 'L’ÊTRE VIVANT (L’ÂME)',
        '2.23': {'aligne': 'centre', 'html': 'Poussière + souffle = être vivant / âme'},
        '2.24': 'Comme nous l’avons vu, les mots « être vivant » de Genèse 2:7 sont aussi traduits « âme vivante ». Dans la Bible, le mot « âme » désigne la personne tout entière. Ou, selon notre formule : poussière + souffle (esprit) = être vivant (âme). L’âme n’est donc que la somme des deux autres éléments. Retirez-en un, par exemple le souffle : que reste-t-il ?',
        '2.25': 'Dans la Bible, « être vivant » et « âme vivante » traduisent le même mot. Comparez Genèse 2:7 dans deux traductions : selon les versions, on lit « âme vivante » ou « être vivant ».',
        '2.27': 'Poussière − souffle (esprit) = plus d’âme vivante',
        '2.28': 'C’est précisément ce qu’enseigne la Bible. Quand le souffle de vie est retiré, la vie cesse. « Les mots hébreux et grecs que nous traduisons par “âme” et “esprit”',
        '3.00': 'apparaissent quelque 1 700 fois dans la Bible… Dans aucune de ces 1 700 occurrences des mots originaux pour âme et esprit, l’un ou l’autre n’est dit immortel, impérissable, indestructible, éternel, incapable de mourir ou en possession de l’immortalité. Les morts ne sont pas non plus présentés comme capables d’une existence consciente hors du corps. »',
        '3.04': '(Arthur G. Lickey, <i>God Speaks to Modern Man</i>, Washington DC, Review and Herald Publishing Assn, 1952, p. 489)',
        '3.07': 'Au lieu de dire que l’esprit ou l’âme continue de vivre après la mort, la Bible décrit la mort tout autrement. Que dit-elle ? Ecclésiaste 9:5-6, 10',
        '3.16': 'LA MORT : UN SOMMEIL ?',
        '3.18': 'La Bible dit clairement que les morts ne savent rien ; elle compare plus de cinquante fois la mort à un sommeil inconscient. Jésus a employé cette comparaison dans Jean 11:1-45. Qu’a-t-il dit de Lazare ? Jean 11:11-14',
        '3.21': 'Jésus a appelé Lazare hors du tombeau, et il appellera tous les justes hors de leurs tombeaux. Quand cela aura-t-il lieu ? 1 Corinthiens 15:22-23',
        '3.23': 'MAIS POURQUOI MEURT-ON ?',
        '3.25': {'puces': ['Parce qu’Adam et Ève ont péché. (Genèse 3:1-6)',
                           'Le péché est une séparation d’avec Dieu. (Ésaïe 59:2)',
                           'Dieu seul possède l’immortalité. (1 Timothée 1:17) « Immortel » signifie « impérissable, éternel, qui ne peut pas mourir ».',
                           'Les hommes meurent parce que le péché les sépare de Dieu, la seule source de la vie éternelle.']},
    })


@lecon(6)
def l6():
    ecrire_lecon(6, {
        '2.32': 'Quand la Bible parle de la destruction finale des méchants, elle emploie des expressions comme « consumés », « dévorés », « brûlés » et « cendres ».',
        '2.01': 'Elle dit aussi que Satan ne sera plus jamais. Toutes ces expressions semblent bien définitives. Ce qui est consumé ne continue pas de brûler : c’est détruit. Que devient un feu quand il n’a plus rien à brûler ? Il s’éteint.',
        '2.05': 'Manifestement, le feu de l’enfer s’éteint lui aussi. Il ne brûlera pas éternellement.',
        '2.10': 'Tout d’abord, le mot « enfer » apparaît 55 fois dans la Bible anglaise, et 12 fois seulement il désigne un « lieu où l’on brûle ».',
        '1.03': {'decaler': 10, 'html': '« Eh bien, je suis heureuse de vous dire que Dieu n’est pas ainsi », répondit son aînée. Elle lui expliqua alors que l’on avait donné de Dieu une mauvaise image et que le sujet du feu de l’enfer avait été largement mal compris.'},
        '4.01': 'Est-ce que j’ai hâte que Dieu supprime le péché et bâtisse une nouvelle terre parfaite ?',
        '2.21': 'L’ensemble de ces indices montre que les mots bibliques traduits par « enfer » désignent simplement la mort ou la tombe, et non un feu sans fin. Mais certains textes semblent dire que l’enfer dure toujours. Que dit Apocalypse 14:11 ?',
        '2.22': 'Comment Malachie 4:1-3 décrit-il le moment de la destruction finale ?',
        '2.31': 'Il est aussi important de comprendre l’emploi biblique du mot « toujours ». Son sens dépend de ce qu’il décrit. Quand il s’applique à Dieu, il signifie « sans fin ».',
        '3.00': 'Appliqué aux hommes, il signifie « aussi longtemps qu’ils vivent », « jusqu’à leur mort ».',
        '3.17': 'À CONSIDÉRER',
        '3.18': 'Remarquez à nouveau les mots « périr », « s’évanouir en fumée », « être consumés ». C’est une destruction totale et définitive. Les méchants ne seront pas punis sans fin, mais leur châtiment durera à jamais. Et le « feu éternel » dont parle Matthieu 25:41 ? Quels termes la Bible emploie-t-elle pour décrire la destruction de Sodome et Gomorrhe ? Jude 7',
        '3.25': 'Ces villes ne brûlent pas aujourd’hui ; pourtant la Bible parle de « feu éternel ». Là encore, ce sont les effets du feu qui sont éternels, non le feu lui-même.',
        '3.19': numero(1, 'Selon la Bible, l’enfer a lieu sur cette terre, à la fin des mille ans ; ensuite, Dieu crée une nouvelle terre. Comment la nouvelle terre pourrait-elle exister là où le feu de l’enfer brûlerait sans fin ?'),
        '3.20': None,
        '3.21': numero(2, 'La Bible emploie des expressions comme « consumés », « détruits » et « ne plus être » pour décrire la destruction complète de Satan et de ses partisans. N’est-il pas incohérent de dire que les méchants continuent de vivre dans le feu de l’enfer, alors que la Bible dit qu’une fois détruits, ils cesseront d’exister ?'),
        '3.22': None,
        '3.26': numero(3, 'La Bible dit que la seule façon d’avoir la vie éternelle, c’est Jésus-Christ. Si les méchants brûlaient sans fin, ils garderaient une forme de vie qui ne finirait jamais. Comment les méchants pourraient-ils avoir la vie éternelle sans Jésus ?'),
        '3.27': None,
    })


POEME_7 = ('On peut aller au ciel<br>sans la santé,<br>sans la prospérité,<br>sans la gloire,<br>sans un nom dans l’histoire,<br>'
           'sans le savoir,<br>sans un gros avoir,<br>sans la culture,<br>sans amis,<br>sans mille autres choses,<br>'
           'mais on ne peut jamais aller au ciel<br>sans le Christ.<br><br>— Anonyme —')


@lecon(7)
def l7():
    poeme = {'rect': [256, 538, 516, 740], 'html': POEME_7,
             'css': 'body {text-align: center; font-family: caladea; font-size: 11pt; line-height: 13.15pt; color: #6d6e71;}'}
    ecrire_lecon(7, {
        '1.03': 'C’est là que la Bible apporte une bonne nouvelle : vous n’avez pas besoin d’être « assez bon » pour y aller, il vous suffit de connaître la bonne personne pour y entrer. Et cette personne, c’est Jésus. Il est le seul et unique billet d’entrée pour le ciel.',
        **PV.effacees(*[f'1.{k:02d}' for k in range(4, 15)]),
        '2.04': 'PREMIÈRE ÉTAPE VERS LE CIEL', '2.06': 'Reconnaître votre besoin de Jésus',
        '2.27': 'DEUXIÈME ÉTAPE VERS LE CIEL', '2.28': 'Croire en Jésus',
        '2.29': 'TROISIÈME ÉTAPE VERS LE CIEL', '2.31': 'Venir à Jésus',
        '3.00': 'QUATRIÈME ÉTAPE VERS LE CIEL', '3.01': 'Vous repentir de vos péchés',
        '3.05': 'CINQUIÈME ÉTAPE VERS LE CIEL', '3.06': 'Recevoir l’adoption et l’héritage',
        '2.30': 'Une fois que vous avez reconnu votre besoin de Jésus, que devez-vous faire ? Jean 3:16, deuxième partie ; Actes 16:31',
        '4.02': '(Si vous n’en êtes pas sûr parce que vous n’avez jamais accepté Jésus comme Sauveur et Seigneur, pourquoi ne pas le faire maintenant ? Écrivez une prière pour lui demander le pardon de vos péchés et l’inviter dans votre vie.)',
        '4.07': '(Si vous avez accepté Jésus comme Sauveur et Seigneur, pourquoi ne pas lui écrire quelques mots pour le remercier de son don de la vie éternelle ?)',
    }, extra={'zones': {'1': [poeme]}})


@lecon(8)
def l8():
    ecrire_lecon(8, {
        '1.01': 'Le baptême est-il nécessaire ?',
        '2.34': 'Remarquez que Jésus a été baptisé dans le Jourdain, et que l’eunuque l’a été lui aussi dans un endroit où il y avait assez d’eau pour que Philippe et lui « descendent dans l’eau ».',
        '3.06': 'Votre Seigneur a le pouvoir de vous changer et de vous garder changé. Mais vous devez le laisser agir en vous jour après jour.',
        '4.09': 'Oui. Je vais faire le nécessaire pour être baptisé bientôt.',
        '2.17': 'CONDITIONS POUR LE BAPTÊME',
        '2.19': 'COMMENT ÊTRE BAPTISÉ ?',
        '2.21': 'Comment serez-vous baptisé ? Jésus a laissé un exemple. Où a-t-il été baptisé ? Marc 1:9',
        '2.22': 'Vous devez croire que Jésus, le Fils de Dieu, est mort pour vous sauver. Mais avant de pouvoir croire, il faut apprendre. Qu’a demandé Jésus à ses disciples quand il les a envoyés dans le monde pour témoigner de lui ? Matthieu 28:19-20',
        '2.26': 'Relisez l’histoire de Philippe et de l’eunuque. Comment l’eunuque a-t-il été baptisé ? Actes 8:36-38',
        '2.29': 'Dans les récits suivants, remarquez la prédication et l’enseignement qui ont précédé la foi et le baptême. Actes 8:35-38',
        '2.37': 'Le mot « baptiser » vient du grec « baptizô », qui signifie « tremper, immerger, plonger ». Ni Jésus ni l’eunuque n’ont été baptisés par aspersion ou par effusion. Ils ont été',
        '3.00': 'immergés. Combien de baptêmes la Bible reconnaît-elle ? Éphésiens 4:5',
        '3.38': 'Le baptême n’est pas un vaccin contre la tentation. Tant que vous vivrez sur cette terre de péché, vous serez tenté ; mais vous aurez la puissance de',
        '3.01': 'Dieu pour vous aider. Que vous promet-il ? Jude 1:24',
        '3.23': 'Quand vous êtes baptisé, vous montrez que vous croyez en Jésus et que vous l’acceptez, lui qui :',
        '3.25': {'puces': ['est mort pour vos péchés ;', 'a enseveli votre vie passée de péché ;', 'est ressuscité pour une vie nouvelle.']},
        '3.24': 'La Bible dit que lorsque nous acceptons le Christ, nous sommes adoptés dans sa famille. Voir Jean 1:12 ; Romains 8:15 ; Galates 4:5 ; Éphésiens 1:5 ; 4:14-15',
        '3.30': 'Le baptême et cette vie nouvelle signifient-ils que vous ne serez plus tenté de pécher ? Qu’est-il arrivé à Jésus juste après son baptême ? Matthieu 4:1',
        '3.39': 'Comment vous entendre avec des gens',
        '4.00': 'si différents ? 1 Pierre 2:17 ; Galates 6:2 ; Éphésiens 5:21',
        '4.03': 'Il ne sera pas toujours facile de vous entendre avec les autres membres de la famille de Dieu. Comment y parvenir ? Jude 1:21',
    })


@lecon(9)
def l9():
    ecrire_lecon(9, {
        '2.04': 'b) Daniel 7:7-10',
        '2.32': 'a) Apocalypse 14:6-7',
        '2.07': 'Selon le dictionnaire, un avocat est « une personne qui plaide la cause d’une autre, notamment devant un tribunal ». Autrement dit, c’est un défenseur.',
        '2.10': 'Dans ce chapitre de la Bible, Daniel voit l’histoire du monde représentée par des animaux symboliques. Il y est question de quatre royaumes (les bêtes) qui se divisent en dix gouvernements ; l’un d’eux acquiert une grande puissance et persécute le peuple de Dieu. Vient ensuite une scène de jugement (« les juges s’assirent »), puis Dieu établit son royaume pour son peuple.',
        '2.11': 'Que fait actuellement au ciel Jésus, votre avocat ? Hébreux 7:25 ; 9:24',
        '2.14': 'Intercéder, c’est « présenter une requête ou une supplication en faveur de quelqu’un d’autre ». Pourquoi avez-vous besoin que Jésus intercède pour vous comme votre avocat ? 2 Corinthiens 5:10',
        '2.15': 'Ces versets donnent la chronologie suivante :',
        '2.17': 'Quatre empires mondiaux<br>Dix royaumes<br>Un royaume très puissant<br>Le jugement commence. Dieu établit son royaume (retour de Jésus)',
        '2.23': 'En comparant la vision de Daniel avec l’histoire du monde, des spécialistes de la Bible ont situé le début du jugement au début des années 1800. Cette leçon ne permet pas d’examiner tous les éléments qui conduisent à cette conclusion.',
        '2.24': 'UN PROCÈS AU CIEL',
        '2.25': 'La Bible dit qu’un jugement est en cours. Comment le décrit-elle ? Daniel 7:9-10',
        '2.26': '(Pour en savoir plus, voir C. Mervyn Maxwell, <i>God Cares</i>, vol. 1, p. 195-249, Pacific Press Publishing Assoc., 1981)',
        '2.29': 'QUE S’EST-IL PASSÉ AU DÉBUT DES ANNÉES 1800 ?',
        '2.30': 'QUAND LE JUGEMENT A-T-IL LIEU ?',
        '2.31': 'Un réveil religieux toucha alors le monde entier autour de ce message : « Le Christ revient en 1844. » Nous savons bien sûr que Jésus n’est pas venu à cette date. On s’était trompé sur ce qui devait se passer, mais pas sur le moment. L’événement n’était pas le retour du Christ. C’était le',
        '3.00': 'début du jugement, qui a lieu avant le retour du Christ, comme l’indique la chronologie de Daniel 7. Ce jugement se déroule actuellement au ciel.',
        '3.02': 'Pourtant, dans la leçon sur les mille ans, vous avez étudié un jugement qui a lieu après le retour du Christ, pendant les mille premières années de l’éternité. La Bible se contredit-elle ? Non : elle présente simplement le jugement en trois phases, un peu comme notre système judiciaire. Les voici :',
        '3.11': '2. Le jugement de révision',
        '3.13': '3. Le prononcé du jugement',
        '3.18': 'Remarque : la suite de cette leçon ne traite que de la première phase du jugement.',
        '3.19': 'Comment Zacharie décrit-il le temps du jugement ? Zacharie 3:1-5',
        '4.05': 'N’est-il pas réjouissant de savoir que vous n’avez pas à craindre le jugement, puisque votre avocat n’a jamais perdu une affaire ? Pourquoi ne pas prendre une minute pour lui écrire votre reconnaissance ?<br>___',
    })


@lecon(10)
def l10():
    ecrire_lecon(10, {
        '2.01': 'Paul, l’auteur de l’épître aux Colossiens, et Jésus semblent ne pas être d’accord. Paul parle de prescriptions clouées à la croix, alors que Jésus a dit qu’il n’était pas venu abolir la loi, mais l’accomplir. Comment comprendre cela ?',
        '2.04': 'En comprenant ce que la Bible veut dire quand elle parle de lois et de prescriptions.',
        '2.06': 'Pour les Juifs du temps du Christ, le mot « Loi » ne désignait pas seulement les dix commandements, mais aussi les écrits de l’Ancien Testament (Exode, Lévitique, Nombres, Deutéronome) qui exposent les prescriptions données à Israël. Il désignait aussi les dix commandements eux-mêmes. Comment savoir de quoi parle la Bible ?',
        '2.09': 'Jésus a souligné deux choses essentielles pour avoir la vie éternelle : obéir aux commandements et le suivre. Ces deux traits marquent aussi le peuple de Dieu à la fin des temps. Comment la Bible décrit-elle le peuple de Dieu des derniers jours ? Apocalypse 12:17 (dernière partie)',
        '2.18': 'La première est la loi morale de Dieu, sa règle de vie pour son peuple. Quelle est une autre catégorie de lois ? Exode 21 et 22. Parcourez rapidement ces chapitres pour avoir une idée de leur contenu.',
        '2.23': 'Ce sont des lois civiles, qui développent et appliquent les dix commandements. Elles ressemblent à beaucoup de nos lois actuelles. Quelqu’un a même estimé qu’il existe environ 35 millions de lois rien que pour faire respecter les dix commandements !',
        '2.27': 'Quelle est une autre catégorie de lois ? Lévitique 11 à 15. Lisez les titres de ces chapitres pour avoir une idée de leur sujet.',
        '3.04': 'La loi morale',
        '3.06': 'La règle de vie de Dieu : les dix commandements',
        '3.08': 'Les lois civiles',
        '3.09': 'L’application des dix commandements',
        '3.11': 'Les lois sanitaires',
        '3.12': 'Les règles d’hygiène et de santé',
        '3.14': 'Les lois cérémonielles',
        '3.16': 'Les instructions sur le culte et sur le traitement du péché',
        '3.18': 'Lesquelles de ces lois ont donc été « clouées à la croix » ? Les dix commandements ? Difficilement : notre système judiciaire repose encore sur eux. Les lois civiles ? Pas si elles ne font que développer les dix commandements. Elles changent et s’adaptent aux sociétés, mais elles existent toujours. Et les lois sanitaires ? Nous n’avons pas les mêmes, mais nous avons bel et bien des lois pour protéger notre santé.',
        '3.23': 'Il ne reste donc que les lois cérémonielles comme lois abolies. Et c’est logique, car toutes ces cérémonies avaient été établies dans un seul but : annoncer Jésus, l’Agneau de Dieu, qui allait se charger des péchés du monde. À sa mort, il n’a plus été nécessaire d’apporter un agneau au temple : on pouvait désormais se confier en Jésus, qui porte nos péchés.',
        '3.24': 'Revenez à Colossiens 2:13-17 et remarquez surtout le verset 17, qui dit que ces choses étaient « l’ombre des choses à venir ». Quelle loi est une ombre ? Hébreux 10:1',
        '3.27': 'Ce sont les lois cérémonielles, « l’ombre des choses à venir », qui ont été abolies. Plus besoin de sacrifier un agneau : nous pouvons nous confier en Jésus. Dans les leçons précédentes,',
        '3.01': 'nous avons vu que nous sommes tous pécheurs, tous transgresseurs de la loi. Mais Jésus est devenu l’agneau sacrifié pour nos péchés. Quand nous l’acceptons, nos péchés sont pardonnés. Une fois pardonnés, allons-nous ignorer sa loi et continuer à pécher ? Romains 6:1-2',
    })


@lecon(11)
def l11():
    ecrire_lecon(11, {
        '1.02': 'Aimeriez-vous être plus efficace au travail, avoir une vie de famille plus épanouie et 50 % de chances en plus que vos enfants refusent la drogue ? C’est possible, en faisant ce que font chaque semaine cent millions d’Américains : aller régulièrement à l’église. C’est ce que montre une enquête récente* : ceux qui participent régulièrement au culte ne sont pas seulement utiles à leur communauté (les églises et les synagogues arrivent en tête des 24 organismes jugés les plus bénéfiques à la vie urbaine) ; ils s’assurent aussi une vie meilleure.',
        '1.04': '*Article de l’Associated Press, <i>The Press Enterprise</i> (Riverside, Californie), 21 avril 1990',
        '2.09': 'Dieu a créé le repos ! Il a délibérément institué le septième jour pour le repos. Le principe de six jours de travail et d’un jour de repos est si important qu’il en a fait l’un des dix commandements. Que faut-il faire, selon lui, pendant six jours de la semaine ? Et le septième ? Exode 20:8-10',
        '2.18': 'Quelles bénédictions Dieu promet-il si vous vous reposez le jour du sabbat ? Ésaïe 58:13-14',
        '2.38': 'En suivant le plan de Dieu pour le travail et le repos, vous suivez son propre exemple à la création, et vous attestez aussi que vous croyez qu’il est le Créateur du monde.',
        '2.39': 'Puisque Jésus est le Seigneur du sabbat et le Seigneur de votre vie, il a donné des instructions pour « se souvenir de son jour, pour le sanctifier ».',
        '3.02': 'Lévitique 23:3 ; Exode 20:8-11',
        '3.06': 'Néhémie 13:15-19',
        '3.10': 'Ésaïe 58:13',
        '3.15': 'Luc 4:16 ; Hébreux 10:25',
        '3.21': 'Matthieu 12:11-13',
        '2.22': 'En vous reposant le septième jour, vous montrez que vous croyez être sauvé non par vos œuvres, mais par la confiance en Dieu.',
        '3.24': 'Vous l’observerez aussi si Jésus, Seigneur du sabbat, est le Seigneur de votre vie.',
        '3.26': '« Le sabbat n’est pas destiné à être une période d’inactivité inutile. La loi interdit le travail profane le jour du repos du Seigneur ; le labeur qui fait vivre doit cesser ; aucun travail pour le plaisir ou le profit du monde n’est permis ce jour-là. Mais comme Dieu a cessé son œuvre de création, s’est reposé le jour du sabbat et l’a béni, l’homme doit quitter ses occupations quotidiennes et consacrer ces heures sacrées à un repos salutaire, au culte et à de saintes actions. » (Ellen G. White, <i>The Desire of Ages</i>, Pacific Press, p. 207)',
        '3.29': 'De la création du monde à la re-création de la nouvelle terre, le sabbat reste en vigueur pour rappeler trois choses :',
        '3.31': {'lettres': ['Votre corps, votre esprit et vos émotions ont besoin de repos régulier.',
                            'Votre Seigneur est le Créateur : en vous reposant le jour qu’il a fixé, vous dites votre foi en lui comme Créateur.',
                            'Votre Seigneur vous sauve du péché. On ne gagne pas le ciel par ses « œuvres » : il faut se « reposer » en lui. Le repos du sabbat exprime votre foi en lui comme Sauveur.']},
        '4.01': 'Puisque le repos du sabbat est bon pour mon corps, mon esprit et mon âme, ne devrais-je pas commencer à sanctifier le septième jour ?',
        '4.02': 'Que dois-je faire pour commencer à profiter chaque semaine du repos du sabbat du septième jour ?',
    })


@lecon(12)
def l12():
    ecrire_lecon(12, {
        '1.01': {'html': 'Pourquoi tant de chrétiens<br>célèbrent-ils le dimanche ?', 'ligne': False},
        '1.02': 'Robert Whiteside, notable, homme d’affaires prospère et orateur de talent du siècle dernier, fit une découverte stupéfiante. Il devait bientôt participer à un débat public sur le culte et défendre l’observation du dimanche. Il n’avait jamais douté du bien-fondé du culte le premier jour de la semaine. Il était sûr que des textes en parlaient, car il avait toujours entendu dire que Jésus avait remplacé le samedi par le dimanche. Mais en étudiant le sujet, il ne trouva rien dans la Bible pour appuyer cette conviction jusque-là incontestée !',
        '2.02': 'Huit textes du Nouveau Testament mentionnent le premier jour de la semaine. Vous en trouverez six dans les quatre premiers livres du Nouveau Testament. Peut-être aimeriez-vous les lire :',
        '2.04': 'Matthieu 28:1<br>Marc 16:1-2<br>Marc 16:9<br>Luc 24:1<br>Jean 20:1<br>Jean 20:19',
        '2.12': 'Ces six textes parlent tous de la résurrection du Christ le premier jour de la semaine, mais ne disent rien d’un culte célébré ce jour-là.',
        '2.15': 'Le septième texte du Nouveau Testament qui mentionne le premier jour de la semaine se trouve en Actes 20:7-8.',
        '2.27': '(Arthur G. Lickey, <i>God Speaks to Modern Man</i>, Washington DC, Review & Herald Publishing Assn., 1952, p. 430)',
        '2.30': 'Cette réunion n’était pas un culte hebdomadaire habituel, mais une réunion d’adieu à Paul. Le fait qu’on y ait « rompu le pain » n’en faisait pas un jour saint, car en Actes 2:46, nous lisons que les croyants « rompaient le pain dans les maisons, chaque jour ». 1 Corinthiens 16:1-2 est le huitième et dernier texte du Nouveau Testament sur le premier jour. Que demandait Paul de faire le premier jour de la semaine ? 1 Corinthiens 16:1-2',
        '2.00': 'TEXTES SUR LE PREMIER JOUR',
        '2.01': 'La Revised Standard Version dit : « Mettez quelque chose de côté et épargnez. » Paul collectait de l’argent pour les pauvres de Jérusalem : chaque premier jour de la semaine, chacun devait faire ses comptes et mettre de côté une part de ses gains.',
        '2.03': 'Vous le voyez : aucun de ces huit textes ne prouve que le premier jour de la semaine soit devenu le jour de culte des apôtres. En fait, la Bible n’autorise nulle part à sanctifier le premier jour de la semaine.',
        # bref aperçu historique : numéros en grand (bleu clair), texte qui s'écoule sous la première ligne
        '2.21': numero(1, 'Au premier siècle de notre ère, rien ne montre que des chrétiens aient célébré le culte le dimanche. Le Nouveau Testament dit que Jésus et les apôtres adoraient le septième jour.'),
        '2.22': None,
        '2.25': numero(2, 'Au deuxième siècle, des chrétiens de Rome et d’Alexandrie commencèrent à célébrer le culte le dimanche, tout en observant le sabbat.'),
        '2.26': None,
        '2.28': numero(3, 'Du IIe au Ve siècle, le sabbat était encore observé dans tout l’Empire romain, mais peu à peu beaucoup de chrétiens se mirent à célébrer le culte à la fois le samedi et le dimanche. Pourquoi ?'),
        '2.29': None,
        '2.31': numero('a', 'L’antisémitisme, surtout à Rome, poussa les chrétiens à se distinguer des Juifs en abandonnant les pratiques qui paraissaient « juives ».'),
        '2.32': None,
        '2.33': numero('b', 'L’influence du culte du soleil chez les Romains païens contribua à faire accepter de plus en plus le dimanche comme jour de culte.'),
        '2.34': None,
        '3.00': numero(4, 'La première loi dominicale connue fut promulguée par l’empereur romain Constantin en 321 ; elle imposait le repos le dimanche.'),
        '3.02': None,
        '3.03': numero(5, 'En 364, le concile de Laodicée publia la première loi ecclésiastique sur le dimanche. Elle demandait de travailler le samedi et de se reposer le dimanche. En 535, l’Église adopta une loi encore plus sévère sur le culte du dimanche.'),
        '3.04': None,
        '3.08': 'Vous le voyez, le changement s’est fait peu à peu, discrètement, sous l’effet de nombreux facteurs. L’Église catholique revendique cependant le passage du sabbat au dimanche comme l’une des marques de son autorité. L’édition de 1977 du <i>Convert’s Catechism</i> dit ceci :',
        '3.12': 'Question :', '3.13': 'Quel est le jour du sabbat ?',
        '3.14': 'Réponse :', '3.15': 'Le samedi est le jour du sabbat.',
        '3.16': 'Question :', '3.18': 'Pourquoi observons-nous le dimanche au lieu du samedi ?',
        '3.20': 'Réponse :', '3.22': 'Nous observons le dimanche au lieu du samedi parce que l’Église catholique a transféré la solennité du samedi au dimanche.',
        '3.24': '(Peter Geiermann, <i>The Convert’s Catechism of Catholic Doctrine</i>, Rockford, IL, Tan Books and Publishers, 1977, p. 50)',
        '3.25': 'Il y a des siècles, Dieu avait annoncé par le prophète Daniel qu’une puissance tenterait de changer ses lois. Quelle était cette prophétie ? Daniel 7:25',
        '3.28': 'Paul a annoncé qu’une séduction aurait lieu avant le retour du Christ. Qu’a-t-il dit aux Thessaloniciens ? 2 Thessaloniciens 2:3-4',
        '3.01': 'Derrière les gouvernements et les puissances de la terre, un « homme du péché » est à l’œuvre pour tenter de « changer les temps et la loi ». Cette force trompeuse n’est autre que Satan. Quel est son but ? Ésaïe 14:13-14 (surtout la fin du verset 14)',
    })


@lecon(13)
def l13():
    ecrire_lecon(13, {
        '2.01': 'Comment l’Église doit-elle faire vivre ses ouvriers, selon Paul ? 1 Corinthiens 9:13-14',
        '2.08': 'Quand on y pense, tous ceux qui ont été pardonnés devraient être aussi reconnaissants que Marie. Pourtant, comment agissent la plupart des gens ? Luc 17:11-19',
        '2.31': 'À maintes reprises, Dieu promet de prendre soin de son peuple. Puisque Dieu est fidèle, quelle attitude Jésus demande-t-il à son peuple d’avoir ? Matthieu 6:25-34',
        '2.33': 'La dîme est le dixième de l’augmentation ou du bénéfice de ce que l’on gagne. Dieu dit qu’elle lui « appartient ». Elle n’est pas du tout à nous : nous la lui rendons, à lui, notre associé principal.',
        '2.34': 'Jésus donne deux principes importants :',
        '2.36': 'Chercher d’abord son royaume<br>Ne pas s’inquiéter',
        '2.40': 'Donner à Dieu vous aidera à garder son royaume à la première place dans votre vie ; alors il pourra vous bénir en pourvoyant à vos besoins, et vous vivrez sans inquiétude !',
        '3.01': 'Dieu appelle offrande tout don qui dépasse la dîme. Rendre la dîme, c’est rendre à Dieu ce qui est déjà à lui. L’offrande est une marque d’amour en plus.',
        '3.27': 'Votre Seigneur est le propriétaire de tout ! Au commencement, il a créé la terre et l’a confiée à Adam et Ève. Il veut toujours que ses disciples soient ses gérants. Il leur demande seulement de l’honorer comme propriétaire en lui rendant la dîme.',
        '4.01': 'Avec Dieu pour associé, lui rendrai-je avec joie sa dîme quand je recevrai mon prochain salaire ? Est-ce que je l’aime assez pour lui exprimer mon amour par des dons ?',
    })


@lecon(14)
def l14():
    ecrire_lecon(14, {
        '1.03': 'Pendant 29 ans, des chercheurs ont comparé le mode de vie des adventistes du septième jour aux États-Unis avec celui de la population générale. Résultat : les hommes adventistes vivent en moyenne 8,9 ans de plus que les autres hommes, et les femmes 7,5 ans de plus que la moyenne des femmes. Un scientifique en a conclu : « Il semble que la meilleure assurance que l’on puisse prendre aujourd’hui soit d’adopter le mode de vie des adventistes. »<br>(<i>Adventist Review</i>, 29 juin 1989)',
        '2.01': 'Votre Seigneur donne-t-il des directives précises sur le soin de votre corps ? Oui. Reprenez 1 Corinthiens 6:13-18. Dans quel domaine de notre vie physique Dieu dit-il qu’il est Seigneur ?',
        '2.07': 'Dieu se soucie de votre vie sexuelle. Il veut être le Seigneur de ce domaine de votre vie, non pour étouffer votre plaisir, mais pour l’accroître grâce à de saines pratiques.',
        '2.10': 'Psaume 139:13-14',
        '2.15': '1 Corinthiens 6:20',
        '2.00': 'JÉSUS, SEIGNEUR DE VOTRE CORPS',
        '2.22': 'Si Jésus est Seigneur de votre vie, quelle sera votre attitude envers votre corps ?',
        '2.34': 'Quel est le souhait de votre Seigneur pour votre corps ? 3 Jean 2',
        '2.35': None,
        '2.39': '=', '2.41': '=', '2.43': '=', '3.00': '=',
        '3.02': 'Comment savoir quels animaux aquatiques sont « purs » ? Lévitique 11:9-12',
        '3.07': 'Avez-vous remarqué que ce sont les « nettoyeurs » de la terre (rapaces, crabes, porcs, etc.) que le Seigneur vous demande de ne pas manger ?',
        '3.08': 'Convaincus que leur corps appartient à Dieu, les adventistes du septième jour ont adopté un mode de vie sans boissons alcoolisées, sans tabac et sans drogues ; c’est ce mode de vie qui leur a donné cette avance.',
        '3.09': 'En plus des lois alimentaires, Dieu a donné à son peuple des règles de santé toujours valables aujourd’hui. Il a enseigné l’hygiène à Israël : les malades contagieux devaient être isolés (Nombres 5:2) ; les objets contaminés, détruits (Lévitique 7:19) ; la viande restée plus de trois jours, brûlée (Lévitique 7:17). Souvenez-vous qu’ils n’avaient pas de réfrigérateur.',
        '3.12': 'Quelle merveille que Dieu ait donné à son peuple des instructions détaillées pour qu’il jouisse d’une bonne santé !',
        '3.15': 'Quelles bénédictions a-t-il promises à Israël s’il le servait et suivait ses instructions ? Exode 23:25',
    })


@lecon(15)
def l15():
    ecrire_lecon(15, {
        '2.34': 'Les chrétiens se réunissaient en grands et petits groupes : le culte en petit groupe',
        '2.01': 'est donc aussi valable et important que le culte au temple. En misant à la fois sur les grandes assemblées et sur les petits groupes, l’Église du Nouveau Testament a grandi rapidement et s’est répandue dans le monde entier. Quelle est l’attitude du Seigneur envers l’Église ? Éphésiens 5:25-27',
        '2.07': 'Certains ont compris ces versets comme si Pierre était le rocher sur lequel l’Église est fondée, mais d’autres versets (1 Corinthiens 10:4 ; Éphésiens 2:20) montrent clairement que le Rocher, c’est Jésus. C’est la déclaration de foi de Pierre en la divinité du Christ qui devait être le fondement de l’Église, et non Pierre lui-même.',
        '2.16': 'Où les premiers chrétiens se réunissaient-ils ? Actes 2:46',
        '2.17': '1. Jésus y occupe la première place.',
        '2.19': 'Que dit Colossiens 1:18 de sa position ?',
        '2.25': {'html': '2. L’Église est un lieu d’amour et de communion.', 'interligne': 14},
        '3.08': 'Ses membres parleront de Jésus aux autres, pour le faire connaître au monde entier. Quelles furent les dernières consignes de Jésus à ses disciples ? Matthieu 28:19-20',
        '2.27': 'Comment Actes 2:42-46 décrit-il l’Église ?',
        '3.00': '4. L’Église aura le témoignage de Jésus.',
        '3.01': 'Le verset 42 met la communion au même rang que l’enseignement, la doctrine !',
        '3.19': {'html': '5. Les membres de l’Église resteront fidèles à Jésus.', 'interligne': 14.5},
        '3.23': {'html': '3. L’Église obéira aux commandements de Dieu.', 'interligne': 14.5},
        '3.25': 'Apocalypse 12:17 donne deux caractéristiques de l’Église des derniers jours. Quelle est la première que mentionne ce verset ?',
        '3.26': 'Quelles que soient les difficultés, le peuple de Dieu ne renoncera pas à sa foi en Jésus.',
        '3.33': 'Si la véritable Église de Dieu observe les commandements, comment et quand ses membres célébreront-ils le culte ? Exode 20:8-11',
        '4.01': 'Ne devrais-je pas devenir membre de l’Église de mon Seigneur…',
        '4.02': {'puces': ['où il est exalté et aimé ;',
                          'où ses disciples vivent l’amour et la communion fraternelle, et où chacun peut exprimer ses dons particuliers ;',
                          'où ses commandements sont observés ;',
                          'où son témoignage est cru et partagé ;',
                          'où ses membres restent fidèles à Jésus ?']},
        '4.09': 'Oui, je veux faire partie de la famille de l’Église dès que possible.',
        '4.11': 'J’y réfléchis encore. J’ai des questions sur :',
    })


if __name__ == '__main__':
    for n in [int(x) for x in sys.argv[1:]] or sorted(LECONS):
        LECONS[n]()
