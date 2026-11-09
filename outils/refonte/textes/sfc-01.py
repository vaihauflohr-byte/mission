# En quête de certitude, étude 1 — d'après « SFC1_How to understand the Bible.pdf » (livret scanné, 8 pages)
import re
ORIGINAL = 'quete-certitude/SFC1_How to understand the Bible.pdf'
TITRE = 'En quête de certitude — 1. Comment comprendre la Bible'
MARGE_DROITE = {3: 736, 4: 713, 5: 711, 6: 707, 7: 671}
SUSPENDU = True

def STYLE_AUTO(p):
    t = p['texte']
    if t.startswith('The Bible answer'):
        return 'etiquette'
    if re.search(r'(^|\s)(\d{1,2}|\|)[.,]\s', t[:14]):
        return 'question'
    return 'reponse'

ENTETE = 'Comment comprendre la Bible <span style="font-family: gill">• Des repères pour le XXI<sup>e</sup> siècle</span>'
def entete(rect, aligner):
    return {'rect': rect, 'bande': True, 'html': ENTETE, 'style': 'entete', 'css': f'text-align: {aligner};',
            'texte_rect': [rect[0] - 30 if aligner == 'right' else rect[0], rect[1] + 1, rect[2] + (0 if aligner == 'right' else 30), rect[3] + 2]}

REP = 'La Bible répond :'

