/* আনন্দধারা Anandadhara: hash-routed static app over songs.json. No build step.
   Design "রবির রং" (Tagore's palette): see design/README.md. Bengali UI by default, English via the switch;
   song titles and lyrics are always Bengali. Playback: YouTube IFrame API in the jukebox, which stays in the page
   on every route; a persistent player bar elsewhere. Optional Google sign-in (sync.js) keeps likes, settings and
   the resume point in the account. */
"use strict";

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enc = encodeURIComponent;
const view = $("#view");

let SONGS = [], BY_ID = new Map(), META = {};

/* ---------------- language ---------------- */
const LANG_KEY = "anandadhara.lang", THEME_KEY = "anandadhara.theme";
let L = (() => { try { const l = localStorage.getItem(LANG_KEY); return l === "en" || l === "bn" ? l : "bn"; } catch { return "bn"; } })();
const BD = "০১২৩৪৫৬৭৮৯";
const num = (n) => L === "bn" ? String(n).replace(/\d/g, (d) => BD[d]) : String(n);
const unnum = (s) => String(s || "").replace(/[০-৯]/g, (d) => String(BD.indexOf(d)));
const T = {
  bn: {
    listen: "শুনুন", browse: "খুঁজুন", jukebox: "জুকবক্স", mine: "আমার", search: "খোঁজ", searchPh: "গানের নাম বা একটি পঙ্‌ক্তি…", loading: "গান আসছে…",
    feelH: "মন কেমন আছে?", feelHint: "নিজের কথায় লিখুন, বাংলায় বা English-এ — গানের তালিকা তৈরি হবে",
    feelPh: "যেমন: বৃষ্টির দিনে মন খারাপ · missing my mother · পরীক্ষার আগে সাহস চাই", makeList: "আমার তালিকা বানাও", songsN: "গান:", nSongs: "কতটি গান",
    recognised: "যে কথা বুঝলাম:", modelReads: "ভাষা-মডেল আপনার কথা বুঝছে:", notFound: "এই কথায় কোনো ভাব খুঁজে পাইনি। নীচের ভাব থেকে বেছে নিন, বা লিখুন যেমন একা, খুশি, বৃষ্টি, প্রার্থনা, উৎসব।",
    playList: "এই তালিকা বাজাও", anotherMix: "অন্য রকম", noFit: "এই ভাবের গানের রেকর্ডিং এখনও নেই; প্রতিদিন নতুন যোগ হয়।",
    modelWait: "আপনার কথা বোঝা হচ্ছে… (প্রথমবার ১১৮ MB-র একটি ভাষা-মডেল একবার নামে; এটি শুধু আপনার ব্রাউজারেই চলে)", modelFail: "ভাষা-মডেল আনা গেল না, তাই শুধু শব্দমিল দিয়ে এই তালিকা।",
    listenNow: "এখন শুনুন", ofSongs: (a, b) => `${num(b)}টি গানের ${num(a)}টির রেকর্ডিং আছে · প্রতিদিন বাড়ছে`,
    seasonNow: (s) => `এখন ${s}`, playSeason: (s) => `${s}ের গান বাজাও`, seasonSongs: (n) => `ঋতুর ${num(n)}টি গান তৈরি`, seasonSoon: "এই ঋতুর রেকর্ডিং আসছে",
    moods: "ভাব অনুসারে", wellKnown: "সুপরিচিত গান", all: (n) => `সব ${num(n)}`, exploreAll: (n) => `${num(n)}টি গান ঘুরে দেখুন`, sotd: "আজকের গান", lyricsBtn: "গানের কথা",
    byParjay: "পর্যায়", bySeason: "ঋতু", byMood: "ভাব", byRaag: "রাগ", byTaal: "তাল", byDrama: "নৃত্যনাট্য", bySinger: "শিল্পী", byAz: "বর্ণানুক্রমে", popular: "সুপরিচিত", comingSoon: "শিগগির",
    popularHint: "যে গান বেশি মানুষ চেনেন, হাতে বাছা; এদের রেকর্ডিং আগে খোঁজা হয়।", azHint: (n) => `সব ${num(n)}টি গান, English নামের বর্ণানুক্রমে।`,
    songsCount: (n) => `${num(n)}টি গান`, recN: (n) => `${num(n)}টি রেকর্ডিং`, recOnly: (a, b) => `শুধু রেকর্ডিং-সহ (${num(a)} / ${num(b)})`, withRec: "রেকর্ডিং-সহ",
    showMore: (n) => `আরও ${num(n)}টি`, noRec: "রেকর্ডিং আসছে", noneHere: "এখানে রেকর্ডিং-সহ গান এখনও নেই। প্রতিদিন নতুন যোগ হয়।",
    notYet: (pop) => `এই গানের রেকর্ডিং এখনও খোঁজা হয়নি। প্রতিদিন নতুন গান যোগ হয়${pop ? ", সুপরিচিত গান আগে" : ""}।`,
    noMatch: "ইউটিউবে মেলানো রেকর্ডিং পাওয়া যায়নি।", recordings: "রেকর্ডিং", moreLike: "এমন আরও গান", moreLikeHint: "এই গানের ভাব, রাগ, উপ-পর্যায় বা ঋতু যাদের মিল",
    playLike: "এমন গান বাজাও", playLikeT: (n) => `${num(n)}টি রেকর্ডিং-সহ গানের ভাব এর মতো`, playLikeNone: "এর ভাবের গানের রেকর্ডিং এখনও নেই",
    like: "পছন্দ", liked: "পছন্দ হয়েছে", likeT: "পছন্দের গান জুকবক্সে ৪ গুণ বেশি বাজে", never: "জুকবক্সে বাজাবে না", nevered: "জুকবক্স থেকে সরানো", neverT: "এই গান জুকবক্সে আর বাজবে না",
    askAi: "AI-কে জিজ্ঞাসা: অর্থ", askAiT: "ChatGPT নতুন ট্যাবে খোলে, গানের কথা ও অর্থের প্রশ্ন সমেত", openYt: "YouTube-এ খুলুন", openYtT: "এই রেকর্ডিং youtube.com-এ (প্রিমিয়াম থাকলে বিজ্ঞাপন ছাড়া)",
    views: "বার দেখা", singer: "শিল্পী", unknownSinger: "শিল্পী চিহ্নিত হয়নি", by: "গেয়েছেন",
    parjay: "পর্যায়", season: "ঋতু", drama: "নাট্য", raag: "রাগ", taal: "তাল", mood: "ভাব", written: "রচনা", source: "সূত্র", lyricsNA: "বাংলা কথা এখানে নেই।",
    srcGb: "English transliteration, স্বরলিপি ও প্রসঙ্গ:", srcWs: "বাংলা উইকিসংকলন", notFoundSong: "গানটি পাওয়া গেল না।", backHome: "প্রথম পাতায়",
    play: "বাজাও", pause: "থামাও", resume: "আবার", next: "পরের গান", prev: "আগের গান", upNext: "এরপর", nowPlaying: "বাজছে", nothingPlaying: "এখনও কিছু বাজছে না।",
    pressPlay: "আপনার ছাঁকনি-মেলা গানের এলোমেলো তালিকা শুনতে ▶ চাপুন", noPool: "এই ছাঁকনিতে রেকর্ডিং-সহ গান নেই। একটি ছাঁকনি সরান বা সব মুছুন।",
    filters: "ছাঁকনি", done: "হল", clearAll: "সব মুছুন", allRec: "রেকর্ডিং-সহ সব গান", toPlay: (n) => `${num(n)}টি গান বাজবে`, removeFilter: (l) => `ছাঁকনি সরান: ${l}`,
    likedOnly: "শুধু পছন্দের গান", anyRaag: "যেকোনো রাগ", anySinger: "যেকোনো শিল্পী", typeFind: "লিখে খুঁজুন…", seekAria: "গানের কোথায় আছেন",
    inSelection: "এই নির্বাচনের গান", yourPlaylist: "আপনার তালিকা", forMood: "আপনার মনের জন্য", thenMore: "তারপর এমন আরও", showAll: (n) => `সব ${num(n)}টি দেখান`, showFewer: "কম দেখান",
    mineH: "আমার গান", likedSongs: "পছন্দের গান", hiddenSongs: "জুকবক্স থেকে সরানো", recentH: "সম্প্রতি শোনা", noneLiked: "এখনও কিছু পছন্দ করেননি",
    noneLikedHint: "যেকোনো গানে ♥ চাপলে এখানে জমা হবে। পছন্দের গান জুকবক্সে ৪ গুণ বেশি বাজে।", none: "কিছু নেই", remove: "সরান", allowAgain: "আবার বাজাতে দিন", playAll: "সবগুলো বাজাও",
    localOnly: "শুধু এই ব্রাউজারে রাখা। সব যন্ত্রে পেতে Google দিয়ে সাইন ইন করুন।", syncNote: "আপনার পছন্দ, সেটিংস আর যেখানে থেমেছিলেন সব আপনার অ্যাকাউন্টে থাকে, তাই অন্য যন্ত্রেও পাবেন।",
    welcome: "আবার স্বাগত", resumePlaying: (w, at) => `যেখানে থেমেছিলেন সেখান থেকে শুরু করবেন? আপনি শুনছিলেন ${w}, ${at}-এ।`, resumePage: (w) => `যেখানে ছিলেন সেখান থেকে শুরু করবেন? আপনি ছিলেন ${w} পাতায়।`,
    resumeYes: "যেখানে ছিলাম সেখান থেকে", resumeNo: "না, প্রথম পাতায় যাই",
    account: "আপনার অ্যাকাউন্ট", signIn: "Google দিয়ে সাইন ইন", signInShort: "সাইন ইন", signOut: "সাইন আউট", notSignedIn: "সাইন ইন করা নেই", deleteData: "অ্যাকাউন্টে রাখা তথ্য মুছুন",
    deleteConfirm: "অ্যাকাউন্টে রাখা সব কিছু (পছন্দ, সেটিংস, থামার জায়গা) মুছে সাইন আউট করবেন? এই ব্রাউজারের নিজের কপি থাকবে।",
    syncError: (m) => `অ্যাকাউন্টের সঙ্গে যোগাযোগ করা গেল না (${m})। সব কিছু এই ব্রাউজারে রাখা আছে।`, syncedAt: (tm) => `অ্যাকাউন্টে রাখা হয়েছে ${tm}-এ`,
    premiumMenu: "বিজ্ঞাপন ছাড়া দেখুন (ইউটিউব প্রিমিয়াম থাকলে)",
    premiumNote: "সাইন ইন থাকলে নিজে থেকেই চালু: সাধারণ ইউটিউব প্লেয়ার আপনার ইউটিউব সাইন-ইন চেনে, তাই ইউটিউব প্রিমিয়াম থাকলে বিজ্ঞাপন দেখাবে না (প্রিমিয়াম না থাকলে কিছু বদলায় না)। বাজানোর সময় ইউটিউব তাদের কুকি রাখতে পারে। তবুও বিজ্ঞাপন দেখালে বুঝবেন আপনার ব্রাউজার অন্য সাইটের ভেতরে ইউটিউবের কুকি আটকাচ্ছে।",
    theme: "রাত / দিন", switchTo: "English", switchLabel: "Switch to English", found: (n) => `${num(n)}টি গান পাওয়া গেল`, nothingFound: "কিছু পাওয়া যায়নি",
    subAll: "সব", home: "প্রথম পাতা", toastLiked: "পছন্দে রাখা হল", toastUnliked: "পছন্দ থেকে সরানো হল", toastNever: "এই গান জুকবক্সে আর বাজবে না", toastAllowed: "আবার বাজবে",
    footer1: 'গানের তথ্য <a href="https://www.geetabitan.com" target="_blank" rel="noopener">geetabitan.com</a> ও <a href="https://bn.wikisource.org/wiki/গীতবিতান" target="_blank" rel="noopener">বাংলা উইকিসংকলন</a> থেকে। রেকর্ডিং YouTube থেকে বাজে। ব্যক্তিগত, অবাণিজ্যিক প্রকল্প।',
    footer2: 'এই সাইট YouTube API Services ব্যবহার করে: <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">ইউটিউবের শর্তাবলি</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">গুগলের গোপনীয়তা নীতি</a> · <a href="privacy.html">গোপনীয়তা</a> · <a href="terms.html">শর্তাবলি ও ছবির কৃতজ্ঞতা</a> · যোগাযোগ: <a href="mailto:smaju1978@gmail.com">smaju1978@gmail.com</a>',
    loadError: (e) => `songs.json আনা গেল না (${e})। ফোল্ডারটি HTTP দিয়ে চালান, যেমন docs/-এর ভেতরে python3 -m http.server।`, retry: "আবার চেষ্টা",
    title: "আনন্দধারা · রবীন্দ্রসংগীত", paintingAlt: "রবীন্দ্রনাথের আঁকা ছবি",
  },
  en: {
    listen: "Listen", browse: "Browse", jukebox: "Jukebox", mine: "Mine", search: "Search", searchPh: "Search by title or a line of lyrics…", loading: "Loading songs…",
    feelH: "How are you feeling?", feelHint: "Say it in your own words, in English or বাংলা, and get a playlist",
    feelPh: "e.g. missing my mother on a rainy evening · বৃষ্টির দিনে মন খারাপ · need courage before an exam", makeList: "Make my playlist", songsN: "Songs:", nSongs: "Number of songs",
    recognised: "Words I recognised:", modelReads: "The language model reads your words as:", notFound: "I couldn't find a feeling in those words. Choose one or more moods below, or try words like lonely, happy, missing someone, rain, prayer, celebration.",
    playList: "Play this playlist", anotherMix: "Another mix", noFit: "No songs with recordings fit these moods yet; more are added every day.",
    modelWait: "Understanding your words… (the first time, a 118 MB language model downloads once; it runs only in your browser)", modelFail: "Couldn't load the language model, so this is based on word matching only.",
    listenNow: "Listen now", ofSongs: (a, b) => `${a} of ${b} songs have recordings · more every day`,
    seasonNow: (s) => `It's ${s} now`, playSeason: (s) => `Play ${s} songs`, seasonSongs: (n) => `${n} songs of the season ready`, seasonSoon: "Recordings for this season are on their way",
    moods: "By mood", wellKnown: "Well-known songs", all: (n) => `All ${n}`, exploreAll: (n) => `Explore all ${n} songs`, sotd: "Song of the day", lyricsBtn: "Lyrics",
    byParjay: "Parjay", bySeason: "Season", byMood: "Mood", byRaag: "Raag", byTaal: "Taal", byDrama: "Dance drama", bySinger: "Singer", byAz: "A–Z", popular: "Well-known", comingSoon: "coming soon",
    popularHint: "Songs most people know, chosen by hand. Their recordings are fetched first.", azHint: (n) => `All ${n} songs, alphabetical by English title.`,
    songsCount: (n) => `${n} song${n === 1 ? "" : "s"}`, recN: (n) => `${n} recording${n === 1 ? "" : "s"}`, recOnly: (a, b) => `Only songs with recordings (${a} of ${b})`, withRec: "with recordings",
    showMore: (n) => `Show ${n} more`, noRec: "Recordings coming soon", noneHere: "No songs with recordings here yet. They are added every day.",
    notYet: (pop) => `Recordings for this song haven't been fetched yet. They are added every day${pop ? ", well-known songs first" : ""}.`,
    noMatch: "No matching recording was found on YouTube.", recordings: "Recordings", moreLike: "More like this", moreLikeHint: "Songs that share this one's mood, raag, sub-group or season",
    playLike: "Play songs like this", playLikeT: (n) => `${n} songs with recordings share its mood`, playLikeNone: "No songs with recordings share its mood yet",
    like: "Like", liked: "Liked", likeT: "Liked songs come up 4× as often in the jukebox", never: "Never play in jukebox", nevered: "Hidden from jukebox", neverT: "Never play this song in the jukebox",
    askAi: "Ask AI: meaning", askAiT: "Opens ChatGPT in a new tab with this song's lyrics and a question about its meaning", openYt: "Open in YouTube", openYtT: "This recording on youtube.com (ad-free with Premium)",
    views: "views", singer: "Singer", unknownSinger: "singer not identified", by: "Sung by",
    parjay: "Parjay", season: "Season", drama: "Drama", raag: "Raag", taal: "Taal", mood: "Mood", written: "Written", source: "Source", lyricsNA: "Bengali lyrics are not available here.",
    srcGb: "English transliteration, notation and background:", srcWs: "Bengali Wikisource", notFoundSong: "Song not found.", backHome: "Back to Listen",
    play: "Play", pause: "Pause", resume: "Resume", next: "Next song", prev: "Previous song", upNext: "Up next", nowPlaying: "Now playing", nothingPlaying: "Nothing playing yet.",
    pressPlay: "Press ▶ for a shuffle of songs that match your filters", noPool: "No songs with recordings match these filters yet. Remove a filter or clear them all.",
    filters: "Filters", done: "Done", clearAll: "Clear all", allRec: "All songs with recordings", toPlay: (n) => `${n} songs to play`, removeFilter: (l) => `Remove filter ${l}`,
    likedOnly: "Only liked songs", anyRaag: "Any raag", anySinger: "Any singer", typeFind: "Type to find…", seekAria: "Position in the song",
    inSelection: "Songs in this selection", yourPlaylist: "Your playlist", forMood: "for your mood", thenMore: "then more like these", showAll: (n) => `Show all ${n}`, showFewer: "Show fewer",
    mineH: "Mine", likedSongs: "Liked songs", hiddenSongs: "Hidden from jukebox", recentH: "Recently played", noneLiked: "Nothing liked yet",
    noneLikedHint: "Press ♥ on any song and it collects here. Liked songs come up 4× as often in the jukebox.", none: "None", remove: "Remove", allowAgain: "Allow again", playAll: "Play all",
    localOnly: "Saved in this browser only. Sign in with Google to keep them on every device.", syncNote: "Your likes, settings and where you left off are kept in your account, so they follow you to your other devices.",
    welcome: "Welcome back", resumePlaying: (w, at) => `Continue where you left off? You were listening to ${w}, at ${at}.`, resumePage: (w) => `Continue where you left off? You were on ${w}.`,
    resumeYes: "Continue", resumeNo: "No, go to the home page",
    account: "Your account", signIn: "Sign in with Google", signInShort: "Sign in", signOut: "Sign out", notSignedIn: "Not signed in", deleteData: "Delete my saved data",
    deleteConfirm: "Delete everything saved in your account (likes, settings, resume point) and sign out? This browser keeps its own copy.",
    syncError: (m) => `Couldn't reach your account (${m}). Everything is still saved in this browser.`, syncedAt: (tm) => `Saved to your account at ${tm}`,
    premiumMenu: "Watch without ads (if you have YouTube Premium)",
    premiumNote: "On automatically while you're signed in: the standard YouTube player recognises your YouTube sign-in, so with YouTube Premium there are no ads (without Premium nothing changes). YouTube can set its cookies when you play. If ads still appear, your browser is blocking YouTube's cookies inside other sites.",
    theme: "Night / day", switchTo: "বাংলা", switchLabel: "বাংলায় দেখুন", found: (n) => `${n} songs found`, nothingFound: "Nothing found",
    subAll: "All", home: "Home", toastLiked: "Added to likes", toastUnliked: "Removed from likes", toastNever: "Will never play in the jukebox", toastAllowed: "Will play again",
    footer1: 'Song data from <a href="https://www.geetabitan.com" target="_blank" rel="noopener">geetabitan.com</a> and <a href="https://bn.wikisource.org/wiki/গীতবিতান" target="_blank" rel="noopener">বাংলা উইকিসংকলন</a>. Recordings play from YouTube. Personal, non-commercial project.',
    footer2: 'This site uses YouTube API Services: <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube Terms of Service</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google Privacy Policy</a> · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms &amp; image credits</a> · Contact: <a href="mailto:smaju1978@gmail.com">smaju1978@gmail.com</a>',
    loadError: (e) => `Couldn't load songs.json (${e}). Serve this folder over HTTP, e.g. python3 -m http.server inside docs/.`, retry: "Try again",
    title: "Anandadhara · Rabindrasangeet", paintingAlt: "Painting by Rabindranath Tagore",
  },
};
const t = (k, ...a) => { const v = T[L][k] ?? T.en[k] ?? k; return typeof v === "function" ? v(...a) : v; };

