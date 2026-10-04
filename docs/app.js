/* Gitabitan site: hash-routed static app over songs.json. No build step. */
"use strict";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enc = encodeURIComponent;
const view = $("#view");

let SONGS = [], BY_ID = new Map(), META = {};

/* ---------------- preferences (localStorage, this browser only) ---------------- */
const PREF_KEY = "gitabitan.prefs.v1";
const EMPTY_FILTERS = { moods: [], parjays: [], seasons: [], raag: "", singer: "", likedOnly: false };
const prefs = loadPrefs();
function loadPrefs() {
  const empty = { likes: [], never: [], recent: [], recOnly: false, filters: { ...EMPTY_FILTERS } };
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    return p ? { ...empty, ...p, filters: { ...EMPTY_FILTERS, ...(p.filters || {}) } } : empty;
  } catch { return empty; }
}
function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ } }
const isLiked = (id) => prefs.likes.includes(id);
const isNever = (id) => prefs.never.includes(id);
function toggle(list, id, on) {
  prefs[list] = prefs[list].filter((x) => x !== id);
  if (on) {
    prefs[list].push(id);
    const other = list === "likes" ? "never" : "likes"; // liked and never-play are exclusive
    prefs[other] = prefs[other].filter((x) => x !== id);
  }
  savePrefs();
}

