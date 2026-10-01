# আনন্দধারা Anandadhara — Rabindrasangeet site

Static site of all ~2,160 Tagore songs: parjay, season, raag, taal, lyrics, moods, top YouTube
recordings, and a mood jukebox. Plain HTML/CSS/JS in `docs/` (served by GitHub Pages), data in `docs/songs.json`.

## Run locally
```
cd docs && python3 -m http.server 8000      # then open http://localhost:8000
```

## Data pipeline (Python 3, WSL)
| Step | Command | Output |
|---|---|---|
| Song list (geetabitan.com + bn.wikisource, cached in `cache/`) | `python3 scripts/scrape_songs.py` | `data/songs_base.json`, `data/merge_report.json` |
| YouTube top 3 (resumable, quota-aware) | `python3 scripts/youtube_match.py` | `cache/youtube/<id>.json` |
| Re-apply video filters, no API calls | `python3 scripts/youtube_match.py --refilter` | |
| Build site data | `python3 scripts/build_data.py` | `docs/songs.json` |
| Refresh stored video stats (monthly, ~1 unit / 50 videos) | `python3 scripts/refresh_stats.py` | updates `cache/youtube/` |

Moods live in `data/moods.json` (approved list + per-song tags).
The YouTube key is read from `.env` (`YOUTUBE_API_KEY=...`); `.env` and `cache/` are git-ignored.
A Windows scheduled task ("Rabindrasangeet YouTube daily", 14:00) runs `scripts/run_youtube_daily.cmd`
and logs to `cache/youtube_daily.log`.

## Publish on GitHub Pages
1. Repository: https://github.com/Smaju78/Anandadhara (public).
2. Push this folder:
   ```
   git remote add origin https://github.com/Smaju78/Anandadhara.git
   git push -u origin main
   ```
3. On GitHub: Settings -> Pages -> Build and deployment -> Source "Deploy from a branch",
   Branch `main`, folder `/docs` -> Save. The site appears at
   https://smaju78.github.io/Anandadhara/ within a few minutes.
4. After each daily YouTube run, publish the new recordings by committing and pushing `docs/songs.json`.

`data/gb_raw.json` and `data/songs_base.json` hold geetabitan.com transliterations and stay local
(git-ignored); the public site carries only Bengali lyrics from Wikisource and links to geetabitan.
