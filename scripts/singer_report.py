"""List likely singer names in the stored video titles that data/singers.json doesn't recognise yet.

Video titles usually name the singer in a separate segment ("Song | Singer | Label", "Song - Singer",
"Song by Singer"). This collects those segments from videos with no recognised singer, removes
parts that are the song title or generic words, and counts them. Add the real names you see
to data/singers.json, then run scripts/build_data.py.

Usage: python3 scripts/singer_report.py [--top 40]
"""
import argparse
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
YT = ROOT / "cache" / "youtube"
SINGERS = json.loads((ROOT / "data" / "singers.json").read_text(encoding="utf-8"))["singers"]
GENERIC = re.compile(
    r"rabindra|tagore|sangeet|sangit|song|lyric|official|video|audio|music|full|hd|4k|live|cover|bengali|bangla|"
    r"রবীন্দ্র|সঙ্গীত|সংগীত|গান|কণ্ঠ|শিল্পী|records?|entertainment|channel|studio|\d{3,}|#", re.I)


def known(text):
    t = text.lower()
    return any(k.lower() in t for keys in SINGERS.values() for k in keys)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=40)
    a = ap.parse_args()
    songs = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in YT.glob("*.json") if not p.name.startswith("_")}
    counts, examples, unmatched, total = collections.Counter(), {}, 0, 0
    for sid, r in songs.items():
        for v in r.get("videos", []):
            total += 1
            if known(v["title"] + " " + v.get("channel", "")):
                continue
            unmatched += 1
            topic = re.fullmatch(r"(.+?) - Topic", v.get("channel", ""))
            if topic:  # auto-generated artist channel: already used as the singer by build_data.py
                counts[f"{topic.group(1)} (Topic channel)"] += 1
                examples.setdefault(f"{topic.group(1)} (Topic channel)", v["title"][:80])
            parts = re.split(r"\s*[|।｜/]\s*|\s+[-–—]\s+|\s+by\s+|\(|\)|\[|\]", v["title"], flags=re.I)
            seen = set()
            for part in parts:
                part = re.sub(r"^(singer|voice|কণ্ঠে?|শিল্পী)\s*[:\-]?\s*", "", part.strip(" :-–"), flags=re.I)
                words = part.split()
                if not (1 <= len(words) <= 4) or GENERIC.search(part) or len(part) < 4:
                    continue
                key = part.title() if part.isascii() else part
                if key in seen:
                    continue
                seen.add(key)
                counts[key] += 1
                examples.setdefault(key, v["title"][:80])
    print(f"{total} stored videos, {unmatched} without a recognised singer.\n")
    print("Most frequent title segments in those videos (song titles also appear; pick the real names):")
    for name, n in counts.most_common(a.top):
        if n < 2:
            break
        print(f"  {n:3d}  {name:32s}  e.g. {examples[name]}")


if __name__ == "__main__":
    main()