PAGES = {
 1: {'zones': [
      {'rect': [140, 6, 472, 29], 'html': '<b><i>IT IS WRITTEN TÉLÉVISION PRÉSENTE :</i></b>', 'style': 'font-family: gill; font-size: 8.6pt; letter-spacing: 0.4pt;', 'texte_rect': [144, 8, 520, 30]},
      {'rect': [243, 47, 471, 99], 'html': 'EN QUÊTE DE', 'style': 'font-family: anton; font-size: 24.5pt; line-height: 34pt; color: #fff;', 'texte_rect': [246, 31, 505, 103]},
      {'rect': [513, 54, 660, 92], 'html': 'Certitude', 'style': 'font-family: archivo; font-size: 15.5pt; line-height: 18pt;', 'texte_rect': [517, 59, 668, 93]},
      {'rect': [135, 151, 626, 195], 'html': 'Comment comprendre la Bible', 'style': 'font-family: goudy; font-size: 20.5pt; line-height: 22pt;', 'texte_rect': [138, 152, 690, 196]},
      {'rect': [338, 195, 694, 224], 'html': 'Des repères pour le XXI<sup>e</sup> siècle', 'style': 'font-family: gill; font-size: 12.2pt; line-height: 13pt; color: #fff; text-align: right;', 'texte_rect': [250, 196, 690, 225]},
      {'rect': [566, 668, 726, 942], 'html': 'Les directions les plus importantes de la vie mènent de la terre au ciel.', 'style': 'citation', 'texte_rect': [574, 676, 728, 950]},
     ]},
 2: {'zones': [
      entete([226, 47, 670, 71], 'right'),
      {'rect': [96, 392, 560, 598], 'style': 'puces', 'html': '<ul style="margin-left: 12pt; padding-left: 0;">'
        '<li>Comment être sûr d’avoir la vie éternelle ?</li>'
        '<li>Si Dieu est si bon, pourquoi le monde va-t-il si mal ?</li>'
        '<li>Comment trouver la paix intérieure ?</li>'
        '<li>Comment devenir la personne que je veux vraiment être ?</li>'
        '<li>Que se passe-t-il cinq minutes après la mort ?</li>'
        '<li>Quelle est la vraie solution au stress ?</li>'
        '<li>Vivons-nous la fin de l’histoire humaine ?</li>'
        '<li>Comment le monde finira-t-il ?</li></ul>', 'texte_rect': [100, 396, 600, 610]},
     ]},
 3: {'zones': [entete([114, 38, 557, 61], 'left')], 'auto': {
      1: '1. Comment Dieu communique-t-il avec une humanité déchue ? 2 Pierre 1:21',
      2: REP,
      3: 'Dieu a parlé par son Saint-Esprit et a inspiré les prophètes pour qu’ils écrivent ses messages. Ils les ont rédigés avec leurs propres mots, mais le message de la Bible vient directement de Dieu. La Bible est la Parole de Dieu.',
      4: '2. Puisque la Bible a été écrite par des êtres humains, quelle part en est réellement inspirée par Dieu ? 2 Timothée 3:16',
      5: REP,
      6: 'L’Ancien et le Nouveau Testament sont tous deux inspirés par Dieu. L’Ancien Testament comprend les 39 premiers livres de la Bible, de la Genèse à Malachie. Il révèle le plan de Dieu pour son peuple avant la naissance de Jésus. Le Nouveau Testament, les 27 derniers livres de la Bible (de Matthieu à l’Apocalypse), raconte la naissance, la vie, la mort et la résurrection de Jésus. Il présente surtout les instructions de Dieu à son Église aujourd’hui.',
      7: '3. Les scribes ont recopié la Bible maintes fois au fil des siècles : est-elle encore fiable aujourd’hui ? Peut-on vraiment lui faire confiance ? Psaume 12:7, 8',
      8: REP,
      9: 'Le même Saint-Esprit qui a inspiré la Bible l’a préservée au long des siècles. Des découvertes archéologiques et historiques récentes ont encore confirmé son exactitude et sa fiabilité. La Parole de Dieu est un guide sûr et digne de confiance.',
     }},
 4: {'zones': [entete([265, 54, 708, 76], 'right')], 'effacer': [], 'auto': {
      2: '4. Dans quel but Dieu nous a-t-il donné la Bible ? Psaume 119:105',
      3: REP,
      4: 'La Parole de Dieu est comme une lampe de poche. Quand vous êtes dans l’obscurité, son faisceau perce les ténèbres et éclaire le chemin devant vous. La Bible éclaire notre intelligence.',
      5: '5. Quel est le premier principe pour bien comprendre la Bible ? 2 Pierre 1:20',
      6: REP,
      7: 'Nous évitons l’interprétation « personnelle » en laissant la Bible s’expliquer elle-même. La Bible est son propre interprète. En laissant un passage de l’Écriture en expliquer un autre, nous découvrons l’interprétation de Dieu.',
      8: '6. Quelle est la source de la vérité de Dieu ? Jean 17:17',
      9: REP,
      10: '7. Tant de gens interprètent la Bible différemment : est-il possible de connaître la vérité ? Jean 8:32',
      11: REP,
     }},
 5: {'zones': [entete([118, 54, 561, 76], 'left')], 'auto': {
      1: '8. Quelle attitude est indispensable pour comprendre la vérité biblique ? Jean 7:17',
      2: REP,
      3: 'Comprendre la Bible dépend largement de notre volonté de faire tout ce que Dieu demande. L’étude de la Bible n’est pas un simple exercice intellectuel : c’est une expérience du cœur. Si vous êtes prêt à faire tout ce que Dieu vous demande dans sa Parole, il vous conduira dans toute la vérité.',
      4: '9. Pourquoi certains ont-ils du mal à comprendre la vérité biblique ? Ésaïe 53:6 ; Proverbes 16:25',
      5: REP,
      6: 'Certains ont du mal à comprendre la Bible parce qu’ils ne veulent pas renoncer à leurs propres idées. Dieu nous invite à chercher sa voie, et non la nôtre. Il nous invite à quitter l’orgueil de notre propre intelligence pour accepter humblement sa volonté révélée dans sa Parole.',
      7: '10. Que nous dit la Bible de faire pour comprendre la vérité ? 2 Timothée 2:15',
      8: REP,
      9: 'Il est très important d’étudier la Bible par vous-même. Nous ne pouvons pas nous fier à ce que d’autres nous disent. Dieu vous invite à découvrir personnellement la vérité dans sa Parole.',
     }},
 6: {'zones': [entete([261, 36, 705, 58], 'right')], 'auto': {
      1: '11. Si Dieu nous conduit dans la vérité quand nous étudions les Écritures, quelle méthode d’étude biblique nous aidera particulièrement à découvrir sa vérité ? Ésaïe 28:9, 10 ; 1 Corinthiens 2:13',
      2: REP,
      3: 'Imaginez que vous assemblez un puzzle. Décidez-vous à quoi ressemblera l’image finale sans regarder le modèle ? Certainement pas ! Il en va de même avec la Parole de Dieu. Dieu nous invite à étudier tous les textes sur un sujet avant de conclure sur ce que la Bible enseigne à ce sujet.',
      4: '12. Quelle garantie Jésus nous donne-t-il que, si nous étudions la Bible avec un cœur sincère, nous serons conduits dans sa vérité ? Jean 16:13',
      5: REP,
      6: 'Si le Saint-Esprit nous guide dans notre étude de la Bible, ligne après ligne et texte après texte, nous connaîtrons la vérité de Dieu. Dieu ne nous a pas laissés seuls dans notre recherche de la vérité : il nous a promis la direction du Saint-Esprit.',
      7: '13. Qui est le thème central de la Bible ? Jean 5:39',
      8: REP,
     }},
 7: {'zones': [entete([80, 47, 525, 69], 'left'),
      {'rect': [70, 437, 238, 457], 'html': 'MA DÉCISION :', 'style': 'font-family: goudy; font-weight: bold; font-size: 12pt; line-height: 13pt;', 'texte_rect': [71, 433, 320, 462]},
      {'rect': [92, 455, 676, 513], 'html': '<i>J’ai la ferme intention de laisser le Saint-Esprit façonner ma vie, en ouvrant mon cœur pour découvrir l’amour et la vérité de Jésus dans sa Parole.</i>', 'style': 'reponse', 'css': 'text-indent: 0;', 'texte_rect': [94, 456, 690, 530]},
     ], 'auto': {
      1: '14. Que se passera-t-il dans notre vie à mesure que nous étudierons les précieuses promesses de la Parole de Dieu ? 2 Pierre 1:3, 4',
      2: REP,
      3: 'Les Écritures rendent témoignage de Jésus. Quand nous étudions la Bible, la puissance du Christ vivant nous transforme.',
     }},
 8: {'zones': [entete([265, 33, 710, 56], 'right'),
      {'rect': [104, 828, 172, 848], 'html': '<b><i>NOM</i></b>', 'style': 'font-family: gill; font-size: 8.4pt; letter-spacing: 0.5pt;', 'texte_rect': [106, 829, 260, 853]},
      {'rect': [104, 885, 200, 904], 'html': '<b><i>ADRESSE</i></b>', 'style': 'font-family: gill; font-size: 8.4pt; letter-spacing: 0.5pt;', 'texte_rect': [106, 886, 260, 910]},
      {'rect': [489, 942, 562, 962], 'html': '<b><i>TÉLÉPHONE</i></b>', 'style': 'font-family: gill; font-size: 8.4pt; letter-spacing: 0.5pt; text-align: right;', 'texte_rect': [420, 943, 560, 967]},
      {'rect': [104, 986, 515, 1004], 'html': 'Pour en savoir plus sur ces études bibliques, contactez :', 'style': 'font-family: goudy; font-size: 7.3pt;', 'texte_rect': [107, 987, 600, 1007]},
     ]},
}

