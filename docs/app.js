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
function songList(list, { limit = 120, toggle = true } = {}) {
  const wrap = document.createElement("div");
  let shown = limit;
  const draw = () => {
    const rec = list.filter(hasRec), rest = list.filter((s) => !hasRec(s));
    const all = prefs.recOnly ? rec : rec.concat(rest);
    const vis = all.slice(0, shown);
    const firstRest = vis.findIndex((s) => !hasRec(s));
    const rows = vis.map((s, i) => (i === firstRest && i > 0 ? `<li class="divider">Recordings coming soon</li>` : "") + songRow(s)).join("");
    wrap.innerHTML = (toggle ? `<p><label class="toggle"><input type="checkbox" class="rec-only"${prefs.recOnly ? " checked" : ""}> Only songs with recordings (${rec.length} of ${list.length})</label></p>` : "") + `
      <ul class="songs">${rows || `<li class="divider">No songs with recordings here yet. They are added every day.</li>`}</ul>` +
      (all.length > shown ? `<p class="more"><button class="btn small" type="button">Show ${Math.min(300, all.length - shown)} more of ${all.length - shown}</button></p>` : "");
    if (toggle) $(".rec-only", wrap).onchange = (e) => { prefs.recOnly = e.target.checked; savePrefs(); draw(); };
    const b = $(".more button", wrap);
    if (b) b.onclick = () => { shown += 300; draw(); };
  };
  draw();
  return wrap;
}

/* ---------------- views ---------------- */
function searchSongs(q) {
  const nq = norm(q);
  if (!nq) return [];
  const starts = [], inTitle = [], inLyrics = [];
  for (const s of SONGS) {
    if (s._title.startsWith(nq)) starts.push(s);
    else if (s._title.includes(nq)) inTitle.push(s);
    else if (s._lyrics.includes(nq)) inLyrics.push(s);
  }
  return starts.concat(inTitle, inLyrics);
}

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
      body.append(songList(res));
    } else renderListen(body);
  };
  input.addEventListener("input", run);
  run();
}

