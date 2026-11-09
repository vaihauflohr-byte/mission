"""« Prendre vie avec Jésus » (Come Alive with Jesus, PAPSDA) : textes français des 7 leçons
sur la mise en page d'origine. Reprend la traduction publiée sur le site (alignée par aligner.py),
complétée et ajustée ici.  python3 series/prendre_vie.py [N …]  -> textes/pv-0N.json
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

FONCE, CLAIR = [0.494, 0.455, 0.361], [0.69, 0.653, 0.567]
SCRIPT, NOIR = ['script', ''], ['sourcenoir', '']

# textes répétés d'une leçon à l'autre (texte anglais exact -> français)
COMMUN = {
    'Papatoetoe Seventh-day Adventist Community Church': 'Église adventiste du septième jour de Papatoetoe',
    'PO Box 23-231, Hunters Corner, Auckland 2155, NZ': '=',
    'Phone (09) 278-7786 Fax (09) 278-4906': 'Tél. (09) 278-7786, fax (09) 278-4906',
    'AUSTRALIAN UNION CONFERENCE': '=',
    'E-mail info@papsda.co.nz, Website www.papsda.co.nz': 'Courriel info@papsda.co.nz, site www.papsda.co.nz',
    'Reprinted with permission': 'Reproduit avec autorisation',
    'IN YOUR OWN WORDS': 'AVEC VOS PROPRES MOTS',
    'TO MEMORISE': 'À MÉMORISER',
}


# (dans une cellule, MuPDF pose le texte nu 1 pt plus haut que le texte balisé : tout est mis dans un span ou un div)
CSS_LISTE = 'table {border-collapse: collapse;} td {vertical-align: top; padding: 0;} '


def puces(items, fin=None, gauche=57):
    """Liste à puces d'un seul bloc qui s'écoule : tableau puce | texte, la puce comme l'originale
    (Times 12 pt, presque noire, 18 pt avant le texte) ; les puces d'origine sont effacées."""
    corps = ''.join(f'<tr><td class="m"><span>•</span></td><td><div>{t}</div></td></tr>' for t in items)
    html = f'<table>{corps}</table>' + (f'<p>{fin}</p>' if fin else '')
    return {'gauche': gauche, 'html': html,
            'css': CSS_LISTE + 'td.m {width: 18pt;} td.m span {font-family: serif; font-size: 12pt; color: #231f20;} p {margin: 0;}'}


def liste(items, marques, gauche, retrait=36):
    """Liste à marques (a), b)…) d'un seul bloc qui s'écoule : tableau marque | texte (marques d'origine effacées)."""
    corps = ''.join(f'<tr><td class="m"><span>{m}</span></td><td><div>{t}</div></td></tr>' for m, t in zip(marques, items))
    return {'gauche': gauche, 'html': f'<table>{corps}</table>',
            'css': CSS_LISTE + f'td.m {{width: {retrait}pt;}}'}


def effacees(*cles):
    return {c: None for c in cles}