/* Bengali names for data values (the data keeps its English keys) */
const MOOD_BN = { prem: "প্রেম", viraha: "বিরহ", bishad: "বিষাদ", ananda: "আনন্দ", shanti: "শান্তি", bhakti: "ভক্তি", "prakriti-bhava": "প্রকৃতি", utsav: "উৎসব", deshprem: "দেশপ্রেম", sahas: "সাহস", smriti: "স্মৃতি", kautuk: "কৌতুক" };
const MOOD_DESC_BN = { prem: "প্রেম, মিলন, কোমলতা", viraha: "বিরহ, প্রতীক্ষা, দূরের জন", bishad: "দুঃখ, শোক, হতাশা", ananda: "আনন্দ, উল্লাস", shanti: "শান্তি, স্থৈর্য, সান্ত্বনা", bhakti: "ভক্তি, প্রার্থনা, সমর্পণ", "prakriti-bhava": "প্রকৃতি: বৃষ্টি, বসন্ত, আকাশ", utsav: "উৎসব, অনুষ্ঠান", deshprem: "স্বদেশপ্রেম", sahas: "সাহস, সংকল্প, জাগরণ", smriti: "স্মৃতি, ফেলে আসা দিন", kautuk: "কৌতুক, হাসি, খেলা" };
const PARJAY_BN = { Puja: "পূজা", Prem: "প্রেম", Prakriti: "প্রকৃতি", Swadesh: "স্বদেশ", Bichitra: "বিচিত্র", Anushthanik: "আনুষ্ঠানিক", "Geetinatya O Nrityanatya": "গীতিনাট্য ও নৃত্যনাট্য", Natyageeti: "নাট্যগীতি", "Prem O Prakriti": "প্রেম ও প্রকৃতি", "Puja O Prarthana": "পূজা ও প্রার্থনা", "Bhanusingher Padabali": "ভানুসিংহের পদাবলী", "Anushthanik Sangeet": "আনুষ্ঠানিক সংগীত", "Jatiya Sangeet": "জাতীয় সংগীত", "Mantra Gaan": "মন্ত্র গান", Parishishta: "পরিশিষ্ট", Unclassified: "অশ্রেণীবদ্ধ" };
const SUB_BN = { Borsha: "বর্ষা", Basanta: "বসন্ত", Sharat: "শরৎ", Grisma: "গ্রীষ্ম", Hemanta: "হেমন্ত", Sheet: "শীত", Bondhu: "বন্ধু", Biraha: "বিরহ", Dukkha: "দুঃখ", Prarthana: "প্রার্থনা", "Prem-Boichitra": "প্রেম-বৈচিত্র্য", Bibidha: "বিবিধ", Gaan: "গান", Bishwa: "বিশ্ব", Shesh: "শেষ", Sundar: "সুন্দর", Jaagoron: "জাগরণ", Aanondo: "আনন্দ", Poth: "পথ", "Saadhana O Sankalpa": "সাধনা ও সংকল্প", Baul: "বাউল", Antarmukhe: "অন্তর্মুখে", Bairagya: "বৈরাগ্য", Utsab: "উৎসব", Sadhak: "সাধক", Nishkromon: "নিষ্ক্রমণ" };
const RAAG_BN = { Bhairavi: "ভৈরবী", Iman: "ইমন", Pilu: "পিলু", Behag: "বেহাগ", Khambaj: "খাম্বাজ", Kafi: "কাফি", Desh: "দেশ", Ramkeli: "রামকেলি", Kedara: "কেদারা", Kalingara: "কালাংড়া", Bahar: "বাহার", Malhar: "মল্লার", Baul: "বাউল", Kirtan: "কীর্তন", Bhimpalashri: "ভীমপলশ্রী", Jogiya: "যোগিয়া", Sahana: "সাহানা", Bhupali: "ভূপালী", Purabi: "পুরবী", Ashavari: "আশাবরী", Gaud: "গৌড়", Sindhu: "সিন্ধু", Mishra: "মিশ্র", Todi: "টোড়ি", Lalit: "ললিত", Bibhas: "বিভাস", Chhayanat: "ছায়ানট", Hambir: "হাম্বীর", Multani: "মুলতান", Paraj: "পরজ", Basant: "বসন্ত", Sarang: "সারং", Durga: "দুর্গা", Kanada: "কানাড়া", Kalyan: "কল্যাণ", Jhinjhit: "ঝিঁঝিট", Bageshri: "বাগেশ্রী", Bhatiyali: "ভাটিয়ালি", Tilakkamod: "তিলককামোদ", Megh: "মেঘ", Nat: "নট", Sohini: "সোহিনী", Suha: "সুহা", Barowa: "বারোয়াঁ" };
const TAAL_BN = { Dadra: "দাদরা", Kaharba: "কাহারবা", Teora: "তেওরা", Jhaptal: "ঝাঁপতাল", Ektal: "একতাল", Tritaal: "ত্রিতাল", Trital: "ত্রিতাল", Rupak: "রূপক", Shasthi: "ষষ্ঠী", Jhampak: "ঝম্পক", Nabatal: "নবতাল", Ekadashi: "একাদশী", Surfanktal: "সুরফাঁকতাল", Chautal: "চৌতাল", Dhamar: "ধামার", Aratal: "আড়াতাল", Khemta: "খেমটা", "Nabo Panchatal": "নবপঞ্চতাল" };
const SINGER_BN = { "Jayati Chakraborty": "জয়তী চক্রবর্তী", "Rezwana Choudhury Bannya": "রেজওয়ানা চৌধুরী বন্যা", "Swagatalakshmi Dasgupta": "স্বাগতালক্ষ্মী দাশগুপ্ত", "Hemanta Mukherjee": "হেমন্ত মুখোপাধ্যায়", "Srikanto Acharya": "শ্রীকান্ত আচার্য", "Suchitra Mitra": "সুচিত্রা মিত্র", "Debabrata Biswas": "দেবব্রত বিশ্বাস", "Srabani Sen": "শ্রাবণী সেন", "Adity Mohsin": "অদিতি মহসিন", "Indrani Sen": "ইন্দ্রাণী সেন", "Kanika Bandyopadhyay": "কণিকা বন্দ্যোপাধ্যায়", "Lopamudra Mitra": "লোপামুদ্রা মিত্র", "Sagar Sen": "সাগর সেন", "Chinmoy Chatterjee": "চিন্ময় চট্টোপাধ্যায়", "Iman Chakraborty": "ইমন চক্রবর্তী", "Somlata Acharyya Chowdhury": "সোমলতা আচার্য চৌধুরী", "Sumitra Sen": "সুমিত্রা সেন", Shaan: "শান", "Subinoy Roy": "সুবিনয় রায়", "Kishore Kumar": "কিশোর কুমার", "Sahana Bajpaie": "সাহানা বাজপেয়ী", "Shreya Ghoshal": "শ্রেয়া ঘোষাল", "Arijit Singh": "অরিজিৎ সিং", "Manna Dey": "মান্না দে", "Sandhya Mukherjee": "সন্ধ্যা মুখোপাধ্যায়", "Pankaj Mullick": "পঙ্কজ মল্লিক", "Rupankar Bagchi": "রূপঙ্কর বাগচী", "Babul Supriyo": "বাবুল সুপ্রিয়", "Ritu Guha": "ঋতু গুহ", "Purba Dam": "পূর্বা দাম", "Shyamal Mitra": "শ্যামল মিত্র", "Mohan Singh": "মোহন সিং", "Pramita Mallick": "প্রমিতা মল্লিক", "Manoj Murali Nair": "মনোজ মুরলী নায়ার", "Papia Sarwar": "পাপিয়া সারোয়ার", "Mita Huq": "মিতা হক", "Sadi Mohammad": "সাদী মহম্মদ", "Rajeshwari Dutta": "রাজেশ্বরী দত্ত", "Bikram Singh": "বিক্রম সিং", "Ashoktaru Bandyopadhyay": "অশোকতরু বন্দ্যোপাধ্যায়", "Anup Ghoshal": "অনুপ ঘোষাল", "Kalika Prasad Bhattacharya": "কালিকাপ্রসাদ ভট্টাচার্য", "Susmita Patra": "সুস্মিতা পাত্র", "Shubhamita Banerjee": "শুভমিতা বন্দ্যোপাধ্যায়", "Sreeradha Bandyopadhyay": "শ্রীরাধা বন্দ্যোপাধ্যায়", "Asha Bhosle": "আশা ভোঁসলে", "Hemanth Kumar": "হেমন্ত কুমার", "Kamalini Mukherji": "কমলিনী মুখোপাধ্যায়", "Pijushkanti Sarkar": "পীযূষকান্তি সরকার", "Agnibha Bandyopadhyay": "অগ্নিভ বন্দ্যোপাধ্যায়", "Alka Yagnik": "অলকা ইয়াগনিক", "Monali Thakur": "মোনালি ঠাকুর", "Anwesha": "অন্বেষা", "Anasuya Mukherjee": "অনসূয়া মুখোপাধ্যায়" };
const SEASON_ORDER = ["Grishma", "Barsha", "Sharat", "Hemanta", "Sheet", "Basanta"];
const SEASONS = {
  Grishma: { bn: "গ্রীষ্ম", months: "বৈশাখ–জ্যৈষ্ঠ", monthsEn: "Baishakh–Jaishtha", note: "দাবদাহ, ঝড়, কৃষ্ণচূড়া", noteEn: "heat, nor'westers, krishnachura" },
  Barsha: { bn: "বর্ষা", months: "আষাঢ়–শ্রাবণ", monthsEn: "Asharh–Shraban", note: "মেঘ, বৃষ্টি, কদম ফুল", noteEn: "clouds, rain, kadam flowers" },
  Sharat: { bn: "শরৎ", months: "ভাদ্র–আশ্বিন", monthsEn: "Bhadra–Ashwin", note: "কাশফুল, নীল আকাশ, শিউলি", noteEn: "kash grass, blue sky, shiuli" },
  Hemanta: { bn: "হেমন্ত", months: "কার্তিক–অগ্রহায়ণ", monthsEn: "Kartik–Agrahayan", note: "পাকা ধান, কুয়াশা, নবান্ন", noteEn: "ripe paddy, mist, nabanna" },
  Sheet: { bn: "শীত", months: "পৌষ–মাঘ", monthsEn: "Poush–Magh", note: "কুয়াশা, সর্ষেখেত, পৌষমেলা", noteEn: "fog, mustard fields, Poush Mela" },
  Basanta: { bn: "বসন্ত", months: "ফাল্গুন–চৈত্র", monthsEn: "Falgun–Chaitra", note: "পলাশ, আবির, কোকিল", noteEn: "palash, abir, the cuckoo" },
};
const SEASON_BN = Object.fromEntries(Object.entries(SEASONS).map(([k, s]) => [k, s.bn]));
const nameOf = (kind, v) => {
  if (!v) return "";
  if (L !== "bn") return v;
  const m = { mood: MOOD_BN, parjay: PARJAY_BN, sub: SUB_BN, raag: RAAG_BN, taal: TAAL_BN, singer: SINGER_BN, season: SEASON_BN }[kind];
  return (m && m[v]) || v;
};
const moodDesc = (m) => L === "bn" ? MOOD_DESC_BN[m] || "" : (META.moods || {})[m] || "";
const seasonName = (k) => L === "bn" ? SEASONS[k].bn : k;

