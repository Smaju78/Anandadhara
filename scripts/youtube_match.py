"""Find the top 3 YouTube videos per song. Resumable and quota-aware.

Per song: search.list (100 units) + videos.list (1 unit); if nothing passes the filters,
one fallback search with the English title (another 101 units).
Every candidate is cached in cache/youtube/<song_id>.json, so filters can be retuned
later with --refilter (no API calls). Songs already cached are skipped.
Quota usage is tracked per Pacific-time day in cache/youtube/_quota.json; the script
stops before exceeding --budget (default 9800) or on a quotaExceeded error.

Usage: python3 scripts/youtube_match.py [--limit N] [--budget 9800] [--ids a,b,c] [--refilter]
"""
import argparse
import difflib
import json
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from scrape_songs import skel_bn, skel_en  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "cache" / "youtube"
QUOTA_FILE = OUT / "_quota.json"
API = "https://www.googleapis.com/youtube/v3"
SEARCH_COST = 101
MAX_SECONDS = 12 * 60
MIN_SECONDS = 60
REL_MIN = 0.8
BAD = re.compile(
    r"jukebox|juke box|non[- ]?stop|compilation|collection|medley|mashup|full album|"
    r"top \d+|best of|\d+\s*songs|songs of|playlist|\bhours?\b|ঘণ্টা|জুকবক্স|সংকলন|\bvol\b|"
    r"nazrul|নজরুল|kobita|kabita|কবিতা|আবৃত্তি|recitation|abritti|#shorts|\bshorts\b|"
    r"dance|nritya|nritto|নৃত্য|নাচ|karaoke|instrumental|tutorial|lesson|শিক্ষা|harmonium|notation|স্বরলিপি",
    re.I,
)


def api_key():
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        k, _, v = line.partition("=")
        if k.strip() == "YOUTUBE_API_KEY":
            return v.strip().strip('"').strip("'")
    sys.exit("YOUTUBE_API_KEY not found in .env")


class QuotaExceeded(Exception):
    pass


def call(endpoint, params):
    """GET without ever printing the URL (it contains the key)."""
    try:
        r = requests.get(f"{API}/{endpoint}", params=params, timeout=30)
    except requests.RequestException as e:
        raise RuntimeError(f"{endpoint}: network error {type(e).__name__}") from None
    if r.status_code == 200:
        return r.json()
    try:
        err = r.json()["error"]
        reason = err["errors"][0].get("reason", "")
        msg = err.get("message", "")
    except Exception:
        reason, msg = "", r.text[:200]
    if reason in ("quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"):
        raise QuotaExceeded(reason)
    raise RuntimeError(f"{endpoint}: HTTP {r.status_code} {reason} {msg}")


def pt_today():
    return datetime.now(ZoneInfo("America/Los_Angeles")).strftime("%Y-%m-%d")


def load_quota():
    q = json.loads(QUOTA_FILE.read_text()) if QUOTA_FILE.exists() else {}
    return q if q.get("date") == pt_today() else {"date": pt_today(), "used": 0}


def save_quota(q):
    QUOTA_FILE.write_text(json.dumps(q))


SEASONS = [(414, "Grishma"), (615, "Barsha"), (817, "Sharat"), (1018, "Hemanta"), (1216, "Sheet"), (213, "Basanta")]


def current_and_next_season(today=None):
    """Bengali seasons, two months each from mid-April (same boundaries as the site)."""
    d = today or datetime.now(ZoneInfo("Asia/Kolkata"))
    md = d.month * 100 + d.day
    starts = sorted(SEASONS)  # by month-day: Basanta(213), Grishma(414), ...
    cur = next((n for m, n in reversed(starts) if md >= m), starts[-1][1])  # before 213 -> Sheet
    order = [n for _, n in SEASONS]
    return cur, order[(order.index(cur) + 1) % len(order)]


def iso_seconds(d):
    m = re.fullmatch(r"P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", d or "")
    if not m:
        return 0
    dd, h, mi, s = (int(x or 0) for x in m.groups())
    return dd * 86400 + h * 3600 + mi * 60 + s


def fix_bn(t):
    """Repair OCR-broken vowel signs (া+ে -> ো, া+ৈ ...) and normalize."""
    t = unicodedata.normalize("NFC", t or "")
    return t.replace("াে", "ো").replace("ো", "ো")


def short_title(t, words=5):
    t = re.sub(r"[,;:!?।॥—–\-‘’'\"()]+", " ", fix_bn(t))
    return " ".join(t.split()[:words])


def song_skels(song):
    """(skeleton, number of words) pairs to look for in video titles: the Bengali title, its first
    four words (videos are often titled with just the opening words) and the English title."""
    out = []
    if song.get("title_bn"):
        words = re.sub(r"[,;:!?।॥—–\-‘’'\"()]+", " ", fix_bn(song["title_bn"])).split()
        out.append((skel_bn(" ".join(words)), len(words)))
        if len(words) > 4:
            out.append((skel_bn(" ".join(words[:4])), 4))
    if song.get("title_en"):
        en = re.sub(r"\s+\d+$", "", song["title_en"])
        out.append((skel_en(en), len(en.split())))
    return [(s[:10], w) for s, w in out if len(s) >= 4]


TAGORE = re.compile(r"rabindra|tagore|রবীন্দ্র|রবি ঠাকুর", re.I)