def ecrire_lecon(n, titre, script, u, couv=None, extra=None):
    """script : lignes du titre manuscrit de la leçon, [(texte, x droite, ligne de base, taille)]."""
    en = glob.glob(f'{natif.ORIG_RACINE}/prendre-vie/0{n} *.pdf')[0]
    source = os.path.relpath(en, natif.ORIG_RACINE)
    chemin = os.path.relpath(glob.glob(f'{natif.chemins.DOCUMENTS}/prendre-vie/0{n}-*.pdf')[0],
                             natif.chemins.DOCUMENTS)[:-4]
    doc = natif.pages_source(en, False)
    tout = {}
    for i, page in enumerate(doc):
        for k, un in enumerate(natif.unites(page)):
            cle = f'{i + 1}.{k:02d}'
            t = natif.texte_unite(un)
            if un['marqueur']:
                continue
            if re.fullmatch(r'[_\s.]+|[a-h]\)\s*_+', t):
                tout[cle] = '='
            elif t in COMMUN:
                v = COMMUN[t]
                tout[cle] = v if v == '=' or i < len(doc) - 1 or un['lignes'][0]['bbox'][1] < 700 else {'html': v, 'ligne': True}
            elif re.fullmatch(r'Lesson \d', t):
                tout[cle] = f'Leçon {n}'
    tout.update(u)
    textes = [
        {'x': 206, 'base': 226, 'texte': 'Prendre vie', 'police': SCRIPT, 'taille': 70, 'couleur': FONCE},
        {'x': 536, 'base': 261, 'texte': 'avec Jésus', 'police': NOIR, 'taille': 17, 'couleur': CLAIR, 'aligne': 'droite'},
    ] + [{'x': x, 'base': b, 'texte': t, 'police': SCRIPT, 'taille': s, 'couleur': CLAIR, 'aligne': 'droite'}
         for t, x, b, s in script]
    T = {'source': source, 'chemin': chemin, 'livret': False, 'titre': titre, 'auteur': 'PAPSDA — traduction française',
         'effacer_dessins': {'1': [[186, 106, 548, 270]] + (couv or [[205, 322, 548, 468]])},
         'textes': {'1': textes}, 'reglages': {'cadre_colonnes': True, 'traits_fins': True}, 'u': dict(sorted(tout.items()))}
    for k, v in (extra or {}).items():
        if k in ('effacer_dessins', 'textes', 'zones'):        # par page : ajoutés à ceux de la couverture
            for page, liste_ in v.items():
                T.setdefault(k, {}).setdefault(page, []).extend(liste_)
        else:
            T[k] = v
    json.dump(T, open(ICI / 'textes' / f'pv-0{n}.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'pv-0{n}', len(T['u']), 'unités')


LECONS = {}


def lecon(n):
    def deco(f):
        LECONS[n] = f
        return f
    return deco


@lecon(1)
def l1():
    u = {
        '1.01': 'Naître à une vie nouvelle',
        '1.02': 'Jim se recula de son bureau, tourna son fauteuil vers la fenêtre et soupira en contemplant la ville, dix-huit étages plus bas. Il éprouvait un sentiment indéfinissable : agitation, ennui, découragement ? Il aurait dû se sentir bien, se disait-il. Il avait une belle carrière, une bonne santé, un mariage convenable, de beaux enfants, de l’argent. « La belle vie », comme on dit. Alors pourquoi ce vague mécontentement ? Était-il passé à côté de quelque chose ?',
        '1.03': 'Oui. Jim avait « la belle vie », mais il n’avait pas une « vie en abondance ». Or c’est précisément cette vie que Jésus a dit être venu offrir : « Je suis venu afin qu’ils aient la vie et qu’ils l’aient en abondance. » (Jean 10:10.) La vie que Jésus propose apporte une dimension nouvelle : un véritable épanouissement, la paix intérieure et le bonheur.',
        '2.00': 'LA VIE ÉTERNELLE, UN DON GRATUIT',
        '2.01': 'Que dit ce verset de notre capacité à choisir ce qui est juste ? Proverbes 14:12',
        '2.02': 'Comment la Bible décrit-elle cette vie ? Romains 6:23, dernière partie',
        '2.08': 'Quelle est la conséquence du péché ? Romains 6:23',
        '2.09': 'Cette vie, appelée « vie éternelle », nous vient « par Jésus-Christ » : c’est un « don de Dieu ».',
        '2.11': 'Pouvez-vous obtenir ce don en le gagnant ou en le méritant ? Éphésiens 2:8-9',
        '2.14': 'La situation paraît sans espoir, n’est-ce pas ? Nous sommes tous pécheurs. Nous ne pouvons pas nous transformer par nous-mêmes, et le salaire du péché, c’est la mort. Voilà pourquoi la vie éternelle doit nous être donnée par Dieu. Il ne suffit pas de réparer ou d’améliorer notre ancienne vie : pour vivre une vie vraiment bonne, il nous faut une vie nouvelle. C’est pourquoi Jésus a dit : « Il faut que vous naissiez de nouveau. » (Jean 3:3, 5.) Cette nouvelle naissance est le don que Dieu veut nous faire, parce qu’il nous aime.',
        '2.17': 'La Bible précise que ce don « ne vient pas de vous » et qu’il ne dépend pas des œuvres. Autrement dit, vous ne pouvez ni le gagner ni le mériter. Pourquoi ? Parce que :',
        '2.18': 'DIEU EST AMOUR',
        '2.19': 'TOUS SONT PÉCHEURS',
        '2.20': 'Quels sentiments Dieu éprouve-t-il pour le monde ? Jean 3:16',
        '2.21': 'Tous ont-ils péché ? Romains 3:10, 23',
        '2.26': 'Dieu aime les pécheurs. Mais quel effet le péché a-t-il sur notre relation avec lui ? Ésaïe 59:2',
        '2.29': 'Qu’est-ce que le péché ? 1 Jean 3:4',
        '2.32': 'Le péché nous sépare de Dieu. Mais qu’a fait Dieu pour nous sauver ?',
        '2.38': 'La Bible affirme que tous sont pécheurs et transgressent donc la loi de Dieu. Elle montre aussi que nous ne savons pas toujours discerner le bon chemin. Lisez Proverbes 14:12.',
        '3.00': 'JÉSUS-CHRIST',
        '3.01': 'RECEVOIR CE DON',
        '3.02': 'Dieu a donné son Fils, Jésus, au monde.',
        '3.03': 'Comment pouvez-vous recevoir cette vie nouvelle ? 1 Jean 5:11-13',
        '3.04': 'Qui est Jésus ?',
        '3.07': 'Sous quelle forme Jésus est-il venu sur terre ? Jean 1:1-3, 14',
        '3.10': 'Ces versets déclarent que celui qui a le Fils a la vie.',
        '3.12': 'Comment pouvez-vous le recevoir ? Jean 1:12',
        '3.15': 'Jésus est venu sur terre sous la forme d’un homme. Pourtant, il était plus qu’un homme : il était Dieu. Jean 1:1-3 dit qu’il existait en tant que Dieu avant de venir sur terre.',
        '3.18': 'Quelle puissance possédait-il ? Hébreux 1:2',
        '3.21': 'Recevoir Jésus et croire en lui engage à la fois notre intelligence et notre cœur. Cela signifie croire qu’il a une vie meilleure à vous offrir, puis agir selon cette conviction en adoptant sa manière de vivre à la place de la vôtre.',
        '3.23': 'Jésus est celui qui a créé le monde. Comprenez-vous pourquoi il s’intéresse tant aux êtres humains ? C’est parce qu’il nous a créés et qu’il ne veut perdre aucun d’entre nous !',
        '3.24': 'Cela signifie que vous demandez :',
        '3.25': 'à Jésus d’être votre Sauveur',
        '3.26': 'Qu’a fait Jésus ?',
        '3.27': 'Que venait-il accomplir ? Matthieu 1:21',
        '3.28': 'Dites-lui que vous regrettez vos péchés et demandez-lui de vous pardonner.',
        '3.30': 'Cela signifie aussi que vous demandez :',
        '3.32': 'à Jésus d’être votre Seigneur',
        '3.33': 'Comment a-t-il sauvé les êtres humains du péché ? 1 Pierre 2:24 (pour approfondir : Ésaïe 53:6)',
        '3.34': 'Invitez-le à diriger votre vie, afin de pouvoir :',
        '3.36': '<b>ÊTRE</b> ce qu’il veut que vous soyez,',
        '3.38': '<b>FAIRE</b> ce qu’il veut que vous fassiez,',
        '3.39': '<b>ALLER</b> là où il veut que vous alliez.',
        '3.41': 'Jésus, le Dieu créateur de ce monde, est venu sur terre pour porter nos péchés et subir à notre place la peine de mort. En échange, il nous offre sa vie parfaite et éternelle. Quel échange extraordinaire pour des pécheurs !',
        '4.00': 'EST-CE CLAIR POUR VOUS ?',
        '4.01': 'Lorsque vous faites cette démarche, quelle promesse vous est donnée ? 1 Jean 5:11-13',
        '4.02': 'Reprenons l’ensemble :',
        '4.04': None, '4.07': None, '4.09': None, '4.10': None, '4.13': None,
        '4.05': puces([
            'Dieu veut vous donner une vie nouvelle, une vie en abondance.',
            'Il vous la donne parce que vous ne pouvez ni la mériter ni la gagner vous-même.',
            'Il vous la donne parce qu’il vous aime.',
            'Il vous la donne par son Fils, Jésus, venu sur terre pour porter vos péchés afin que vous puissiez recevoir sa vie parfaite.',
            'Vous recevez ce don d’une vie nouvelle et abondante en croyant à ce que Jésus a fait pour vous et en l’invitant dans votre vie comme Sauveur et Seigneur. Cela s’appelle :']),
        '4.16': {'decaler': 12, 'html': 'NAÎTRE DE NOUVEAU'},
        '4.18': {'decaler': 12, 'html': 'Souhaitez-vous recevoir ce don de la vie ? Si oui, voici comment faire : parlez à Dieu à voix haute et dites-lui :'},
        '4.22': None, '4.24': None, '4.25': None,
        '4.21': {**puces([
            'que vous désirez le don de la vie éternelle ;',
            'que vous avez besoin de son pardon ;',
            'que vous invitez Jésus dans votre vie.']), 'decaler': 12},
        '4.27': {'decaler': 12, 'html': 'Écrivez ci-dessous ce que vous souhaitez dire à Dieu, puis servez-vous de ces mots pour prier :'},
    }
    ecrire_lecon(1, 'Une nouvelle relation avec Jésus',
                 [('Une nouvelle relation', 520, 380, 34), ('avec Jésus', 538, 420, 34)], u)


def brouillon(n):
    return json.load(open(ICI / 'textes' / 'brouillons' / f'pv-0{n}.json', encoding='utf-8'))['u']


def sans_point(t):
    """« … ? Romains 6:23. » -> sans le point final après une référence (comme l'original)."""
    return re.sub(r'(\d)\.$', r'\1', t)


@lecon(2)
def l2():
    B = brouillon(2)
    u = {
        '1.01': 'Vous êtes né de nouveau',
        '1.02': B['1.02'],
        '1.03': 'Longtemps, il encaissa sans rien dire. Puis, un jour, il explosa. Il perdit complètement le contrôle : jurons, cris, colère… exactement comme avant de devenir chrétien.',
        '1.04': B['1.04'],
        '2.00': 'ET MAINTENANT ?',
        '2.01': 'COMME JÉSUS A ÉTÉ TENTÉ, VOUS SEREZ TENTÉ',
        '2.02': 'Comme Ken, vous êtes né de nouveau. Cela signifie-t-il que toutes vos tentations et vos difficultés ont disparu ? Romains 7:18-24',
        '2.03': sans_point(B['2.03']),
        '2.08': 'Pour quelle raison, entre autres, les chrétiens connaissent-ils difficultés et tentations ? 1 Pierre 5:8',
        '2.09': B['2.09'],
        '2.11': 'Quelles sont ces armes ? Éphésiens 6:13-18',
        '2.14': 'En dehors des attaques directes de Satan, d’où viennent les tentations ? Jacques 1:13-14',
        '2.20': sans_point(B['2.20']),
        '2.23': 'Selon la Bible, comment pouvez-vous vaincre le péché ? Jacques 4:7 (fin du verset)',
        '2.27': 'Vous êtes un nouveau-né dans la famille de Dieu. Vous vivez dans un monde de péché, avec une nature habituée à pécher, et vous avez un ennemi : Satan. Il a tenté de détruire Jésus quand il était bébé ; il voudrait aussi vous détruire.',
        '2.29': 'Comment résister au diable ?',
        '2.31': 'Jacques 4:7 (début du verset)',
        '2.32': B['2.32'],
        '2.35': 'Colossiens 4:2',
        '2.37': 'Qu’a vécu Jésus juste après son baptême ? Matthieu 4:1',
        '2.39': 'Matthieu 26:41',
        '2.42': 'Selon Jésus, quel est le secret d’une vie chrétienne réussie ? Jean 15:4',
        '3.00': 'VAINCRE LE PÉCHÉ',
        '3.01': 'relèvera lorsque vous trébucherez et tomberez.',
        '3.02': sans_point(B['3.02']),
        '3.03': 'Pour vaincre le péché, il faut :',
        '3.05': liste(['Se consacrer et se soumettre à Dieu chaque jour. (Jean 15:4 ; Jacques 4:7)',
                       'Rester vigilant et connaître ses propres points faibles. (Matthieu 26:41)',
                       'Prier chaque jour. (Colossiens 4:2)',
                       'Étudier la Bible chaque jour. (Jean 5:39)'], ['a)', 'b)', 'c)', 'd)'], 57),
        **effacees('3.04', '3.07', '3.10', '3.11'),
        '3.09': B['3.09'],
        '3.12': 'Même en suivant ces conseils, vous aurez parfois l’impression d’être tenté et éprouvé au-delà de vos forces.',
        '3.14': liste(['Être chrétien ne signifie pas que l’on ne sera plus tenté. Les tentations peuvent même se multiplier, car Satan veut vous détruire et votre corps comme votre esprit sont habitués au péché.',
                       'La Bible promet de l’aide par l’étude des Écritures, la prière et la puissance de Dieu.',
                       'Lorsque vous péchez, vous pouvez le confesser à Dieu : il vous pardonnera et vous relèvera.'], ['a)', 'b)', 'c)'], 319),
        **effacees('3.13', '3.16', '3.19'),
        '3.15': sans_point(B['3.15']),
        '3.20': 'Dieu a aussi prévu les moments où le péché vous fait tomber. Que vous promet-il ? 1 Jean 1:9',
        '3.21': 'En découvrant ces secrets pour vaincre le péché, Ken remercia Dieu, se releva et reprit sa marche avec lui. Vous pouvez faire de même quand vous trébuchez et tombez.',
        '3.25': 'Dieu ne vous « chasse pas de la famille » quand vous trébuchez et tombez dans le péché. Au contraire, il veut que vous y restiez : il promet de vous pardonner et de vous purifier quand vous confessez vos fautes. Mais la confession, c’est plus que dire simplement : « Je suis désolé. »',
        '3.26': 'Qu’implique-t-elle encore ? Proverbes 28:13',
        '3.29': B['3.29'],
        '3.30': 'Vous avez besoin de votre Père céleste. Il vous protégera, vous guidera et vous',
        '4.00': 'Vous avez peut-être trébuché dans votre vie chrétienne et vous vous dites : « Cela ne sert à rien d’essayer d’être chrétien. » Prenez quelques minutes pour recopier 1 Jean 1:9 et Philippiens 4:13 sur les lignes ci-dessous. Croyez à ces promesses, mettez-les en pratique et remerciez Dieu de vous relever.',
        '4.21': '1 Jean 1:9<br>Philippiens 4:13',
    }
    ecrire_lecon(2, 'La tentation', [('La tentation', 538, 384, 40)], u)


@lecon(3)
def l3():
    u = {
        '1.01': 'Se nourrir pour grandir',
        '1.02': '« J’étais vraiment inquiète pour notre premier bébé, raconte une jeune maman. Il ne voulait pas manger. Il dormait tout le temps. »',
        '1.03': '« Quelle chance ! » s’esclaffèrent les autres mamans.',
        '1.04': '« Oui, je sais, mais un bébé a besoin de manger ! On le réveillait, on essayait de le faire manger, mais il se rendormait avant d’avoir bu trente grammes de lait ! Et puis un jour, il s’est réveillé, il s’est mis à manger… et il ne s’arrêtait plus ! »',
        '1.05': 'Nous avons ri de l’inquiétude de cette maman pour un bébé qui ne semblait pas manger assez ; mais nous la comprenons, car chacun sait qu’un nouveau-né doit se nourrir pour vivre et grandir. Il doit manger souvent et régulièrement.',
        '1.06': 'Vous qui venez de naître à la vie chrétienne, vous devez vous aussi manger souvent, sinon vous dépérirez !',
        '2.00': 'Quelle sera votre nourriture ? Matthieu 4:4',
        '2.01': 'De quelles autres manières la Bible vous aidera-t-elle ? 2 Timothée 3:16',
        '2.06': 'Pourquoi avez-vous besoin de la Parole de Dieu ? 1 Pierre 2:2 (surtout la fin du verset)',
        '2.07': 'La Bible affirme être inspirée de Dieu. Comment a-t-elle été écrite ? 2 Pierre 1:20-21',
        '2.12': 'La Parole de Dieu est la nourriture du chrétien : sans nourriture, on ne grandit pas. Si des parents s’inquiètent pour un bébé qui refuse de manger, que doit ressentir Dieu pour les nouveaux chrétiens qui refusent de « manger » sa Parole ?',
        '2.13': 'L’Esprit de Dieu a guidé les auteurs de la Bible. Qui vous guidera dans l’étude de sa Parole ? Jean 16:13',
        '2.15': 'Le moment du repas ne fait pas seulement grandir le bébé : il tisse aussi un lien entre le parent et l’enfant. Il en va de même pour le chrétien. Le temps passé dans la Parole de Dieu vous attachera à lui et construira une relation solide entre vous et votre Père céleste. Dieu désire passer ce temps avec vous. Il sait que sa Parole vous est vitale.',
        '2.17': 'La meilleure façon de découvrir la valeur et l’inspiration de la Bible, c’est d’en faire l’expérience : lisez-la et étudiez-la vous-même.',
        '2.18': 'Quand vous ouvrez la Bible pour l’étudier, que devez-vous demander dans la prière ? Psaume 119:18, 27 ; Jacques 1:5',
        '2.19': 'La Bible compare d’ailleurs la Parole de Dieu à une arme offensive, celle du soldat.',
        '2.22': 'Quel nom donne-t-elle à la Parole de Dieu ? Éphésiens 6:17',
        '2.25': 'COMMENT ÉTUDIER LA BIBLE ?',
        '2.26': 'Un soldat ne partirait pas au combat sans arme ; vous non plus ne pouvez pas entrer sur le champ de bataille de la vie et affronter l’ennemi, Satan, sans arme. Jésus connaissait ce secret : à chaque tentation que Satan lui présenta dans le désert, il répondit : « Il est écrit. » (Matthieu 4:1-11) Le Christ a vaincu la tentation par les Écritures. Vous pouvez faire de même. Vous ne voulez pas pécher et décevoir votre nouvel ami, Jésus.',
        '2.27': 'Paul dit que les enfants en Christ ont besoin de lait avant la nourriture solide. 1 Corinthiens 3:1-2',
        '2.28': 'Commencez par les passages faciles de la Bible avant d’aborder les plus difficiles.',
        '2.29': 'Beaucoup de nouveaux chrétiens aiment l’Évangile selon Jean. Vous pourriez commencer par lui : il est facile à lire et plein de l’amour de Dieu.',
        '2.30': 'Une version récente de la Bible, en français courant, comme la Bible du Semeur, la Parole de Vie ou la Segond 21, vous paraîtra peut-être plus agréable à lire.',
        '2.31': 'Que pouvez-vous faire pour vaincre le péché ? Psaume 119:11',
        '2.34': 'N’essayez pas de vous gaver de la Bible : vous',
        '3.00': 'auriez une indigestion, comme le bébé qui avale trop de nourriture d’un seul coup.',
        '3.01': '« Méditer », c’est s’arrêter pour réfléchir à ce que vous avez lu. Les versets à mémoriser de chaque leçon vous aideront à méditer la Parole de Dieu. Recopiez-les sur des cartes ou des bouts de papier, collez-les sur le miroir ou dans la cuisine, ou gardez-les dans votre poche ou votre sac. Dans les moments libres de la journée, et même en faisant la vaisselle ou en vous rasant, vous pourrez méditer la Parole de Dieu et graver ses promesses dans votre mémoire.',
        '3.02': '« On ne retire que peu de profit d’une lecture hâtive des Écritures. On peut lire toute la Bible sans en voir la beauté ni en saisir le sens profond et caché. Un seul passage étudié jusqu’à ce que sa signification soit claire et que son rapport avec le plan du salut soit évident vaut mieux que la lecture de nombreux chapitres sans but précis et sans en tirer d’enseignement. » <i>Vers Jésus</i>, chap. « La connaissance de Dieu »',
        '3.04': None,
        '3.03': 'OUTILS D’ÉTUDE BIBLIQUE',
        '3.05': puces([
            'Un dictionnaire biblique donne la définition des mots de la Bible.',
            'Une concordance biblique répertorie les mots importants de la Bible et indique où ils se trouvent. Par exemple, pour étudier le sujet des anges, cherchez le mot « ange » dans la concordance : elle vous indiquera tous les passages de la Bible où il apparaît. Certaines Bibles contiennent une petite concordance, mais vous voudrez peut-être en acheter une plus complète. Dictionnaires et concordances bibliques sont en vente dans les librairies chrétiennes ; vous en trouverez même sur Internet.',
            'Les livres de récits bibliques pour enfants, comme les dix volumes des <i>Belles Histoires de la Bible</i> d’Arthur S. Maxwell, rendent la Bible intéressante et instructive pour les adultes comme pour les jeunes.',
            'La Bible existe aussi en enregistrement audio, pour l’écouter. On trouve également de nombreuses prédications et causeries chrétiennes enregistrées.',
            'Il existe aussi des vidéos sur des sujets et des récits bibliques.',
            'Et ne négligez pas de vous nourrir de la Parole de Dieu en participant aux cultes d’une église locale.'], gauche=319),
        **effacees('3.16', '3.06', '3.07', '3.14', '3.17', '3.20', '3.21'),
        '3.08': 'POUR COMMENCER',
        '3.09': 'Servez-vous de la fiche « AVEC VOS PROPRES MOTS », à la fin de cette leçon, et procédez ainsi :',
        '3.11': liste(['Lisez le passage biblique.',
                       'Avec vos propres mots, écrivez ce qu’il semble dire. Imaginez que vous l’expliquez avec des mots qu’un enfant comprendrait.',
                       'Relisez le passage et notez ce qu’il signifie selon vous.',
                       'Des questions vous viendront peut-être à l’esprit : notez-les. Il y aura peut-être des mots que vous ne comprenez pas : notez-les aussi, pour chercher leur sens plus tard.',
                       'Réfléchissez aux façons d’appliquer ce passage à votre vie, et notez-les.',
                       'La place prévue dans la leçon ne suffira sans doute pas pour vos notes : ayez d’autres feuilles sous la main.'],
                      ['a)', 'b)', 'c)', 'd)', 'e)', 'f)'], 57),
        **effacees('3.10', '3.12', '3.13', '3.15', '3.18', '3.19'),
        '3.22': 'Pourquoi est-il important de mettre la Bible en pratique au quotidien ? Jacques 1:22-25',
        '3.25': 'Quelle autre manière importante de faire entrer l’Écriture dans votre vie quotidienne ? Josué 1:8',
        '4.02': 'Voici quelques versets à étudier :',
        '4.03': 'Psaume 119:11<br>2 Timothée 2:15',
        '4.04': 'Texte : Jean 3:1-17',
        '4.05': 'Avec vos propres mots, écrivez ce qu’il dit :',
        '4.09': 'Ce qu’il signifie :',
        '4.15': 'Mes questions ; les mots que je ne comprends pas :',
        '4.21': 'Application à ma vie :',
    }
    ecrire_lecon(3, 'L’étude de la Bible', [('L’étude de la Bible', 538, 384, 38)], u)


@lecon(4)
def l4():
    B = brouillon(4)
    u = {
        '1.01': 'Vous apprendrez à parler',
        '1.02': B['1.02'],
        '1.03': 'Vous êtes comme un nouveau-né dans la famille de Dieu, et sa famille attend vos premiers mots avec plus d’intérêt encore. Votre Père céleste se réjouit quand vous commencez à lui parler. C’est ce que nous appelons la prière. Elle devrait être aussi naturelle que d’« ouvrir son cœur à Dieu comme à un ami ». <i>Vers Jésus</i>, chap. « Le privilège de la prière »',
        '1.04': None,
        '1.05': 'Pourtant, beaucoup de personnes se sentent inquiètes ou intimidées à l’idée de prier. Elles se demandent quoi dire et comment le dire. Elles ne réalisent pas que Dieu n’attend qu’une chose : entendre ses enfants lui parler.',
        '2.00': 'QUAND POUVEZ-VOUS PRIER ?',
        '2.01': 'Que dit Dieu qu’il fera quand nous le prions ? Jérémie 29:12-13',
        '2.02': 'Quand devez-vous prier ? Éphésiens 6:18',
        '2.07': B['2.07'],
        '2.08': 'Certaines traductions disent « priez en tout temps » ou « en toute occasion ». Cela ne veut pas dire qu’un chrétien doit littéralement prier à chaque minute du jour et de la nuit, mais qu’aucun moment n’est inopportun pour prier.',
        '2.09': 'À quoi Dieu ressemble-t-il ? Psaume 103:13-14',
        '2.12': 'À quels autres moments devez-vous prier ? Psaume 55:18',
        '2.15': B['2.15'],
        '2.17': B['2.17'],
        '2.18': B['2.18'],
        '2.19': 'DE QUOI POUVEZ-VOUS PARLER ?',
        '2.20': 'OÙ POUVEZ-VOUS PRIER ?',
        '2.21': 'En lisant ce que la Bible dit de la prière, vous verrez que vous pouvez parler de bien des choses avec Dieu. Quand vous lui parlez, vous pouvez :',
        '2.22': 'Où devez-vous prier ? 1 Timothée 2:8',
        '2.23': puces([
            'le louer (Daniel 2:23) ;',
            'le remercier (Daniel 2:23 ; Éphésiens 5:20) ;',
            'lui confesser vos péchés (Psaume 32:5 ; 51:5) ;',
            'lui demander pardon et purification (Psaume 32:5 ; 51:3-6, 12) ;',
            'demander que sa volonté soit faite (Matthieu 6:10) ;',
            'demander le nécessaire (Matthieu 6:11) ;',
            'demander la force de vaincre la tentation (Matthieu 6:13 ; 26:41) ;',
            'demander la sagesse (Jacques 1:5) ;',
            'prier pour vos amis (Job 42:10) ;',
            'prier pour vos ennemis (Luc 23:33-34).']),
        **effacees('2.34', '2.24', '2.26', '2.27', '2.29', '2.31', '2.33', '2.35', '2.37', '2.39', '2.40'),
        '2.30': 'Matthieu 18:20',
        '2.38': 'Matthieu 6:6',
        '2.43': B['2.43'],
        '3.00': B['3.00'],
        '3.01': '1 Jean 5:14-15',
        '3.05': 'La foi, l’obéissance et la soumission à la volonté de Dieu sont essentielles dans la prière. Mais peut-être pensez-vous ne pas les avoir, et craignez-vous de prier parce que tout n’est pas « parfaitement en ordre ».',
        '3.06': B['3.06'],
        '3.07': 'À qui devez-vous adresser vos prières ? Matthieu 6:9',
        '3.08': 'Mais que vous promet Dieu ? Romains 8:26-27',
        '3.14': 'PRIÈRES SANS RÉPONSE',
        '3.16': 'Ne vous inquiétez pas : l’Esprit vous aidera à prier. Allez-y, parlez à Dieu. Qu’importe si vous êtes un bébé en Christ et si vos mots ressemblent à un babillage ! Dieu se réjouit plus d’entendre vos premiers mots que vos parents lorsque vous avez commencé à parler.',
        '3.17': 'Parfois, nos prières ne reçoivent pas la réponse que nous voudrions. Pourquoi ? Jacques 4:3',
        '3.20': B['3.20'],
        '3.22': 'La version Segond 21 traduit ainsi ce verset : « Vous demandez et vous ne recevez pas, parce que vous demandez avec de mauvaises motivations, afin de tout dépenser pour votre plaisir. »',
        '3.23': 'Si vous venez à Dieu avec un cœur sincère, disponible et conscient de son besoin, que vous promet-il ? Psaume 102:18',
        '3.25': 'Dans quelles dispositions devez-vous prier ? Jacques 1:6',
        '3.32': '1 Jean 3:22',
        '4.01': 'Notez ci-dessous des sujets dont vous pourriez parler à Dieu. Faites la liste de ce pour quoi vous pouvez le remercier, et notez aussi quelques-uns de vos besoins. Ajoutez les noms de personnes pour qui vous pourriez prier. Vous pourrez ensuite vous servir de ces notes pour commencer à prier chaque jour.',
        '4.22': 'Matthieu 21:22<br>Jérémie 29:13',
    }
    ecrire_lecon(4, 'La prière', [('La prière', 538, 384, 42)], u)


@lecon(5)
def l5():
    u = {
        '1.01': 'Vous grandissez !<br>Comment le savoir ?',
        '1.02': 'À Saint-Louis, un petit garçon remporta un concours organisé par un journal sur le thème « La personne à qui je voudrais ressembler » : il avait choisi l’évangéliste Billy Graham. Celui-ci écrivit au garçon, Dan Fotsch : « Je suis très honoré et touché. Moi aussi, il y a quelques années, j’ai choisi un Homme pour modèle. J’ai lamentablement échoué bien des fois, mais je prie de tout mon cœur pour continuer à grandir et à ressembler à Jésus. »',
        '2.00': 'PORTER DU FRUIT',
        '2.01': 'L’OBÉISSANCE PAR LA FOI',
        '2.02': 'Le secret pour grandir et ressembler davantage à Jésus : passer du temps avec lui. Si votre relation avec Jésus est solide, la croissance se fera naturellement dans votre vie.',
        '2.03': 'Quel autre résultat produit la connaissance du Christ ? 1 Jean 2:3-4',
        '2.05': 'Comment Jésus a-t-il illustré la croissance chrétienne ? Selon lui, que produit celui qui reste près de lui ? Jean 15:5',
        '2.07': '(Pour approfondir : 1 Jean 5:3)',
        '2.09': 'Quel est le fondement de l’obéissance aux commandements de Dieu ? Jean 14:15',
        '2.15': 'Vous avez commencé à l’aimer. Pourquoi ? 1 Jean 4:19',
        '2.16': 'De même qu’un sarment porte du fruit parce qu’il est attaché au cep, vous porterez du fruit si vous restez attaché à Jésus.',
        '2.19': 'Qu’est-ce que ce « fruit » ? Galates 5:22-23',
        '2.20': 'L’Évangile, cette incroyable nouvelle que Dieu vous a tant aimé qu’il est mort pour vous, a éveillé dans votre cœur l’amour pour lui. Ce même amour vous rendra obéissant à ses commandements. Mais cette obéissance, vous ne pouvez pas la produire tout seul.',
        '2.24': 'Vous avez sans doute déjà remarqué, comme votre entourage, de nouveaux traits dans votre caractère. Là où vous haïssiez, vous aimez ; là où vous doutiez, vous croyez. Vous n’êtes pas parfait, mais votre vie chrétienne commence à se voir dans vos actes et vos paroles. Et tout cela vient de votre relation avec Jésus.',
        '2.25': 'Qui agit en vous ? Philippiens 2:13',
        '2.28': '« S’il est vrai que nous ne pouvons rien faire pour changer nos cœurs, ou pour nous rendre tels que Dieu nous veut ; si nous ne devons avoir aucune confiance en nous-mêmes ou en nos bonnes œuvres, notre vie révélera néanmoins que l’Esprit de Dieu demeure en nous. Un changement se remarquera dans notre caractère, nos habitudes et nos préoccupations. » <i>Vers Jésus</i>, chap. « La pierre de touche »',
        '2.29': 'Que produira votre foi en Dieu ? Jacques 2:14-17',
        '2.32': {'decaler': 27, 'html': '« Nous ne gagnons pas le salut par notre obéissance, puisque le salut est un don gratuit de Dieu, qui s’obtient par la foi. Par contre, l’obéissance est le fruit de la foi. » <i>Vers Jésus</i>, chap. « La pierre de touche »'},
        '2.35': {'decaler': 38, 'html': 'Quand vous aimez Dieu, vous voulez lui obéir.'},
        '3.00': 'Dans ses paroles :',
        '3.01': 'Quels sont les commandements de Jésus auxquels vous voudrez obéir ? Jean 13:34-35',
        '3.02': 'D’où venaient ses paroles, selon lui ? Jean 12:49',
        '3.07': 'Qu’est-ce que l’amour ? Romains 13:8-10',
        '3.08': 'Dans sa mort :',
        '3.10': 'Quels autres commandements Jésus dit-il avoir reçus de son Père ? Jean 10:17-18',
        '3.13': 'Comment Jésus a-t-il montré que l’amour est l’accomplissement de la loi ? Matthieu 22:36-40',
        '3.16': 'Même la mort de Jésus fut un acte d’obéissance : « Il s’est humilié lui-même, se rendant obéissant jusqu’à la mort, même jusqu’à la mort de la croix. » Philippiens 2:8.',
        '3.18': 'Examinez les dix commandements (Exode 20:3-17) et voyez si vous pouvez découvrir comment l’amour accomplit chacun d’eux. Par exemple, le premier commandement dit : « Tu n’auras pas d’autres dieux devant ma face. » Si vous aimez vraiment Dieu, placerez-vous quoi que ce soit, un autre dieu, avant lui ? Non.',
        '3.19': 'Jésus vous demande de vivre la même vie d’obéissance. Il dit : « Si quelqu’un veut venir après moi, qu’il se charge chaque jour de sa croix, et qu’il me suive. » Cela paraît impossible, n’est-ce pas ? Mais Jésus vous promet son aide.',
        '3.20': 'Regardez maintenant le sixième commandement : « Tu ne tueras point. » Si vous aimez votre prochain, le tuerez-vous ? Non.',
        '3.21': 'DIEU VOUS AIDE À OBÉIR',
        '3.22': 'En lisant les dix commandements à la lumière des paroles de Jésus, « Tu aimeras le Seigneur, ton Dieu, de tout ton cœur » et « Tu aimeras ton prochain comme toi-même », vous voyez que seul l’amour permet de les accomplir, de les observer tous. Observer les quatre premiers commandements montre notre amour pour Dieu ; observer les six derniers, notre amour pour les hommes.',
        '3.23': 'D’après Jésus, comment pouvait-il faire ce que Dieu attendait de lui ? Jean 5:30, première partie ; Jean 10:30.',
        '3.27': 'Jésus a dit que sa force pour obéir venait de son union avec le Père, et il désire que vous ayez la même force.',
        '3.28': 'JÉSUS, MODÈLE D’OBÉISSANCE',
        '3.29': 'Jésus a vécu une vie parfaite d’amour et d’obéissance envers Dieu. Voyez avec quelle fidélité il a gardé les commandements de son Père :',
        '3.30': 'Que demandait-il pour ses disciples dans sa prière ? Jean 17:21',
        '3.31': 'Dans sa vie :',
        '3.33': 'Qu’a-t-il dit être venu faire ? Jean 6:38',
        '4.01': 'Comment pouvez-vous être « un avec Jésus et le Père » ? Jean 15:4, première partie.',
        '4.02': 'Jean 14:15<br>Philippiens 2:13',
        '4.06': 'Comment Dieu vous aidera-t-il encore à garder ses lois et à lui obéir ? Hébreux 10:16',
        '4.07': 'Tout au long du chemin, Dieu vous aidera :',
        '4.08': {'taille': 11, 'famille': 'caladea', 'interligne': 14.5, 'cesure': False,
                 'css': '.m {font-family: sourcenoir; font-size: 12pt; color: #b0a891;}',
                 'html': 'Vos <span class="m">ACTES</span> découlent de<br>votre <span class="m">AMOUR</span>, qui découle de<br>votre <span class="m">COMMUNION</span> avec lui.'},
        '4.09': 'Choisissez donc chaque jour de rester avec lui.',
        '4.11': 'Jésus vous a-t-il déjà montré, dans sa Parole, la Bible, des domaines où vous devriez lui obéir ? Prenez une minute pour y réfléchir, et demandez-lui de vous parler d’une chose précise qu’il aimerait vous voir commencer à faire. Avez-vous pensé à quelque chose ? Si oui, notez-le ; puis priez et dites à Jésus que vous voulez commencer à faire ce qu’il désire. Demandez-lui son aide, puis remerciez-le de vous aider à lui obéir.',
    }
    ecrire_lecon(5, 'L’obéissance', [('L’obéissance', 538, 424, 46)], u)


@lecon(6)
def l6():
    u = {
        '1.01': 'Faites de l’exercice',
        '1.02': 'Les nouveau-nés se mettent à bouger le plus tôt possible : ils gigotent, s’étirent, se retournent, rampent, s’assoient, se mettent debout, marchent. C’est naturel pour eux. Pour vous aussi, qui venez de naître à la vie chrétienne, il sera naturel d’exercer votre foi en parlant de Jésus autour de vous.',
        '1.03': '« La force s’acquiert par l’exercice ; l’activité est la condition même de la vie. Ceux qui prétendent maintenir leur vie chrétienne en se bornant à accepter passivement les grâces d’en haut, sans rien faire pour le Christ, essaient simplement de manger sans travailler. Or, dans le monde spirituel comme dans le monde matériel, ce système aboutit fatalement à la dégénérescence et à la mort. Celui qui refuserait de faire usage de ses jambes perdrait bientôt la faculté de s’en servir. De même, le chrétien qui se refuse à employer les facultés que Dieu lui a données, non seulement ne grandit pas en Christ, mais il perd les forces qu’il possédait. » <i>Vers Jésus</i>, chap. « L’œuvre de la vie »',
        '1.04': {'decaler': 28, 'html': 'Alors, bougez avec le Christ : faites-le connaître autour de vous !'},
        '2.00': 'Qu’a fait André dès qu’il a rencontré Jésus ? Jean 1:40-41',
        '2.05': 'Qu’a fait Philippe après avoir rencontré Jésus ? Jean 1:45-46',
        '2.09': 'Jésus a guéri un homme possédé : vous pouvez lire ce récit dans Marc 5:1-19. Quand cet homme vit comment Jésus l’avait purifié et avait changé sa vie, il voulut rester avec lui.',
        '2.11': 'Mais que lui a répondu Jésus ? Marc 5:19',
        '2.16': 'Après sa résurrection, juste avant de retourner au ciel, Jésus donna des instructions semblables à tous les chrétiens.',
        '2.19': 'Quelles étaient ses directives ? Matthieu 28:19-20',
        '2.24': 'Aller parler du Christ aux gens, cela paraît difficile, n’est-ce pas ? Cela peut même faire peur. Mais quand vous pensez à ce que Jésus a fait pour vous, cela ne semble plus si difficile.',
        '2.28': 'Il y a plus d’un siècle, un voyageur engagea un vieil homme noir pour lui faire traverser le Mississippi à la rame. Au milieu de la traversée, le batelier lâcha ses rames et s’écria : « Regardez ! Regardez ! C’est le capitaine ! »',
        '2.31': 'Le voyageur regarda dans la direction que montraient les gestes agités du batelier et vit un homme appuyé contre le mât d’un sloop qui venait vers eux.',
        '2.32': '« Qui est cet homme ? demanda le voyageur. Qu’a-t-il donc fait pour vous ? — C’est l’homme qui m’a sauvé, répondit le vieil homme. Je suis',
        '2.01': 'tombé à l’eau ; il a sauté, m’a pris dans ses bras et m’a sauvé ! »',
        '2.03': 'Il ajouta : « Je voudrais être son esclave toute ma vie, mais avec mes rhumatismes, je ne vaux plus rien, même comme esclave. Il passe ici en bateau une fois par mois et je le guette. J’aime tant le montrer ! N’a-t-il pas l’air le plus bon que vous ayez jamais vu ? J’aime tant le montrer ! »',
        '2.07': 'C’est cela, témoigner : tout simplement montrer aux autres l’homme qui vous a sauvé, Jésus-Christ.',
        '2.10': 'MAIS PAR OÙ COMMENCER ? VERS QUI ALLER ?',
        '2.12': 'Vers qui, et dans quel ordre, Jésus a-t-il dit à ses disciples d’aller ? Actes 1:8',
        '2.22': 'Les disciples devaient commencer à témoigner là où ils étaient, à Jérusalem, puis étendre leur œuvre jusqu’à ce qu’elle embrasse le monde entier.',
        '2.25': 'Voyez vers qui André est allé d’abord : Jean 1:41',
        '2.29': 'Votre témoignage peut commencer aux mêmes endroits : auprès de votre famille et de vos amis.',
        '2.30': '« Nul n’est besoin, si nous voulons travailler pour Jésus-Christ, de nous rendre dans les pays païens, ni même peut-être de quitter le cercle étroit du foyer. Ce travail, nous pouvons l’accomplir dans notre famille, dans notre église, parmi ceux avec lesquels nous entrons en contact ou en relations commerciales. » <i>Vers Jésus</i>, chap. « L’œuvre de la vie »',
        '3.00': 'QUE DIRE AUX GENS ?',
        '3.01': 'Jésus a dit que notre vie serait comme une lumière dans un monde obscur, et que nos « bonnes œuvres » aideraient notre entourage à voir le Seigneur. On dit souvent que « les actes parlent plus fort que les mots » : rien d’étonnant donc à ce que notre vie soit notre meilleur témoignage de ce que Jésus est pour nous.',
        '3.02': 'Qu’est-ce que Jésus a dit à l’ancien possédé de raconter à ses amis ? Marc 5:19',
        '3.05': 'Quelles sont quelques-unes des « bonnes œuvres » que feront les chrétiens ?',
        '3.06': 'Il devait raconter à ses amis comment Jésus avait fait de lui un homme nouveau. Vous aussi, vous pouvez raconter comment Jésus a fait de vous une personne nouvelle. En voyant votre vie changée, vos amis vous demanderont peut-être ce qui vous est arrivé. Ce sera l’occasion de leur expliquer comment Jésus a pardonné vos péchés, vous a réconcilié avec Dieu et a mis en vous de nouveaux désirs. Après avoir raconté ce que le Christ a fait pour vous, expliquez à votre interlocuteur comment cela peut lui arriver à lui aussi. Pour cela, vous pourriez reprendre la leçon 1, « Naître à une vie nouvelle », et parcourir avec lui les étapes bibliques de la conversion. Demandez-lui ensuite s’il ne voudrait pas laisser Jésus entrer dans son cœur.',
        '3.07': 'Jacques 1:27',
        '3.10': 'Matthieu 7:12',
        '3.13': 'Michée 6:8',
        '3.16': 'ET SI L’ON VOUS REPOUSSE ?',
        '3.17': 'Par la gentillesse envers vos voisins, une miche de pain, une assiette de biscuits, un sourire dans la rue, un coup de main au jardin, l’honnêteté en affaires, la compassion envers les malheureux, Dieu peut se servir de vous pour toucher les cœurs.',
        '3.18': 'Qu’a dit Jésus de ceux qui refusent l’invitation à l’accepter ? Luc 10:16',
        '3.21': 'Il y a bien des façons de vivre une vie chrétienne de partage. Certaines familles « adoptent » une grand-mère ou un grand-père isolé ; d’autres aident une mère seule par leurs talents de bricoleur : réparer un robinet qui fuit, faire la vidange de la voiture… Pourquoi ne pas noter quelques façons de vous donner à votre entourage ?',
        '3.22': 'Jésus a dit que ceux qui vous repoussent le repoussent en réalité, lui, et non pas vous. Mais n’oubliez pas ces personnes : priez pour elles. Votre témoignage a semé dans leur esprit une graine de réflexion. Demandez à Dieu de l’arroser, pour qu’elle puisse germer un autre jour.',
        '3.23': 'Allez à la page « AVEC VOS PROPRES MOTS » et notez dans l’espace prévu vos projets de témoignage.',
        '3.24': 'Pour approfondir la manière d’être un témoin efficace, lisez Colossiens 4:2-6.',
        '3.25': 'Jésus a utilisé une image intéressante pour décrire l’influence que ses disciples auraient sur le monde qui les entoure.',
        '3.26': 'Qu’a-t-il dit ? Matthieu 5:14-16',
        '4.01': 'Notez les noms de quelques personnes à qui vous aimeriez faire connaître Jésus :',
        '4.06': 'Notez maintenant quelques façons de leur faire connaître Jésus :',
        '4.23': 'Matthieu 28:19-20<br>Matthieu 24:14',
    }
    ecrire_lecon(6, 'Les fruits de la vie chrétienne',
                 [('Les fruits de la', 500, 392, 36), ('vie chrétienne', 538, 430, 36)], u)


RESUME_PUCES = [
    ('VOUS ÊTES NÉ DE NOUVEAU', 'par la grâce de Dieu, par la foi en Jésus-Christ.'),
    ('VOUS ÊTES UN BÉBÉ', 'qui trébuchera et tombera en apprenant à marcher. Mais Jésus vous relèvera, vous pardonnera et vous remettra sur pied.'),
    ('VOUS AUREZ FAIM ET SOIF', 'de justice, et vous trouverez de quoi combler vos besoins en étudiant chaque jour la Parole de Dieu.'),
    ('VOUS APPRENDREZ À PARLER', 'à Dieu, chaque jour, dans la prière.'),
    ('VOUS OBÉIREZ À DIEU', 'et commencerez à porter les fruits de l’obéissance dans votre vie, grâce à votre union avec lui.'),
    ('VOUS EXERCEREZ VOTRE AMOUR', 'en annonçant aux autres la bonne nouvelle du salut.'),
    ('ET VOUS AUREZ LA JOIE DE GRANDIR', 'au sein d’une communauté de chrétiens.'),
]
RESUME_DROITE = (
    '<div class="h">NE VOUS ARRÊTEZ PAS LÀ :<br>CONTINUEZ À GRANDIR !</div>'
    '<div class="p g">Comment continuer à grandir ?</div>'
    '<div class="h g">1. CONTINUEZ À ÉTUDIER LA BIBLE CHAQUE JOUR.</div>'
    '<div class="p">D’autres cours d’étude à domicile peuvent vous aider à poursuivre un parcours méthodique '
    'd’apprentissage spirituel. Renseignez-vous auprès de votre accompagnateur.</div>'
    '<div class="h g">2. CONTINUEZ À PRIER CHAQUE JOUR.</div>'
    '<div class="h g">3. CHERCHEZ UN GROUPE BIBLIQUE DE MAISON OU UN GROUPE DE VIE À REJOINDRE.</div>'
    '<div class="p">Votre accompagnateur pourra peut-être vous aider à trouver un groupe qui vous plaira.</div>'
    '<div class="h g">4. CHERCHEZ UNE ÉGLISE ET COMMENCEZ À LA FRÉQUENTER RÉGULIÈREMENT.</div>'
    '<div class="v g2">Le souhait de Dieu pour vous :</div>'
    '<div class="p g">« Le Dieu de toute grâce, qui vous a appelés en Jésus-Christ à sa gloire éternelle, après que vous '
    'aurez souffert un peu de temps, vous perfectionnera lui-même, vous affermira, vous fortifiera, vous rendra '
    'inébranlables. » 1 Pierre 5:10</div>')
CSS_RESUME = ('span {font-family: inherit; font-size: inherit; color: inherit;} .h {font-family: sourcenoir; font-size: 14pt; line-height: 17.5pt; color: #b0a891;} '
              '.p {font-family: caladea; font-size: 11pt; line-height: 13.3pt; color: #6d6e71;} '
              '.v {font-family: caladea; font-weight: bold; font-size: 11pt; line-height: 13.3pt; color: #7e745c;} '
              '.g {margin-top: 12pt;} .g2 {margin-top: 24pt;}')


@lecon(7)
def l7():
    corps = ''.join(f'<tr><td class="m"><span>•</span></td><td><div><span class="t">{t}</span> {r}</div></td></tr>'
                    for t, r in RESUME_PUCES)
    gauche = {'rect': [56.7, 312, 282, 770], 'html': f'<table>{corps}</table>',
              'css': CSS_LISTE + 'td {padding-bottom: 12.5pt;} td.m {width: 18pt;} '
                     'td.m span {font-family: serif; font-size: 12pt; line-height: 16pt; color: #231f20;} '
                     'span {font-family: inherit; font-size: inherit; color: inherit;} '
                     'div {font-family: caladea; font-size: 11pt; line-height: 13.3pt; color: #6d6e71;} '
                     '.t {font-family: sourcenoir; font-size: 14pt; color: #b0a891;}'}
    droite = {'rect': [318.9, 236, 545, 770], 'html': RESUME_DROITE, 'css': CSS_RESUME}
    u = {
        '1.01': 'En grandissant, vous aurez<br>besoin d’amis',
        '1.02': 'Imaginez, si vous le pouvez, un nouveau-né déposé dès sa naissance dans un lit stérile, puis laissé grandir seul. Des infirmières en blouse, mais muettes, le changeraient quand il le faut ou poseraient un biberon à sa portée ; mais personne ne lui parlerait, ne lui sourirait, ne le prendrait dans ses bras. Il ne rentrerait pas à la maison, dans une famille. Pas de grands-parents, d’oncles, de tantes ou de cousins pour l’admirer. Il recevrait les meilleurs soins physiques : nourriture, environnement propre, examens médicaux. Mais aucune compagnie, aucune communication avec d’autres êtres humains.',
        '1.03': {'decaler': 14, 'html': 'Il est impossible de croire qu’un tel enfant puisse devenir un adulte équilibré. On peut même se demander s’il survivrait. Pour bien grandir, les bébés ont besoin d’une présence aimante et de tendresse, autant que de nourriture et de chaleur.'},
        '1.04': {'decaler': 14, 'html': 'Les chrétiens aussi ont besoin d’une présence aimante ; et Dieu veut que ses enfants vivent ensemble une heureuse communion fraternelle.'},
        '2.00': 'Quelle attitude Jésus demande-t-il aux chrétiens d’avoir les uns envers les autres ? Jean 13:34-35',
        '2.01': 'La Bible du Semeur traduit ce verset ainsi : « Encouragez-vous les uns les autres et aidez-vous mutuellement à grandir dans la foi. » N’est-ce pas beau ? Les chrétiens doivent s’aimer, se réconforter, s’encourager et s’entraider.',
        '2.04': 'Que doivent-ils encore faire ensemble ? Hébreux 10:24-25',
        '2.06': 'Si les chrétiens s’aiment les uns les autres, quel en sera le résultat ? Jean 17:21',
        '2.10': 'Qu’a promis Jésus, même aux petits groupes de croyants ? Matthieu 18:20',
        '2.14': 'L’amour unira les chrétiens, afin qu’ils présentent au monde un solide témoignage d’amour ; et par cet amour, le monde verra Jésus.',
        '2.16': 'La Bible indique clairement que les chrétiens ont besoin de se réunir. Vous voudrez donc aller à l’église et à d’autres rencontres de chrétiens, car vous serez encouragé et fortifié en adorant Dieu avec d’autres. Et vous pouvez être sûr que Jésus sera au milieu de vous, car il l’a promis.',
        '2.17': 'Que dit le psalmiste de l’unité chrétienne ? Psaume 133:1',
        '2.20': 'Mais comment trouver la bonne église ou le bon groupe de chrétiens ? La Bible dit que son peuple, aux derniers jours, aura deux caractéristiques.',
        '2.22': 'Comment encore les chrétiens se comporteront-ils les uns envers les autres ? Éphésiens 5:21 ; 1 Pierre 5:5',
        '2.23': '8. Quelles sont ces caractéristiques ? Apocalypse 12:17 (dernière partie)',
        '2.27': 'Se soumettre ne veut pas dire se laisser marcher dessus, mais chercher à faire grandir l’autre plutôt que soi-même.',
        '2.29': 'Trouver un groupe qui présente ces deux caractéristiques peut prendre du temps. Vous devrez poursuivre votre propre étude de la Bible pour connaître tous les commandements de Dieu et faire grandir votre relation avec Jésus. Mais, pour l’essentiel, cherchez des chrétiens qui obéissent à tous les commandements de Dieu et qui rendent témoignage de Jésus-Christ, leur Sauveur et Seigneur.',
        '2.30': 'Lisez 1 Thessaloniciens 5:11 et notez ce qu’il dit des relations que les chrétiens devraient avoir entre eux.',
        '2.33': {'decaler': 12, 'html': 'Pour une autre description intéressante des chrétiens en tant que groupe, lisez 1 Corinthiens 12:12-31.'},
        '3.01': 'À quoi Paul compare-t-il l’Église ? 1 Corinthiens 12:12-31',
        '3.02': 'Y a-t-il des façons concrètes de manifester votre amour à d’autres chrétiens ? Notez quelques idées qui vous viennent à l’esprit.',
        '3.05': 'Paul compare l’Église à un corps. Le corps a de nombreuses parties : bras, jambes, oreilles, yeux, bouche… Chaque organe a sa fonction, mais chaque partie est importante, si petite soit-elle. De même, les membres de l’Église sont différents : chacun a son don ou ses aptitudes, mais chacun est important pour l’ensemble.',
        '3.10': '10. Mais qui est la tête de l’Église ? Éphésiens 5:23',
        '3.13': '(Pour approfondir : Colossiens 1:18)',
        '3.15': 'Le Christ est la tête du corps des croyants : regardez à lui, l’exemple parfait. Si vous regardez comment vivent les autres (même des membres d’église), vous risquez de trébucher, car eux aussi trébuchent. <i>L’Église n’est pas un rassemblement de gens parfaits, mais un groupe de gens qui grandissent.</i> Profitez de la communion avec d’autres chrétiens en croissance, mais gardez les yeux sur le Christ, votre modèle.',
        **effacees('3.18', '3.19'),
        '3.17': 'Matthieu 18:20<br>Jean 13:34',
        '3.20': 'Quel est le but des différents « dons » ou talents dans l’Église ? Éphésiens 4:11-13',
        '3.26': 'Les nombreux talents présents dans l’Église de Dieu ont un seul but : aider chaque membre à grandir « à la mesure de la stature parfaite de Christ ». Le même verset parle de parvenir « à l’état d’homme fait » : de devenir des chrétiens adultes, et vous le deviendrez. Vos relations avec les autres membres de l’église peuvent vous aider à atteindre cet idéal.',
        '4.00': 'Prendre vie',
        '4.02': 'Que signifie PRENDRE VIE<br>avec Jésus ?',
        '4.04': 'Cela veut dire :',
        **effacees(*[f'4.{k:02d}' for k in (1, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
                                             24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38)]),
    }
    ecrire_lecon(7, 'La communion fraternelle', [('L’Église', 538, 430, 46)], u,
                 extra={'effacer_dessins': {'4': [[50, 75, 285, 200]]},
                        'textes': {'4': [{'x': 58, 'base': 160, 'texte': 'Résumé', 'police': SCRIPT, 'taille': 66,
                                          'couleur': CLAIR}]},
                        'zones': {'4': [gauche, droite]}})


if __name__ == '__main__':
    for n in [int(x) for x in sys.argv[1:]] or sorted(LECONS):
        LECONS[n]()