/* Bengali calendar (approximate: fixed Gregorian month starts, the same cut-offs as the seasons) */
const BN_MONTHS = [["Baishakh", "বৈশাখ", 4, 14], ["Jaishtha", "জ্যৈষ্ঠ", 5, 15], ["Asharh", "আষাঢ়", 6, 15], ["Shraban", "শ্রাবণ", 7, 17], ["Bhadra", "ভাদ্র", 8, 17], ["Ashwin", "আশ্বিন", 9, 17], ["Kartik", "কার্তিক", 10, 18], ["Agrahayan", "অগ্রহায়ণ", 11, 17], ["Poush", "পৌষ", 12, 16], ["Magh", "মাঘ", 1, 15], ["Falgun", "ফাল্গুন", 2, 13], ["Chaitra", "চৈত্র", 3, 15]];
function bengaliDate(d = new Date()) {
  const y = d.getFullYear();
  let cur = null;
  for (const [en, bn, m, day] of BN_MONTHS) { const dt = new Date(y, m - 1, day); if (dt <= d && (!cur || dt > cur.date)) cur = { en, bn, date: dt }; }
  if (!cur) cur = { en: "Chaitra", bn: "চৈত্র", date: new Date(y - 1, 2, 15) };
  const day = Math.floor((d - cur.date) / 864e5) + 1, bnYear = d >= new Date(y, 3, 14) ? y - 593 : y - 594;
  return { day, monthEn: cur.en, monthBn: cur.bn, year: bnYear, text: L === "bn" ? `${num(day)} ${cur.bn} ${num(bnYear)}` : `${day} ${cur.en} ${bnYear}` };
}
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
const setSeasonTint = (k) => { document.documentElement.dataset.season = k; };

/* ---------------- preferences (localStorage; synced to the account when signed in) ---------------- */
const PREF_KEY = "gitabitan.prefs.v1";          // kept from the first version so existing likes survive
const SESSION_KEY = "anandadhara.session.v1";    // resume point: page, song, video, position, playlist
const EMPTY_FILTERS = { moods: [], parjays: [], seasons: [], raag: "", singer: "", likedOnly: false };
const freshFilters = () => ({ ...EMPTY_FILTERS, moods: [], parjays: [], seasons: [] });
let lastPage = "#/", holdSession = true; // the saved resume point is kept untouched until the visitor has answered the prompt
const prefs = loadPrefs();
function loadPrefs() {
  const empty = { likes: [], never: [], recent: [], recOnly: false, filters: freshFilters() };
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    return p ? { ...empty, ...p, filters: { ...freshFilters(), ...(p.filters || {}) } } : empty;
  } catch { return empty; }
}
function savePrefs() {
  prefs.updatedAt = Date.now();
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  SYNC.changed("prefs");
}
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

/* ---------------- account sync hooks (optional Google sign-in, see sync.js) ----------------
   sync.js (an ES module) fills these in when firebase-config.js has a Firebase config; without it they
   stay no-ops and everything is kept in this browser only. */
const SYNC = window.anandadharaSync = { changed: () => {}, signIn: null, user: null };
SYNC.ready = new Promise((res) => { SYNC.resolveReady = res; setTimeout(res, 4000); });
const readSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } };
SYNC.snapshot = () => ({
  prefs: { likes: prefs.likes, never: prefs.never, filters: prefs.filters, recOnly: !!prefs.recOnly, adsOptOut: !!prefs.adsOptOut, recent: prefs.recent.slice(-150) },
  prefsAt: prefs.updatedAt || 0, lang: L, session: readSession(),
});
// Merge what the account holds into this browser. The first time a browser is linked to an account, likes and
// never-play lists from both are kept; after that the newer side wins. The newer resume point always wins.
SYNC.apply = (r, firstLink) => {
  if (!r) return;
  const rp = r.prefs || {};
  if (firstLink) {
    prefs.likes = [...new Set([...(rp.likes || []), ...prefs.likes])];
    prefs.never = [...new Set([...(rp.never || []), ...prefs.never])].filter((id) => !prefs.likes.includes(id));
  }
  if ((r.prefsAt || 0) > (prefs.updatedAt || 0)) {
    if (!firstLink) { prefs.likes = rp.likes || []; prefs.never = rp.never || []; }
    Object.assign(prefs.filters, freshFilters(), rp.filters || {});
    prefs.adsOptOut = !!rp.adsOptOut; prefs.recOnly = !!rp.recOnly;
    if (rp.recent) prefs.recent = rp.recent;
    prefs.updatedAt = r.prefsAt;
    if (r.lang && r.lang !== L) setLang(r.lang, false);
  }
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
  const ls = readSession();
  if (r.session && (!ls || (r.session.at || 0) > (ls.at || 0))) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(r.session)); } catch { /* storage unavailable */ }
  }
  if (SONGS.length) jb.refresh();
};

/* ---------------- theme ---------------- */
function setTheme(th, save = true) {
  document.documentElement.dataset.theme = th;
  const meta = $('meta[name="theme-color"]'); if (meta) meta.content = th === "light" ? "#f3e9d6" : "#1b1714";
  if (save) { try { localStorage.setItem(THEME_KEY, th); } catch { /* ignore */ } }
}
$$(".theme-toggle").forEach((b) => b.onclick = () => setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light"));

let toastT;
function toast(msg) { const el = $("#toast"); el.textContent = msg; el.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("on"), 2200); }

/* ---------------- helpers ---------------- */
// "Watch without ads": YouTube offers no way for a site to check for Premium, so when someone is signed in with
// Google the standard player (which knows their YouTube sign-in, so Premium members get no ads) is used
// automatically; prefs.adsOptOut is set only if they switch it off in the account menu. Signed out: the
// privacy-enhanced player.
const noAds = () => !!SYNC.user && !prefs.adsOptOut;
const ytHost = () => noAds() ? "https://www.youtube.com" : "https://www.youtube-nocookie.com";
const ytLink = (id, at = 0) => `https://www.youtube.com/watch?v=${esc(id)}${at > 5 ? `&t=${Math.floor(at)}s` : ""}`;
const thumb = (id, q = "mq") => `https://i.ytimg.com/vi/${esc(id)}/${q}default.jpg`;
const title = (s) => s.bn || s.en || s.id;
const titleEn = (s) => s.bn && s.en ? (s.alias ? `${s.alias} · ${s.en}` : s.en) : "";
const hasRec = (s) => !!(s.videos && s.videos.length);
const singersOf = (s) => [...new Set((s.videos || []).flatMap((v) => v.singers || []))];
const singerNames = (list) => list.map((x) => nameOf("singer", x)).join(", ");
function fmtViews(n) {
  if (L === "bn") { const f = (x) => num(x >= 10 ? Math.round(x) : Math.round(x * 10) / 10); return n >= 1e7 ? `${f(n / 1e7)} কোটি` : n >= 1e5 ? `${f(n / 1e5)} লাখ` : n >= 1e3 ? `${f(n / 1e3)} হাজার` : num(n); }
  return n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n);
}
const fmtTime = (sec) => { sec = Math.max(0, Math.floor(sec || 0)); return num(sec >= 3600 ? `${Math.floor(sec / 3600)}:${String(Math.floor(sec / 60) % 60).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`); };
const norm = (s) => (s || "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
const I = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 20.5 3.9 12.4a4.6 4.6 0 0 1 6.5-6.5l1.6 1.6 1.6-1.6a4.6 4.6 0 0 1 6.5 6.5z"/></svg>',
  heartF: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 20.5 3.9 12.4a4.6 4.6 0 0 1 6.5-6.5l1.6 1.6 1.6-1.6a4.6 4.6 0 0 1 6.5 6.5z"/></svg>',
  yt: '<svg class="yt-ico" viewBox="0 0 28 20" aria-hidden="true"><path fill="#FF0000" d="M27.4 3.1A3.5 3.5 0 0 0 25 .6C22.8 0 14 0 14 0S5.2 0 3 .6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9A3.5 3.5 0 0 0 3 19.4c2.2.6 11 .6 11 .6s8.8 0 11-.6a3.5 3.5 0 0 0 2.4-2.5C28 14.7 28 10 28 10s0-4.7-.6-6.9z"/><path fill="#FFFFFF" d="M11.2 14.3 18.5 10l-7.3-4.3z"/></svg>',
  prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 5v14L9 12zM5 5h3v14H5z"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 5v14l10-7zM16 5h3v14h-3z"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  tune: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4z" fill="#4285F4"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853"/><path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" fill="#FBBC05"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" fill="#EA4335"/></svg>',
  mark: '<svg viewBox="0 0 48 48" aria-hidden="true"><use href="#mark"/></svg>',
  divider: '<div class="div-alp" aria-hidden="true"><svg viewBox="0 0 64 20"><use href="#divider"/></svg></div>',
};
const KINDS = {
  popular: { key: "popular" },
  parjay: { key: "byParjay", get: (s) => s.parjay ? [s.parjay] : [] },
  season: { key: "bySeason", get: (s) => s.season ? [s.season] : [] },
  mood: { key: "byMood", get: (s) => s.moods || [] },
  raag: { key: "byRaag", get: (s) => s.raag ? [s.raag] : [] },
  taal: { key: "byTaal", get: (s) => s.taal ? [s.taal] : [] },
  singer: { key: "bySinger", get: (s) => singersOf(s) },
  drama: { key: "byDrama", get: (s) => s.drama ? s.drama.split(", ") : [] },
  az: { key: "byAz" },
};
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
const popular = () => SONGS.filter((s) => s.pop).sort((a, b) => a.pop - b.pop);
const songHref = (s) => `#/song/${enc(s.id)}`;

/* ---------------- song lists ---------------- */
function songRow(s) {
  const meta = [nameOf("parjay", s.parjay), nameOf("raag", s.raag)].filter(Boolean).join(" · ");
  const v = hasRec(s) ? s.videos[0] : null;
  return `<li class="${hasRec(s) ? "" : "no-rec"}"><a href="${songHref(s)}">
    <span class="t-bn">${esc(title(s))}</span>
    <span class="meta">${hasRec(s) ? `<span class="rec">▶ ${num(s.videos.length)}</span>` : ""}<span>${esc(meta)}</span></span>
    ${titleEn(s) ? `<span class="t-en">${esc(titleEn(s))}</span>` : ""}</a>
    ${v ? `<a class="row-yt" href="${ytLink(v.id)}" target="_blank" rel="noopener" title="${esc(t("openYtT"))}" aria-label="${esc(t("openYt"))}: ${esc(title(s))}">${I.yt}</a>` : ""}</li>`;
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
    const rows = vis.map((s, i) => (i === firstRest && i > 0 ? `<li class="divider">${t("noRec")}</li>` : "") + songRow(s)).join("");
    wrap.innerHTML = (toggle ? `<p class="list-tools"><label class="toggle"><input type="checkbox" class="rec-only"${prefs.recOnly ? " checked" : ""}> ${t("recOnly", rec.length, list.length)}</label></p>` : "") + `
      <ul class="songs">${rows || `<li class="divider">${t("noneHere")}</li>`}</ul>` +
      (all.length > shown ? `<p class="more"><button class="btn ghost sm" type="button">${t("showMore", Math.min(300, all.length - shown))}</button></p>` : "");
    if (toggle) $(".rec-only", wrap).onchange = (e) => { prefs.recOnly = e.target.checked; savePrefs(); draw(); };
    const b = $(".more button", wrap);
    if (b) b.onclick = () => { shown += 300; draw(); };
  };
  draw();
  return wrap;
}
// A thumbnail card (well-known songs, more like this, recently played).
function songCard(s) {
  const v = hasRec(s) ? s.videos[0] : null, sg = v ? (v.singers || []) : [];
  return `<a class="scard" href="${songHref(s)}"><span class="th">${v ? `<img src="${thumb(v.id)}" alt="" loading="lazy"><button class="pl" type="button" data-play-song="${esc(s.id)}" aria-label="${esc(t("play"))}: ${esc(title(s))}">${I.play}</button>` : ""}</span>
    <b>${esc(title(s))}</b><span>${sg.length ? esc(singerNames(sg)) : esc([nameOf("parjay", s.parjay), nameOf("raag", s.raag)].filter(Boolean).join(" · "))}</span></a>`;
}
function wireCards(root) {
  $$("[data-play-song]", root).forEach((b) => b.onclick = (e) => { e.preventDefault(); e.stopPropagation(); jb.playSong(b.dataset.playSong); location.hash = "#/jukebox"; });
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
const dedupe = (s) => s.replace(/(.)\1+/g, "$1");
function skelBn(s) {
  s = (s || "").normalize("NFC").replace(/য়|য়/g, "")   // য় (ya) is a vowel glide
    .replace(/ড়|ঢ়|ড়|ঢ়/g, "র");          // ড় ঢ় sound like r
  return dedupe([...s].map((c) => BN_SKEL[c] || "").join(""));
}
function skelEn(s) {
  s = (s || "").toLowerCase().replace(/[^a-z]/g, "");
  for (const [a, b] of LAT_DIGRAPHS) s = s.split(a).join(b);
  return dedupe(s.replace(/[aeiouh]/g, ""));
}
const isBengali = (s) => /[ঀ-৿]/.test(s);

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
// Type-to-find over names (singers, raags): prefix first, then substring, then skeleton; Bengali names count too.
function findNames(names, q) {
  const nq = norm(q);
  if (!nq) return names;
  const qs = isBengali(q) ? skelBn(q) : skelEn(q);
  const score = (n) => {
    const bn = SINGER_BN[n] || RAAG_BN[n] || "", nn = norm(`${n} ${bn}`);
    if (nn.startsWith(nq)) return 0;
    if (nn.includes(nq)) return 1;
    if (qs.length >= 3 && (skelEn(n).includes(qs) || skelBn(bn).includes(qs))) return 2;
    return 9;
  };
  return names.map((n) => [score(n), n]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0]).map(([, n]) => n);
}

