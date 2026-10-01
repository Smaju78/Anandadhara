@echo off
rem Daily YouTube run (scheduled task):
rem   1. monthly stats refresh when due, resumable matching, rebuild docs/songs.json (in WSL)
rem   2. commit and push docs/songs.json so the GitHub Pages site shows the new recordings
rem Output is appended to cache\youtube_daily.log
cd /d "%~dp0.."
echo ==== %DATE% %TIME% ==== >> cache\youtube_daily.log
wsl -e bash -lc "cd '/mnt/c/Git Projects/rabindrasangeet' && python3 scripts/refresh_stats.py --if-older 28 && python3 scripts/youtube_match.py && python3 scripts/build_data.py" >> cache\youtube_daily.log 2>&1
if errorlevel 1 (
  echo Data step failed; nothing published. >> cache\youtube_daily.log
  exit /b 1
)
git add docs/songs.json >> cache\youtube_daily.log 2>&1
git diff --cached --quiet
if errorlevel 1 git commit -q -m "Daily recordings update" >> cache\youtube_daily.log 2>&1
rem push also retries any commit left unpushed by an earlier failed run
git push -q origin main >> cache\youtube_daily.log 2>&1
if errorlevel 1 (echo Push failed: check the GitHub sign-in for Smaju78. >> cache\youtube_daily.log) else (echo Published. >> cache\youtube_daily.log)