/* ---------------- helpers ---------------- */
const title = (s) => s.bn || s.en || s.id;
const hasRec = (s) => !!(s.videos && s.videos.length);
const fmtViews = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n);
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
const norm = (t) => (t || "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

const KINDS = {
  popular: { label: "Well-known" },
  parjay: { label: "Parjay", get: (s) => s.parjay ? [s.parjay] : [] },
  season: { label: "Season", get: (s) => s.season ? [s.season] : [] },
  mood: { label: "Mood", get: (s) => s.moods || [] },
  raag: { label: "Raag", get: (s) => s.raag ? [s.raag] : [] },
  taal: { label: "Taal", get: (s) => s.taal ? [s.taal] : [] },
  drama: { label: "Dance drama", get: (s) => s.drama ? s.drama.split(", ") : [] },
  az: { label: "A–Z" },
};
const SEASON_ORDER = ["Grishma", "Barsha", "Sharat", "Hemanta", "Sheet", "Basanta"];
const SEASON_BN = { Grishma: "গ্রীষ্ম", Barsha: "বর্ষা", Sharat: "শরৎ", Hemanta: "হেমন্ত", Sheet: "শীত", Basanta: "বসন্ত" };

// Bengali seasons (two months each, Baishakh starting mid-April).
function currentSeason(d = new Date()) {
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  if (md >= 414 && md < 615) return "Grishma";
  if (md >= 615 && md < 817) return "Barsha";
  if (md >= 817 && md < 1018) return "Sharat";
  if (md >= 1018 && md < 1216) return "Hemanta";
  if (md >= 1216 || md < 213) return "Sheet";
  return "Basanta";
}

function groupsOf(kind) {
  const m = new Map();
  for (const s of SONGS) for (const v of KINDS[kind].get(s)) {
    const g = m.get(v) || { n: 0, rec: 0 };
    g.n++; g.rec += hasRec(s); m.set(v, g);
  }
  const arr = [...m.entries()];
  if (kind === "season") arr.sort((a, b) => SEASON_ORDER.indexOf(a[0]) - SEASON_ORDER.indexOf(b[0]));
  else arr.sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  return arr;
}

/* ---------------- song lists ---------------- */
function songRow(s) {
  const meta = [s.parjay, s.raag].filter(Boolean).join(" · ");
  return `<li class="${hasRec(s) ? "" : "no-rec"}"><a href="#/song/${enc(s.id)}">
    <span class="t-bn">${esc(title(s))}</span>
    <span class="meta">${hasRec(s) ? `<span class="rec">▶ ${s.videos.length} recording${s.videos.length > 1 ? "s" : ""}</span>` : ""}<span>${esc(meta)}</span></span>
    ${s.bn && s.en ? `<span class="t-en">${esc(s.alias ? `${s.alias} · ${s.en}` : s.en)}</span>` : ""}
  </a></li>`;
}

// Songs with recordings first (keeping the given order inside each part), optional "only with recordings".
function songList(list, { limit = 120, toggle = true, recFirst = true } = {}) {
  const wrap = document.createElement("div");
  let shown = limit;
  const draw = () => {
    const rec = list.filter(hasRec), rest = list.filter((s) => !hasRec(s));
    const all = prefs.recOnly ? rec : recFirst ? rec.concat(rest) : list;
    const vis = all.slice(0, shown);
    const firstRest = recFirst ? vis.findIndex((s) => !hasRec(s)) : -1;
    const rows = vis.map((s, i) => (i === firstRest && i > 0 ? `<li class="divider">Recordings coming soon</li>` : "") + songRow(s)).join("");
    wrap.innerHTML = (toggle ? `<p><label class="toggle"><input type="checkbox" class="rec-only"${prefs.recOnly ? " checked" : ""}> Only songs with recordings (${rec.length} of ${list.length})</label></p>` : "") + `
      <ul class="songs">${rows || `<li class="divider">No songs with recordings here yet. They are added every day.</li>`}</ul>` +
      (all.length > shown ? `<p class="more"><button class="btn small" type="button">${all.length - shown > 300 ? `Show 300 more of ${all.length - shown}` : `Show ${all.length - shown} more`}</button></p>` : "");
    if (toggle) $(".rec-only", wrap).onchange = (e) => { prefs.recOnly = e.target.checked; savePrefs(); draw(); };
    const b = $(".more button", wrap);
    if (b) b.onclick = () => { shown += 300; draw(); };
  };
  draw();
  return wrap;
}

/* ---------------- spelling-tolerant search ----------------
   Romanised Bengali is spelled many ways (Paroshmoni / Poroshmoni / Parashmoni), so titles are
   also compared as consonant "skeletons": vowels dropped, similar sounds merged. Bengali and Latin
   text map to the same skeleton alphabet, so "aguner poroshmoni" finds আগুনের পরশমণি. */
const BN_SKEL = {};
[["কখ", "k"], ["গঘ", "g"], ["ঙঞণনং", "n"], ["চছ", "c"], ["জঝয", "j"], ["টঠতথৎ", "t"], ["ডঢদধ", "d"],
 ["রৃঋ", "r"], ["পফ", "p"], ["বভ", "b"], ["ম", "m"], ["ল", "l"], ["শষস", "s"]]
  .forEach(([chars, v]) => [...chars].forEach((c) => { BN_SKEL[c] = v; }));
const LAT_DIGRAPHS = [["chh", "c"], ["ch", "c"], ["sh", "s"], ["kh", "k"], ["gh", "g"], ["th", "t"], ["dh", "d"],
  ["ph", "p"], ["bh", "b"], ["jh", "j"], ["ng", "n"], ["w", "b"], ["v", "b"], ["f", "p"], ["z", "j"], ["q", "k"],
  ["x", "ks"], ["y", ""]];
const dedupe = (t) => t.replace(/(.)\1+/g, "$1");
function skelBn(t) {
  t = (t || "").normalize("NFC").replace(/য়|য়/g, "")   // য় (ya) is a vowel glide
    .replace(/ড়|ঢ়|ড়|ঢ়/g, "র");          // ড় ঢ় sound like r
  return dedupe([...t].map((c) => BN_SKEL[c] || "").join(""));
}
function skelEn(t) {
  t = (t || "").toLowerCase().replace(/[^a-z]/g, "");
  for (const [a, b] of LAT_DIGRAPHS) t = t.split(a).join(b);
  return dedupe(t.replace(/[aeiouh]/g, ""));
}
const isBengali = (t) => /[ঀ-৿]/.test(t);

function searchSongs(q) {
  const nq = norm(q);
  if (!nq) return [];
  const qs = isBengali(q) ? skelBn(q) : skelEn(q);
  const fuzzy = qs.length >= 4;   // shorter skeletons match almost everything
  const exactStart = [], exactTitle = [], skelStart = [], skelTitle = [], inLyrics = [];
  for (const s of SONGS) {
    if (s._title.startsWith(nq)) exactStart.push(s);
    else if (s._title.includes(nq)) exactTitle.push(s);
    else if (fuzzy && s._skels.some((k) => k.startsWith(qs))) skelStart.push(s);
    else if (fuzzy && s._skels.some((k) => k.includes(qs))) skelTitle.push(s);
    else if (s._lyrics.includes(nq) || (fuzzy && qs.length >= 5 && s._skelLyrics.includes(qs))) inLyrics.push(s);
  }
  return exactStart.concat(exactTitle, skelStart, skelTitle, inLyrics);
}

/* ---------------- views ---------------- */

function renderHome() {
  const q = sessionGet("q");
  view.innerHTML = `
    <div class="search-row">
      <input id="q" class="search" type="search" placeholder="খুঁজুন · Search by title or a line of lyrics" value="${esc(q)}" autocomplete="off" aria-label="Search songs">
    </div>
    <div id="home-body"></div>`;
  const input = $("#q"), body = $("#home-body");
  const run = () => {
    sessionSet("q", input.value);
    if (norm(input.value)) {
      const res = searchSongs(input.value);
      body.innerHTML = `<div class="section-head"><h2>${plural(res.length, "song")} found</h2></div>`;
      body.append(songList(res, { recFirst: false }));
    } else renderListen(body);
  };
  input.addEventListener("input", run);
  run();
}

/* ---------------- "How are you feeling?" playlists ----------------
   Free text -> moods (and a season) using docs/feelings.json, then the best-fitting songs. */
let FEEL = null, FEEL_PATTERNS = null;
const POSITIVE = new Set(["ananda", "shanti", "prem", "utsav", "kautuk"]);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function feelPattern(w) {
  if (isBengali(w)) return new RegExp(reEsc(w.normalize("NFC")), "g");
  const p = reEsc(w.toLowerCase()).replace(/\\\*$/, "[a-z']*");
  return new RegExp(`(?<![a-z])${p}(?![a-z])`, "g");
}
function compileFeelings() {
  const list = [];
  FEEL.moods.forEach(({ mood, words }) => words.forEach((w) => list.push({ mood, w, re: feelPattern(w) })));
  list.sort((a, b) => b.w.length - a.w.length);   // longest phrase wins ("ভালো লাগছে না" before "ভালো লাগছে")
  const seasons = FEEL.seasons.map(({ season, words }) => ({ season, res: words.map(feelPattern) }));
  const neg = new RegExp(`(?<![a-z])(${FEEL.negations.map(reEsc).join("|")})\\s+(\\S+\\s+)?$`);
  FEEL_PATTERNS = { list, seasons, neg };
}
function detectFeelings(text) {
  if (!FEEL_PATTERNS) compileFeelings();
  const t = (text || "").normalize("NFC").toLowerCase();
  let work = t;
  const scores = {}, hits = [];
  for (const { mood, re } of FEEL_PATTERNS.list) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(work))) {
      const negated = !isBengali(m[0]) && FEEL_PATTERNS.neg.test(t.slice(Math.max(0, m.index - 25), m.index));
      if (negated && POSITIVE.has(mood)) {
        scores.bishad = (scores.bishad || 0) + 0.8;
        hits.push({ word: `not ${m[0].trim()}`, mood: "bishad" });
      } else if (!negated) {
        scores[mood] = (scores[mood] || 0) + 1;
        hits.push({ word: m[0].trim(), mood });
      }
      work = work.slice(0, m.index) + " ".repeat(m[0].length) + work.slice(m.index + m[0].length);
    }
  }
  let season = null, best = 0;
  for (const { season: name, res } of FEEL_PATTERNS.seasons) {
    const n = res.reduce((c, re) => { re.lastIndex = 0; return c + (t.match(re) || []).length; }, 0);
    if (n > best) { best = n; season = name; }
  }
  const max = Math.max(0, ...Object.values(scores));
  const moods = Object.entries(scores).filter(([, s]) => s >= max * 0.34).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([m, s]) => ({ mood: m, weight: s / max }));
  return { moods, season, hits };
}
// Best-fitting songs with recordings. A little randomness so "Another mix" differs.
function buildPlaylist({ moods, season }, n) {
  const w = Object.fromEntries(moods.map((m) => [m.mood, m.weight]));
  const scored = [];
  for (const s of SONGS) {
    if (!hasRec(s) || isNever(s.id)) continue;
    const tags = s.moods || [];
    const fit = tags.reduce((a, m, i) => a + (w[m] || 0) * (i === 0 ? 1 : 0.75), 0);
    const inSeason = season && s.season === season;
    if (!fit && !inSeason) continue;
    const score = fit * 2 + (inSeason ? 1 : 0) + (isLiked(s.id) ? 0.6 : 0)
      + (s.pop ? 0.4 * (1 - s.pop / 400) : 0) + Math.random() * 0.8;
    const why = tags.filter((m) => w[m]).concat(inSeason ? [season] : []);
    scored.push({ s, score, why });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, n);
}