/* ---------------- views ---------------- */
function renderHome() {
  const q = sessionGet("q");
  view.innerHTML = `<div id="hero"></div>
    <div class="search-row"><span class="ic">${I.search}</span><input id="q" class="search" type="search" placeholder="${esc(t("searchPh"))}" value="${esc(q)}" autocomplete="off" aria-label="${esc(t("search"))}"></div>
    <div id="home-body"></div>`;
  renderHero();
  const input = $("#q"), body = $("#home-body");
  const run = () => {
    sessionSet("q", input.value);
    if (norm(input.value)) {
      const res = searchSongs(input.value);
      body.innerHTML = `<div class="section"><div class="section-head"><h2>${res.length ? t("found", res.length) : t("nothingFound")}</h2></div></div>`;
      body.append(songList(res, { recFirst: false }));
    } else renderListen(body);
  };
  input.addEventListener("input", run);
  run();
}

/* The season banner: the current ritu's sky drawn in code with a fragment of Tagore's 1937 landscape. */
let previewSeason = null;
const SEASON_SW = { Grishma: "#c6922e", Barsha: "#2f3f6e", Sharat: "#3f6a8c", Hemanta: "#a67a1c", Sheet: "#7a5a3c", Basanta: "#8e2f3c" };
function scene(k, w = 800, h = 340) {
  const rnd = (seed) => { let x = seed * 9301 + 49297; return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; }; };
  const r = rnd(k.length * 7), p = [];
  if (k === "Grishma") { p.push(`<circle cx="${w * .72}" cy="${h * .3}" r="56" fill="#f3dca0" opacity=".9"/><circle cx="${w * .72}" cy="${h * .3}" r="92" fill="#f3dca0" opacity=".25"/>`); for (let i = 0; i < 5; i++) p.push(`<path d="M0 ${h * .62 + i * 14} q ${w / 4} -8 ${w / 2} 0 t ${w / 2} 0" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.5"/>`); for (let i = 0; i < 36; i++) p.push(`<circle cx="${r() * w * .45}" cy="${h * .25 + r() * h * .3}" r="${2 + r() * 3}" fill="#b4472b" opacity=".8"/>`); p.push(`<path d="M0 ${h * .3} q 60 -40 120 10 t 110 -20" fill="none" stroke="#5a3a18" stroke-width="3"/>`); }
  else if (k === "Barsha") { for (let i = 0; i < 3; i++) p.push(`<ellipse class="cloud" cx="${w * (.2 + i * .3)}" cy="${h * .22 + i * 10}" rx="${120 + i * 20}" ry="34" fill="rgba(255,255,255,.18)"/>`); for (let g = 0; g < 2; g++) { let d = ""; for (let i = 0; i < 70; i++) d += `M${r() * w} ${r() * h}l-6 18`; p.push(`<path class="rain" d="${d}" stroke="rgba(255,255,255,.4)" stroke-width="1.2" fill="none"/>`); } for (let i = 0; i < 14; i++) p.push(`<circle cx="${w * .1 + r() * w * .3}" cy="${h * .7 + r() * 40}" r="${5 + r() * 5}" fill="#d49a3a" opacity=".85"/>`); p.push(`<path d="M0 ${h} L0 ${h * .82} Q ${w * .3} ${h * .7} ${w * .6} ${h * .84} T ${w} ${h * .8} L${w} ${h}z" fill="#5f7a3a" opacity=".55"/>`); }
  else if (k === "Sharat") { for (let i = 0; i < 4; i++) p.push(`<ellipse class="cloud" cx="${w * (.15 + i * .25)}" cy="${h * (.18 + (i % 2) * .1)}" rx="${80 + i * 15}" ry="26" fill="rgba(255,255,255,.7)"/>`); for (let i = 0; i < 90; i++) { const x = r() * w; p.push(`<path d="M${x} ${h} q ${-8 + r() * 16} -40 ${-6 + r() * 12} -${60 + r() * 50}" fill="none" stroke="rgba(255,250,235,.85)" stroke-width="${1 + r()}" stroke-linecap="round"/>`); } for (let i = 0; i < 18; i++) p.push(`<circle cx="${r() * w}" cy="${h * .55 + r() * h * .3}" r="3" fill="#fff8ea"/><circle cx="${r() * w}" cy="${h * .55 + r() * h * .3}" r="1.6" fill="#d49a3a"/>`); }
  else if (k === "Hemanta") { p.push(`<rect x="0" y="${h * .5}" width="${w}" height="${h * .22}" fill="rgba(255,255,255,.3)"/>`); for (let i = 0; i < 160; i++) { const x = r() * w; p.push(`<path d="M${x} ${h} q 4 -30 ${2 - r() * 6} -${50 + r() * 40}" fill="none" stroke="#c6922e" stroke-width="2" stroke-linecap="round" opacity=".8"/>`); } p.push(`<circle cx="${w * .2}" cy="${h * .3}" r="40" fill="rgba(255,240,200,.6)"/>`); }
  else if (k === "Sheet") { p.push(`<rect x="0" y="${h * .35}" width="${w}" height="${h * .3}" fill="rgba(255,255,255,.45)"/>`); for (let i = 0; i < 220; i++) p.push(`<circle cx="${r() * w}" cy="${h * .66 + r() * h * .34}" r="${1.5 + r() * 2.5}" fill="#d49a3a" opacity=".85"/>`); p.push(`<path d="M${w * .1} ${h * .62} v -70 m -10 70 h 20" stroke="#5a3a18" stroke-width="3" fill="none"/><path d="M${w * .1} ${h * .5} l 24 -40 m -24 40 l -24 -40" stroke="#5a3a18" stroke-width="2" fill="none"/>`); }
  else { p.push(`<path d="M0 ${h * .9} q ${w * .25} -120 ${w * .55} -40 t ${w * .45} -60" fill="none" stroke="#5a3a18" stroke-width="4"/>`); for (let i = 0; i < 46; i++) { const x = r() * w, y = h * .35 + r() * h * .5; p.push(`<path d="M${x} ${y} q 6 -12 12 0 q -6 12 -12 0z" fill="#b4472b"/><path d="M${x} ${y} q -8 -10 -2 -16" stroke="#b4472b" stroke-width="2" fill="none"/>`); } for (let i = 0; i < 30; i++) p.push(`<circle cx="${r() * w}" cy="${r() * h}" r="${6 + r() * 14}" fill="#8e2f3c" opacity=".12"/>`); }
  return `<svg class="scene" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${p.join("")}</svg>`;
}
function renderHero() {
  const el = $("#hero"); if (!el) return;
  const k = previewSeason || currentSeason(), S = SEASONS[k], d = bengaliDate();
  const n = SONGS.filter((s) => s.season === k && hasRec(s)).length, total = SONGS.filter((s) => s.season === k).length;
  setSeasonTint(k);
  el.innerHTML = `<section class="hero" aria-label="${esc(seasonName(k))}"><div class="paint" aria-hidden="true"></div>${scene(k)}<span class="alp" aria-hidden="true">${I.mark}</span><div class="in">
      <div class="date">${esc(d.text)}<span class="en">${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long" })} · ${L === "bn" ? S.monthsEn : S.months}</span></div>
      <h1>${previewSeason ? esc(seasonName(k)) : t("seasonNow", seasonName(k))}<small>${esc(L === "bn" ? `${k} · ${S.noteEn}` : `${S.bn} · ${S.note}`)}</small></h1>
      <p>${esc(L === "bn" ? S.note : S.noteEn)}. ${n ? t("seasonSongs", n) : t("seasonSoon")}.</p>
      <div class="acts"><button class="btn" type="button" id="hero-play"${n ? "" : " disabled"}>${I.play} ${t("playSeason", seasonName(k))}</button><a class="btn ghost sm" href="#/list/season/${k}">${t("songsCount", total)}</a></div>
    </div></section>
    <div class="seasons" role="group" aria-label="${esc(t("season"))}">${SEASON_ORDER.map((x) => `<button type="button" class="${x === k ? "on" : ""}" data-s="${x}" style="--sw:${SEASON_SW[x]}" aria-pressed="${x === k}"><i aria-hidden="true"></i>${esc(seasonName(x))}</button>`).join("")}</div>`;
  $("#hero-play").onclick = () => playFiltered("season", k);
  $$("[data-s]", el).forEach((b) => b.onclick = () => { previewSeason = b.dataset.s === currentSeason() ? null : b.dataset.s; renderHero(); });
}
// One well-known song per day, with a Tagore painting beside it.
function songOfDay() {
  const pool = popular().filter(hasRec);
  if (!pool.length) return null;
  const d = new Date(), doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
  return pool[doy % pool.length];
}
/* Tagore's palette, one colour (and, where it fits, one of his paintings) per mood */
const MOODC = { prem: ["#9b4455", "#5f2531", "two-figures01"], viraha: ["#3a4a7a", "#232d52", "bird-fantastic"], bishad: ["#555a66", "#2f333c", "head-study-geometric"], ananda: ["#c6922e", "#8a5f14", "untitled-dacing-girl"],
  shanti: ["#7f957a", "#4f6650", "vase"], bhakti: ["#c98a2b", "#8a5612", null], "prakriti-bhava": ["#5f7a3a", "#394d20", "landscape-by-1937"], utsav: ["#b4472b", "#762b17", "seven-figures"],
  deshprem: ["#8e2f3c", "#561a23", null], sahas: ["#a65a31", "#6b371a", "man-and-woman"], smriti: ["#7a5a3c", "#4e3826", "veiled-woman"], kautuk: ["#3f7d7a", "#265452", null] };

function renderListen(body) {
  const moodRec = (m) => SONGS.filter((s) => hasRec(s) && (s.moods || []).includes(m)).length;
  const pop = popular(), popRec = pop.filter(hasRec), totalRec = SONGS.filter(hasRec).length, sod = songOfDay();
  const sodV = sod && sod.videos[0], sodSg = sodV ? (sodV.singers || []) : [];
  body.innerHTML = `
    <section class="section card feel" aria-labelledby="h-feel" id="feel-box"></section>
    ${sod ? `<section class="section card sotd" aria-labelledby="h-sod"><div class="art${(sod.moods || [])[0] === "viraha" || (sod.moods || [])[0] === "bishad" ? " alt" : ""}" role="img" aria-label="${esc(t("paintingAlt"))}"></div>
      <div><div class="lab">${t("sotd")} · ${esc(bengaliDate().text)}</div><h2 id="h-sod"><a href="${songHref(sod)}">${esc(title(sod))}</a></h2>
      <p>${sodSg.length ? `${t("by")} ${esc(singerNames(sodSg))} · ` : ""}${[nameOf("parjay", sod.parjay), nameOf("raag", sod.raag)].filter(Boolean).map(esc).join(" · ")}</p>
      <div class="acts"><button class="btn sm" type="button" data-play-song="${esc(sod.id)}">${I.play} ${t("play")}</button><a class="btn ghost sm" href="${songHref(sod)}">${t("lyricsBtn")}</a></div></div></section>` : ""}
    <section class="section" aria-labelledby="h-listen">
      <div class="section-head"><h2 id="h-listen">${t("moods")}</h2><span class="hint">${t("ofSongs", totalRec, SONGS.length)}</span></div>
      <div class="moods">${Object.keys(META.moods).map((m) => { const n = moodRec(m), [c1, c2, pic] = MOODC[m] || ["#666", "#333", null];
        return `<button class="mood" type="button" data-play="mood:${esc(m)}" style="--m1:${c1};--m2:${c2}"${n ? "" : " disabled"}>${pic ? `<span class="img" style="--pic:url(img/${pic}.jpg)" aria-hidden="true"></span>` : ""}<span class="tx"><b>${esc(nameOf("mood", m))}</b><small>${esc(moodDesc(m))}</small></span><span class="n">${n ? `▶ ${t("songsCount", n)}` : t("comingSoon")}</span></button>`; }).join("")}</div>
    </section>
    ${I.divider}
    <section class="section" aria-labelledby="h-pop">
      <div class="section-head"><h2 id="h-pop">${t("wellKnown")}</h2><a class="more-link" href="#/browse/popular">${t("all", pop.length)} →</a></div>
      <div class="row">${(popRec.length >= 8 ? popRec : pop).slice(0, 14).map(songCard).join("")}</div>
    </section>
    <section class="section" aria-labelledby="h-explore">
      <div class="section-head"><h2 id="h-explore">${t("exploreAll", SONGS.length)}</h2></div>
      <p class="chips">${Object.entries(KINDS).filter(([k]) => k !== "popular").map(([k, v]) => `<a class="chip" href="#/browse/${k}">${t(v.key)}</a>`).join("")}</p>
    </section>`;
  // The feelings box appears only once the language model has loaded (see startup below).
  if (FEEL && M.ready) renderFeel($("#feel-box", body)); else $("#feel-box", body).hidden = true;
  wireCards(body);
  $$("[data-play]", body).forEach((b) => b.onclick = () => { const [kind, value] = b.dataset.play.split(":"); playFiltered(kind, value); });
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
  const tx = (text || "").normalize("NFC").toLowerCase();
  let work = tx;
  const scores = {}, hits = [];
  for (const { mood, re } of FEEL_PATTERNS.list) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(work))) {
      const negated = !isBengali(m[0]) && FEEL_PATTERNS.neg.test(tx.slice(Math.max(0, m.index - 25), m.index));
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
    const n = res.reduce((c, re) => { re.lastIndex = 0; return c + (tx.match(re) || []).length; }, 0);
    if (n > best) { best = n; season = name; }
  }
  const max = Math.max(0, ...Object.values(scores));
  const moods = Object.entries(scores).filter(([, s]) => s >= max * 0.34).sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([m, s]) => ({ mood: m, weight: s / max }));
  return { moods, season, hits };
}
/* Language model: the same small open multilingual model as the Kathamrita site
   (Xenova/multilingual-e5-small via transformers.js), run in a background Web Worker so the page
   never freezes. It compares the visitor's words with a description of each mood
   (docs/search/moods.json, made by scripts/embed_songs.py). Nothing leaves the browser.
   The browser caches the model after the first download. */
