"""Combine songs, YouTube results and moods into docs/songs.json (the one data file the site loads).

Usage: python3 scripts/build_data.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA, YT, SITE = ROOT / "data", ROOT / "cache" / "youtube", ROOT / "docs"

# Singer name -> spellings seen in video titles/channels (case-insensitive substrings); edit data/singers.json
SINGERS = json.loads((DATA / "singers.json").read_text(encoding="utf-8"))["singers"]


def singers_of(video):
    hay = (video["title"] + " " + video.get("channel", "")).lower()
    found = [name for name, keys in SINGERS.items() if any(k.lower() in hay for k in keys)]
    # YouTube's auto-generated "<Artist> - Topic" channels always name the performer
    topic = re.fullmatch(r"(.+?) - Topic", video.get("channel", ""))
    if not found and topic and not re.search(r"various|artists|tagore|rabindra", topic.group(1), re.I):
        found = [topic.group(1)]
    return found


def main():
    songs = json.loads((DATA / "songs_base.json").read_text(encoding="utf-8"))
    moods = json.loads((DATA / "moods.json").read_text(encoding="utf-8"))
    popular = json.loads((DATA / "popular.json").read_text(encoding="utf-8"))
    pop_rank = {p["id"]: i + 1 for i, p in enumerate(popular)}
    aliases = {p["id"]: p["alias"] for p in popular if p.get("alias")}
    out, n_vid, n_mood = [], 0, 0
    for s in songs:
        yt = YT / f'{s["id"]}.json'
        vids = json.loads(yt.read_text(encoding="utf-8"))["videos"] if yt.exists() else None
        rec = {
            "id": s["id"], "bn": s["title_bn"], "en": s["title_en"],
            "parjay": s["parjay"], "sub": s["sub_parjay"], "season": s["season"], "drama": s["drama"],
            "raag": s["raag"], "raagFull": s["raag_full"], "taal": s["taal"],
            # Bengali lyrics only: geetabitan.com's transliterations are their own work, so the public
            # site links to them instead of copying them.
            "written": s["written"], "lyrics": s["lyrics_bn"],
            "source": s["source"],
            "moods": moods["songs"].get(s["id"], []),
            "pop": pop_rank.get(s["id"]),  # rank among well-known songs (1 = best known)
            "alias": aliases.get(s["id"]),
            # None = not searched yet; [] = searched, nothing relevant found
            "videos": None if vids is None else [
                {"id": v["id"], "t": v["title"], "ch": v["channel"], "views": v["views"],
                 "likes": v["likes"], "sec": v["seconds"], "singers": singers_of(v)} for v in vids],
        }
        n_vid += bool(rec["videos"])
        n_mood += bool(rec["moods"])
        out.append({k: v for k, v in rec.items() if v not in (None, "", [])} | {"id": s["id"]})
    SITE.mkdir(exist_ok=True)
    meta = {"moods": moods["moods"], "count": len(out)}
    (SITE / "songs.json").write_text(json.dumps({"meta": meta, "songs": out}, ensure_ascii=False,
                                                separators=(",", ":")), encoding="utf-8")
    size = (SITE / "songs.json").stat().st_size / 1e6
    print(f"docs/songs.json: {len(out)} songs, {n_vid} with videos, {n_mood} with moods, {size:.1f} MB")


if __name__ == "__main__":
    main()
