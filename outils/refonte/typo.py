"""Espaces insécables de la typographie française (avant : ; ? ! et à l'intérieur des guillemets)."""
import re
NBSP = ' '

def fr(s):
    if s is None:
        return None
    s = re.sub(r' ([:;?!])', NBSP + r'\1', s)
    s = re.sub(r'« ', '«' + NBSP, s)
    s = re.sub(r' »', NBSP + '»', s)
    return s

import pyphen
_DIC = pyphen.Pyphen(lang='fr_FR', left=3, right=3)
SHY = '­'

def cesure(html):
    """Ajoute des césures possibles (traits d'union conditionnels) dans les mots longs, hors balises."""
    morceaux = re.split(r'(<[^>]+>|&[a-z]+;)', html)
    out = []
    for m in morceaux:
        if m.startswith('<') or m.startswith('&'):
            out.append(m)
        else:
            out.append(re.sub(r"[A-Za-zÀ-ÿœŒ]{7,}", lambda w: _DIC.inserted(w.group(0), hyphen=SHY), m))
    return ''.join(out)


NOWRAP = '<span style="white-space: nowrap">{}</span>'


def refs(html):
    """Références bibliques insécables (« Jean 3:16 », « 2 Pierre 1:21 », « Luc 24:27, 32 »), dates
    (« 539 av. J.-C. »), pronoms inversés (« est-elle », « a-t-il ») et nombres (« 2 500 ») sans coupure.
    (Même règle que refs() de sfc.py.)"""
    if not isinstance(html, str):
        return html
    html = re.sub(r'(?<=[A-Za-zéèêëïîÉ]) (?=\d+:\d)', NBSP, html)
    html = re.sub(r'\b([1-3]) (?=[A-ZÉ][a-zéèêëï]+' + NBSP + r'\d)', r'\1' + NBSP, html)
    html = re.sub(r'(\d+:\d+(?:-\d+)?), (?=\d)', r'\1,' + NBSP, html)
    html = re.sub(r'(\d+) (av\.|apr\.) J\.-C\.', lambda m: NOWRAP.format(f'{m.group(1)}{NBSP}{m.group(2)}{NBSP}J.-C.'), html)
    html = re.sub(r"(?<![\w’'-])([\wÀ-ÿ’']+(?:-t)?-(?:il|ils|elle|elles|on|je|tu|nous|vous|ce|là|ci|même|mêmes))(?![\w-])",
                  lambda m: NOWRAP.format(m.group(1)), html)
    html = re.sub(r'\b(Y) (?=<span style="white-space: nowrap">a-t-il)', r'\1' + NBSP, html)
    html = re.sub(r'(?<=\d) (?=\d{3}\b)', NBSP, html)
    return html