function renderFeel(box) {
  const text = sessionGet("feel"), n = sessionGet("feelN") || "10";
  box.innerHTML = `
    <div class="section-head"><h2 id="h-feel">How are you feeling?</h2>
      <span class="hint">Say it in your own words, in English or বাংলা, and get a playlist</span></div>
    <textarea id="feel-text" class="feel-text" rows="2" aria-labelledby="h-feel"
      placeholder="e.g. missing my mother on a rainy evening · বৃষ্টির দিনে মন খারাপ · need courage before an exam">${esc(text)}</textarea>
    <div class="feel-row">
      <span class="hint" id="feel-n-label">Songs:</span>
      <div class="feel-n" role="group" aria-labelledby="feel-n-label">
        ${[5, 10, 20].map((k) => `<button type="button" class="btn small" data-n="${k}" aria-pressed="${String(k) === n}">${k}</button>`).join("")}
        <input id="feel-n" class="feel-n-input" type="number" min="1" max="50" value="${esc(n)}" aria-label="Number of songs">
      </div>
      <button class="btn primary" type="button" id="feel-go">Make my playlist</button>
    </div>
    <div id="feel-result" aria-live="polite"></div>`;
  const input = $("#feel-n", box);
  let state = null;   // last detection, possibly edited via chips
  const count = () => Math.max(1, Math.min(50, parseInt(input.value, 10) || 10));
  $$("[data-n]", box).forEach((b) => b.onclick = () => {
    input.value = b.dataset.n; sessionSet("feelN", b.dataset.n);
    $$("[data-n]", box).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    if (state) draw();
  });
  input.onchange = () => { sessionSet("feelN", String(count())); $$("[data-n]", box).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.n === String(count())))); if (state) draw(); };
  const draw = () => {
    const out = $("#feel-result", box);
    const active = state.moods.filter((m) => m.on);
    const picks = active.length || state.season ? buildPlaylist({ moods: active, season: state.seasonOn ? state.season : null }, count()) : [];
    const chips = Object.keys(META.moods).map((m) => {
      const d = state.moods.find((x) => x.mood === m);
      return `<button type="button" class="chip mood-chip" data-mood="${esc(m)}" aria-pressed="${!!(d && d.on)}" title="${esc(META.moods[m])}">${esc(m)}</button>`;
    }).join("");
    const seasonChip = state.season ? `<button type="button" class="chip mood-chip" data-season aria-pressed="${state.seasonOn}">${esc(state.season)} ${SEASON_BN[state.season]}</button>` : "";
    out.innerHTML = `
      <div class="feel-understood">
        ${state.hits.length ? `<p class="hint">I picked up: ${[...new Set(state.hits.map((h) => `“${esc(h.word)}” → ${esc(h.mood)}`))].join(", ")}</p>`
          : `<p class="hint">I couldn't find a feeling in those words. Choose one or more moods below, or try words like lonely, happy, missing someone, rain, prayer, celebration.</p>`}
        <div class="chips">${seasonChip}${chips}</div>
      </div>
      ${picks.length ? `
        <div class="feel-actions">
          <button class="btn primary" type="button" id="feel-play">▶ Play this playlist (${picks.length})</button>
          <button class="btn" type="button" id="feel-again">↻ Another mix</button>
        </div>
        <ol class="queue feel-list">${picks.map(({ s, why }, i) => {
          const singers = [...new Set(s.videos.flatMap((v) => v.singers || []))];
          return `<li><span class="q-num">${i + 1}</span>
            <button class="btn icon small" type="button" data-feel-play="${i}" aria-label="Play from ${esc(title(s))}">▶</button>
            <div class="q-main"><span><a class="q-title" href="#/song/${enc(s.id)}">${esc(title(s))}</a>${isLiked(s.id) ? ` <span class="liked">♥</span>` : ""}</span>
              <span class="q-singers">${singers.length ? singers.map(esc).join(", ") : "singer not identified"} · <span class="why">${why.map(esc).join(", ")}</span></span></div></li>`;
        }).join("")}</ol>` : (active.length || state.seasonOn ? `<p class="hint">No songs with recordings fit these moods yet; more are added every day.</p>` : "")}`;
    $$(".mood-chip[data-mood]", out).forEach((b) => b.onclick = () => {
      const m = b.dataset.mood, d = state.moods.find((x) => x.mood === m);
      if (d) d.on = !d.on; else state.moods.push({ mood: m, weight: 0.8, on: true });
      draw();
    });
    const sc = $(".mood-chip[data-season]", out); if (sc) sc.onclick = () => { state.seasonOn = !state.seasonOn; draw(); };
    const ids = picks.map((p) => p.s.id);
    const label = active.map((m) => m.mood).concat(state.seasonOn && state.season ? [state.season] : []).join(" · ");
    const play = (from) => { jb.playPlaylist(ids, label, active.map((m) => m.mood), from); location.hash = "#/jukebox"; };
    if ($("#feel-play", out)) $("#feel-play", out).onclick = () => play(0);
    if ($("#feel-again", out)) $("#feel-again", out).onclick = draw;
    $$("[data-feel-play]", out).forEach((b) => b.onclick = () => play(+b.dataset.feelPlay));
  };
  const go = () => {
    const text = $("#feel-text", box).value;
    sessionSet("feel", text);
    const d = detectFeelings(text);
    state = { moods: d.moods.map((m) => ({ ...m, on: true })), season: d.season, seasonOn: !!d.season, hits: d.hits };
    draw();
  };
  $("#feel-go", box).onclick = go;
  $("#feel-text", box).addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) go(); });
  if (text.trim()) go();
}

function renderListen(body) {
  const season = currentSeason();
  const seasonSongs = SONGS.filter((s) => s.season === season && hasRec(s)).length;
  const moodRec = (m) => SONGS.filter((s) => hasRec(s) && (s.moods || []).includes(m)).length;
  const popular = SONGS.filter((s) => s.pop).sort((a, b) => a.pop - b.pop);
  const popRec = popular.filter(hasRec);
  const totalRec = SONGS.filter(hasRec).length;
  body.innerHTML = `
    <section class="section feel" aria-labelledby="h-feel" id="feel-box"></section>
    <section class="section" aria-labelledby="h-listen">
      <div class="section-head"><h2 id="h-listen">Listen now</h2>
        <span class="hint">${totalRec} of ${SONGS.length} songs have recordings so far · more are added every day</span></div>
      <div class="season-tile">
        <div><span class="bn">${SEASON_BN[season]}</span> <strong>${season}</strong>
          <p>${seasonSongs ? `It's ${season} now. ${plural(seasonSongs, "song")} of the season ready to play.` : `It's ${season} now. Recordings for ${season} songs are on their way.`}</p></div>
        <button class="btn" type="button" data-play="season:${season}"${seasonSongs ? "" : " disabled"}>▶ Play ${season} songs</button>
      </div>
      <div class="tiles">${Object.entries(META.moods).map(([m, d]) => {
        const n = moodRec(m);
        return `<button class="tile" type="button" data-play="mood:${esc(m)}"${n ? "" : " disabled"}>
          <strong>${esc(m)}</strong><span>${esc(d)}</span><span class="n">${n ? `▶ ${plural(n, "song")}` : "coming soon"}</span></button>`;
      }).join("")}</div>
    </section>
    <section class="section" aria-labelledby="h-pop">
      <div class="section-head"><h2 id="h-pop">Well-known songs</h2><a href="#/browse/popular">All ${popular.length}</a></div>
      <div id="pop-list"></div>
    </section>
    <section class="section" aria-labelledby="h-explore">
      <div class="section-head"><h2 id="h-explore">Explore all ${SONGS.length} songs</h2></div>
      <p class="tabs">${Object.entries(KINDS).filter(([k]) => k !== "popular").map(([k, v]) => `<a class="tab" href="#/browse/${k}">By ${v.label}</a>`).join("")}</p>
    </section>`;
  $("#pop-list", body).append(songList(popRec.length >= 12 ? popRec : popular, { limit: 12, toggle: false }));
  if (FEEL) renderFeel($("#feel-box", body)); else $("#feel-box", body).hidden = true;
  $$("[data-play]", body).forEach((b) => b.onclick = () => {
    const [kind, value] = b.dataset.play.split(":");
    playFiltered(kind, value);
  });
}

function renderBrowse(kind) {
  if (!KINDS[kind]) kind = "popular";
  const tabs = Object.entries(KINDS).map(([k, v]) =>
    `<a class="tab" href="#/browse/${k}"${k === kind ? ' aria-current="page"' : ""}>${v.label}</a>`).join("");
  view.innerHTML = `<nav class="tabs" aria-label="Browse by">${tabs}</nav>`;
  if (kind === "popular" || kind === "az") {
    const list = kind === "popular" ? SONGS.filter((s) => s.pop).sort((a, b) => a.pop - b.pop) : SONGS;
    view.insertAdjacentHTML("beforeend", `<p class="hint">${kind === "popular"
      ? "Songs most people know, chosen by hand. Their recordings are fetched first."
      : `All ${SONGS.length} songs, alphabetical by English title.`}</p>`);
    view.append(songList(list));
    return;
  }
  const label = (v) => kind === "season" ? `${esc(v)} <small class="bn">${SEASON_BN[v] || ""}</small>`
    : kind === "mood" ? `${esc(v)} <small>${esc(META.moods[v] || "")}</small>` : esc(v);
  view.insertAdjacentHTML("beforeend", `<div class="groups">${groupsOf(kind).map(([v, g]) =>
    `<a class="group" href="#/list/${kind}/${enc(v)}"><span>${label(v)}</span><span class="n" title="${g.rec} with recordings">${g.n}${g.rec ? ` · ▶${g.rec}` : ""}</span></a>`).join("")}</div>`);
}

function renderList(kind, value, sub = "") {
  if (!KINDS[kind] || !KINDS[kind].get) return renderBrowse("popular");
  const all = SONGS.filter((s) => KINDS[kind].get(s).includes(value));
  const list = sub ? all.filter((s) => s.sub === sub) : all;
  const playable = ["mood", "parjay", "season", "raag"].includes(kind) && all.some(hasRec);
  // Parjays are split into sub-groups in Gitabitan (Puja: Bondhu, Biraha, Dukkha...): offer them as chips.
  const subs = kind === "parjay" ? groupCounts(all, (s) => s.sub) : [];
  const subChips = subs.length > 1 ? `<nav class="tabs subtabs" aria-label="${esc(value)} sub-groups">
      <a class="tab" href="#/list/parjay/${enc(value)}"${sub ? "" : ' aria-current="page"'}>All <small>${all.length}</small></a>
      ${subs.map(([v, n]) => `<a class="tab" href="#/list/parjay/${enc(value)}/${enc(v)}"${v === sub ? ' aria-current="page"' : ""}>${esc(v)} <small>${n}</small></a>`).join("")}
    </nav>` : "";
  view.innerHTML = `<p class="crumb"><a href="#/browse/${kind}">${KINDS[kind].label}</a>${sub ? ` › <a href="#/list/parjay/${enc(value)}">${esc(value)}</a>` : ""}</p>
    <div class="list-head"><h1>${esc(sub || value)}${kind === "season" ? ` <span class="bn">${SEASON_BN[value] || ""}</span>` : ""}</h1>
    <span class="n">${plural(list.length, "song")}</span>
    ${kind === "mood" ? `<span class="hint">${esc(META.moods[value] || "")}</span>` : ""}
    ${playable ? `<button class="btn small primary" type="button" id="play-list">▶ Play ${esc(value)} in jukebox</button>` : ""}</div>
    ${subChips}`;
  view.append(songList(list));
  if (playable) $("#play-list").onclick = () => playFiltered(kind, value);
}

function groupCounts(list, keyFn) {
  const m = new Map();
  for (const s of list) { const k = keyFn(s); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// Songs that share moods, raag, sub-group or season with this one; playable songs ranked a little higher.
function relatedSongs(s, n = 8) {
  const moods = new Set(s.moods || []);
  const scored = [];
  for (const o of SONGS) {
    if (o.id === s.id) continue;
    let sc = 3 * (o.moods || []).filter((m) => moods.has(m)).length;
    if (s.raag && o.raag === s.raag) sc += 3;
    if (s.sub && o.sub === s.sub && o.parjay === s.parjay) sc += 2;
    else if (s.parjay && o.parjay === s.parjay) sc += 1;
    if (s.season && o.season === s.season) sc += 2;
    if (s.taal && o.taal === s.taal) sc += 0.5;
    if (sc < 4) continue;
    sc += hasRec(o) ? 1.5 : 0;
    sc += o.pop ? 0.5 : 0;
    scored.push([sc, o]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, n).map(([, o]) => o);
}

function renderSong(id) {
  const s = BY_ID.get(id);
  if (!s) { view.innerHTML = `<p>Song not found. <a href="#/">Back to Listen</a></p>`; return; }
  const chip = (kind, v) => `<a class="chip" href="#/list/${kind}/${enc(v)}">${esc(v)}</a>`;
  const facts = [
    ["Parjay", s.parjay && chip("parjay", s.parjay) + (s.sub && s.parjay
      ? ` <a class="hint" href="#/list/parjay/${enc(s.parjay)}/${enc(s.sub)}">${esc(s.sub)}</a>` : "")],
    ["Season", s.season && chip("season", s.season)],
    ["Drama", s.drama && s.drama.split(", ").map((d) => chip("drama", d)).join(" ")],
    ["Raag", s.raag && chip("raag", s.raag) + (s.raagFull && s.raagFull !== s.raag ? ` <span class="hint">${esc(s.raagFull)}</span>` : "")],
    ["Taal", s.taal && chip("taal", s.taal)],
    ["Mood", s.moods && s.moods.length && `<span class="chips">${s.moods.map((m) => chip("mood", m)).join("")}</span>`],
    ["Written", s.written && esc(s.written)],
  ].filter(([, v]) => v);
  const vids = s.videos == null
    ? `<p class="novideo">Recordings for this song haven't been fetched yet. They are added every day${s.pop ? ", well-known songs first" : ""}.</p>`
    : !s.videos.length ? `<p class="novideo">No matching recording was found on YouTube.</p>`
    : s.videos.map((v) => `<figure class="video">
        <div class="frame"><img src="https://i.ytimg.com/vi/${esc(v.id)}/hqdefault.jpg" alt="" loading="lazy">
          <button class="play" type="button" data-vid="${esc(v.id)}" aria-label="Play ${esc(v.t)}"><span>▶</span></button></div>
        <figcaption>${esc(v.t)}<small>${esc(v.ch)} · ${fmtViews(v.views)} views · ${fmtTime(v.sec)}</small></figcaption>
      </figure>`).join("");
  const fromGb = s.source.includes("geetabitan.com");
  view.innerHTML = `<article class="song">
    <div>
      <h1>${esc(title(s))}</h1>
      ${s.bn && s.en ? `<p class="sub-en">${esc(s.alias ? `${s.alias} · ${s.en}` : s.en)}</p>` : ""}
      <div class="song-actions">
        <button class="btn small" id="s-like" type="button" aria-pressed="${isLiked(s.id)}">♥ ${isLiked(s.id) ? "Liked" : "Like"}</button>
        <button class="btn small" id="s-never" type="button" aria-pressed="${isNever(s.id)}">${isNever(s.id) ? "Hidden from jukebox" : "Never play in jukebox"}</button>
        ${askAiLink(s)}
      </div>
      <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      ${s.lyrics ? `<pre class="lyrics bn" id="lyrics">${esc(s.lyrics)}</pre>` : `<p class="novideo">Bengali lyrics are not available here.</p>`}
      <p class="src">${fromGb
        ? `English transliteration, notation and background: <a href="${esc(s.source)}" target="_blank" rel="noopener">geetabitan.com</a>`
        : `Source: <a href="${esc(s.source)}" target="_blank" rel="noopener">Bengali Wikisource</a>`}</p>
    </div>
    <section class="videos" aria-label="Recordings"><h2>Recordings</h2>${vids}</section>
  </article>
  <section class="section related" aria-labelledby="h-related">
    <div class="section-head"><h2 id="h-related">More like this</h2>
      ${(s.moods || []).length ? `<button class="btn small primary" type="button" id="play-like">▶ Play songs like this</button>` : ""}</div>
    <p class="hint">Songs that share this one's mood, raag, sub-group or season.</p>
    <div id="related"></div>
  </section>`;
  const rel = relatedSongs(s);
  if (rel.length) $("#related").append(songList(rel, { limit: 8, toggle: false }));
  else $(".related").hidden = true;
  const likeBtn = $("#play-like");
  if (likeBtn) {
    const n = jb.countFor({ moods: s.moods });
    likeBtn.disabled = !n;
    likeBtn.title = n ? `${plural(n, "song")} with recordings share its mood` : "No songs with recordings share its mood yet";
    likeBtn.onclick = () => { jb.setFilters({ moods: s.moods }); location.hash = "#/jukebox"; jb.start(); };
  }
  $$("[data-vid]", view).forEach((b) => b.onclick = () => {
    jb.pause();
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${b.dataset.vid}?autoplay=1&rel=0`;
    f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true; f.title = "YouTube video";
    b.parentElement.replaceChildren(f);
  });
  $("#s-like").onclick = () => { toggle("likes", s.id, !isLiked(s.id)); renderSong(id); jb.prefsChanged(); };
  $("#s-never").onclick = () => { toggle("never", s.id, !isNever(s.id)); renderSong(id); jb.prefsChanged(); };
}

/* Ask AI: opens ChatGPT in a new tab with the question already filled in (chatgpt.com/?q=...).
   Nothing is sent until the listener clicks. The lyrics are Tagore's and in the public domain. */
function askAiPrompt(s) {
  const facts = [
    s.parjay && `Parjay: ${s.parjay}${s.sub ? ` (${s.sub})` : ""}`,
    s.drama && `From the dance drama: ${s.drama}`,
    s.raag && `Raag: ${s.raagFull || s.raag}`, s.taal && `Taal: ${s.taal}`, s.written && `Written: ${s.written}`,
  ].filter(Boolean).join("; ");
  let lyrics = s.lyrics || "";
  // Bengali letters take ~9 characters each in a URL: keep the link under ~8,000 characters
  if (lyrics.length > 800) lyrics = lyrics.slice(0, 800).replace(/\n[^\n]*$/, "") + "\n… (opening verses only)";
  return `Explain the meaning of the Rabindrasangeet song "${s.bn || s.en}"${s.bn && s.en ? ` (${s.en})` : ""} by Rabindranath Tagore.`
    + (facts ? `\n${facts}.` : "")
    + (lyrics ? `\n\nBengali lyrics:\n${lyrics}` : "")
    + `\n\nPlease give:\n1. The meaning line by line in simple English, quoting each Bengali line first.`
    + `\n2. The central idea and emotion of the song.`
    + `\n3. Any known background: when and why Tagore wrote it, and how it is usually understood.`
    + `\nIf you are unsure about any detail, say so rather than guessing.`;
}
function askAiLink(s) {
  return `<a class="btn small ask-ai" href="https://chatgpt.com/?q=${enc(askAiPrompt(s))}" target="_blank" rel="noopener"
    title="Opens ChatGPT in a new tab with this song's lyrics and a question about its meaning">✨ Ask AI: meaning</a>`;
}

function sessionGet(k) { try { return sessionStorage.getItem("gitabitan." + k) || ""; } catch { return ""; } }
function sessionSet(k, v) { try { sessionStorage.setItem("gitabitan." + k, v); } catch { /* ignore */ } }

/* ---------------- jukebox ---------------- */
const jb = (() => {
  const F = prefs.filters;
  let player = null, apiLoading = null, current = null, upNext = null, errors = 0;
  // What the listener asked for. YouTube reports ads and buffering as "not playing", so the
  // Pause/Resume buttons follow this instead of the player's state.
  let wantPlay = false;
  // A playlist from "How are you feeling?": played in order, then shuffle continues on its moods.
  let playlist = null;   // { label, ids, idx }
  const history = [];
  const ARR = { moods: "moods", parjays: "parjays", seasons: "seasons" };

  function matches(s, f) {
    return hasRec(s) && !isNever(s.id)
      && (!f.likedOnly || isLiked(s.id))
      && (!f.moods.length || (s.moods || []).some((m) => f.moods.includes(m)))
      && (!f.parjays.length || f.parjays.includes(s.parjay))
      && (!f.seasons.length || f.seasons.includes(s.season))
      && (!f.raag || s.raag === f.raag)
      && (!f.singer || s.videos.some((v) => (v.singers || []).includes(f.singer)));
  }
  const pool = (f = F) => SONGS.filter((s) => matches(s, f));

  // Liked songs are 4x as likely; recently played songs sit out until the pool cycles.
  function pickSong(exclude = []) {
    const p = pool();
    if (!p.length) return null;
    const avoid = new Set(prefs.recent.slice(-Math.min(40, Math.floor(p.length / 2))).concat(exclude));
    const cands = p.filter((s) => !avoid.has(s.id));
    const list = cands.length ? cands : p.filter((s) => !exclude.includes(s.id)).length ? p.filter((s) => !exclude.includes(s.id)) : p;
    const w = list.map((s) => (isLiked(s.id) ? 4 : 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < list.length; i++) if ((r -= w[i]) <= 0) return list[i];
    return list[list.length - 1];
  }
  // Prefer the chosen singer; otherwise favour popular recordings (weight ~ sqrt(views)).
  function pickVideo(s) {
    let vids = s.videos;
    if (F.singer) vids = vids.filter((v) => (v.singers || []).includes(F.singer));
    if (!vids.length) vids = s.videos;
    const w = vids.map((v) => Math.sqrt(v.views + 1));
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < vids.length; i++) if ((r -= w[i]) <= 0) return vids[i];
    return vids[0];
  }
  function planNext() {
    const fromList = playlist && playlist.ids.slice(playlist.idx + 1).map((id) => BY_ID.get(id)).find((s) => s && !isNever(s.id));
    const s = fromList || pickSong(current ? [current.song.id] : []);
    upNext = s ? { song: s, video: pickVideo(s) } : null;
    const el = $("#jb-next");
    el.innerHTML = upNext && current ? `Up next: <a href="#/song/${enc(upNext.song.id)}">${esc(title(upNext.song))}</a>` : "";
  }

  function loadApi() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (apiLoading) return apiLoading;
    apiLoading = new Promise((res) => {
      window.onYouTubeIframeAPIReady = res;
      const sc = document.createElement("script");
      sc.src = "https://www.youtube.com/iframe_api";
      document.head.append(sc);
    });
    return apiLoading;
  }

  // autoplay=false loads the song paused (used when filters change while the listener had paused)
  async function playItem(item, autoplay = true) {
    current = item;
    wantPlay = autoplay;
    prefs.recent.push(item.song.id); prefs.recent = prefs.recent.slice(-200); savePrefs();
    showNow(); planNext(); renderQueue();
    await loadApi();
    $("#jb-empty").hidden = true;
    if (!player) {
      player = new YT.Player("yt-player", {
        videoId: item.video.id, host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) next();
            if (e.data === YT.PlayerState.PLAYING) { errors = 0; wantPlay = true; }
            if (e.data === YT.PlayerState.PAUSED) wantPlay = false; // also when paused in YouTube's own controls
            updateButtons();
          },
          onError: () => { if (++errors < 5) next(); }, // unembeddable or removed video: move on
        },
      });
    } else if (autoplay) player.loadVideoById(item.video.id);
    else player.cueVideoById(item.video.id);
    updateButtons();
  }

  // Play a song chosen from the list (keeps "Previous" working).
  function playSong(id) {
    const s = BY_ID.get(id);
    if (!s || !hasRec(s)) return;
    if (current) history.push(current);
    if (playlist && playlist.ids.includes(id)) playlist.idx = playlist.ids.indexOf(id);
    playItem({ song: s, video: pickVideo(s) });
  }

  // Start a playlist (from the feelings box) at position `from`. Filters are set to its moods
  // quietly, so shuffle continues in the same spirit once the list ends.
  function playPlaylist(ids, label, moods, from = 0) {
    clearTimeout(resetTimer);
    Object.assign(F, { ...EMPTY_FILTERS, moods: [], parjays: [], seasons: [] }, { moods: moods || [] });
    savePrefs(); updateCounts();
    playlist = { label, ids, idx: from };
    history.length = 0; upNext = null;
    const s = BY_ID.get(ids[from]);
    playItem({ song: s, video: pickVideo(s) });
  }

  // Filters changed under a song that no longer fits: start afresh in the new selection.
  function switchToSelection() {
    history.length = 0;   // earlier songs belong to the old selection
    upNext = null;
    const s = pickSong();
    if (!s) return stop();
    playItem({ song: s, video: pickVideo(s) }, wantPlay);
  }
  function stop() {
    try { player && player.stopVideo(); } catch { /* not ready */ }
    current = null; upNext = null; wantPlay = false; history.length = 0;
    showNow(); $("#jb-lyrics").innerHTML = ""; $("#jb-next").innerHTML = "";
    showEmpty(); renderQueue();
  }

  function next() {
    if (playlist) {
      const rest = playlist.ids.slice(playlist.idx + 1);
      const k = rest.findIndex((id) => !isNever(id));
      if (k >= 0) {
        playlist.idx += k + 1;
        const s = BY_ID.get(playlist.ids[playlist.idx]);
        if (current) history.push(current);
        return playItem(upNext && upNext.song === s ? upNext : { song: s, video: pickVideo(s) });
      }
      playlist = null;   // finished: carry on shuffling songs of the same moods
      upNext = null;
    }
    if (upNext && !matches(upNext.song, F)) upNext = null;
    const item = upNext || (() => { const s = pickSong(); return s && { song: s, video: pickVideo(s) }; })();
    if (!item) { showEmpty(); return; }
    if (current) history.push(current);
    playItem(item);
  }
  function prev() {
    const item = history.pop();
    if (!item) return;
    const back = current;
    current = null;
    if (playlist && playlist.ids.includes(item.song.id)) playlist.idx = playlist.ids.indexOf(item.song.id);
    playItem(item); // runs planNext synchronously before its first await
    if (back) {     // after going back, "next" returns to the song we just left
      upNext = back;
      $("#jb-next").innerHTML = `Up next: <a href="#/song/${enc(back.song.id)}">${esc(title(back.song))}</a>`;
      renderQueue();
    }
  }
  function start() {
    if (current && player) { player.playVideo(); wantPlay = true; updateButtons(); return; }
    next();
  }

  function showEmpty() {
    const n = pool().length;
    $("#jb-empty").hidden = !!current && n > 0;
    $("#jb-empty-msg").textContent = n ? "Press Play for a shuffle of songs that match your filters."
      : "No songs with recordings match these filters yet. Remove a filter or clear them all.";
    $("#jb-empty-clear").hidden = n > 0;
    updateButtons();
  }

  function showNow() {
    const el = $("#jb-now");
    if (!current) { el.innerHTML = `<p class="hint">Nothing playing yet.</p>`; return; }
    const s = current.song;
    el.innerHTML = `<h2><a href="#/song/${enc(s.id)}">${esc(title(s))}</a></h2>
      ${s.bn && s.en ? `<p>${esc(s.en)}</p>` : ""}
      <p>${[s.parjay, s.season, s.raag, s.taal].filter(Boolean).map(esc).join(" · ")}</p>
      <p class="chips">${(s.moods || []).map((m) => `<span class="chip">${esc(m)}</span>`).join("")}</p>
      ${(current.video.singers || []).length ? `<p class="singer">Singer: <strong>${current.video.singers.map(esc).join(", ")}</strong></p>` : ""}
      <p class="hint">${esc(current.video.t)} — ${esc(current.video.ch)}</p>`;
    $("#jb-ask").href = `https://chatgpt.com/?q=${enc(askAiPrompt(s))}`;
    $("#jb-lyrics").innerHTML = s.lyrics
      ? `<pre class="lyrics bn">${esc(s.lyrics)}</pre>` : "";
  }

  const playing = () => !!(player && current && wantPlay);
  function updateButtons() {
    const on = !!current, n = pool().length;
    $("#jb-skip").disabled = !on || !n; $("#jb-like").disabled = !on; $("#jb-never").disabled = !on;
    $("#jb-ask").hidden = !on;
    $("#jb-prev").disabled = !history.length;
    $("#jb-play").disabled = !on && !n;
    const liked = on && isLiked(current.song.id);
    $("#jb-like").setAttribute("aria-pressed", String(liked));
    $("#jb-like").textContent = liked ? "♥ Liked" : "♥ Like";
    $("#jb-play").textContent = !on ? "▶ Play" : playing() ? "❚❚ Pause" : "▶ Resume";
    updateMini();
  }
  function updateMini() {
    const show = !!current && location.hash.indexOf("#/jukebox") !== 0;
    $("#mini").hidden = !show;
    document.body.classList.toggle("has-mini", show);
    if (!current) return;
    $("#mini-title").textContent = title(current.song);
    $("#mini-play").textContent = playing() ? "❚❚" : "▶";
    $("#mini-play").setAttribute("aria-label", playing() ? "Pause" : "Play");
    $("#mini-like").setAttribute("aria-pressed", String(isLiked(current.song.id)));
  }

  /* filters */
  function countWith(key, value) {
    const f = { ...F, [key]: ARR[key] ? [value] : value };
    return pool(f).length;
  }
  function pills(key, values, labelFn = (v) => v) {
    return `<div class="pillset">${values.map((v) => `<label><input type="checkbox" name="${key}" value="${esc(v)}"${F[key].includes(v) ? " checked" : ""}><span>${esc(labelFn(v))} <small data-count></small></span></label>`).join("")}</div>`;
  }
  function renderFilters() {
    const moods = Object.keys(META.moods);
    const parjays = groupsOf("parjay").map(([v]) => v);
    $("#jb-filters").innerHTML = `
      <fieldset><legend>Mood</legend>${pills("moods", moods)}</fieldset>
      <fieldset><legend>Season</legend>${pills("seasons", SEASON_ORDER, (v) => `${v} ${SEASON_BN[v]}`)}</fieldset>
      <fieldset><legend>Parjay</legend>${pills("parjays", parjays)}</fieldset>
      <fieldset><legend>Raag, singer</legend>
        <label class="hint" for="jb-raag">Raag</label><select id="jb-raag"></select>
        <label class="hint" for="jb-singer">Singer</label><select id="jb-singer"></select>
        <label class="toggle"><input type="checkbox" id="jb-liked"${F.likedOnly ? " checked" : ""}> Only liked songs</label>
      </fieldset>`;
    $("#jb-filters").onchange = (e) => {
      const t = e.target;
      if (ARR[t.name]) F[t.name] = $$(`input[name="${t.name}"]:checked`, $("#jb-filters")).map((x) => x.value);
      else if (t.id === "jb-raag") F.raag = t.value;
      else if (t.id === "jb-singer") F.singer = t.value;
      else if (t.id === "jb-liked") F.likedOnly = t.checked;
      filtersChanged();
    };
    updateCounts();
  }
  // Each option shows how many songs you'd get by choosing it (other filters unchanged); zero = greyed out.
  function updateCounts() {
    $$("#jb-filters input[name]").forEach((inp) => {
      const n = countWith(inp.name, inp.value);
      inp.checked = F[inp.name].includes(inp.value);
      inp.disabled = !n && !inp.checked;
      inp.nextElementSibling.querySelector("[data-count]").textContent = n;
    });
    const opts = (key, values, anyLabel) => {
      const sel = key === "raag" ? $("#jb-raag") : $("#jb-singer");
      const items = values.map((v) => [v, countWith(key, v)]).filter(([v, n]) => n || v === F[key]);
      sel.innerHTML = `<option value="">${anyLabel}</option>` +
        items.map(([v, n]) => `<option value="${esc(v)}"${v === F[key] ? " selected" : ""}>${esc(v)} (${n})</option>`).join("");
    };
    const withRec = SONGS.filter(hasRec);
    opts("raag", [...new Set(withRec.map((s) => s.raag).filter(Boolean))].sort(), "Any raag");
    opts("singer", [...new Set(withRec.flatMap((s) => s.videos.flatMap((v) => v.singers || [])))].sort(), "Any singer");
    $("#jb-liked").checked = F.likedOnly;
    renderFilterBar();
  }
  function renderFilterBar() {
    const n = pool().length;
    $("#jb-count").textContent = `${plural(n, "song")} to play`;
    const chips = [
      ...F.moods.map((v) => ["moods", v, v]), ...F.seasons.map((v) => ["seasons", v, `${v} ${SEASON_BN[v]}`]),
      ...F.parjays.map((v) => ["parjays", v, v]),
      ...(F.raag ? [["raag", F.raag, `Raag ${F.raag}`]] : []), ...(F.singer ? [["singer", F.singer, F.singer]] : []),
      ...(F.likedOnly ? [["likedOnly", "", "Liked only"]] : []),
    ];
    $("#jb-active").innerHTML = chips.length
      ? chips.map(([k, v, l]) => `<button class="chip" type="button" data-k="${k}" data-v="${esc(v)}" aria-label="Remove filter ${esc(l)}">${esc(l)}</button>`).join("") +
        `<button class="btn small" type="button" id="jb-clear">Clear all</button>`
      : `<span class="hint">All songs with recordings</span>`;
    $$("#jb-active [data-k]").forEach((b) => b.onclick = () => {
      const k = b.dataset.k;
      if (ARR[k]) F[k] = F[k].filter((x) => x !== b.dataset.v);
      else if (k === "likedOnly") F.likedOnly = false;
      else F[k] = "";
      filtersChanged();
    });
    const c = $("#jb-clear"); if (c) c.onclick = clearFilters;
  }
  // immediate: switch at once (a "Play … songs" button); otherwise wait a moment so several quick
  // filter clicks lead to one switch, not one per click.
  let resetTimer = null;
  function filtersChanged(immediate = false) {
    playlist = null;   // choosing filters by hand leaves playlist mode
    savePrefs(); updateCounts(); planNext(); renderQueue();
    clearTimeout(resetTimer);
    const reset = () => { if (current && !matches(current.song, F)) switchToSelection(); };
    if (current && !matches(current.song, F)) {
      if (immediate) reset(); else resetTimer = setTimeout(reset, 700);
    }
    if (!current) showEmpty(); else updateButtons();
  }

  /* the selection as a list, with singers */
  let queueAll = false;
  function renderQueue() {
    let list;
    if (playlist) {
      list = playlist.ids.map((id) => BY_ID.get(id)).filter((s) => s && hasRec(s) && !isNever(s.id));
      $("#jb-queue-h").textContent = `Your playlist: ${playlist.label || "for your mood"}`;
      $("#jb-queue-count").textContent = `song ${Math.min(playlist.idx + 1, list.length)} of ${list.length} · then more like these`;
    } else {
      list = pool();
      const order = (s) => s === current?.song ? 0 : s === upNext?.song ? 1 : 2;
      list.sort((a, b) => order(a) - order(b) || (a.pop || 9999) - (b.pop || 9999) || title(a).localeCompare(title(b)));
      $("#jb-queue-h").textContent = "Songs in this selection";
      $("#jb-queue-count").textContent = `${plural(list.length, "song")}`;
    }
    const shown = queueAll ? list : list.slice(0, 25);
    $("#jb-queue").innerHTML = shown.map((s) => {
      const singers = [...new Set(s.videos.flatMap((v) => v.singers || []))];
      const tag = s === current?.song ? `<span class="badge now">Now playing</span>`
        : s === upNext?.song ? `<span class="badge">Up next</span>` : "";
      return `<li class="${s === current?.song ? "is-now" : ""}">
        <button class="btn icon small" type="button" data-play-id="${esc(s.id)}" aria-label="Play ${esc(title(s))}">▶</button>
        <a class="btn icon small ask-ai" href="https://chatgpt.com/?q=${enc(askAiPrompt(s))}" target="_blank" rel="noopener"
           title="Ask AI what this song means (opens ChatGPT)" aria-label="Ask AI about ${esc(title(s))}">✨</a>
        <div class="q-main"><span><a href="#/song/${enc(s.id)}" class="q-title">${esc(title(s))}</a>${isLiked(s.id) ? ` <span class="liked" title="Liked">♥</span>` : ""} ${tag}</span>
          <span class="q-singers">${singers.length
            ? singers.map((n) => n === F.singer ? `<strong>${esc(n)}</strong>` : esc(n)).join(", ")
            : `<span class="hint">singer not identified</span>`}</span></div>
      </li>`;
    }).join("") || `<li class="hint">No songs with recordings match these filters yet.</li>`;
    $("#jb-queue-more").hidden = list.length <= 25;
    $("#jb-queue-more").textContent = queueAll ? "Show fewer" : `Show all ${list.length}`;
  }
  function clearFilters() { Object.assign(F, { ...EMPTY_FILTERS, moods: [], parjays: [], seasons: [] }); filtersChanged(); }
  function setFilter(kind, value) {
    const key = { mood: "moods", parjay: "parjays", season: "seasons" }[kind];
    setFilters(key ? { [key]: [value] } : kind === "raag" ? { raag: value } : {});
  }
  // Replace all filters with the given ones (unspecified ones are cleared).
  function setFilters(f) {
    Object.assign(F, { ...EMPTY_FILTERS, moods: [], parjays: [], seasons: [] }, f);
    filtersChanged(true);
  }
  const countFor = (f) => pool({ ...EMPTY_FILTERS, moods: [], parjays: [], seasons: [], ...f }).length;

  function prefsChanged() {
    const row = (id, list) => {
      const s = BY_ID.get(id); if (!s) return "";
      return `<li><a href="#/song/${enc(id)}">${esc(title(s))}</a><button class="btn small" type="button" data-un="${list}" data-id="${esc(id)}">Remove</button></li>`;
    };
    $("#jb-prefs").innerHTML = `<summary>Your liked songs (${prefs.likes.length}) and hidden songs (${prefs.never.length})</summary>
      <h3 class="hint">Liked: these come up 4× as often</h3><ul>${prefs.likes.map((id) => row(id, "likes")).join("") || "<li class='hint'>None yet. Press ♥ Like while a song plays.</li>"}</ul>
      <h3 class="hint">Never play</h3><ul>${prefs.never.map((id) => row(id, "never")).join("") || "<li class='hint'>None</li>"}</ul>
      <p class="hint">Saved in this browser only.</p>`;
    $$("#jb-prefs [data-un]").forEach((b) => b.onclick = () => { toggle(b.dataset.un, b.dataset.id, false); prefsChanged(); });
    if (SONGS.length) { updateCounts(); updateButtons(); renderQueue(); }
  }

  function togglePlay() {
    if (!current || !player) return next();
    if (wantPlay) player.pauseVideo(); else player.playVideo();
    wantPlay = !wantPlay;
    updateButtons();
  }
  function likeCurrent() { if (!current) return; toggle("likes", current.song.id, !isLiked(current.song.id)); prefsChanged(); }

  function init() {
    renderFilters(); prefsChanged(); showEmpty();
    $("#jb-play").onclick = togglePlay;
    $("#jb-skip").onclick = next;
    $("#jb-prev").onclick = prev;
    $("#jb-like").onclick = likeCurrent;
    $("#jb-never").onclick = () => { toggle("never", current.song.id, true); prefsChanged(); next(); };
    $("#jb-empty-clear").onclick = clearFilters;
    $("#jb-edit").onclick = () => {
      const open = $("#jb-filters").hidden;
      $("#jb-filters").hidden = !open;
      $("#jb-edit").setAttribute("aria-expanded", String(open));
      $("#jb-edit").textContent = open ? "Done" : "Edit filters";
    };
    $("#mini-play").onclick = togglePlay;
    $("#mini-skip").onclick = next;
    $("#mini-like").onclick = likeCurrent;
    $("#jb-queue").onclick = (e) => { const b = e.target.closest("[data-play-id]"); if (b) playSong(b.dataset.playId); };
    $("#jb-queue-more").onclick = () => { queueAll = !queueAll; renderQueue(); };
    renderQueue();
  }

  return { init, start, setFilter, setFilters, countFor, prefsChanged, playPlaylist, updateMini, pause: () => { try { player && player.pauseVideo(); } catch { /* not ready */ } wantPlay = false; updateButtons(); } };
})();