const MODEL_JS = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3";
const WORKER_SRC = `
  import {pipeline} from "${MODEL_JS}";
  let ext = null;
  const load = () => ext || (ext = pipeline("feature-extraction", "Xenova/multilingual-e5-small", {dtype: "q8"}));
  self.onmessage = async e => {
    const {id, text} = e.data;
    try {
      const p = await load();
      if (text == null) return self.postMessage({id, ok: true});          // warm-up only
      const out = await p("query: " + text, {pooling: "mean", normalize: true});
      self.postMessage({id, ok: true, vec: out.data});
    } catch (err) { ext = null; self.postMessage({id, ok: false, err: String(err)}); }
  };`;
const M = { worker: null, seq: 0, waiting: new Map(), ready: false, warming: null, main: null, moods: null };
function modelWorker() {
  if (M.worker === null) {
    try {
      M.worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: "text/javascript" })), { type: "module" });
      M.worker.onmessage = (e) => { const w = M.waiting.get(e.data.id); if (w) { M.waiting.delete(e.data.id); e.data.ok ? w.ok(e.data) : w.fail(e.data.err); } };
      M.worker.onerror = () => { M.worker = false; for (const w of M.waiting.values()) w.fail("worker"); M.waiting.clear(); };
    } catch { M.worker = false; }   // very old browsers: fall back to the main thread
  }
  return M.worker;
}
function askWorker(text) {
  return new Promise((ok, fail) => { const id = ++M.seq; M.waiting.set(id, { ok, fail }); modelWorker().postMessage({ id, text }); });
}
async function embedMain(text) {
  if (!M.main) M.main = import(MODEL_JS).then(({ pipeline }) => pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" }));
  const p = await M.main;
  if (text == null) return null;
  return (await p("query: " + text, { pooling: "mean", normalize: true })).data;
}
async function embed(text) {
  if (modelWorker()) {
    try { const r = await askWorker(text); M.ready = true; return r.vec; }
    catch (err) { if (M.worker !== false) throw err; }   // worker unavailable: use the main thread
  }
  const v = await embedMain(text); M.ready = true; return v;
}
function loadMoodVectors() {
  if (!M.moods) M.moods = fetch("search/moods.json?v=1").then((r) => r.json()).then((d) => ({
    margin: d.margin || 0.015,
    rows: Object.entries(d.moods).map(([mood, q]) => [mood, Float32Array.from(q, (x) => x / d.scale)]),
  }));
  return M.moods;
}
function warmUp() {
  if (!M.warming) M.warming = Promise.all([loadMoodVectors(), embed(null)]).catch((err) => { M.warming = null; console.warn(err); });
  return M.warming;
}
// Don't fetch a 118 MB model on data-saving or very slow connections until it's actually needed.
function mayPreload() {
  const c = navigator.connection;
  return !(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || "")));
}
// Moods whose description is closest to the visitor's words (within a small margin of the best).
async function semanticMoods(text) {
  const [mv, v] = await Promise.all([loadMoodVectors(), embed(text)]);
  const sims = mv.rows.map(([mood, row]) => [mood, row.reduce((a, x, i) => a + x * v[i], 0)]);
  const top = Math.max(...sims.map(([, s]) => s));
  return sims.filter(([, s]) => s >= top - mv.margin).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([mood, s]) => ({ mood, weight: 1 - ((top - s) / mv.margin) * 0.3 }));
}
// Word matches are explicit, so they keep full weight; the model adds what the words missed.
function mergeMoods(lexical, semantic) {
  const out = new Map(lexical.map((m) => [m.mood, { ...m }]));
  for (const m of semantic) {
    const w = lexical.length ? Math.min(0.8, m.weight) : m.weight;
    const cur = out.get(m.mood);
    if (cur) cur.weight = Math.max(cur.weight, w);
    else out.set(m.mood, { mood: m.mood, weight: w, on: true, viaModel: true });
  }
  return [...out.values()].sort((a, b) => b.weight - a.weight).slice(0, 4);
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
    <div class="section-head"><h2 id="h-feel">${t("feelH")}</h2></div><p class="hint feel-hint">${t("feelHint")}</p>
    <textarea id="feel-text" class="feel-text" rows="2" aria-labelledby="h-feel" placeholder="${esc(t("feelPh"))}">${esc(text)}</textarea>
    <div class="feel-row">
      <span class="hint" id="feel-n-label">${t("songsN")}</span>
      <div class="feel-n" role="group" aria-labelledby="feel-n-label">
        ${[5, 10, 20].map((k) => `<button type="button" class="chip" data-n="${k}" aria-pressed="${String(k) === n}">${num(k)}</button>`).join("")}
        <input id="feel-n" class="feel-n-input" type="text" inputmode="numeric" value="${num(n)}" aria-label="${esc(t("nSongs"))}">
      </div>
      <button class="btn" type="button" id="feel-go">${t("makeList")}</button>
    </div>
    <div id="feel-result" aria-live="polite"></div>`;
  const input = $("#feel-n", box);
  let state = null;   // last detection, possibly edited via chips
  const count = () => Math.max(1, Math.min(50, parseInt(unnum(input.value), 10) || 10));
  const syncN = () => { input.value = num(count()); sessionSet("feelN", String(count())); $$("[data-n]", box).forEach((x) => x.setAttribute("aria-pressed", String(+x.dataset.n === count()))); };
  $$("[data-n]", box).forEach((b) => b.onclick = () => { input.value = b.dataset.n; syncN(); if (state) draw(); });
  input.onchange = () => { syncN(); if (state) draw(); };
  const draw = () => {
    const out = $("#feel-result", box);
    const active = state.moods.filter((m) => m.on);
    const picks = active.length || state.season ? buildPlaylist({ moods: active, season: state.seasonOn ? state.season : null }, count()) : [];
    const chips = Object.keys(META.moods).map((m) => {
      const d = state.moods.find((x) => x.mood === m);
      return `<button type="button" class="chip mood-chip" data-mood="${esc(m)}" aria-pressed="${!!(d && d.on)}" title="${esc(moodDesc(m))}">${esc(nameOf("mood", m))}</button>`;
    }).join("");
    const seasonChip = state.season ? `<button type="button" class="chip mood-chip" data-season aria-pressed="${state.seasonOn}">${esc(nameOf("season", state.season))}${L === "bn" ? ` ${state.season}` : ` ${SEASON_BN[state.season]}`}</button>` : "";
    out.innerHTML = `
      <div class="feel-understood">
        ${state.hits.length ? `<p class="hint">${t("recognised")} ${[...new Set(state.hits.map((h) => `“${esc(h.word)}” → ${esc(nameOf("mood", h.mood))}`))].join(", ")}</p>` : ""}
        ${state.byModel && state.byModel.length ? `<p class="hint">${t("modelReads")} <strong>${state.byModel.map((m) => esc(nameOf("mood", m))).join(", ")}</strong></p>` : ""}
        ${!state.hits.length && !(state.byModel && state.byModel.length) && !state.note ? `<p class="hint">${t("notFound")}</p>` : ""}
        <div class="chips">${seasonChip}${chips}</div>
      </div>
      ${picks.length ? `
        <div class="feel-actions">
          <button class="btn" type="button" id="feel-play">${I.play} ${t("playList")} (${num(picks.length)})</button>
          <button class="btn ghost" type="button" id="feel-again">↻ ${t("anotherMix")}</button>
        </div>
        <ol class="queue feel-list">${picks.map(({ s, why }, i) => {
          const singers = singersOf(s);
          return `<li><span class="q-num">${num(i + 1)}</span>
            <button class="btn icon sm ghost" type="button" data-feel-play="${i}" aria-label="${esc(t("play"))}: ${esc(title(s))}">${I.play}</button>
            <div class="q-main"><span><a class="q-title" href="${songHref(s)}">${esc(title(s))}</a>${isLiked(s.id) ? ` <span class="liked">♥</span>` : ""}</span>
              <span class="q-singers">${singers.length ? esc(singerNames(singers)) : t("unknownSinger")} · <span class="why">${why.map((w) => esc(MOOD_BN[w] ? nameOf("mood", w) : nameOf("season", w))).join(", ")}</span></span></div></li>`;
        }).join("")}</ol>` : (active.length || state.seasonOn ? `<p class="hint">${t("noFit")}</p>` : "")}`;
    $$(".mood-chip[data-mood]", out).forEach((b) => b.onclick = () => {
      const m = b.dataset.mood, d = state.moods.find((x) => x.mood === m);
      if (d) d.on = !d.on; else state.moods.push({ mood: m, weight: 0.8, on: true });
      state.edited = true;   // the listener's own choice: the language model won't override it
      draw();
    });
    const sc = $(".mood-chip[data-season]", out); if (sc) sc.onclick = () => { state.seasonOn = !state.seasonOn; state.edited = true; draw(); };
    if (state.note) out.insertAdjacentHTML("afterbegin", `<p class="hint model-note">${state.note}</p>`);
    const ids = picks.map((p) => p.s.id);
    const label = active.map((m) => nameOf("mood", m.mood)).concat(state.seasonOn && state.season ? [nameOf("season", state.season)] : []).join(" · ");
    const play = (from) => { jb.playPlaylist(ids, label, active.map((m) => m.mood), from); location.hash = "#/jukebox"; };
    if ($("#feel-play", out)) $("#feel-play", out).onclick = () => play(0);
    if ($("#feel-again", out)) $("#feel-again", out).onclick = draw;
    $$("[data-feel-play]", out).forEach((b) => b.onclick = () => play(+b.dataset.feelPlay));
  };
  // Word matching answers at once; the language model then refines the moods (unless the
  // listener has already changed the chips, or another question was asked meanwhile).
  let asked = 0;
  const go = () => {
    const tx = $("#feel-text", box).value;
    sessionSet("feel", tx);
    const d = detectFeelings(tx);
    state = { moods: d.moods.map((m) => ({ ...m, on: true })), season: d.season, seasonOn: !!d.season, hits: d.hits };
    const mine = ++asked;
    if (!tx.trim()) return draw();
    state.note = M.ready ? "" : t("modelWait");
    draw();
    semanticMoods(tx).then((sem) => {
      if (mine !== asked || !state || state.edited) return;
      state.moods = mergeMoods(state.moods, sem);
      state.note = "";
      state.byModel = sem.map((m) => m.mood);
      draw();
    }).catch(() => {
      if (mine !== asked || !state) return;
      state.note = t("modelFail");
      draw();
    });
  };
  $("#feel-text", box).addEventListener("focus", () => { if (mayPreload()) warmUp(); }, { once: true });
  $("#feel-go", box).onclick = go;
  $("#feel-text", box).addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) go(); });
  if (text.trim()) go();
}

/* ---------------- browse ---------------- */
function kindsNav(kind) {
  return `<nav class="chips scroll kinds" aria-label="${esc(t("browse"))}">${Object.entries(KINDS).map(([k, v]) =>
    `<a class="chip${k === kind ? " on" : ""}" href="#/browse/${k}"${k === kind ? ' aria-current="page"' : ""}>${t(v.key)}</a>`).join("")}</nav>`;
}
function renderBrowse(kind) {
  if (!KINDS[kind]) kind = "popular";
  view.innerHTML = `<div class="search-row"><span class="ic">${I.search}</span><input id="q" class="search" type="search" placeholder="${esc(t("searchPh"))}" autocomplete="off" aria-label="${esc(t("search"))}"></div>${kindsNav(kind)}<div id="browse-body"></div>`;
  const body = $("#browse-body"), q = $("#q");
  const drawKind = () => {
    if (kind === "popular" || kind === "az") {
      const list = kind === "popular" ? popular() : SONGS;
      body.innerHTML = `<p class="hint">${kind === "popular" ? t("popularHint") : t("azHint", SONGS.length)}</p>`;
      body.append(songList(list));
      return;
    }
    const groups = groupsOf(kind), g = new Map(groups), withFind = ["singer", "raag", "taal", "drama"].includes(kind);
    body.innerHTML = `${withFind ? `<div class="find"><span class="ic">${I.search}</span><input id="group-find" type="search" placeholder="${esc(t("typeFind"))}" aria-label="${esc(t("typeFind"))}" autocomplete="off"></div>` : ""}<div class="groups" id="groups"></div>`;
    const draw = (qq = "") => {
      const names = qq ? findNames(groups.map(([v]) => v), qq) : groups.map(([v]) => v);
      $("#groups").innerHTML = names.map((v) => {
        const { n, rec } = g.get(v);
        const sub = kind === "mood" ? moodDesc(v) : kind === "season" ? (L === "bn" ? SEASONS[v].months : SEASONS[v].monthsEn) : (nameOf(kind, v) !== v ? v : "");
        return `<a class="group" href="#/list/${kind}/${enc(v)}"><b>${esc(nameOf(kind, v))}</b>${sub ? `<small>${esc(sub)}</small>` : ""}<span class="bar"><i style="width:${Math.round(100 * rec / n)}%"></i></span><span class="n" title="${num(rec)} ${esc(t("withRec"))}">${t("songsCount", n)}${rec ? ` · ▶ ${num(rec)}` : ""}</span></a>`;
      }).join("") || `<p class="hint">${t("nothingFound")}</p>`;
    };
    draw();
    const gf = $("#group-find"); if (gf) gf.oninput = () => draw(gf.value);
  };
  q.oninput = () => {
    if (norm(q.value)) { const res = searchSongs(q.value); body.innerHTML = `<div class="section-head"><h2>${res.length ? t("found", res.length) : t("nothingFound")}</h2></div>`; body.append(songList(res, { recFirst: false })); }
    else drawKind();
  };
  drawKind();
}

function renderList(kind, value, sub = "") {
  if (!KINDS[kind] || !KINDS[kind].get) return renderBrowse("popular");
  const all = SONGS.filter((s) => KINDS[kind].get(s).includes(value));
  const list = sub ? all.filter((s) => s.sub === sub) : all;
  const playable = ["mood", "parjay", "season", "raag", "singer"].includes(kind) && all.some(hasRec);
  // Parjays are split into sub-groups in Gitabitan (Puja: Bondhu, Biraha, Dukkha...): offer them as chips.
  const subs = kind === "parjay" ? groupCounts(all, (s) => s.sub) : [];
  const subChips = subs.length > 1 ? `<nav class="chips scroll subtabs" aria-label="${esc(value)}">
      <a class="chip${sub ? "" : " on"}" href="#/list/parjay/${enc(value)}"${sub ? "" : ' aria-current="page"'}>${t("subAll")} <small>${num(all.length)}</small></a>
      ${subs.map(([v, n]) => `<a class="chip${v === sub ? " on" : ""}" href="#/list/parjay/${enc(value)}/${enc(v)}"${v === sub ? ' aria-current="page"' : ""}>${esc(nameOf("sub", v))} <small>${num(n)}</small></a>`).join("")}
    </nav>` : "";
  if (kind === "season") setSeasonTint(value);
  view.innerHTML = `<p class="crumb"><a href="#/browse/${kind}">${t(KINDS[kind].key)}</a>${sub ? ` › <a href="#/list/parjay/${enc(value)}">${esc(nameOf("parjay", value))}</a>` : ""}</p>
    <div class="list-head"><h1>${esc(sub ? nameOf("sub", sub) : nameOf(kind, value))}${kind === "season" && L === "bn" ? ` <span class="hint">${esc(value)}</span>` : ""}</h1>
    <span class="n">${t("songsCount", list.length)}</span>
    ${kind === "mood" ? `<span class="hint">${esc(moodDesc(value))}</span>` : ""}
    ${playable ? `<button class="btn sm" type="button" id="play-list">${I.play} ${t("play")}</button>` : ""}</div>
    ${kind === "season" ? `<div class="hero small"><div class="paint" aria-hidden="true"></div>${scene(value, 800, 160)}</div>` : ""}
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
function relatedSongs(s, n = 10) {
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
  if (!s) { view.innerHTML = `<p class="empty">${t("notFoundSong")} <a href="#/">${t("backHome")}</a></p>`; return; }
  setSeasonTint(s.season || currentSeason());
  const chip = (kind, v) => `<a href="#/list/${kind}/${enc(v)}">${esc(nameOf(kind, v))}</a>`;
  const facts = [
    ["parjay", s.parjay && chip("parjay", s.parjay) + (s.sub && s.parjay ? ` <a class="sub" href="#/list/parjay/${enc(s.parjay)}/${enc(s.sub)}">${esc(nameOf("sub", s.sub))}</a>` : "")],
    ["season", s.season && chip("season", s.season)],
    ["drama", s.drama && s.drama.split(", ").map((d) => chip("drama", d)).join(", ")],
    ["raag", s.raag && chip("raag", s.raag) + (s.raagFull && s.raagFull !== s.raag ? ` <span class="sub">${esc(s.raagFull)}</span>` : "")],
    ["taal", s.taal && chip("taal", s.taal)],
    ["written", s.written && esc(s.written)],
    ["mood", s.moods && s.moods.length && `<span class="chips">${s.moods.map((m) => `<a class="chip sm" href="#/list/mood/${enc(m)}">${esc(nameOf("mood", m))}</a>`).join("")}</span>`],
  ].filter(([, v]) => v);
  const vids = s.videos == null
    ? `<p class="novideo">${t("notYet", !!s.pop)}</p>`
    : !s.videos.length ? `<p class="novideo">${t("noMatch")}</p>`
    : s.videos.map((v, i) => `<figure class="video">
        <div class="frame"><img src="${thumb(v.id, "hq")}" alt="" loading="lazy">
          <button class="play" type="button" data-vid="${i}" aria-label="${esc(t("play"))}: ${esc(v.t)}"><span>${I.play}</span></button></div>
        <figcaption><span class="s">${(v.singers || []).length ? esc(singerNames(v.singers)) : esc(v.ch)}</span><small>${esc(v.t)}</small><small>${fmtViews(v.views)} ${t("views")} · ${fmtTime(v.sec)}</small>
          <a class="yt" href="${ytLink(v.id)}" target="_blank" rel="noopener" title="${esc(t("openYtT"))}">${I.ext} ${t("openYt")}</a></figcaption>
      </figure>`).join("");
  const fromGb = s.source.includes("geetabitan.com");
  view.innerHTML = `<section class="shero"><div class="ms" aria-hidden="true"></div><div class="in">
      <div class="lab">${[nameOf("parjay", s.parjay), nameOf("sub", s.sub)].filter(Boolean).map(esc).join(" · ")}</div>
      <h1>${esc(title(s))}</h1>${titleEn(s) ? `<p class="sub-en">${esc(titleEn(s))}</p>` : ""}
      <div class="song-actions">
        ${hasRec(s) ? `<button class="btn" type="button" id="s-play">${I.play} ${t("play")}</button>` : ""}
        <button class="btn ghost" id="s-like" type="button" aria-pressed="${isLiked(s.id)}" title="${esc(t("likeT"))}">${isLiked(s.id) ? I.heartF : I.heart} ${isLiked(s.id) ? t("liked") : t("like")}</button>
        ${askAiLink(s)}
        <button class="btn ghost" id="s-never" type="button" aria-pressed="${isNever(s.id)}" title="${esc(t("neverT"))}">${isNever(s.id) ? t("nevered") : t("never")}</button>
      </div></div></section>
  <article class="song">
    <div class="leaf ruled">
      ${s.lyrics ? `<pre class="lyrics bn" id="lyrics">${esc(s.lyrics)}</pre>` : `<p class="novideo">${t("lyricsNA")}</p>`}
      <p class="src">${fromGb ? `${t("srcGb")} <a href="${esc(s.source)}" target="_blank" rel="noopener">geetabitan.com</a>` : `${t("source")}: <a href="${esc(s.source)}" target="_blank" rel="noopener">${t("srcWs")}</a>`}</p>
    </div>
    <aside>
      <dl class="facts">${facts.map(([k, v]) => `<div class="${k === "mood" || k === "drama" ? "span" : ""}"><dt>${t(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>
      <section class="videos" aria-label="${esc(t("recordings"))}"><div class="section-head"><h2>${t("recordings")}</h2>${hasRec(s) ? `<span class="hint">${t("recN", s.videos.length)}</span>` : ""}</div>${vids}</section>
    </aside>
  </article>
  ${I.divider}
  <section class="section related" aria-labelledby="h-related">
    <div class="section-head"><h2 id="h-related">${t("moreLike")}</h2><span class="hint">${t("moreLikeHint")}</span>
      ${(s.moods || []).length ? `<button class="btn soft sm more-link" type="button" id="play-like">${I.play} ${t("playLike")}</button>` : ""}</div>
    <div class="row" id="related"></div>
  </section>`;
  const rel = relatedSongs(s);
  if (rel.length) { $("#related").innerHTML = rel.map(songCard).join(""); wireCards($("#related")); } else $(".related").hidden = true;
  const likeBtn = $("#play-like");
  if (likeBtn) {
    const n = jb.countFor({ moods: s.moods });
    likeBtn.disabled = !n;
    likeBtn.title = n ? t("playLikeT", n) : t("playLikeNone");
    likeBtn.onclick = () => { jb.setFilters({ moods: s.moods }); location.hash = "#/jukebox"; jb.start(true); };
  }
  // A recording plays in the jukebox (which stays alive across pages), from the chosen video.
  $$("[data-vid]", view).forEach((b) => b.onclick = () => { jb.playSong(s.id, s.videos[+b.dataset.vid]); location.hash = "#/jukebox"; });
  const sp = $("#s-play"); if (sp) sp.onclick = () => { jb.playSong(s.id); location.hash = "#/jukebox"; };
  $("#s-like").onclick = () => { const on = !isLiked(s.id); toggle("likes", s.id, on); renderSong(id); jb.prefsChanged(); toast(on ? t("toastLiked") : t("toastUnliked")); };
  $("#s-never").onclick = () => { const on = !isNever(s.id); toggle("never", s.id, on); renderSong(id); jb.prefsChanged(); toast(on ? t("toastNever") : t("toastAllowed")); };
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
const askAiUrl = (s) => `https://chatgpt.com/?q=${enc(askAiPrompt(s))}`;
function askAiLink(s, cls = "btn ghost") {
  return `<a class="${cls} ask-ai" href="${askAiUrl(s)}" target="_blank" rel="noopener" title="${esc(t("askAiT"))}">${I.spark} ${t("askAi")}</a>`;
}

function sessionGet(k) { try { return sessionStorage.getItem("gitabitan." + k) || ""; } catch { return ""; } }
function sessionSet(k, v) { try { sessionStorage.setItem("gitabitan." + k, v); } catch { /* ignore */ } }

/* ---------------- Mine ---------------- */
function renderMine() {
  const likes = prefs.likes.map((id) => BY_ID.get(id)).filter(Boolean), never = prefs.never.map((id) => BY_ID.get(id)).filter(Boolean);
  const recent = prefs.recent.slice().reverse().filter((id, i, a) => a.indexOf(id) === i).slice(0, 12).map((id) => BY_ID.get(id)).filter(Boolean);
  const u = SYNC.user;
  const acct = SYNC.signIn
    ? (u ? `<div class="card acct"><span class="seal" aria-hidden="true"></span>${u.photo ? `<img class="avatar" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc((u.name || u.email || "?").trim()[0].toUpperCase())}</span>`}<div><p><b>${esc(u.name || "")}</b></p><p class="hint">${esc(u.email || "")} · ${t("syncNote")}</p></div><button class="btn ghost sm" type="button" id="mine-out">${t("signOut")}</button></div>`
      : `<div class="card acct"><span class="seal" aria-hidden="true"></span><span class="avatar">?</span><div><p><b>${t("notSignedIn")}</b></p><p class="hint">${t("localOnly")}</p></div><button class="btn ghost" type="button" id="mine-in">${I.google} ${t("signIn")}</button></div>`)
    : `<p class="hint">${t("localOnly")}</p>`;
  view.innerHTML = `<div class="list-head"><h1>${t("mineH")}</h1></div>${acct}
    <section class="section"><div class="section-head"><h2>${t("likedSongs")}</h2><span class="hint">${t("songsCount", likes.length)}</span>${likes.some(hasRec) ? `<button class="btn sm more-link" type="button" id="mine-play">${I.play} ${t("playAll")}</button>` : ""}</div><div id="mine-likes"></div></section>
    <section class="section"><div class="section-head"><h2>${t("recentH")}</h2></div>${recent.length ? `<div class="row" id="mine-recent">${recent.map(songCard).join("")}</div>` : `<p class="hint">${t("none")}</p>`}</section>
    <section class="section"><div class="section-head"><h2>${t("hiddenSongs")}</h2><span class="hint">${t("songsCount", never.length)}</span></div>
      <ul class="songs">${never.map((s) => `<li><a href="${songHref(s)}"><span class="t-bn">${esc(title(s))}</span></a><button class="btn ghost sm" type="button" data-un="${esc(s.id)}">${t("allowAgain")}</button></li>`).join("") || `<li class="divider">${t("none")}</li>`}</ul></section>`;
  if (likes.length) $("#mine-likes").append(songList(likes, { toggle: false })); else $("#mine-likes").innerHTML = `<div class="card empty"><b>${t("noneLiked")}</b><p>${t("noneLikedHint")}</p></div>`;
  wireCards(view);
  const mi = $("#mine-in"); if (mi) mi.onclick = () => SYNC.signIn();
  const mo = $("#mine-out"); if (mo) mo.onclick = () => SYNC.signOut();
  const mp = $("#mine-play"); if (mp) mp.onclick = () => { jb.setFilters({ likedOnly: true }); location.hash = "#/jukebox"; jb.start(true); };
  $$("[data-un]", view).forEach((b) => b.onclick = () => { toggle("never", b.dataset.un, false); jb.prefsChanged(); toast(t("toastAllowed")); renderMine(); });
}

/* ---------------- jukebox ---------------- */
const jb = (() => {
  const F = prefs.filters;
  let player = null, apiLoading = null, current = null, upNext = null, errors = 0;
  // What the listener asked for. YouTube reports ads and buffering as "not playing", so the
  // Pause/Resume buttons follow this instead of the player's state.
  let wantPlay = false;
  // A playlist from "How are you feeling?": played in order, then shuffle continues on its moods.
  let playlist = null;   // { label, ids, idx, moods }
  const history = [];
  const ARR = { moods: "moods", parjays: "parjays", seasons: "seasons" };
  const findQ = { raag: "", singer: "" };

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
    el.innerHTML = upNext && current ? `${t("upNext")}: <a href="${songHref(upNext.song)}">${esc(title(upNext.song))}</a>` : "";
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

  // autoplay=false loads the song paused (used when filters change while the listener had paused,
  // and after a page refresh, when browsers block sound until a click).
  let pendingStart = 0;
  async function playItem(item, autoplay = true, startAt = 0) {
    current = item;
    wantPlay = autoplay;
    pendingStart = Math.floor(startAt);
    if (!startAt) { prefs.recent.push(item.song.id); prefs.recent = prefs.recent.slice(-200); savePrefs(); }
    showNow(); planNext(); renderQueue(); saveSession(); setProgress(pendingStart, item.video.sec);
    await loadApi();
    $("#jb-empty").hidden = true;
    const start = Math.floor(startAt);
    if (!player) {
      player = new YT.Player("yt-player", {
        videoId: item.video.id, host: ytHost(),
        playerVars: { autoplay: autoplay ? 1 : 0, rel: 0, playsinline: 1, hl: L, start },
        events: {
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.ENDED) next();
            if (e.data === YT.PlayerState.PLAYING) { errors = 0; wantPlay = true; }
            if (e.data === YT.PlayerState.PAUSED) wantPlay = false; // also when paused in YouTube's own controls
            updateButtons(); saveSession(); tick();
          },
          onError: () => { if (++errors < 5) next(); }, // unembeddable or removed video: move on
        },
      });
    } else if (autoplay) player.loadVideoById({ videoId: item.video.id, startSeconds: start });
    else player.cueVideoById({ videoId: item.video.id, startSeconds: start });
    updateButtons();
  }

  /* Resume point: what was playing, where, the playlist, the filters' song and the page. */
  const position = () => {
    try {
      const st = player && player.getPlayerState ? player.getPlayerState() : -1;
      if (st === -1 || st === 5) return pendingStart; // unstarted / cued
      return player.getCurrentTime();
    } catch { return pendingStart; }
  };
  const duration = () => { try { const d = player && player.getDuration ? player.getDuration() : 0; return d || (current ? current.video.sec : 0); } catch { return current ? current.video.sec : 0; } };
  function saveSession() {
    if (!SONGS.length || holdSession) return;
    const s = { at: Date.now(), route: lastPage, id: current ? current.song.id : "", vid: current ? current.video.id : "", t: current ? Math.floor(position()) : 0,
      playlist: playlist ? { label: playlist.label, ids: playlist.ids.slice(0, 200), idx: playlist.idx, moods: playlist.moods || [] } : null,
      history: history.slice(-30).map((h) => h.song.id) };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
    SYNC.changed("session");
  }
  // Continue a saved session: playlist and history come back, the song starts where it stopped.
  function resume(s, play = true) {
    if (s.playlist && s.playlist.ids) playlist = { label: s.playlist.label || "", ids: s.playlist.ids, idx: s.playlist.idx || 0, moods: s.playlist.moods || [] };
    history.splice(0, history.length, ...(s.history || []).map((id) => BY_ID.get(id)).filter((x) => x && hasRec(x)).map((x) => ({ song: x, video: x.videos[0] })));
    const song = s.id && BY_ID.get(s.id);
    if (song && hasRec(song)) {
      const video = song.videos.find((v) => v.id === s.vid) || song.videos[0];
      playItem({ song, video }, play, play ? Math.max(0, (s.t || 0) - 3) : s.t || 0);
    } else renderQueue();
  }

  // Play a song chosen from a list (keeps "Previous" working); optionally a specific recording.
  function playSong(id, video) {
    const s = BY_ID.get(id);
    if (!s || !hasRec(s)) return;
    if (current && current.song.id === id && (!video || current.video.id === video.id)) { if (player) { player.playVideo(); wantPlay = true; updateButtons(); } return; }
    if (current) history.push(current);
    if (playlist && playlist.ids.includes(id)) playlist.idx = playlist.ids.indexOf(id);
    playItem({ song: s, video: video || pickVideo(s) });
  }

  // Start a playlist (from the feelings box) at position `from`. Filters are set to its moods
  // quietly, so shuffle continues in the same spirit once the list ends.
  function playPlaylist(ids, label, moods, from = 0) {
    clearTimeout(resetTimer);
    Object.assign(F, freshFilters(), { moods: moods || [] });
    savePrefs(); updateCounts();
    playlist = { label, ids, idx: from, moods: moods || [] };
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
    showNow(); $("#jb-next").innerHTML = "";
    showEmpty(); renderQueue(); saveSession();
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
      $("#jb-next").innerHTML = `${t("upNext")}: <a href="${songHref(back.song)}">${esc(title(back.song))}</a>`;
      renderQueue();
    }
  }
  // start(): resume what is playing; start(true): a fresh song from the (new) selection.
  function start(fresh = false) {
    if (!fresh && current && player) { player.playVideo(); wantPlay = true; updateButtons(); return; }
    if (fresh && current && !matches(current.song, F)) { history.length = 0; upNext = null; }
    next();
  }
  // Switch between the privacy-enhanced player and the standard one (YouTube Premium) without losing the place.
  function resetPlayer() {
    if (!player) return;
    const t0 = position();
    try { player.destroy(); } catch { /* already gone */ }
    player = null;
    if (!$("#yt-player")) { const d = document.createElement("div"); d.id = "yt-player"; $(".jb-player").prepend(d); }
    if (current) playItem(current, wantPlay, t0);
  }

  function showEmpty() {
    const n = pool().length;
    $("#jb-empty").hidden = !!current && n > 0;
    $("#jb-empty-msg").textContent = n ? t("pressPlay") : t("noPool");
    $("#jb-empty-clear").hidden = n > 0;
    $("#jb-empty-clear").textContent = t("clearAll");
    $("#jb-empty-play").hidden = !n;
    $("#jb-empty-play").innerHTML = `${I.play} ${t("play")}`;
    updateButtons();
  }

  function showNow() {
    const el = $("#jb-now");
    document.title = t("title");
    setSeasonTint((current && current.song.season) || currentSeason());
    if (!current) { el.innerHTML = `<p class="hint">${t("nothingPlaying")}</p>`; $("#jb-lyrics").innerHTML = ""; $("#jb-acts").innerHTML = ""; return; }
    const s = current.song, v = current.video;
    el.innerHTML = `<div class="lab">${t("nowPlaying")}${s.season ? ` · ${esc(nameOf("season", s.season))}` : ""}</div>
      <h2><a href="${songHref(s)}">${esc(title(s))}</a></h2>
      ${titleEn(s) ? `<p class="sub-en">${esc(titleEn(s))}</p>` : ""}
      <p class="meta">${(v.singers || []).length ? `${t("singer")}: <b>${esc(singerNames(v.singers))}</b> · ` : ""}${[nameOf("parjay", s.parjay), nameOf("raag", s.raag), nameOf("taal", s.taal)].filter(Boolean).map(esc).join(" · ")}</p>
      <p class="hint vt">${esc(v.t)} — ${esc(v.ch)}</p>
      <p class="chips">${(s.moods || []).map((m) => `<a class="chip sm" href="#/list/mood/${enc(m)}">${esc(nameOf("mood", m))}</a>`).join("")}</p>`;
    $("#jb-acts").innerHTML = `${askAiLink(s, "btn ghost sm")}<a class="btn ghost sm" id="jb-yt" href="${ytLink(v.id)}" target="_blank" rel="noopener" title="${esc(t("openYtT"))}">${I.yt} ${t("openYt")}</a><button class="btn ghost sm" type="button" id="jb-never" title="${esc(t("neverT"))}">${t("never")}</button>`;
    $("#jb-yt").addEventListener("click", (e) => { e.currentTarget.href = ytLink(v.id, position()); });
    $("#jb-never").onclick = () => { if (!current) return; toggle("never", current.song.id, true); prefsChanged(); toast(t("toastNever")); next(); };
    $("#jb-lyrics").innerHTML = s.lyrics ? `<div class="leaf ruled"><div class="hw" aria-hidden="true"></div><pre class="lyrics bn">${esc(s.lyrics)}</pre></div>` : "";
  }

  const playing = () => !!(player && current && wantPlay);
  function updateButtons() {
    const on = !!current, n = pool().length;
    $("#jb-skip").disabled = !on || !n; $("#jb-like").disabled = !on;
    $("#jb-prev").disabled = !history.length;
    $("#jb-play").disabled = !on && !n;
    $("#jb-seek").disabled = !on;
    const liked = on && isLiked(current.song.id);
    $("#jb-like").setAttribute("aria-pressed", String(liked));
    $("#jb-like").innerHTML = liked ? I.heartF : I.heart;
    $("#jb-like").classList.toggle("on", liked);
    $("#jb-play").innerHTML = playing() ? I.pause : I.play;
    $("#jb-play").setAttribute("aria-label", !on ? t("play") : playing() ? t("pause") : t("resume"));
    updateMini();
  }
  /* The persistent player bar (every page except the jukebox). */
  function updateMini() {
    const show = !!current && location.hash.indexOf("#/jukebox") !== 0;
    $("#mini").hidden = !show;
    document.body.classList.toggle("has-mini", show);
    if (!current) return;
    const s = current.song, v = current.video;
    $("#mini-main").textContent = title(s);
    $("#mini-sub").textContent = `${(v.singers || []).length ? singerNames(v.singers) : v.ch}${upNext ? ` · ${t("upNext")}: ${title(upNext.song)}` : ""}`;
    $("#mini-thumb").src = thumb(v.id);
    $("#mini-title").setAttribute("aria-label", `${t("jukebox")}: ${title(s)}`);
    $("#mini-play").innerHTML = playing() ? I.pause : I.play;
    $("#mini-play").setAttribute("aria-label", playing() ? t("pause") : t("play"));
    $("#mini-like").setAttribute("aria-pressed", String(isLiked(s.id)));
    $("#mini-like").innerHTML = isLiked(s.id) ? I.heartF : I.heart;
    $("#mini-like").classList.toggle("on", isLiked(s.id));
    $("#mini-yt").href = ytLink(v.id, position());
  }
  /* progress: the seek line in the jukebox and the thin line / timer of the player bar */
  let seeking = false;
  function setProgress(c, d) {
    const pct = d ? Math.min(100, Math.max(0, c / d * 100)) : 0;
    if (!seeking) $("#jb-seek").value = String(Math.round(pct * 10));
    $("#jb-cur").textContent = fmtTime(c); $("#jb-dur").textContent = d ? fmtTime(d) : "–:––";
    $("#mini-bar").style.width = `${pct}%`;
    $("#mini-time").textContent = `${fmtTime(c)} / ${d ? fmtTime(d) : "–:––"}`;
  }
  function tick() { if (!current) return; setProgress(position(), duration()); }

  /* filters */
  function countWith(key, value) {
    const f = { ...F, [key]: ARR[key] ? [value] : value };
    return pool(f).length;
  }
  function pills(key, values, labelFn = (v) => v) {
    return `<div class="pillset">${values.map((v) => `<label><input type="checkbox" name="${key}" value="${esc(v)}"${F[key].includes(v) ? " checked" : ""}><span class="chip">${esc(labelFn(v))} <small data-count></small></span></label>`).join("")}</div>`;
  }
  // Raag and singer: type-to-find boxes with the matching names as chips (the first ten, or all matches of a query).
  function namePills(key, kind) {
    const withRec = SONGS.filter(hasRec);
    const names = key === "raag" ? [...new Set(withRec.map((s) => s.raag).filter(Boolean))].sort() : [...new Set(withRec.flatMap(singersOf))].sort((a, b) => a.localeCompare(b));
    const q = findQ[key];
    const shown = findNames(names, q).filter((v) => countWith(key, v) || F[key] === v).slice(0, q ? 30 : 10);
    if (F[key] && !shown.includes(F[key])) shown.unshift(F[key]);
    return `<div class="pillset">${shown.map((v) => `<button type="button" class="chip" data-fk="${key}" data-fv="${esc(v)}" aria-pressed="${F[key] === v}">${esc(nameOf(kind, v))} <small>${num(countWith(key, v))}</small></button>`).join("")}</div>`;
  }
  function renderFilters() {
    const parjays = groupsOf("parjay").map(([v]) => v);
    $("#jb-filters").innerHTML = `
      <div class="grp"><h4>${t("mood")}</h4>${pills("moods", Object.keys(META.moods), (m) => nameOf("mood", m))}</div>
      <div class="grp"><h4>${t("season")}</h4>${pills("seasons", SEASON_ORDER, (v) => `${nameOf("season", v)}${L === "bn" ? "" : ` ${SEASON_BN[v]}`}`)}</div>
      <div class="grp"><h4>${t("parjay")}</h4>${pills("parjays", parjays, (v) => nameOf("parjay", v))}</div>
      <div class="grp"><h4>${t("raag")}</h4><div class="find"><span class="ic">${I.search}</span><input class="mini-search" type="search" id="jb-raag-q" autocomplete="off" placeholder="${esc(t("typeFind"))}" aria-label="${esc(t("raag"))}" value="${esc(findQ.raag)}"></div><div id="jb-raag"></div></div>
      <div class="grp"><h4>${t("singer")}</h4><div class="find"><span class="ic">${I.search}</span><input class="mini-search" type="search" id="jb-singer-q" autocomplete="off" placeholder="${esc(t("typeFind"))}" aria-label="${esc(t("singer"))}" value="${esc(findQ.singer)}"></div><div id="jb-singer"></div>
        <label class="toggle"><input type="checkbox" id="jb-liked"${F.likedOnly ? " checked" : ""}> ${t("likedOnly")}</label></div>`;
    for (const key of ["raag", "singer"]) $(`#jb-${key}-q`).oninput = (e) => { findQ[key] = e.target.value; drawNames(); };
    $("#jb-filters").onchange = (e) => {
      const el = e.target;
      if (el.classList.contains("mini-search")) return;
      if (ARR[el.name]) F[el.name] = $$(`input[name="${el.name}"]:checked`, $("#jb-filters")).map((x) => x.value);
      else if (el.id === "jb-liked") F.likedOnly = el.checked;
      filtersChanged();
    };
    $("#jb-filters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-fk]"); if (!b) return;
      F[b.dataset.fk] = F[b.dataset.fk] === b.dataset.fv ? "" : b.dataset.fv;
      filtersChanged();
    });
    updateCounts();
  }
  function drawNames() { $("#jb-raag").innerHTML = namePills("raag", "raag"); $("#jb-singer").innerHTML = namePills("singer", "singer"); }
  // Each option shows how many songs you'd get by choosing it (other filters unchanged); zero = greyed out.
  function updateCounts() {
    $$("#jb-filters input[name]").forEach((inp) => {
      const n = countWith(inp.name, inp.value);
      inp.checked = F[inp.name].includes(inp.value);
      inp.disabled = !n && !inp.checked;
      inp.nextElementSibling.querySelector("[data-count]").textContent = num(n);
    });
    drawNames();
    $("#jb-liked").checked = F.likedOnly;
    renderFilterBar();
  }
  function renderFilterBar() {
    const n = pool().length;
    $("#jb-count").textContent = t("toPlay", n);
    $("#sheet-count").textContent = t("toPlay", n);
    const chips = [
      ...F.moods.map((v) => ["moods", v, nameOf("mood", v)]), ...F.seasons.map((v) => ["seasons", v, nameOf("season", v)]),
      ...F.parjays.map((v) => ["parjays", v, nameOf("parjay", v)]),
      ...(F.raag ? [["raag", F.raag, `${t("raag")} ${nameOf("raag", F.raag)}`]] : []), ...(F.singer ? [["singer", F.singer, nameOf("singer", F.singer)]] : []),
      ...(F.likedOnly ? [["likedOnly", "", t("likedOnly")]] : []),
    ];
    $("#jb-active").innerHTML = chips.length
      ? chips.map(([k, v, l]) => `<button class="chip on x" type="button" data-k="${k}" data-v="${esc(v)}" aria-label="${esc(t("removeFilter", l))}">${esc(l)}</button>`).join("") +
        `<button class="chip" type="button" id="jb-clear">${t("clearAll")}</button>`
      : `<span class="hint">${t("allRec")}</span>`;
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
      $("#jb-queue-h").textContent = `${t("yourPlaylist")}: ${playlist.label || t("forMood")}`;
      $("#jb-queue-count").textContent = `${num(Math.min(playlist.idx + 1, list.length))} / ${num(list.length)} · ${t("thenMore")}`;
    } else {
      list = pool();
      const order = (s) => s === current?.song ? 0 : s === upNext?.song ? 1 : 2;
      list.sort((a, b) => order(a) - order(b) || (a.pop || 9999) - (b.pop || 9999) || title(a).localeCompare(title(b)));
      $("#jb-queue-h").textContent = t("inSelection");
      $("#jb-queue-count").textContent = t("songsCount", list.length);
    }
    const shown = queueAll ? list : list.slice(0, 25);
    $("#jb-queue").innerHTML = shown.map((s, i) => {
      const singers = singersOf(s), v = s === current?.song ? current.video : s.videos[0];
      const tag = s === current?.song ? `<span class="badge now">${t("nowPlaying")}</span>` : s === upNext?.song ? `<span class="badge">${t("upNext")}</span>` : "";
      return `<li class="${s === current?.song ? "is-now" : ""}">
        <span class="q-num">${num(i + 1)}</span>
        <span class="thw"><img class="th" src="${thumb(v.id)}" alt="" loading="lazy"><button type="button" data-play-id="${esc(s.id)}" aria-label="${esc(t("play"))}: ${esc(title(s))}">${I.play}</button></span>
        <div class="q-main"><span><a href="${songHref(s)}" class="q-title">${esc(title(s))}</a>${isLiked(s.id) ? ` <span class="liked" title="${esc(t("liked"))}">♥</span>` : ""} ${tag}</span>
          <span class="q-singers">${singers.length ? singers.map((n) => n === F.singer ? `<strong>${esc(nameOf("singer", n))}</strong>` : esc(nameOf("singer", n))).join(", ") : `<span class="hint">${t("unknownSinger")}</span>`}</span></div>
        <span class="q-ex"><a class="btn icon sm ghost ask-ai" href="${askAiUrl(s)}" target="_blank" rel="noopener" title="${esc(t("askAiT"))}" aria-label="${esc(t("askAi"))}: ${esc(title(s))}">${I.spark}</a><a class="btn icon sm ghost" href="${ytLink(v.id)}" target="_blank" rel="noopener" title="${esc(t("openYtT"))}" aria-label="${esc(t("openYt"))}: ${esc(title(s))}">${I.yt}</a></span>
      </li>`;
    }).join("") || `<li class="hint">${t("noPool")}</li>`;
    $("#jb-queue-more").hidden = list.length <= 25;
    $("#jb-queue-more").textContent = queueAll ? t("showFewer") : t("showAll", list.length);
  }
  function clearFilters() { Object.assign(F, freshFilters()); findQ.raag = findQ.singer = ""; $$("#jb-filters .mini-search").forEach((i) => { i.value = ""; }); filtersChanged(); }
  function setFilter(kind, value) {
    const key = { mood: "moods", parjay: "parjays", season: "seasons" }[kind];
    setFilters(key ? { [key]: [value] } : kind === "raag" ? { raag: value } : kind === "singer" ? { singer: value } : {});
  }
  // Replace all filters with the given ones (unspecified ones are cleared).
  function setFilters(f) {
    Object.assign(F, freshFilters(), f);
    filtersChanged(true);
  }
  const countFor = (f) => pool({ ...freshFilters(), ...f }).length;

  // Likes or never-play changed anywhere: counts, buttons and the playlist follow.
  function prefsChanged() { if (SONGS.length) { updateCounts(); updateButtons(); renderQueue(); } }

  function togglePlay() {
    if (!current || !player) return next();
    if (wantPlay) player.pauseVideo(); else player.playVideo();
    wantPlay = !wantPlay;
    updateButtons();
  }
  function likeCurrent() {
    if (!current) return;
    const on = !isLiked(current.song.id);
    toggle("likes", current.song.id, on); prefsChanged();
    toast(on ? t("toastLiked") : t("toastUnliked"));
  }
  /* the filter sheet (a bottom sheet on the phone, a panel on desktop) */
  let sheetOpener = null;
  function toggleFilters(open) {
    const sh = $("#sheet");
    sh.classList.toggle("on", open); $("#sheet-bg").classList.toggle("on", open);
    sh.setAttribute("aria-hidden", String(!open));
    $("#jb-edit").setAttribute("aria-expanded", String(open));
    if (open) { sheetOpener = document.activeElement; setTimeout(() => { const f = $("#sheet input, #sheet button"); if (f) f.focus(); }, 60); }
    else if (sheetOpener && sheetOpener.focus) { sheetOpener.focus(); sheetOpener = null; }
  }
  // Re-draw everything that has words in it (after a language switch).
  function relabel() { renderFilters(); showNow(); showEmpty(); renderQueue(); updateButtons(); tick(); }
  // YouTube Premium: the standard player (sees the YouTube sign-in) instead of the privacy-enhanced one.
  function setPremium(on) { prefs.adsOptOut = !on; savePrefs(); resetPlayer(); }
  // Signing in or out can change which player is used: rebuild it (keeping the place) only if it changed.
  let lastHost = null;
  function hostChanged() { const h = ytHost(); if (lastHost && h !== lastHost && player) resetPlayer(); lastHost = h; }
  // Prefs changed from outside (account sync): redraw filters, lists and the playlist.
  function refresh() { renderFilters(); planNext(); renderQueue(); updateButtons(); }

  function init() {
    renderFilters(); showEmpty(); renderQueue();
    $("#jb-play").onclick = togglePlay;
    $("#jb-empty-play").onclick = () => start();
    $("#jb-skip").onclick = next;
    $("#jb-prev").onclick = prev;
    $("#jb-like").onclick = likeCurrent;
    $("#jb-empty-clear").onclick = clearFilters;
    $("#jb-edit").onclick = () => toggleFilters(!$("#sheet").classList.contains("on"));
    $("#sheet-done").onclick = () => toggleFilters(false);
    $("#sheet-bg").onclick = () => toggleFilters(false);
    $("#sheet-clear").onclick = clearFilters;
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#sheet").classList.contains("on")) toggleFilters(false); });
    $("#mini-play").onclick = togglePlay;
    $("#mini-skip").onclick = next;
    $("#mini-like").onclick = likeCurrent;
    $("#mini-yt").addEventListener("click", (e) => { if (current) e.currentTarget.href = ytLink(current.video.id, position()); });
    $("#jb-queue").onclick = (e) => { const b = e.target.closest("[data-play-id]"); if (b) playSong(b.dataset.playId); };
    $("#jb-queue-more").onclick = () => { queueAll = !queueAll; renderQueue(); };
    const seek = $("#jb-seek");
    seek.oninput = () => { seeking = true; $("#jb-cur").textContent = fmtTime(duration() * seek.value / 1000); };
    seek.onchange = () => { seeking = false; if (player && player.seekTo) player.seekTo(duration() * seek.value / 1000, true); tick(); };
    setInterval(() => { if (current) saveSession(); }, 15000);
    setInterval(tick, 1000);
    window.addEventListener("pagehide", saveSession);
    document.addEventListener("visibilitychange", () => { if (document.hidden) saveSession(); });
  }

  return { init, start, setFilter, setFilters, countFor, prefsChanged, playPlaylist, playSong, updateMini, relabel, refresh, setPremium, hostChanged, saveSession, resume, preload: loadApi,
    current: () => current, pause: () => { try { player && player.pauseVideo(); } catch { /* not ready */ } wantPlay = false; updateButtons(); } };
})();