FLUX = [
 {'nom': 'introduction', 'style': 'corps', 'regles': 'p + p {text-indent: 1.4em;} p.suite {text-indent: 0;}', 'premiere_ligne': (1, [143, 338, 406, 368]), 'effacer_ligne': [143, 335, 406, 366], 'zones': [
     (1, [108, 366, 411, 651]), (1, [108, 651, 562, 1119]), (2, [66, 154, 663, 381])],
  'html': '<p>e temps presse : vous roulez vers un rendez-vous très important. C’est urgent !</p>'
          '<p>Ce rendez-vous se trouve à plus de mille kilomètres de chez vous, dans une ville inconnue. Il est fixé à 14 heures, à une adresse professionnelle où vous n’êtes jamais allé. Le président de l’une des plus grandes entreprises d’Amérique vous a proposé un poste intéressant.</p>'
          '<p>À une centaine de kilomètres de votre destination, vous doutez d’arriver à l’heure. Vous n’êtes même plus sûr d’aller dans la bonne direction. Vous vous arrêtez pour demander de l’aide. Chaque personne interrogée vous indique un chemin différent. Complètement désorienté, vous voilà irrémédiablement perdu. Vous êtes maintenant certain de manquer ce rendez-vous capital.</p>'
          '<p>Dans votre recherche désespérée, vous vous adressez à un pompiste. Heureusement, non seulement il connaît le chemin, mais il vous donne une carte avec des indications précises. Rassuré, vous repartez certain d’arriver à destination. Vous arrivez au rendez-vous à l’heure exacte.</p>'
          '<p>Dieu nous a donné des repères pour le XXI<sup>e</sup> siècle. Les directions les plus importantes de la vie mènent de la terre au ciel. Le rendez-vous le plus important de la vie, c’est d’être prêt à rencontrer le Christ à son retour. Il n’y a pas de seconde chance pour l’éternité. Manquer l’éternité avec le Christ, c’est manquer le rendez-vous le plus important de la vie. Pourtant, une multitude de gens ont pris de mauvaises « directions religieuses ». Ils sont désespérément perdus sur la route de la vie. Sans « carte religieuse » pour les guider, ils sont désorientés. Ils ont cherché la vérité par eux-mêmes, sans rien trouver. Ils ont écouté des voix qui les égaraient, et leur recherche désespérée n’a mené nulle part. Ils sont sur la mauvaise route, et ils le savent.</p>'
          '<p>Où trouver une carte fiable ? Existe-t-il des repères pour traverser le XXI<sup>e</sup> siècle avec assurance ? Oui. La Bible donne des indications claires. Elle apporte des réponses compréhensibles aux questions les plus profondes du cœur humain, par exemple :</p>'},
 {'nom': 'suite', 'style': 'corps', 'regles': 'p {text-indent: 1.4em;}', 'zones': [(2, [66, 618, 674, 1100])],
  'html': '<p>Ces leçons sont spécialement conçues pour répondre à vos questions directement à partir de la Bible. Vous pouvez faire confiance à la Parole de Dieu. Si vous n’avez jamais étudié la Bible, une riche récompense vous attend : la Parole de Dieu vous apportera encouragement et espérance dans votre recherche du sens profond de la vie. Si vous la connaissez déjà bien, ces leçons vous feront approfondir les vérités de la Parole de Dieu.</p>'
          '<p>La première leçon, « Comment comprendre la Bible », vous donne les clés pour comprendre la Bible par vous-même. La Bible a été écrite sur une période de 1 500 ans. Elle contient 66 livres, écrits par une quarantaine d’auteurs. Ils abordent les sujets les plus difficiles et les plus controversés qui soient, et pourtant ils sont d’accord : ils ne se contredisent pas. Ces écrits témoignent d’une inspiration divine.</p>'
          '<p>Un message central traverse toute la Bible : le Christ, Sauveur de l’humanité. L’histoire biblique commence en Éden, le monde parfait de Dieu, et se termine en Éden, le monde parfait de Dieu restauré.</p>'
          '<p>Avant l’entrée du péché dans le monde, Dieu communiquait directement avec Adam et Ève. Le péché a séparé nos premiers parents de Dieu. Aujourd’hui, une communion face à face avec Dieu n’est plus possible. Pourtant, le cœur d’un Dieu d’amour désire toujours communiquer avec une planète en rébellion. Voyons comment.</p>'},
]