function playFiltered(kind, value) {
  jb.setFilter(kind, value);
  location.hash = "#/jukebox";
  jb.start();
}

/* ---------------- router ---------------- */
function route() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const page = parts[0] || "home";
  const isJb = page === "jukebox";
  $("#jukebox").classList.toggle("offstage", !isJb);
  $("#jukebox").setAttribute("aria-hidden", String(!isJb));
  view.hidden = isJb;
  $$("[data-nav]").forEach((a) => a.removeAttribute("aria-current"));
  const nav = { home: "home", song: "home", browse: "browse", list: "browse", jukebox: "jukebox" }[page];
  const navEl = $(`[data-nav="${nav}"]`); if (navEl) navEl.setAttribute("aria-current", "page");
  jb.updateMini();
  if (isJb) { window.scrollTo(0, 0); return; }
  if (page === "song") renderSong(parts[1]);
  else if (page === "browse") renderBrowse(parts[1]);
  else if (page === "list" && parts[1] === "parjay") renderList("parjay", parts[2], parts[3] || "");
  else if (page === "list") renderList(parts[1], parts.slice(2).join("/"));
  else renderHome();
  if (page !== "home") { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
}

// The feelings word list is optional: without it the site works, just without the feelings box.
const feelingsLoad = fetch("feelings.json?v=1").then((r) => (r.ok ? r.json() : null)).catch(() => null);
fetch("songs.json", { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(async (d) => {
  FEEL = await feelingsLoad;
  META = d.meta; SONGS = d.songs;
  for (const s of SONGS) {
    BY_ID.set(s.id, s);
    s._title = norm([s.bn, s.en, s.alias, s.id.replace(/-/g, " ")].join(" "));
    s._lyrics = norm(s.lyrics);
    s._skels = [skelBn(s.bn), skelEn(s.en), skelEn(s.alias), skelEn(s.id)].filter(Boolean);
    s._skelLyrics = skelBn(s.lyrics);
  }
  jb.init();
  window.addEventListener("hashchange", route);
  route();
}).catch((e) => {
  view.innerHTML = `<p>Couldn't load songs.json (${esc(e.message)}). Serve this folder over HTTP, e.g. <code>python3 -m http.server</code> inside <code>docs/</code>.</p>`;
});
