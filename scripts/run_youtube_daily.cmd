@echo off
rem Daily YouTube run (scheduled task): monthly stats refresh when due, then resumable matching,
rem then rebuild docs/songs.json. Output is appended to cache\youtube_daily.log
cd /d "%~dp0.."
echo ==== %DATE% %TIME% ==== >> cache\youtube_daily.log
wsl -e bash -lc "cd '/mnt/c/Git Projects/rabindrasangeet' && python3 scripts/refresh_stats.py --if-older 28 && python3 scripts/youtube_match.py && python3 scripts/build_data.py" >> cache\youtube_daily.log 2>&1