def relevance(song, video):
    """Best approximate-substring match of the song's title skeletons inside the video title
    (Bengali and romanised parts are both skeletonised). Short titles of one to three words
    ("ভালোবাসি, ভালোবাসি") are ambiguous, so they need an exact match plus a Tagore marker in the
    video title or channel; a longer line is distinctive enough on its own."""
    t = fix_bn(video["title"])
    hay = [skel_bn(t), skel_en(re.sub(r"[ঀ-৿]", " ", t))]
    marked = bool(TAGORE.search(video["title"] + " " + video.get("channel", "")))
    best = 0.0
    for needle, words in song_skels(song):
        n, sc = len(needle), 0.0
        for h in hay:
            for i in range(max(1, len(h) - n + 1)):
                sc = max(sc, difflib.SequenceMatcher(None, needle, h[i:i + n]).ratio())
        if n < 10 and words < 4 and (sc < 1.0 or not marked):
            sc = 0.0
        elif n < 10 and sc < 1.0:
            sc = 0.0  # short skeleton of a longer line: still require it exactly
        best = max(best, sc)
    return round(best, 2)


def keep_videos(song, cands):
    keep = [x for x in cands
            if x["embeddable"] and MIN_SECONDS <= x["seconds"] <= MAX_SECONDS
            and not BAD.search(x["title"]) and relevance(song, x) >= REL_MIN]
    keep.sort(key=lambda x: x["views"], reverse=True)
    return keep[:3]


def search(q, key):
    s = call("search", {"part": "snippet", "q": q, "type": "video", "order": "relevance",
                        "maxResults": 15, "videoEmbeddable": "true", "key": key})
    ids = [it["id"]["videoId"] for it in s.get("items", [])]
    if not ids:
        return []
    v = call("videos", {"part": "snippet,contentDetails,statistics,status", "id": ",".join(ids), "key": key})
    out = []
    for it in v.get("items", []):
        sn, st, cd = it["snippet"], it.get("statistics", {}), it["contentDetails"]
        out.append({
            "id": it["id"], "title": sn["title"], "channel": sn["channelTitle"],
            "views": int(st.get("viewCount", 0)), "likes": int(st.get("likeCount", 0)),
            "seconds": iso_seconds(cd.get("duration")),
            "embeddable": it.get("status", {}).get("embeddable", False),
        })
    return out


def match_song(song, key, quota):
    queries = []
    if song.get("title_bn"):
        queries.append(f'{short_title(song["title_bn"])} রবীন্দ্রসঙ্গীত')
    if song.get("title_en"):
        title_en = re.sub(r"\s+\d+$", "", song["title_en"])  # drop geetabitan's '... 2' suffix
        queries.append(f"{title_en} Rabindra Sangeet")
    cands, used = [], []
    for q in queries:
        if used and keep_videos(song, cands):
            break  # fallback only when the first search found nothing usable
        seen = {c["id"] for c in cands}
        cands += [c for c in search(q, key) if c["id"] not in seen]
        quota["used"] += SEARCH_COST
        used.append(q)
    return {"queries": used, "fetched": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "candidates": cands, "videos": keep_videos(song, cands)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max songs this run (0 = no limit)")
    ap.add_argument("--budget", type=int, default=9800, help="max units to use per PT day")
    ap.add_argument("--ids", default="", help="comma-separated song ids")
    ap.add_argument("--refilter", action="store_true", help="re-apply filters to cached candidates; no API calls")
    a = ap.parse_args()

    songs = json.loads((ROOT / "data" / "songs_base.json").read_text(encoding="utf-8"))
    if a.ids:
        want = set(a.ids.split(","))
        songs = [s for s in songs if s["id"] in want]
    OUT.mkdir(parents=True, exist_ok=True)

    if a.refilter:
        n = 0
        for s in songs:
            p = OUT / f'{s["id"]}.json'
            if p.exists():
                r = json.loads(p.read_text(encoding="utf-8"))
                if "candidates" in r and isinstance(r["candidates"], list):
                    r["videos"] = keep_videos(s, r["candidates"])
                    p.write_text(json.dumps(r, ensure_ascii=False, indent=1), encoding="utf-8")
                    n += 1
        print(f"refiltered {n} cached songs")
        return

    todo = [s for s in songs if not (OUT / f'{s["id"]}.json').exists()]
    # Order: well-known songs (data/popular.json order), then songs of the current and the
    # coming season (so the site's season tile fills first), then the rest.
    pop_file = ROOT / "data" / "popular.json"
    rank = {p["id"]: i for i, p in enumerate(json.loads(pop_file.read_text(encoding="utf-8")))} if pop_file.exists() else {}
    now, soon = current_and_next_season()
    todo.sort(key=lambda s: (0, s.get("season") != now, rank[s["id"]]) if s["id"] in rank
              else (1, 0, 0) if s.get("season") == now else (2, 0, 0) if s.get("season") == soon else (3, 0, 0))
    print(f"{len(songs) - len(todo)} cached, {len(todo)} to do", flush=True)
    key, quota, done, fails = api_key(), load_quota(), 0, 0
    for s in todo:
        if a.limit and done >= a.limit:
            break
        if quota["used"] + 2 * SEARCH_COST > a.budget:  # room for a possible fallback search
            print(f"Stopping: daily budget reached ({quota['used']} units used today PT).")
            break
        try:
            res = match_song(s, key, quota)
        except QuotaExceeded as e:
            print(f"Stopping: YouTube says {e}.")
            quota["used"] = a.budget
            save_quota(quota)
            break
        except RuntimeError as e:
            fails += 1
            print(f"  error on {s['id']}: {e}")
            if fails >= 3:
                print("Stopping after 3 errors.")
                break
            continue
        finally:
            save_quota(quota)
        (OUT / f'{s["id"]}.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
        done += 1
        if done % 10 == 0:
            print(f"  {done} songs, {quota['used']} units today", flush=True)
    left = len(todo) - done
    print(f"Done this run: {done}. Remaining: {left}. Units used today (PT): {quota['used']}.")


if __name__ == "__main__":
    main()
