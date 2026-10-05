# Design references — আনন্দধারা Anandadhara

`mockups/` holds three redesign concepts made with Claude Fable in October 2026 (phase 1: design concepts only;
the live site in `docs/` is untouched). They are click-through prototypes over the real `docs/songs.json` and
`docs/feelings.json`, bilingual (বাংলা default, English via the switch), with phone (375 px) and desktop layouts,
light and dark modes, visible focus rings and `prefers-reduced-motion` support.

To view them, serve the **repository root** and open `/design/mockups/`:

```
node design/serve.js            # or: python3 -m http.server 8010   (in the repo root, not in docs/)
# then http://localhost:8010/design/mockups/
```

`mockups/shots/` has headless-Chrome screenshots of each concept (`a|b|c-home|song|jukebox|browse-phone|desktop.png`,
plus `*-home-dark-desktop.png` and `*-home-en-phone.png`).

## The three concepts

Each concept is rooted in Tagore and Santiniketan rather than in a music-app template, and each puts the same
things on screen: Listen (the "How are you feeling?" box, the season of the Bengali calendar, moods, well-known songs),
a song page (Bengali lyrics, facts, recordings with "Open in YouTube", Ask AI, More like this), the jukebox (player,
controls, filters with type-to-find for raag and singer, the playlist with singers), Browse (including a Singer index),
Mine (liked songs, recently played, hidden songs, sign-in), the বাংলা/English switch, a persistent player bar with a
progress line on every page, the "Welcome back — continue?" prompt, and the account menu with Google sign-in and
"Watch without ads (YouTube Premium)".

- **A · পাণ্ডুলিপি Pandulipi — the Gitabitan manuscript.** Aged paper, blue-black fountain-pen ink, a red margin rule.
  Tiro Bangla for titles and lyrics, Galada brush script only for the brand and the feelings heading, Alegreya for English.
  Every page carries the Bengali date the way Tagore dated his poems; moods are an index with dotted leaders; browse tabs are
  notebook index tabs; the song page is a ruled leaf with facts and recordings as marginalia; Tagore's strike-through doodles
  are the only ornament. Text navigation at the top on every width, a bookmark-ribbon player bar. Dark mode is "night ink".
  The quietest, most literary concept; lyrics come first.
- **B · ঋতুরঙ্গ Riturango — the six seasons colour the site.** Light and soft (Noto Serif Bengali + Hind Siliguri, Fraunces for
  English). The current ritu sets the accent colour, the page tint and a drawn sky scene in the home hero (rain and kadam for
  Barsha, kash and shiuli for Sharat, mustard fields for Sheet, palash for Basanta…); a season row previews any ritu and a song
  page takes its own season. Moods are colour fields; well-known songs and "more like this" are thumbnail rows; jukebox filters
  live in a bottom sheet. Bottom tabs and a floating player pill on the phone. Dark mode is the same seasons at night.
  The most app-like and the most alive over the year; the least tied to Tagore himself.
- **C · রাঙামাটি Rangamati — Santiniketan's red earth and alpona.** Laterite terracotta, rice-paste white, khoai ochre, sal green,
  kantha indigo; Noto Serif Bengali 800 for display. Every mood, season, song and the brand gets a generated alpona medallion
  (rotational symmetry seeded from its name), a running alpona vine borders the terracotta band, kantha running-stitch rules
  divide sections, songs are numbered like a songbook, and the home panel knows Santiniketan's days (পৌষমেলা, ২৫শে বৈশাখ,
  ২২শে শ্রাবণ, নববর্ষ). Terracotta sidebar on desktop, terracotta band plus bottom tabs on the phone. Dark mode is night under the chhatim.
  The most distinctive identity and the one that reads as "this place" at a glance.

## Recommendation

**C · রাঙামাটি**, with two things borrowed: A's ruled manuscript sheet (Tiro Bangla, 32 px baseline rules, the red margin)
for the lyrics on the song page and in the jukebox, and B's season scene/date treatment inside C's terracotta home panel so the
page still changes with the Bengali year.

Why: C is the only concept whose identity cannot be mistaken for another site — the alpona medallions give the twelve moods
(and, later, parjays and seasons) a visual vocabulary the site currently lacks, the terracotta/cream pairing keeps long
reading comfortable because the content area stays cream, and it is the only one of the three that also works as an app icon,
a social card and a favicon. A is beautiful but reads as an archive rather than a place to listen; B's season engine is a
strong idea but on its own it is a palette, not an identity (only 268 songs carry a season). A is the alternative if the owner
wants a quieter, reading-first site.

## Notes for the final build

- All three share `mockups/common.js` (data, bilingual strings, Bengali calendar, spelling-tolerant search, feelings word
  matching, playlist building, player state, router); only markup and CSS differ, so the chosen look can take another concept's
  layout ideas cheaply.
- Pressing play loads a real YouTube embed in the jukebox; pause, skip and the progress line are simulated in the mockups
  (the real site keeps the IFrame API, which gives a real progress line and resume point). Google sign-in and "YouTube Premium"
  are stubs: Premium would simply use the `youtube.com` embed host (signed-in player) instead of `youtube-nocookie.com`.
- The feelings box here matches words only; the in-browser language model stays as on the live site.
- Bengali digits follow the UI language; the Bengali date uses the same fixed Gregorian cut-offs as the live site's seasons and
  should be labelled approximate or replaced by a proper Bangabda calculation.
- Elements that must survive in the real site: the YouTube embed visible in the jukebox (never under the player bar), keyboard
  focus rings, reduced-motion, no horizontal scroll at 375 px, and the `#jukebox` section staying in the DOM across routes so
  playback continues.
