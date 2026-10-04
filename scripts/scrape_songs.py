"""Scrape the Gitabitan song list.

Stages (each resumable; pages are cached under cache/):
  gb     - geetabitan.com: index + every song page (metadata, transliteration)
  ws     - bn.wikisource.org: every numbered Gitabitan song page (Bengali title + lyrics)
  merge  - join both into data/songs_base.json

Usage: python3 scripts/scrape_songs.py [gb] [ws] [merge]   (default: all)
"""
import collections
import difflib
import hashlib
import json
import re
import sys
import time
import unicodedata
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
DATA = ROOT / "data"
UA = "RabindrasangeetPersonalSite/0.1 (personal non-commercial project)"
S = requests.Session()
S.headers["User-Agent"] = UA

BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
TO_BN = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")


def scan_title(idx, n):
    return f"পাতা:{idx}/{str(n).translate(TO_BN)}"


def fetch(url, path, delay, **params):
    """GET url, caching the body at path. Sleeps only on real network hits."""
    if path.exists():
        return path.read_text(encoding="utf-8")
    for attempt in range(5):
        try:
            if params.get("action") == "query":  # long title lists: POST avoids 414
                r = S.post(url, data=params, timeout=60)
            else:
                r = S.get(url, params=params or None, timeout=30)
            if r.status_code == 404:
                return None
            if r.status_code == 429:
                wait = int(r.headers.get("Retry-After", 0) or 0) or 60 * (attempt + 1)
                print(f"  429, sleeping {wait}s", flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            break
        except requests.RequestException as e:
            print(f"  retry {attempt + 1}: {url} ({e})", flush=True)
            time.sleep(5 * (attempt + 1))
    else:
        return None
    r.encoding = "utf-8"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(r.text, encoding="utf-8")
    time.sleep(delay)
    return r.text


# ---------------------------------------------------------------- geetabitan
def gb_index():
    js = fetch("https://www.geetabitan.com/search/js/all_lyrics.js", CACHE / "geetabitan" / "all_lyrics.js", 1)
    return re.findall(r'href="https?://www\.geetabitan\.com(/lyrics/[^"]+)">([^<]+)</a>', js)


def parse_gb(html):
    soup = BeautifulSoup(html, "html.parser")
    meta = {}
    box = soup.select_one("div.marginbottom20.fontengsize16")
    if box:
        for p in box.find_all("p"):
            k, _, v = p.get_text(" ", strip=True).partition(":")
            if v.strip():
                meta[k.strip().lower()] = v.strip()
    pre = soup.select_one("#copy pre")
    translit = pre.get_text().strip("\n") if pre else ""
    return meta, translit


def split_num(s):
    """'Prakriti (98)' -> ('Prakriti', 98)."""
    m = re.match(r"(.*?)\s*\((\d+)\)\s*$", s or "")
    return (m.group(1).strip(), int(m.group(2))) if m else ((s or "").strip() or None, None)


def stage_gb():
    entries = gb_index()
    print(f"geetabitan index: {len(entries)} songs", flush=True)
    out = []
    for i, (path, title) in enumerate(entries, 1):
        html = fetch("https://www.geetabitan.com" + path, CACHE / "geetabitan" / path.lstrip("/"), 1.0)
        if i % 100 == 0:
            print(f"  gb {i}/{len(entries)}", flush=True)
        if not html:
            print(f"  missing: {path}", flush=True)
            continue
        meta, translit = parse_gb(html)
        parjay, pnum = split_num(meta.get("parjaay"))
        sub, snum = split_num(meta.get("upa-parjaay"))
        out.append({
            "gb_url": "https://www.geetabitan.com" + path,
            "title_en": title.strip(),
            "parjay_en": parjay, "parjay_num": pnum,
            "sub_parjay_en": sub, "sub_parjay_num": snum,
            "taal": meta.get("taal"), "raag": meta.get("raag"),
            "written": meta.get("written on"), "place": meta.get("place"),
            "collection": meta.get("collection"),
            "lyrics_translit": translit,
        })
    (DATA).mkdir(exist_ok=True)
    (DATA / "gb_raw.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"gb done: {len(out)}", flush=True)


# ---------------------------------------------------------------- wikisource
WS_API = "https://bn.wikisource.org/w/api.php"


def ws_titles():
    p = CACHE / "wikisource" / "_titles.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    titles, cont = [], {}
    while True:
        r = S.get(WS_API, params={"action": "query", "list": "allpages", "apprefix": "গীতবিতান/",
                                  "apfilterredir": "nonredirects", "aplimit": 500, "format": "json", **cont}).json()
        titles += [x["title"] for x in r["query"]["allpages"]]
        if "continue" not in r:
            break
        cont = r["continue"]
        time.sleep(0.5)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(titles, ensure_ascii=False), encoding="utf-8")
    return titles


def ws_wikitext(titles, label):
    """Raw wikitext for many pages, 50 per API call; each batch cached as JSON."""
    out = {}
    for b in range(0, len(titles), 50):
        chunk = titles[b:b + 50]
        path = CACHE / "wikisource" / label / (hashlib.md5("|".join(chunk).encode()).hexdigest()[:12] + ".json")
        raw = fetch(WS_API, path, 3, action="query", prop="revisions", rvprop="content", rvslots="main",
                    format="json", formatversion=2, titles="|".join(chunk))
        if not raw:
            raise SystemExit(f"wikisource batch failed: {label} {b}")
        q = json.loads(raw)["query"]
        alias = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for p in q["pages"]:
            if "revisions" in p:
                out[alias.get(p["title"], p["title"])] = p["revisions"][0]["slots"]["main"]["content"]
    return out


def _unwrap(m):
    """{{name|a|key=v|text}} -> last positional argument."""
    args = [a for a in m.group(1).split("|")[1:] if not re.match(r"\s*[\w-]+\s*=", a)]
    return args[-1] if args else ""


def clean_wikitext(t):
    t = t.replace("াে", "ো")  # OCR-broken o-kar (া + ে)
    t = t.replace("﻿", "").replace("​", "")
    t = re.sub(r"<noinclude>.*?</noinclude>", "", t, flags=re.S)
    t = re.sub(r"<!--.*?-->", "", t, flags=re.S)
    t = re.sub(r"<ref[^>]*?/>|<ref.*?</ref>", "", t, flags=re.S)
    t = re.sub(r"<section[^>]*/>", "", t)
    t = re.sub(r"<br\s*/?>", "\n", t)
    t = re.sub(r"\{\{\s*(gap|em|nbsp|ফাঁক)[^{}]*\}\}", " ", t, flags=re.I)
    # hanging first word set in the margin: {{overfloat left|যদি|depth=4em}}প্রেম -> 'যদি প্রেম'
    t = re.sub(r"\{\{\s*overfloat left\s*\|([^{}]*)\}\}", lambda m: _unwrap(re.match(r"(.*)", "x|" + m.group(1))) + " ", t,
               flags=re.I)
    t = re.sub(r"\{\{\s*c\s*\|\s*[০-৯\d]+\s*\}\}", "", t, flags=re.I)  # song number heading
    t = re.sub(r"\{\{\s*rh\s*\|[^{}]*\}\}", "", t, flags=re.I)  # running header
    prev = None
    while prev != t:  # innermost templates first, until stable
        prev = t
        t = re.sub(r"\{\{([^{}|]*)\}\}", "", t)  # no-arg templates
        t = re.sub(r"\{\{([^{}]*\|[^{}]*)\}\}", _unwrap, t)
    t = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"\{\{[^{}|\n]*\|?|\}\}", "", t)  # unbalanced leftovers spanning pages
    t = t.replace("'''", "").replace("''", "").replace("&nbsp;", " ")
    lines = [re.sub(r"[ \t ]+", " ", l).strip(" :") for l in t.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    text = re.sub(r"^(?:[০-৯\d]+\s*\n)+", "", text).strip()  # leading stray numbers
    return text


def section_bounds(text, begin_sec, end_sec):
    """Slice a Page: wikitext from section begin_sec's start to end_sec's end (None = page edge).
    Supports <section begin/end="x"/> and ## x ## markers."""
    start, end = 0, len(text)
    if begin_sec:
        m = (re.search(rf'<section begin="?{re.escape(begin_sec)}"?\s*/>', text)
             or re.search(rf"^##\s*{re.escape(begin_sec)}\s*##\s*$", text, re.M))
        if m:
            start = m.end()
    if end_sec:
        m = re.search(rf'<section end="?{re.escape(end_sec)}"?\s*/>', text[start:])
        if m:
            end = start + m.start()
        else:
            h = re.search(rf"^##\s*{re.escape(end_sec)}\s*##\s*$", text, re.M)
            nxt = re.search(r"^##\s*[^#\n]+?\s*##\s*$", text[h.end():], re.M) if h else None
            if nxt:
                end = h.end() + nxt.start()
    return text[start:end]


def stage_ws():
    titles = [t for t in ws_titles() if re.fullmatch(r"গীতবিতান/[^/]+/[০-৯]+", t)]
    print(f"wikisource numbered pages: {len(titles)}", flush=True)
    songs = ws_wikitext(titles, "songs")
    refs, need = {}, set()
    for t, w in songs.items():
        m = re.search(r"<pages\s(.*?)/>", w, re.S)
        if not m:
            continue
        attrs = dict(re.findall(r'(\w+)\s*=\s*"?([^"\s/]+)"?', m.group(1)))
        if "index" not in attrs or "from" not in attrs:
            continue
        idx, a = attrs["index"], int(attrs["from"].translate(BN_DIGITS))
        b = int(attrs.get("to", attrs["from"]).translate(BN_DIGITS))
        refs[t] = (idx, a, b, attrs.get("fromsection"), attrs.get("tosection"))
        need.update(scan_title(idx, n) for n in range(a, b + 1))
    print(f"  song pages: {len(songs)}, scan pages needed: {len(need)}", flush=True)
    pages = ws_wikitext(sorted(need), "scan")
    out = []
    for t in titles:
        _, section, num = t.split("/")
        lyrics = ""
        if t in refs:
            idx, a, b, fs, ts = refs[t]
            parts = []
            for n in range(a, b + 1):
                txt = re.sub(r"<noinclude>.*?</noinclude>", "", pages.get(scan_title(idx, n), ""), flags=re.S)
                parts.append(section_bounds(txt, fs if n == a else None, ts if n == b else None))
            lyrics = clean_wikitext("\n".join(parts))
            heads = {section, "গীতবিতান"} | {x.split("/")[1] for x in titles}
            while lyrics and lyrics.split("\n", 1)[0].strip() in heads:  # leaked section heading
                lyrics = lyrics.split("\n", 1)[1].strip() if "\n" in lyrics else ""
        first = lyrics.split("\n", 1)[0].rstrip(",।;—-–! ") if lyrics else ""
        out.append({"ws_title": t, "section_bn": section, "num": int(num.translate(BN_DIGITS)),
                    "title_bn": first, "lyrics_bn": lyrics})
    DATA.mkdir(exist_ok=True)
    (DATA / "ws_raw.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"ws done: {len(out)}", flush=True)


# ---------------------------------------------------------------- merge
# geetabitan parjay -> (display name, Bengali name / Wikisource section)
PARJAY = {
    "puja": ("Puja", "পূজা"),
    "prem": ("Prem", "প্রেম"),
    "prakriti": ("Prakriti", "প্রকৃতি"),
    "bichitro": ("Bichitra", "বিচিত্র"),
    "bichitra": ("Bichitra", "বিচিত্র"),
    "natya-geeti": ("Natyageeti", "নাট্যগীতি"),
    "prem o prokriti": ("Prem O Prakriti", "প্রেম ও প্রকৃতি"),
    "prem o prakriti": ("Prem O Prakriti", "প্রেম ও প্রকৃতি"),
    "puja o prarthana": ("Puja O Prarthana", "পূজা ও প্রার্থনা"),
    "swadesh": ("Swadesh", "স্বদেশ"),
    "jatiya sangeet": ("Jatiya Sangeet", "জাতীয় সংগীত"),
    "anushthanik": ("Anushthanik", "আনুষ্ঠানিক"),
    "anushthanik sangeet": ("Anushthanik Sangeet", "আনুষ্ঠানিক সংগীত"),
    "bhanu singher padabali": ("Bhanusingher Padabali", "ভানুসিংহ ঠাকুরের পদাবলী"),
    "mantra gaan": ("Mantra Gaan", "মন্ত্র গান"),
    "porishishto": ("Parishishta", "পরিশিষ্ট"),
    "porishishta": ("Parishishta", "পরিশিষ্ট"),
}
WS_PARJAY = {bn: en for en, bn in PARJAY.values()}
DRAMAS = {"balmiki-pratibha": "বাল্মীকিপ্রতিভা", "kaal-mrigaya": "কালমৃগয়া", "mayar-khela": "মায়ার খেলা",
          "chitrangada": "চিত্রাঙ্গদা", "chandalika": "চণ্ডালিকা", "shyama": "শ্যামা",
          "porishodh": "পরিশোধ", "mayar-khela-nn": "মায়ার খেলা"}
SEASONS = {"borsha": "Barsha", "barsha": "Barsha", "basanta": "Basanta", "sharat": "Sharat",
           "grisma": "Grishma", "grishma": "Grishma", "hemanta": "Hemanta", "sheet": "Sheet",
           "shit": "Sheet"}


BN_SKEL = {}
for _chars, _v in [("কখ", "k"), ("গঘ", "g"), ("ঙঞণনং", "n"), ("চছ", "c"), ("জঝয", "j"), ("টঠতথৎ", "t"),
                   ("ডঢদধ", "d"), ("ড়ঢ়রৃঋ", "r"), ("পফ", "p"), ("বভ", "b"), ("ম", "m"), ("ল", "l"),
                   ("শষস", "s")]:
    for _c in _chars:
        BN_SKEL[_c] = _v
LAT_DIGRAPHS = [("chh", "c"), ("ch", "c"), ("sh", "s"), ("kh", "k"), ("gh", "g"), ("th", "t"), ("dh", "d"),
                ("ph", "p"), ("bh", "b"), ("jh", "j"), ("ng", "n"), ("w", "b"), ("v", "b"), ("f", "p"),
                ("z", "j"), ("q", "k"), ("x", "ks"), ("y", "")]


def skel_bn(t):
    """Rough consonant skeleton of Bengali text, comparable with skel_en."""
    t = unicodedata.normalize("NFC", t or "").replace("য়", "")
    return re.sub(r"(.)\1+", r"\1", "".join(BN_SKEL.get(c, "") for c in t))


def skel_en(t):
    t = re.sub(r"[^a-z]", "", (t or "").lower())
    for a, b in LAT_DIGRAPHS:
        t = t.replace(a, b)
    return re.sub(r"(.)\1+", r"\1", re.sub(r"[aeiouh]", "", t))


def title_sim(bn, en, window=False, min_len=1):
    """Skeleton similarity of the title starts; window=True also tries every offset into bn
    (geetabitan sometimes titles a song by a phrase from mid-line)."""
    a, b = skel_bn(bn), skel_en(en)
    n = min(len(a), len(b), 12)
    if n < min_len:
        return 0.0
    best = difflib.SequenceMatcher(None, a[:n], b[:n]).ratio()
    if window:
        for i in range(1, max(1, len(a) - n + 1)):
            best = max(best, difflib.SequenceMatcher(None, a[i:i + n], b[:n]).ratio())
    return best


def norm_parjay(raw):
    """-> (parjay_en, parjay_bn, drama or None, number or None)."""
    if not raw:
        return None, None, None, None
    raw = re.split(r"\s+Upa-parjaay:", raw)[0]
    name, num = split_num(raw)
    name = re.sub(r"\s*\(\w+\)$", "", name or "")  # 'Bichitro (54A)'
    m = re.match(r"(.*?)\s+(\d+)$", name)  # 'Bichitro 93'
    if m and num is None:
        name, num = m.group(1), int(m.group(2))
    low = name.lower()
    first = re.split(r"\s*/\s*|\s+nn\b|\s*\(scene", low)[0].strip().replace(" ", "-")
    if first in DRAMAS:
        return "Geetinatya O Nrityanatya", "গীতিনাট্য ও নৃত্যনাট্য", first.replace("-", " ").title(), None
    if re.match(r"p[oa]r[iu]sh?i?sh?t", low):
        return "Parishishta", "পরিশিষ্ট", None, None
    if low.startswith("bhanu"):
        low = "bhanu singher padabali"
    key = re.split(r"\s*/\s*", low)[0].strip()
    if key in PARJAY:
        en, bn = PARJAY[key]
        return en, bn, None, num
    return None, None, None, None


RAAG_CANON = {
    "asabari": "Ashavari", "ashabari": "Ashavari", "asowari": "Ashavari", "asoari touri teoth": "Ashavari",
    "bageshre": "Bageshree", "bagesree": "Bageshree", "bahaar": "Bahar", "bahag": "Behag", "behaag": "Behag",
    "bahirav": "Bhairav", "bhairon": "Bhairav", "bhaupali": "Bhupali", "bhopali": "Bhupali",
    "bhimpalasri": "Bhimpalasi", "basanta": "Basant", "bilabal": "Bilawal", "brindavani": "Brindavani Sarang",
    "chhayanot": "Chhayanat", "goursarang": "Gour Sarang", "hamir": "Hameer", "not hameer": "Nat",
    "iman kayan": "Iman", "iman kalyan": "Iman", "iman bhupali": "Iman", "kalyan": "Iman",
    "jayjayanti": "Jaijayanti", "jhinjhat": "Jhijhit", "jhijhit khambaj": "Jhijhit",
    "misra jhijhit khambaj": "Jhijhit", "karnataki jhijhit": "Carnatic", "karnataki khambaj": "Carnatic",
    "karnati bhajan": "Carnatic", "jogiya": "Jogia", "kadara": "Kedara", "kedar": "Kedara",
    "maaru kedara": "Kedara", "kahmbaj": "Khambaj", "kalangara": "Kalingara", "kalangara sohini": "Kalingara",
    "lallit": "Lalit", "lalit kalingara": "Lalit", "malhaar": "Malhar", "miyan": "Malhar", "misra malhar": "Malhar",
    "malkaus": "Malkauns", "malkosh": "Malkauns", "multaan": "Multan", "purabi": "Purvi",
    "ramprasadi sur": "Ramprasadi", "sankara": "Shankara", "sankaravaran": "Shankarabharan",
    "bhairavi baul": "Bhairavi", "bhairavi tappa": "Bhairavi", "ananda bhairavi": "Bhairavi", "ananda": "Bhairavi",
    "pilu baroa": "Pilu", "barwan pilu": "Barwan", "desh khambaj": "Desh", "paraj basaanta": "Paraj",
    "sindhu kafi": "Sindhu", "sindhu khambaj": "Sindhu", "nachari touri": "Nachari", "baul sur": "Baul",
    "lachhasaar": "Lachhasar",
}
WESTERN = re.compile(r"auld lang|drink to me|glory waits|nancy|robin adair|grenadier|vicar of bray|banks and braes", re.I)


def simplify_raag(r):
    if not r:
        return None
    if WESTERN.search(r):
        return "Western"
    v = re.sub(r"(?i)^mi?shra[- ]+", "", r.strip())
    v = re.split(r"\s*[-/,&(]\s*", v)[0]
    v = re.sub(r"\s+", " ", v).strip()
    return RAAG_CANON.get(v.lower(), v[:1].upper() + v[1:])


def slug(url):
    return re.sub(r"-lyric\.html$", "", url.rsplit("/", 1)[-1])


MATCH_MIN = 0.5  # number matches below this title similarity are numbering mismatches
# geetabitan pages whose transliteration belongs to a different song (their Bengali match is right)
TRANSLIT_WRONG = {"saarthak-janom-aamar"}
FUZZY_MIN = 0.8


DRAMA_PAGES = list(range(743, 877)) + list(range(1043, 1084))  # গীতিনাট্য ও নৃত্যনাট্য + পরিশিষ্ট dramas


def drama_lines():
    """All lyric lines of the dance dramas (speaker names stripped), in book order."""
    need = [scan_title("গীতবিতান.djvu", n) for n in DRAMA_PAGES]
    pages = ws_wikitext(need, "dramascan")
    out = []
    for t in need:
        txt = re.sub(r"<noinclude>.*?</noinclude>", "", pages.get(t, ""), flags=re.S)
        txt = re.sub(r"\{\{\s*rule[^{}]*\}\}", "\n", txt)
        for line in clean_wikitext(txt).split("\n"):
            line = re.sub(r"^[^\s।]+(?:\s+ও\s+[^\s।]+)*।\s*", "", line.strip())  # 'অমর ও কুমার। '
            if re.search(r"(প্রবেশ|প্রস্থান|অন্তর্ধান)[।]?$", line) and len(line) < 60:  # stage direction
                continue
            if line and not re.fullmatch(r"[০-৯\d\s]+", line):
                out.append(line)
    return out


def match_drama(translit, lines, skels):
    """Find the song in the drama text by its first transliterated line; take as many lines as it has."""
    tl = [l.strip() for l in (translit or "").split("\n") if l.strip()]
    if not tl:
        return None, 0
    key = skel_en(tl[0])[:14]
    if len(key) < 6:
        return None, 0
    best, bi = 0.0, -1
    for i, sk in enumerate(skels):
        if sk[:1] != key[:1]:
            continue
        sc = difflib.SequenceMatcher(None, sk[:len(key)], key).ratio()
        if sc > best:
            best, bi = sc, i
    if best < 0.75:
        return None, best
    # line breaks differ between sources: take lines until the text is about as long as the transliteration
    target, got, out = len(skel_en(" ".join(tl))), 0, []
    for j in range(bi, len(lines)):
        if out and got >= target * 0.92:
            break
        out.append(lines[j])
        got += len(skels[j])
    return out, best


NUKTA_PAIRS = {"ড": "ড়", "ঢ": "ঢ়", "য": "য়"}  # ড ঢ য -> ড় ঢ় য়


def fix_missing_nukta(songs):
    """OCR sometimes drops the dot under ড়/ঢ়/য় (ঝডের for ঝড়ের). Correct a word only when the dotted
    spelling is clearly the usual one in the whole corpus (3+ times and 3x as common), so real words
    with ড/ঢ/য (ডাক, ঢেউ, যদি) are never touched. Returns the corrections made."""
    def words(t):
        return re.findall(r"[ঀ-৿]+", unicodedata.normalize("NFC", t or ""))
    count = collections.Counter(w for s in songs for w in words(s["lyrics_bn"]))
    fixes = {}
    for w, n in count.items():
        for i, ch in enumerate(w):
            if ch in NUKTA_PAIRS and (i + 1 >= len(w) or w[i + 1] != "়"):
                v = w[:i] + NUKTA_PAIRS[ch] + w[i + 1:]
                if count.get(v, 0) >= max(3, 3 * n):
                    fixes[w] = v
    if fixes:
        pat = re.compile(r"[ঀ-৿]+")
        for s in songs:
            for f in ("lyrics_bn", "title_bn"):
                if s[f]:
                    s[f] = pat.sub(lambda m: fixes.get(m.group(0), m.group(0)), unicodedata.normalize("NFC", s[f]))
    return fixes


def translit_key(x):
    """Skeleton of the first two transliterated lines; same key = same song."""
    lines = [l for l in (x.get("lyrics_translit") or "").split("\n") if l.strip()][:2]
    k = skel_en(" ".join(lines))[:30]
    return k if len(k) >= 12 else None


def stage_merge():
    gb = json.loads((DATA / "gb_raw.json").read_text(encoding="utf-8"))
    ws = json.loads((DATA / "ws_raw.json").read_text(encoding="utf-8"))
    # Wikisource pages that are whole sections (e.g. 'পরিশিষ্ট ৩'), not single songs
    ws = [w for w in ws if not re.fullmatch(r"পরিশিষ্ট\s*[০-৯]*", w["title_bn"]) and w["lyrics_bn"]]
    ws_by = {(w["section_bn"], w["num"]): w for w in ws}
    rejected, fuzzy = [], []

    # pass 1: (parjay, number) match, verified by title
    rows = []
    for g in gb:
        p_en, p_bn, drama, num = norm_parjay(
            f'{g["parjay_en"]} ({g["parjay_num"]})' if g["parjay_num"] else g["parjay_en"])
        w = ws_by.get((p_bn, num)) if p_bn and num else None
        if w and title_sim(w["title_bn"], g["title_en"]) < MATCH_MIN \
                and title_sim(w["title_bn"], g["title_en"], window=True) < FUZZY_MIN:
            rejected.append((g["title_en"], w["title_bn"]))
            w = None
        rows.append({"g": g, "p_en": p_en, "p_bn": p_bn, "drama": drama, "num": num, "w": w,
                     "orig": {"p_en": p_en, "p_bn": p_bn, "num": num}})

    # pass 1b: several pages claiming one Wikisource song -> only near-perfect title matches keep it
    claims = collections.defaultdict(list)
    for r in rows:
        if r["w"]:
            claims[id(r["w"])].append(r)
    for rs in claims.values():
        if len(rs) < 2:
            continue
        scored = sorted(((title_sim(r["w"]["title_bn"], r["g"]["title_en"]), r) for r in rs),
                        key=lambda t: t[0], reverse=True)
        for sc, r in scored[1:]:
            if sc < 0.9:
                rejected.append((r["g"]["title_en"], r["w"]["title_bn"]))
                r["w"] = None

    # pass 2: unmatched geetabitan songs (incl. dance-drama songs) vs unmatched Wikisource songs, by title
    taken = {id(r["w"]) for r in rows if r["w"]}
    free = [w for w in ws if id(w) not in taken]
    for r in rows:
        if r["w"]:
            continue
        cands = [(title_sim(w["title_bn"], r["g"]["title_en"], min_len=5), w) for w in free]
        sc, best = max(cands, key=lambda c: c[0], default=(0, None))
        if best and sc >= FUZZY_MIN:
            free.remove(best)
            fuzzy.append((r["g"]["title_en"], best["title_bn"]))
            r.update(w=best, p_bn=best["section_bn"], num=best["num"],
                     p_en=WS_PARJAY.get(best["section_bn"], r["p_en"]))

    # pass 2b: a rejected (parjay, number) match is right after all if nobody else claimed that song
    for r in rows:
        w = ws_by.get((r["p_bn"], r["num"])) if r["p_bn"] and r["num"] else None
        if not r["w"] and w in free:
            r["w"] = w
            free.remove(w)
    # pass 2d: verify every match against geetabitan's transliterated first line. Near-identical titles
    # (দিন যদি হল অবসান / দিন অবসান হল) can pair songs crosswise; swap, reassign or unmatch those.
    def line_sim(w, g):
        """Overlap of the opening ~30 consonants of the Bengali lyrics and the transliteration.
        Uses the first two lines (line breaks differ between sources) and matching blocks, so
        repeated phrases in one source don't count against it."""
        tl = " ".join((g["lyrics_translit"] or "").strip().split("\n")[:2])
        if not (tl.strip() and w and w["lyrics_bn"]):
            return None
        bn = " ".join(w["lyrics_bn"].split("\n")[:2])
        bn = bn.replace("্য", "").replace("্ব", "").replace("ঙ্গ", "ঙ")  # silent ya-/ba-phala; 'ng' is one sound
        tl = re.sub(r"w", "", tl, flags=re.I)  # 'w' in romanisation is mostly the য়/ওয় glide
        b, t = skel_bn(bn), skel_en(tl)
        n = min(len(b), len(t), 30)
        if n < 6:
            return None
        blocks = difflib.SequenceMatcher(None, b[:n], t[:n]).get_matching_blocks()
        return sum(m.size for m in blocks) / n

    def assign(r, w):
        r["w"] = w
        if w and not r["drama"]:
            r.update(p_bn=w["section_bn"], num=w["num"], p_en=WS_PARJAY.get(w["section_bn"], r["p_en"]))
        elif not w:
            r.update(r["orig"])  # back to what geetabitan says

    relinked = []
    for r in rows:
        sc = line_sim(r["w"], r["g"])
        if sc is None or sc >= 0.75 or slug(r["g"]["gb_url"]) in TRANSLIT_WRONG:
            continue
        cands = [(line_sim(w, r["g"]) or 0, w) for w in ws]
        bs, best = max(cands, key=lambda c: c[0])
        old = r["w"]
        if bs < 0.85:
            assign(r, None)
            free.append(old)
        else:
            owner = next((o for o in rows if o["w"] is best), None)
            if owner is None:
                if best in free:
                    free.remove(best)
                assign(r, best)
                free.append(old)
            elif (line_sim(best, owner["g"]) or 1) < 0.75:
                assign(owner, old)  # crosswise pair: swap
                assign(r, best)
            else:
                assign(r, None)
                free.append(old)
        relinked.append((slug(r["g"]["gb_url"]), old["title_bn"], r["w"]["title_bn"] if r["w"] else None))

    # pass 2e: unmatched geetabitan songs vs still-free Wikisource songs, accepted only when the
    # transliteration confirms it (stricter than the title matching in pass 2)
    for r in rows:
        if r["w"] or not r["g"]["lyrics_translit"]:
            continue
        cands = [(line_sim(w, r["g"]) or 0, w) for w in free]
        sc, best = max(cands, key=lambda c: c[0], default=(0, None))
        if best and sc >= 0.85:
            free.remove(best)
            assign(r, best)
            relinked.append((slug(r["g"]["gb_url"]), None, best["title_bn"]))

    # pass 2c: Wikisource songs printed twice in Gitabitan (two sections) whose twin is already matched
    twins = []
    for w in list(free):
        for r in rows:
            if r["w"] and title_sim(w["title_bn"], r["g"]["title_en"], min_len=8) >= 0.95 \
                    and skel_bn(w["title_bn"])[:12] == skel_bn(r["w"]["title_bn"])[:12]:
                twins.append((w["ws_title"], r["w"]["ws_title"]))
                free.remove(w)
                break

    # pass 3: duplicates within geetabitan (same Wikisource song, or same opening lines)
    parent = list(range(len(rows)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    seen = {}
    for i, r in enumerate(rows):
        for key in (("ws", r["w"]["ws_title"]) if r["w"] else None, ("tl", translit_key(r["g"]))):
            if key and key[1]:
                if key in seen:
                    other = rows[seen[key]]["w"]
                    if r["w"] and other and r["w"] is not other:
                        continue  # matched to different Wikisource songs: not duplicates
                    parent[find(i)] = find(seen[key])
                else:
                    seen[key] = i
    groups = collections.defaultdict(list)
    for i, r in enumerate(rows):
        groups[find(i)].append(r)

    def rank(r):
        g = r["g"]
        return (bool(r["w"]), not r["drama"], bool(g["raag"]) + bool(g["taal"]),
                not re.search(r"-\d$", slug(g["gb_url"])), -len(slug(g["gb_url"])))

    dlines = drama_lines()
    dskels = [skel_bn(l) for l in dlines]
    songs, dup_report, drama_hits = [], [], 0
    for grp in groups.values():
        grp.sort(key=rank, reverse=True)
        r = grp[0]
        g, w = r["g"], r["w"] or next((x["w"] for x in grp if x["w"]), None)
        if not w and any(x["drama"] for x in grp):  # Bengali text from the drama itself
            found, _ = match_drama(g["lyrics_translit"], dlines, dskels)
            if found and (line_sim({"lyrics_bn": "\n".join(found)}, g) or 1) < 0.5:
                found = None  # first word matched but the lines don't: a different song in the drama
            if found:
                drama_hits += 1
                w = {"title_bn": found[0].rstrip(",।;—-–! "), "lyrics_bn": "\n".join(found)}

        def pick(field):
            return next((x["g"][field] for x in grp if x["g"][field]), None)
        p_en, p_bn = r["p_en"], r["p_bn"]
        sub = g["sub_parjay_en"] if not r["drama"] else None
        dramas = sorted({x["drama"] for x in grp if x["drama"]})
        if len(grp) > 1:
            dup_report.append([slug(x["g"]["gb_url"]) for x in grp])
        songs.append({
            "id": slug(g["gb_url"]),
            "aliases": [slug(x["g"]["gb_url"]) for x in grp[1:]],
            "title_bn": w["title_bn"] if w else "",
            "title_en": g["title_en"],
            "parjay": p_en or "Unclassified", "parjay_bn": p_bn, "parjay_num": r["num"],
            "sub_parjay": sub,
            "season": SEASONS.get((sub or "").lower()) if p_en == "Prakriti" else None,
            "drama": ", ".join(dramas) or None,
            "raag": simplify_raag(pick("raag")), "raag_full": pick("raag"), "taal": pick("taal"),
            "written": pick("written"), "collection": pick("collection"),
            "lyrics_bn": w["lyrics_bn"] if w else "",
            "lyrics_translit": g["lyrics_translit"] or pick("lyrics_translit") or "",
            "source": g["gb_url"],
        })
    # Wikisource songs geetabitan doesn't have, minus repeats of songs already listed
    # (Gitabitan prints a few songs twice; punctuation differs, so compare title skeletons)
    seen_titles = {skel_bn(s["title_bn"])[:12] for s in songs if s["title_bn"]}
    kept_free = []
    for w in free:
        k = skel_bn(w["title_bn"])[:12]
        if k in seen_titles:
            twins.append((w["ws_title"], "repeat of a listed song"))
            continue
        seen_titles.add(k)
        kept_free.append(w)
    free = kept_free
    for w in free:
        songs.append({
            "id": f'ws-{WS_PARJAY.get(w["section_bn"], "x").lower().replace(" ", "-")}-{w["num"]}',
            "aliases": [], "title_bn": w["title_bn"], "title_en": "",
            "parjay": WS_PARJAY.get(w["section_bn"], w["section_bn"]), "parjay_bn": w["section_bn"],
            "parjay_num": w["num"], "sub_parjay": None, "season": None, "drama": None,
            "raag": None, "raag_full": None, "taal": None, "written": None, "collection": None,
            "lyrics_bn": w["lyrics_bn"], "lyrics_translit": "",
            "source": "https://bn.wikisource.org/wiki/" + w["ws_title"].replace(" ", "_"),
        })
    spelling = fix_missing_nukta(songs)
    ids = collections.Counter(s["id"] for s in songs)
    assert not [i for i, c in ids.items() if c > 1], "duplicate ids"
    (DATA / "songs_base.json").write_text(json.dumps(songs, ensure_ascii=False, indent=1), encoding="utf-8")
    (DATA / "merge_report.json").write_text(json.dumps(
        {"rejected_number_matches": rejected, "title_matches": fuzzy, "duplicates_merged": dup_report,
         "lyrics_relinked": relinked, "spelling_fixes": spelling, "wikisource_twins_dropped": twins,
         "wikisource_only": [w["ws_title"] for w in free]}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"merged: {len(songs)} songs | {len(gb)} geetabitan pages, {len(dup_report)} duplicate groups merged, "
          f"{len(fuzzy)} title matches, {len(rejected)} number matches rejected, "
          f"{len(free)} Wikisource-only, {drama_hits} drama songs given Bengali text", flush=True)


if __name__ == "__main__":
    stages = sys.argv[1:] or ["gb", "ws", "merge"]
    for s in stages:
        {"gb": stage_gb, "ws": stage_ws, "merge": stage_merge}[s]()