function renderListen(body) {
  const season = currentSeason();
  const seasonSongs = SONGS.filter((s) => s.season === season && hasRec(s)).length;
  const moodRec = (m) => SONGS.filter((s) => hasRec(s) && (s.moods || []).includes(m)).length;
  const popular = SONGS.filter((s) => s.pop).sort((a, b) => a.pop - b.pop);
  const popRec = popular.filter(hasRec);
  const totalRec = SONGS.filter(hasRec).length;
  body.innerHTML = `
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

function renderList(kind, value) {
  if (!KINDS[kind] || !KINDS[kind].get) return renderBrowse("popular");
  const list = SONGS.filter((s) => KINDS[kind].get(s).includes(value));
  const playable = ["mood", "parjay", "season", "raag"].includes(kind) && list.some(hasRec);
  view.innerHTML = `<p class="crumb"><a href="#/browse/${kind}">${KINDS[kind].label}</a></p>
    <div class="list-head"><h1>${esc(value)}${kind === "season" ? ` <span class="bn">${SEASON_BN[value] || ""}</span>` : ""}</h1>
    <span class="n">${plural(list.length, "song")}</span>
    ${kind === "mood" ? `<span class="hint">${esc(META.moods[value] || "")}</span>` : ""}
    ${playable ? `<button class="btn small primary" type="button" id="play-list">▶ Play in jukebox</button>` : ""}</div>`;
  view.append(songList(list));
  if (playable) $("#play-list").onclick = () => playFiltered(kind, value);
}

function renderSong(id) {
  const s = BY_ID.get(id);
  if (!s) { view.innerHTML = `<p>Song not found. <a href="#/">Back to Listen</a></p>`; return; }
  const chip = (kind, v) => `<a class="chip" href="#/list/${kind}/${enc(v)}">${esc(v)}</a>`;
  const facts = [
    ["Parjay", s.parjay && chip("parjay", s.parjay) + (s.sub ? ` <span class="hint">${esc(s.sub)}</span>` : "")],
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
      </div>
      <dl class="facts">${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      ${s.lyrics ? `<pre class="lyrics bn" id="lyrics">${esc(s.lyrics)}</pre>` : `<p class="novideo">Bengali lyrics are not available here.</p>`}
      <p class="src">${fromGb
        ? `English transliteration, notation and background: <a href="${esc(s.source)}" target="_blank" rel="noopener">geetabitan.com</a>`
        : `Source: <a href="${esc(s.source)}" target="_blank" rel="noopener">Bengali Wikisource</a>`}</p>
    </div>
    <section class="videos" aria-label="Recordings"><h2>Recordings</h2>${vids}</section>
  </article>`;
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

function sessionGet(k) { try { return sessionStorage.getItem("gitabitan." + k) || ""; } catch { return ""; } }
function sessionSet(k, v) { try { sessionStorage.setItem("gitabitan." + k, v); } catch { /* ignore */ } }

/* ---------------- jukebox ---------------- */
const jb = (() => {
  const F = prefs.filters;
  let player = null, apiLoading = null, current = null, upNext = null, errors = 0;
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
    const s = pickSong(current ? [current.song.id] : []);
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

  async function playItem(item) {
    current = item;
    prefs.recent.push(item.song.id); prefs.recent = prefs.recent.slice(-200); savePrefs();
    showNow(); planNext();
    await loadApi();
    $("#jb-empty").hidden = true;
    if (!player) {
      player = new YT.Player("yt-player", {
        videoId: item.video.id, host: "https://www.youtube-nocookie.com",
        playerVars: { autoplay: 1, rel: 0, playsinline: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) next();
            if (e.data === YT.PlayerState.PLAYING) errors = 0;
            updateButtons();
          },
          onError: () => { if (++errors < 5) next(); }, // unembeddable or removed video: move on
        },
      });
    } else player.loadVideoById(item.video.id);
    updateButtons();
  }

  function next() {
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
    playItem(item); // runs planNext synchronously before its first await
    if (back) {     // after going back, "next" returns to the song we just left
      upNext = back;
      $("#jb-next").innerHTML = `Up next: <a href="#/song/${enc(back.song.id)}">${esc(title(back.song))}</a>`;
    }
  }
  function start() {
    if (current && player) { player.playVideo(); return; }
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
      <p class="hint">${esc(current.video.t)} — ${esc(current.video.ch)}</p>`;
    $("#jb-lyrics").innerHTML = s.lyrics
      ? `<pre class="lyrics bn">${esc(s.lyrics)}</pre>` : "";
  }

  const playing = () => !!(player && player.getPlayerState && player.getPlayerState() === 1);
  function updateButtons() {
    const on = !!current, n = pool().length;
    $("#jb-skip").disabled = !on || !n; $("#jb-like").disabled = !on; $("#jb-never").disabled = !on;
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
  function filtersChanged() {
    savePrefs(); updateCounts(); planNext();
    if (!current) showEmpty(); else updateButtons();
  }
  function clearFilters() { Object.assign(F, { ...EMPTY_FILTERS, moods: [], parjays: [], seasons: [] }); filtersChanged(); }
  function setFilter(kind, value) {
    Object.assign(F, { ...EMPTY_FILTERS, moods: [], parjays: [], seasons: [] });
    if (kind === "mood") F.moods = [value];
    if (kind === "parjay") F.parjays = [value];
    if (kind === "season") F.seasons = [value];
    if (kind === "raag") F.raag = value;
    filtersChanged();
  }

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
    if (SONGS.length) { updateCounts(); updateButtons(); }
  }

  function togglePlay() { if (!current || !player) return next(); playing() ? player.pauseVideo() : player.playVideo(); }
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
  }

  return { init, start, setFilter, prefsChanged, updateMini, pause: () => { try { player && player.pauseVideo(); } catch { /* not ready */ } } };
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
  else if (page === "list") renderList(parts[1], parts.slice(2).join("/"));
  else renderHome();
  if (page !== "home") { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
}

fetch("songs.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
  META = d.meta; SONGS = d.songs;
  for (const s of SONGS) {
    BY_ID.set(s.id, s);
    s._title = norm([s.bn, s.en, s.alias, s.id.replace(/-/g, " ")].join(" "));
    s._lyrics = norm(s.lyrics);
  }
  jb.init();
  window.addEventListener("hashchange", route);
  route();
}).catch((e) => {
  view.innerHTML = `<p>Couldn't load songs.json (${esc(e.message)}). Serve this folder over HTTP, e.g. <code>python3 -m http.server</code> inside <code>docs/</code>.</p>`;
});