function playFiltered(kind, value) {
  jb.setFilter(kind, value);
  location.hash = "#/jukebox";
  jb.start(true);
}

/* ---------------- static page text + language switch ---------------- */
function applyStaticText() {
  document.documentElement.lang = L;
  document.title = t("title");
  $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
  $$("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  $$(".lang-switch").forEach((sw) => { sw.textContent = t("switchTo"); sw.setAttribute("aria-label", t("switchLabel")); sw.lang = L === "bn" ? "en" : "bn"; });
}
function setLang(l, save = true) {
  L = l;
  try { localStorage.setItem(LANG_KEY, L); } catch { /* storage unavailable */ }
  applyStaticText();
  if (SONGS.length) { jb.relabel(); route(); renderAccount(); }
  if (save) savePrefs(); // so the account (if signed in) keeps the language too
}
$$(".lang-switch").forEach((b) => b.onclick = () => setLang(L === "bn" ? "en" : "bn"));
applyStaticText();

/* ---------------- account (Google sign-in via sync.js) ---------------- */
function renderAccount() {
  const el = $("#account");
  if (!el) return;
  if (!SYNC.signIn) { el.hidden = true; return; }
  el.hidden = false;
  const u = SYNC.user;
  if (!u) {
    el.innerHTML = `<button class="pill signin" type="button" id="acct-in" aria-label="${esc(t("signIn"))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg><span class="lbl-short">${t("signInShort")}</span><span class="lbl-long">${t("signIn")}</span></button>`;
    $("#acct-in").onclick = () => SYNC.signIn();
    return;
  }
  const initial = (u.name || u.email || "?").trim()[0].toUpperCase();
  el.innerHTML = `<details class="acct-menu"><summary class="acct-btn" aria-label="${esc(t("account"))}">
      ${u.photo ? `<img class="avatar" src="${esc(u.photo)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(initial)}</span>`}</summary>
    <div class="acct-pop">
      <p><strong>${esc(u.name || "")}</strong><br><small class="hint">${esc(u.email || "")}</small></p>
      <p class="hint">${t("syncNote")}</p>
      <label class="toggle"><input type="checkbox" id="acct-premium"${noAds() ? " checked" : ""}> ${t("premiumMenu")}</label>
      <p class="hint">${t("premiumNote")}</p>
      ${SYNC.lastSync ? `<p class="hint">${t("syncedAt", num(new Date(SYNC.lastSync).toLocaleTimeString(L === "bn" ? "bn-IN" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })))}</p>` : ""}
      <button class="btn ghost sm" type="button" id="acct-out">${t("signOut")}</button>
      <button class="btn danger sm" type="button" id="acct-del">${t("deleteData")}</button>
    </div></details>`;
  $("#acct-premium").onchange = (e) => jb.setPremium(e.target.checked);
  $("#acct-out").onclick = () => SYNC.signOut();
  $("#acct-del").onclick = () => { if (confirm(t("deleteConfirm"))) SYNC.deleteData(); };
  const d = $("details", el);
  document.addEventListener("click", (e) => { if (d.open && !d.contains(e.target)) d.open = false; });
}
SYNC.userChanged = () => {
  renderAccount();
  if (location.hash.startsWith("#/mine") && SONGS.length) renderMine();
  jb.hostChanged(); // signed in: standard player (no ads with Premium); signed out: privacy-enhanced player
};
SYNC.onError = (e) => {
  console.warn("Anandadhara sync:", e);
  if (e && /popup-closed|cancelled-popup|permission-denied/.test(e.code || "")) return; // denied writes (rules not yet published): data stays local
  toast(t("syncError", (e && (e.code || e.message)) || ""));
};

/* ---------------- resume where you left off ---------------- */
function loadSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (!s || Date.now() - s.at > 30 * 864e5) return null; // older than 30 days: start fresh
    const page = s.route && s.route !== "#/" && s.route !== "#" ? s.route : "";
    return (s.id && BY_ID.has(s.id)) || page ? s : null;
  } catch { return null; }
}
function pageName(hash) {
  const [kind, a, b] = hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (kind === "song" && BY_ID.get(a)) return title(BY_ID.get(a));
  if (kind === "jukebox") return t("jukebox");
  if (kind === "mine") return t("mine");
  if (kind === "list") return b && a !== "parjay" ? nameOf(a, b) : t("browse");
  if (kind === "browse") return t("browse");
  return "";
}
function askResume(s) {
  const dlg = $("#resume"), song = s.id && BY_ID.get(s.id);
  if (!dlg || typeof dlg.showModal !== "function" || dlg.open) { holdSession = false; return; }
  if (song) jb.preload(); // so playback can start straight from the click on "Continue"
  $("#resume-title").textContent = t("welcome");
  $("#resume-text").innerHTML = song
    ? t("resumePlaying", `<strong>${esc(title(song))}</strong>`, fmtTime(s.t || 0))
    : t("resumePage", `<strong>${esc(pageName(s.route) || s.route)}</strong>`);
  $("#resume-yes").textContent = t("resumeYes");
  $("#resume-no").textContent = t("resumeNo");
  $("#resume-yes").onclick = () => {
    dlg.close(); holdSession = false;
    if (s.route && s.route !== location.hash) location.hash = s.route;
    jb.resume(s);
  };
  $("#resume-no").onclick = () => {
    dlg.close(); holdSession = false;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
    jb.saveSession();
    if (location.hash !== "#/") location.hash = "#/";
  };
  dlg.addEventListener("cancel", () => $("#resume-no").onclick(), { once: true }); // Esc = No
  dlg.showModal();
}

/* ---------------- router ---------------- */
function route() {
  $$(".acct-menu[open]").forEach((d) => { d.open = false; }); // a menu left open must not cover the next page
  const parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  const page = parts[0] || "home";
  const isJb = page === "jukebox";
  document.body.dataset.page = page;
  $("#jukebox").classList.toggle("offstage", !isJb);
  $("#jukebox").setAttribute("aria-hidden", String(!isJb));
  view.hidden = isJb;
  $$("[data-nav]").forEach((a) => a.removeAttribute("aria-current"));
  const nav = { home: "home", song: "home", browse: "browse", list: "browse", jukebox: "jukebox", mine: "mine" }[page];
  $$(`[data-nav="${nav}"]`).forEach((a) => a.setAttribute("aria-current", "page"));
  jb.updateMini();
  lastPage = location.hash || "#/";
  jb.saveSession();
  if (!isJb && page !== "song" && !(page === "list" && parts[1] === "season")) setSeasonTint(currentSeason());
  if (isJb) { window.scrollTo(0, 0); return; }
  if (page === "song") renderSong(parts[1]);
  else if (page === "browse") renderBrowse(parts[1]);
  else if (page === "list" && parts[1] === "parjay") renderList("parjay", parts[2], parts[3] || "");
  else if (page === "list") renderList(parts[1], parts.slice(2).join("/"));
  else if (page === "mine") renderMine();
  else renderHome();
  if (page !== "home") { window.scrollTo(0, 0); view.focus({ preventScroll: true }); }
}

/* ---------------- data ---------------- */
// The feelings word list is optional: without it the site works, just without the feelings box.
const feelingsLoad = fetch("feelings.json?v=1").then((r) => (r.ok ? r.json() : null)).catch(() => null);
function load() {
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
    const startHash = location.hash;
    window.addEventListener("hashchange", route);
    route();
    renderAccount();
    // Load the language model in the background; show "How are you feeling?" when it's ready.
    // Not on data-saving or 2G connections: there the box stays hidden.
    if (FEEL && mayPreload()) warmUp().then(() => {
      const box = $("#feel-box");
      if (M.ready && box && box.hidden) { box.hidden = false; renderFeel(box); }
    });
    // Coming back to the home page: offer to continue where the last visit stopped (on any device, when signed in).
    // A shared link opens directly; a page refresh quietly restores the playlist and cues the song where it was.
    SYNC.ready.then(() => {
      const nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      const reload = !!nav && nav.type === "reload";
      const home = !startHash || startHash === "#/" || startHash === "#";
      const session = loadSession();
      if (reload && session && session.id) { holdSession = false; jb.resume(session, false); }
      else if (!reload && home && session && (location.hash || "#/") === (startHash || "#/")) askResume(session);
      else holdSession = false;
    });
  }).catch((e) => {
    view.innerHTML = `<div class="empty"><b>${t("loadError", esc(e.message))}</b><p><button class="btn sm" type="button" id="retry">${t("retry")}</button></p></div>`;
    $("#retry").onclick = load;
    console.error(e);
  });
}
load();
