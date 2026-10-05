/* Shared core for the three Anandadhara design mockups (a/b/c.html).
   Data, bilingual strings, Bengali calendar, search, playlist logic, player state and the hash router live here;
   every look (markup + CSS) lives in its own html file. Nothing here is the final site code — it is a prototype. */
"use strict";
window.AD = (() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const enc = encodeURIComponent;
  const CONCEPT = document.documentElement.dataset.concept || "x";
  const KEY = "anandadhara.mock." + CONCEPT;

  /* ---------- persisted state (this browser only; "sign in" would sync it) ---------- */
  const state = Object.assign({ lang: "bn", theme: "", likes: [], never: [], recent: [], resume: null, premium: false, signedIn: false, filters: {} },
    (() => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } };
  const isLiked = (id) => state.likes.includes(id), isNever = (id) => state.never.includes(id);
  function toggleList(list, id, on) {
    state[list] = state[list].filter((x) => x !== id);
    if (on) { state[list].push(id); const o = list === "likes" ? "never" : "likes"; state[o] = state[o].filter((x) => x !== id); }
    save(); emit("prefs");
  }

  /* ---------- bilingual strings ---------- */
  const BD = "০১২৩৪৫৬৭৮৯";
  const num = (n) => state.lang === "bn" ? String(n).replace(/\d/g, (d) => BD[d]) : String(n);
  const T = {
    bn: {
      listen: "শুনুন", browse: "খুঁজুন", jukebox: "জুকবক্স", mine: "আমার", search: "খোঁজ", searchPh: "গানের নাম বা একটি পঙ্‌ক্তি…",
      feelH: "মন কেমন আছে?", feelHint: "নিজের কথায় লিখুন, বাংলায় বা English-এ — গানের তালিকা তৈরি হবে",
      feelPh: "যেমন: বৃষ্টির দিনে মন খারাপ · missing my mother · পরীক্ষার আগে সাহস চাই", makeList: "আমার তালিকা বানাও", songsN: "গান:",
      recognised: "যে কথা বুঝলাম:", notFound: "এই কথায় কোনো ভাব খুঁজে পাইনি। নীচের ভাব থেকে বেছে নিন।", playList: "এই তালিকা বাজাও",
      anotherMix: "অন্য রকম", modelNote: "আসল সাইটে ভাষা-মডেলও কথা বোঝে; এই নমুনায় শুধু শব্দমিল।",
      listenNow: "এখন শুনুন", ofSongs: (a, b) => `${num(b)}টি গানের ${num(a)}টির রেকর্ডিং আছে · প্রতিদিন বাড়ছে`,
      seasonNow: (s) => `এখন ${s}`, playSeason: (s) => `${s}ের গান বাজাও`, seasonSongs: (n) => `ঋতুর ${num(n)}টি গান তৈরি`,
      seasonSoon: "এই ঋতুর রেকর্ডিং আসছে", moods: "ভাব অনুসারে", wellKnown: "সুপরিচিত গান", all: (n) => `সব ${num(n)}`,
      exploreAll: (n) => `${num(n)}টি গান ঘুরে দেখুন`, byParjay: "পর্যায়", bySeason: "ঋতু", byMood: "ভাব", byRaag: "রাগ", byTaal: "তাল",
      byDrama: "নৃত্যনাট্য", bySinger: "শিল্পী", byAz: "বর্ণানুক্রমে", popular: "সুপরিচিত", comingSoon: "শিগগির",
      songsCount: (n) => `${num(n)}টি গান`, recN: (n) => `${num(n)} রেকর্ডিং`, recOnly: (a, b) => `শুধু রেকর্ডিং-সহ (${num(a)} / ${num(b)})`,
      showMore: (n) => `আরও ${num(n)}টি`, noRec: "রেকর্ডিং এখনও আসেনি", notYet: "এই গানের রেকর্ডিং এখনও খোঁজা হয়নি — প্রতিদিন নতুন গান যোগ হয়।",
      noMatch: "ইউটিউবে মেলানো রেকর্ডিং পাওয়া যায়নি।", recordings: "রেকর্ডিং", moreLike: "এমন আরও গান", moreLikeHint: "এই গানের ভাব, রাগ, উপ-পর্যায় বা ঋতু যাদের মিল",
      playLike: "এমন গান বাজাও", like: "পছন্দ", liked: "পছন্দ হয়েছে", never: "জুকবক্সে বাজাবে না", nevered: "জুকবক্স থেকে সরানো", askAi: "AI-কে জিজ্ঞাসা: অর্থ",
      askAiT: "ChatGPT নতুন ট্যাবে খোলে, গানের কথা ও প্রশ্ন সমেত", openYt: "YouTube-এ খুলুন", views: "বার দেখা", singer: "শিল্পী", unknownSinger: "শিল্পী চিহ্নিত হয়নি",
      parjay: "পর্যায়", season: "ঋতু", drama: "নাট্য", raag: "রাগ", taal: "তাল", mood: "ভাব", written: "রচনা", source: "সূত্র", lyricsNA: "বাংলা কথা এখানে নেই।",
      srcGb: "English transliteration, স্বরলিপি ও প্রসঙ্গ: geetabitan.com", srcWs: "বাংলা উইকিসংকলন",
      play: "বাজাও", pause: "থামাও", resume: "আবার", next: "পরের গান", prev: "আগের গান", upNext: "এরপর", nowPlaying: "বাজছে",
      pressPlay: "আপনার ছাঁকনি-মেলা গানের এলোমেলো তালিকা শুনতে ▶ চাপুন", noPool: "এই ছাঁকনিতে রেকর্ডিং-সহ গান নেই। একটি ছাঁকনি সরান।",
      filters: "ছাঁকনি", editFilters: "ছাঁকনি বদলান", done: "হল", clearAll: "সব মুছুন", allRec: "রেকর্ডিং-সহ সব গান", toPlay: (n) => `${num(n)}টি গান বাজবে`,
      likedOnly: "শুধু পছন্দের গান", anyRaag: "যেকোনো রাগ", anySinger: "যেকোনো শিল্পী", typeFind: "লিখে খুঁজুন…",
      inSelection: "এই নির্বাচনের গান", yourPlaylist: "আপনার তালিকা", thenMore: "তারপর এমন আরও", showAll: (n) => `সব ${num(n)}টি দেখান`, showFewer: "কম দেখান",
      mineH: "আমার গান", likedSongs: "পছন্দের গান", hiddenSongs: "জুকবক্স থেকে সরানো", recentH: "সম্প্রতি শোনা", noneLiked: "এখনও কিছু পছন্দ করেননি",
      noneLikedHint: "যেকোনো গানে ♥ চাপলে এখানে জমা হবে। পছন্দের গান জুকবক্সে ৪ গুণ বেশি বাজে।", none: "কিছু নেই", remove: "সরান", playAll: "সবগুলো বাজাও",
      localOnly: "শুধু এই ব্রাউজারে সংরক্ষিত। সব যন্ত্রে পেতে Google দিয়ে সাইন ইন করুন।", syncedAs: (e) => `${e} হিসেবে সিঙ্ক হচ্ছে`,
      welcome: "আবার স্বাগত", continueQ: (t) => `${t} — যেখানে থেমেছিলেন, সেখান থেকে চলবে?`, cont: "চালিয়ে যান", dismiss: "না, থাক",
      account: "অ্যাকাউন্ট", signIn: "Google দিয়ে সাইন ইন", signInHint: "পছন্দ, ‘বাজাবে না’ ও থামার জায়গা সব যন্ত্রে এক", signOut: "সাইন আউট",
      premium: "বিজ্ঞাপন ছাড়া দেখুন (YouTube Premium)", premiumHint: "আপনার YouTube অ্যাকাউন্টের প্লেয়ার ব্যবহার হবে", theme: "রাত্রি / দিন", language: "English",
      notSigned: "সাইন ইন করা নেই", demoNote: "নমুনা: কিছু বাজে না; সাইন ইন কাজ করে না", found: (n) => `${num(n)}টি গান পাওয়া গেল`, nothingFound: "কিছু পাওয়া যায়নি",
      subAll: "সব", bnDate: "বঙ্গাব্দ", home: "প্রথম পাতা", back: "ফিরুন", min: "মিনিট", by: "গেয়েছেন", playFrom: "এখান থেকে বাজাও", whyHint: "কেন",
      appName: "আনন্দধারা", tagline: "রবীন্দ্রসংগীত · ২১৫৬ গান", footer: "গানের তথ্য geetabitan.com ও বাংলা উইকিসংকলন থেকে। রেকর্ডিং YouTube থেকে বাজে। ব্যক্তিগত, অবাণিজ্যিক।",
    },
    en: {
      listen: "Listen", browse: "Browse", jukebox: "Jukebox", mine: "Mine", search: "Search", searchPh: "Search by title or a line of lyrics…",
      feelH: "How are you feeling?", feelHint: "Say it in your own words, in English or বাংলা, and get a playlist",
      feelPh: "e.g. missing my mother on a rainy evening · বৃষ্টির দিনে মন খারাপ · need courage before an exam", makeList: "Make my playlist", songsN: "Songs:",
      recognised: "Words I recognised:", notFound: "I couldn't find a feeling in those words. Choose one or more moods below.", playList: "Play this playlist",
      anotherMix: "Another mix", modelNote: "On the real site the in-browser language model also reads your words; this mockup matches words only.",
      listenNow: "Listen now", ofSongs: (a, b) => `${a} of ${b} songs have recordings · more every day`,
      seasonNow: (s) => `It's ${s} now`, playSeason: (s) => `Play ${s} songs`, seasonSongs: (n) => `${n} songs of the season ready`,
      seasonSoon: "Recordings for this season are on their way", moods: "By mood", wellKnown: "Well-known songs", all: (n) => `All ${n}`,
      exploreAll: (n) => `Explore all ${n} songs`, byParjay: "Parjay", bySeason: "Season", byMood: "Mood", byRaag: "Raag", byTaal: "Taal",
      byDrama: "Dance drama", bySinger: "Singer", byAz: "A–Z", popular: "Well-known", comingSoon: "coming soon",
      songsCount: (n) => `${n} song${n === 1 ? "" : "s"}`, recN: (n) => `${n} recording${n === 1 ? "" : "s"}`, recOnly: (a, b) => `Only with recordings (${a} of ${b})`,
      showMore: (n) => `Show ${n} more`, noRec: "Recordings coming soon", notYet: "Recordings for this song haven't been fetched yet; new songs are added every day.",
      noMatch: "No matching recording was found on YouTube.", recordings: "Recordings", moreLike: "More like this", moreLikeHint: "Songs that share this one's mood, raag, sub-group or season",
      playLike: "Play songs like this", like: "Like", liked: "Liked", never: "Never play in jukebox", nevered: "Hidden from jukebox", askAi: "Ask AI: meaning",
      askAiT: "Opens ChatGPT in a new tab with the lyrics and a question", openYt: "Open in YouTube", views: "views", singer: "Singer", unknownSinger: "singer not identified",
      parjay: "Parjay", season: "Season", drama: "Drama", raag: "Raag", taal: "Taal", mood: "Mood", written: "Written", source: "Source", lyricsNA: "Bengali lyrics are not available here.",
      srcGb: "Transliteration, notation and background: geetabitan.com", srcWs: "Bengali Wikisource",
      play: "Play", pause: "Pause", resume: "Resume", next: "Next song", prev: "Previous song", upNext: "Up next", nowPlaying: "Now playing",
      pressPlay: "Press ▶ for a shuffle of songs that match your filters", noPool: "No songs with recordings match these filters yet. Remove a filter.",
      filters: "Filters", editFilters: "Edit filters", done: "Done", clearAll: "Clear all", allRec: "All songs with recordings", toPlay: (n) => `${n} songs to play`,
      likedOnly: "Only liked songs", anyRaag: "Any raag", anySinger: "Any singer", typeFind: "Type to find…",
      inSelection: "Songs in this selection", yourPlaylist: "Your playlist", thenMore: "then more like these", showAll: (n) => `Show all ${n}`, showFewer: "Show fewer",
      mineH: "Mine", likedSongs: "Liked songs", hiddenSongs: "Hidden from jukebox", recentH: "Recently played", noneLiked: "Nothing liked yet",
      noneLikedHint: "Press ♥ on any song and it collects here. Liked songs come up 4× as often in the jukebox.", none: "None", remove: "Remove", playAll: "Play all",
      localOnly: "Saved in this browser only. Sign in with Google to keep them on every device.", syncedAs: (e) => `Syncing as ${e}`,
      welcome: "Welcome back", continueQ: (t) => `Continue ${t} from where you stopped?`, cont: "Continue", dismiss: "Not now",
      account: "Account", signIn: "Sign in with Google", signInHint: "Likes, never-play and resume points on every device", signOut: "Sign out",
      premium: "Watch without ads (YouTube Premium)", premiumHint: "Uses your own YouTube account's player", theme: "Night / day", language: "বাংলা",
      notSigned: "Not signed in", demoNote: "Mockup: sign-in is a stub", found: (n) => `${n} songs found`, nothingFound: "Nothing found",
      subAll: "All", bnDate: "Bangabda", home: "Home", back: "Back", min: "min", by: "Sung by", playFrom: "Play from here", whyHint: "why",
      appName: "Anandadhara", tagline: "Rabindrasangeet · 2,156 songs", footer: "Song data from geetabitan.com and Bengali Wikisource. Recordings play from YouTube. Personal, non-commercial.",
    },
  };
  const t = (k, ...a) => { const v = T[state.lang][k] ?? T.en[k] ?? k; return typeof v === "function" ? v(...a) : v; };

  /* ---------- Bengali names for data values ---------- */
  const MOOD_BN = { prem: "প্রেম", viraha: "বিরহ", bishad: "বিষাদ", ananda: "আনন্দ", shanti: "শান্তি", bhakti: "ভক্তি", "prakriti-bhava": "প্রকৃতি", utsav: "উৎসব", deshprem: "দেশপ্রেম", sahas: "সাহস", smriti: "স্মৃতি", kautuk: "কৌতুক" };
  const MOOD_DESC_BN = { prem: "প্রেম, মিলন, কোমলতা", viraha: "বিরহ, প্রতীক্ষা, দূরের জন", bishad: "দুঃখ, শোক, হতাশা", ananda: "আনন্দ, উল্লাস", shanti: "শান্তি, স্থৈর্য, সান্ত্বনা", bhakti: "ভক্তি, প্রার্থনা, সমর্পণ", "prakriti-bhava": "প্রকৃতি: বৃষ্টি, বসন্ত, আকাশ", utsav: "উৎসব, অনুষ্ঠান", deshprem: "স্বদেশপ্রেম", sahas: "সাহস, সংকল্প, জাগরণ", smriti: "স্মৃতি, ফেলে আসা দিন", kautuk: "কৌতুক, হাসি, খেলা" };
  const PARJAY_BN = { Puja: "পূজা", Prem: "প্রেম", Prakriti: "প্রকৃতি", Swadesh: "স্বদেশ", Bichitra: "বিচিত্র", Anushthanik: "আনুষ্ঠানিক", "Geetinatya O Nrityanatya": "গীতিনাট্য ও নৃত্যনাট্য", Natyageeti: "নাট্যগীতি", "Prem O Prakriti": "প্রেম ও প্রকৃতি", "Puja O Prarthana": "পূজা ও প্রার্থনা", "Bhanusingher Padabali": "ভানুসিংহের পদাবলী", "Anushthanik Sangeet": "আনুষ্ঠানিক সংগীত", "Jatiya Sangeet": "জাতীয় সংগীত", "Mantra Gaan": "মন্ত্র গান", Parishishta: "পরিশিষ্ট", Unclassified: "অশ্রেণীবদ্ধ" };
  const SUB_BN = { Borsha: "বর্ষা", Basanta: "বসন্ত", Sharat: "শরৎ", Grisma: "গ্রীষ্ম", Hemanta: "হেমন্ত", Sheet: "শীত", Bondhu: "বন্ধু", Biraha: "বিরহ", Dukkha: "দুঃখ", Prarthana: "প্রার্থনা", "Prem-Boichitra": "প্রেম-বৈচিত্র্য", Bibidha: "বিবিধ", Gaan: "গান", Bishwa: "বিশ্ব", Shesh: "শেষ", Sundar: "সুন্দর", Jaagoron: "জাগরণ", Aanondo: "আনন্দ", Poth: "পথ", "Saadhana O Sankalpa": "সাধনা ও সংকল্প", Baul: "বাউল", Antarmukhe: "অন্তর্মুখে", Bairagya: "বৈরাগ্য", Utsab: "উৎসব", Bibidho: "বিবিধ", Sadhak: "সাধক", Nishkromon: "নিষ্ক্রমণ" };
  const RAAG_BN = { Bhairavi: "ভৈরবী", Iman: "ইমন", Pilu: "পিলু", Behag: "বেহাগ", Khambaj: "খাম্বাজ", Kafi: "কাফি", Desh: "দেশ", Ramkeli: "রামকেলি", Kedara: "কেদারা", Kalingara: "কালাংড়া", Bahar: "বাহার", Malhar: "মল্লার", Baul: "বাউল", Kirtan: "কীর্তন", Bhimpalashri: "ভীমপলশ্রী", Jogiya: "যোগিয়া", Sahana: "সাহানা", Bhupali: "ভূপালী", Purabi: "পুরবী", Ashavari: "আশাবরী", Gaud: "গৌড়", Sindhu: "সিন্ধু", Mishra: "মিশ্র", Todi: "টোড়ি", Lalit: "ললিত", Bibhas: "বিভাস", Chhayanat: "ছায়ানট", Hambir: "হাম্বীর", Multani: "মুলতান", Paraj: "পরজ", Basant: "বসন্ত", Sarang: "সারং", Durga: "দুর্গা", Kanada: "কানাড়া", Kalyan: "কল্যাণ", Jhinjhit: "ঝিঁঝিট", Jhinjhoti: "ঝিঁঝিট", Bageshri: "বাগেশ্রী", Bhatiyali: "ভাটিয়ালি", Tilakkamod: "তিলককামোদ", Shyam: "শ্যাম", Megh: "মেঘ", Nat: "নট", Mallar: "মল্লার", Sohini: "সোহিনী", Suha: "সুহা", Barowa: "বারোয়াঁ" };
  const TAAL_BN = { Dadra: "দাদরা", Kaharba: "কাহারবা", Teora: "তেওরা", Jhaptal: "ঝাঁপতাল", Ektal: "একতাল", Tritaal: "ত্রিতাল", Trital: "ত্রিতাল", Rupak: "রূপক", Shasthi: "ষষ্ঠী", Jhampak: "ঝম্পক", Nabatal: "নবতাল", Ekadashi: "একাদশী", Surfanktal: "সুরফাঁকতাল", Chautal: "চৌতাল", Dhamar: "ধামার", Aratal: "আড়াতাল", Khemta: "খেমটা", "Nabo Panchatal": "নবপঞ্চতাল", Jhamptal: "ঝাঁপতাল" };
  const SINGER_BN = { "Jayati Chakraborty": "জয়তী চক্রবর্তী", "Rezwana Choudhury Bannya": "রেজওয়ানা চৌধুরী বন্যা", "Swagatalakshmi Dasgupta": "স্বাগতালক্ষ্মী দাশগুপ্ত", "Hemanta Mukherjee": "হেমন্ত মুখোপাধ্যায়", "Srikanto Acharya": "শ্রীকান্ত আচার্য", "Suchitra Mitra": "সুচিত্রা মিত্র", "Debabrata Biswas": "দেবব্রত বিশ্বাস", "Srabani Sen": "শ্রাবণী সেন", "Adity Mohsin": "অদিতি মহসিন", "Indrani Sen": "ইন্দ্রাণী সেন", "Kanika Bandyopadhyay": "কণিকা বন্দ্যোপাধ্যায়", "Lopamudra Mitra": "লোপামুদ্রা মিত্র", "Sagar Sen": "সাগর সেন", "Chinmoy Chatterjee": "চিন্ময় চট্টোপাধ্যায়", "Iman Chakraborty": "ইমন চক্রবর্তী", "Somlata Acharyya Chowdhury": "সোমলতা আচার্য চৌধুরী", "Sumitra Sen": "সুমিত্রা সেন", Shaan: "শান", "Subinoy Roy": "সুবিনয় রায়", "Kishore Kumar": "কিশোর কুমার", "Sahana Bajpaie": "সাহানা বাজপেয়ী", "Shreya Ghoshal": "শ্রেয়া ঘোষাল", "Arijit Singh": "অরিজিৎ সিং", "Manna Dey": "মান্না দে", "Sandhya Mukherjee": "সন্ধ্যা মুখোপাধ্যায়", "Pankaj Mullick": "পঙ্কজ মল্লিক", "Rupankar Bagchi": "রূপঙ্কর বাগচী", "Babul Supriyo": "বাবুল সুপ্রিয়", "Ritu Guha": "ঋতু গুহ", "Purba Dam": "পূর্বা দাম", "Shyamal Mitra": "শ্যামল মিত্র", "Mohan Singh": "মোহন সিং", "Pramita Mallick": "প্রমিতা মল্লিক", "Manoj Murali Nair": "মনোজ মুরলী নায়ার", "Papia Sarwar": "পাপিয়া সারোয়ার", "Mita Huq": "মিতা হক", "Sadi Mohammad": "সাদী মহম্মদ", "Rajeshwari Dutta": "রাজেশ্বরী দত্ত", "Bikram Singh": "বিক্রম সিং", "Ashoktaru Bandyopadhyay": "অশোকতরু বন্দ্যোপাধ্যায়", "Anup Ghoshal": "অনুপ ঘোষাল", "Kalika Prasad Bhattacharya": "কালিকাপ্রসাদ ভট্টাচার্য" };
  const SEASON_ORDER = ["Grishma", "Barsha", "Sharat", "Hemanta", "Sheet", "Basanta"];
  const SEASONS = {
    Grishma: { bn: "গ্রীষ্ম", months: "বৈশাখ–জ্যৈষ্ঠ", monthsEn: "Baishakh–Jaishtha", flower: "কৃষ্ণচূড়া", note: "দাবদাহ, ঝড়, কৃষ্ণচূড়া", noteEn: "heat, nor'westers, krishnachura" },
    Barsha: { bn: "বর্ষা", months: "আষাঢ়–শ্রাবণ", monthsEn: "Asharh–Shraban", flower: "কদম", note: "মেঘ, বৃষ্টি, কদম ফুল", noteEn: "clouds, rain, kadam flowers" },
    Sharat: { bn: "শরৎ", months: "ভাদ্র–আশ্বিন", monthsEn: "Bhadra–Ashwin", flower: "শিউলি", note: "কাশফুল, নীল আকাশ, শিউলি", noteEn: "kash grass, blue sky, shiuli" },
    Hemanta: { bn: "হেমন্ত", months: "কার্তিক–অগ্রহায়ণ", monthsEn: "Kartik–Agrahayan", flower: "ধান", note: "পাকা ধান, কুয়াশা, নবান্ন", noteEn: "ripe paddy, mist, nabanna" },
    Sheet: { bn: "শীত", months: "পৌষ–মাঘ", monthsEn: "Poush–Magh", flower: "সর্ষে", note: "কুয়াশা, সর্ষেখেত, পৌষমেলা", noteEn: "fog, mustard fields, Poush Mela" },
    Basanta: { bn: "বসন্ত", months: "ফাল্গুন–চৈত্র", monthsEn: "Falgun–Chaitra", flower: "পলাশ", note: "পলাশ, আবির, কোকিল", noteEn: "palash, abir, the cuckoo" },
  };
  const nameOf = (kind, v) => {
    if (!v) return "";
    if (state.lang !== "bn") return v;
    const m = { mood: MOOD_BN, parjay: PARJAY_BN, sub: SUB_BN, raag: RAAG_BN, taal: TAAL_BN, singer: SINGER_BN, season: Object.fromEntries(Object.entries(SEASONS).map(([k, s]) => [k, s.bn])) }[kind];
    return (m && m[v]) || v;
  };
  const moodDesc = (m) => state.lang === "bn" ? MOOD_DESC_BN[m] || "" : (META.moods || {})[m] || "";

  /* ---------- Bengali calendar (approximate: fixed Gregorian month starts, as the site's seasons use) ---------- */
  const BN_MONTHS = [["Baishakh", "বৈশাখ", 4, 14], ["Jaishtha", "জ্যৈষ্ঠ", 5, 15], ["Asharh", "আষাঢ়", 6, 15], ["Shraban", "শ্রাবণ", 7, 17], ["Bhadra", "ভাদ্র", 8, 17], ["Ashwin", "আশ্বিন", 9, 17], ["Kartik", "কার্তিক", 10, 18], ["Agrahayan", "অগ্রহায়ণ", 11, 17], ["Poush", "পৌষ", 12, 16], ["Magh", "মাঘ", 1, 15], ["Falgun", "ফাল্গুন", 2, 13], ["Chaitra", "চৈত্র", 3, 15]];
  function bengaliDate(d = new Date()) {
    const y = d.getFullYear();
    // the latest month start on or before today (this Gregorian year, else Chaitra of last year)
    let cur = null;
    for (const [en, bn, m, day] of BN_MONTHS) { const dt = new Date(y, m - 1, day); if (dt <= d && (!cur || dt > cur.date)) cur = { en, bn, date: dt }; }
    if (!cur) cur = { en: "Chaitra", bn: "চৈত্র", date: new Date(y - 1, 2, 15) };
    const day = Math.floor((d - cur.date) / 864e5) + 1;
    const bnYear = (d >= new Date(y, 3, 14)) ? y - 593 : y - 594;
    return { day, monthEn: cur.en, monthBn: cur.bn, year: bnYear,
      text: state.lang === "bn" ? `${num(day)} ${cur.bn} ${num(bnYear)}` : `${day} ${cur.en} ${bnYear}` };
  }
  function currentSeason(d = new Date()) {
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    if (md >= 414 && md < 615) return "Grishma";
    if (md >= 615 && md < 817) return "Barsha";
    if (md >= 817 && md < 1018) return "Sharat";
    if (md >= 1018 && md < 1216) return "Hemanta";
    if (md >= 1216 || md < 213) return "Sheet";
    return "Basanta";
  }

  /* ---------- data ---------- */
  let SONGS = [], BY_ID = new Map(), META = {}, FEEL = null;
  const title = (s) => state.lang === "bn" ? (s.bn || s.en || s.id) : (s.en || s.bn || s.id);
  const title2 = (s) => state.lang === "bn" ? (s.bn ? s.en : "") : (s.en ? s.bn : "");
  const hasRec = (s) => !!(s.videos && s.videos.length);
  const fmtViews = (n) => num(n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
  const fmtTime = (sec) => num(`${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`);
  const norm = (x) => (x || "").normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();
  const singersOf = (s) => [...new Set((s.videos || []).flatMap((v) => v.singers || []))];
  const KINDS = {
    popular: { key: "popular", get: null },
    parjay: { key: "byParjay", get: (s) => s.parjay ? [s.parjay] : [] },
    season: { key: "bySeason", get: (s) => s.season ? [s.season] : [] },
    mood: { key: "byMood", get: (s) => s.moods || [] },
    raag: { key: "byRaag", get: (s) => s.raag ? [s.raag] : [] },
    taal: { key: "byTaal", get: (s) => s.taal ? [s.taal] : [] },
    singer: { key: "bySinger", get: (s) => singersOf(s) },
    drama: { key: "byDrama", get: (s) => s.drama ? s.drama.split(", ") : [] },
    az: { key: "byAz", get: null },
  };
  function groupsOf(kind) {
    const m = new Map();
    for (const s of SONGS) for (const v of KINDS[kind].get(s)) { const g = m.get(v) || { n: 0, rec: 0 }; g.n++; g.rec += hasRec(s) ? 1 : 0; m.set(v, g); }
    const arr = [...m.entries()];
    if (kind === "season") arr.sort((a, b) => SEASON_ORDER.indexOf(a[0]) - SEASON_ORDER.indexOf(b[0]));
    else arr.sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
    return arr;
  }
  const popular = () => SONGS.filter((s) => s.pop).sort((a, b) => a.pop - b.pop);
  const listFor = (kind, value, sub) => {
    if (kind === "popular") return popular();
    if (kind === "az") return SONGS.slice().sort((a, b) => (a.en || "").localeCompare(b.en || ""));
    const all = SONGS.filter((s) => KINDS[kind].get(s).includes(value));
    return sub ? all.filter((s) => s.sub === sub) : all;
  };
  const subGroups = (list) => { const m = new Map(); for (const s of list) if (s.sub) m.set(s.sub, (m.get(s.sub) || 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]); };

  /* spelling-tolerant search (from the live site) */
  const BN_SKEL = {};
  [["কখ", "k"], ["গঘ", "g"], ["ঙঞণনং", "n"], ["চছ", "c"], ["জঝয", "j"], ["টঠতথৎ", "t"], ["ডঢদধ", "d"], ["রৃঋ", "r"], ["পফ", "p"], ["বভ", "b"], ["ম", "m"], ["ল", "l"], ["শষস", "s"]]
    .forEach(([chars, v]) => [...chars].forEach((c) => { BN_SKEL[c] = v; }));
  const LAT = [["chh", "c"], ["ch", "c"], ["sh", "s"], ["kh", "k"], ["gh", "g"], ["th", "t"], ["dh", "d"], ["ph", "p"], ["bh", "b"], ["jh", "j"], ["ng", "n"], ["w", "b"], ["v", "b"], ["f", "p"], ["z", "j"], ["q", "k"], ["x", "ks"], ["y", ""]];
  const dedupe = (x) => x.replace(/(.)\1+/g, "$1");
  const skelBn = (x) => dedupe([...(x || "").normalize("NFC").replace(/য়|য়/g, "").replace(/ড়|ঢ়|ড়|ঢ়/g, "র")].map((c) => BN_SKEL[c] || "").join(""));
  function skelEn(x) { x = (x || "").toLowerCase().replace(/[^a-z]/g, ""); for (const [a, b] of LAT) x = x.split(a).join(b); return dedupe(x.replace(/[aeiouh]/g, "")); }
  const isBengali = (x) => /[ঀ-৿]/.test(x);
  function searchSongs(q) {
    const nq = norm(q); if (!nq) return [];
    const qs = isBengali(q) ? skelBn(q) : skelEn(q), fuzzy = qs.length >= 4;
    const a = [], b = [], c = [], d = [], e = [];
    for (const s of SONGS) {
      if (s._title.startsWith(nq)) a.push(s); else if (s._title.includes(nq)) b.push(s);
      else if (fuzzy && s._skels.some((k) => k.startsWith(qs))) c.push(s); else if (fuzzy && s._skels.some((k) => k.includes(qs))) d.push(s);
      else if (s._lyrics.includes(nq) || (fuzzy && qs.length >= 5 && s._skelLyrics.includes(qs))) e.push(s);
    }
    return a.concat(b, c, d, e);
  }
  // type-to-find over names (singers, raags…): prefix first, then substring, then skeleton
  function findNames(names, q) {
    const nq = norm(q); if (!nq) return names;
    const qs = isBengali(q) ? skelBn(q) : skelEn(q);
    const score = (n) => { const nn = norm(n + " " + (SINGER_BN[n] || RAAG_BN[n] || "")); if (nn.startsWith(nq)) return 0; if (nn.includes(nq)) return 1; if (qs.length >= 3 && (skelEn(n).includes(qs) || skelBn(SINGER_BN[n] || RAAG_BN[n] || "").includes(qs))) return 2; return 9; };
    return names.map((n) => [score(n), n]).filter(([s]) => s < 9).sort((a, b) => a[0] - b[0]).map(([, n]) => n);
  }
  function relatedSongs(s, n = 8) {
    const moods = new Set(s.moods || []), out = [];
    for (const o of SONGS) {
      if (o.id === s.id) continue;
      let sc = 3 * (o.moods || []).filter((m) => moods.has(m)).length;
      if (s.raag && o.raag === s.raag) sc += 3;
      if (s.sub && o.sub === s.sub && o.parjay === s.parjay) sc += 2; else if (s.parjay && o.parjay === s.parjay) sc += 1;
      if (s.season && o.season === s.season) sc += 2;
      if (s.taal && o.taal === s.taal) sc += 0.5;
      if (sc < 4) continue;
      sc += hasRec(o) ? 1.5 : 0; sc += o.pop ? 0.5 : 0;
      out.push([sc, o]);
    }
    return out.sort((a, b) => b[0] - a[0]).slice(0, n).map(([, o]) => o);
  }

  /* feelings: word matching only (the real site adds the in-browser language model) */
  const POSITIVE = new Set(["ananda", "shanti", "prem", "utsav", "kautuk"]);
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let FP = null;
  function feelPattern(w) { if (isBengali(w)) return new RegExp(reEsc(w.normalize("NFC")), "g"); const p = reEsc(w.toLowerCase()).replace(/\\\*$/, "[a-z']*"); return new RegExp(`(?<![a-z])${p}(?![a-z])`, "g"); }
  function detectFeelings(text) {
    if (!FEEL) return { moods: [], season: null, hits: [] };
    if (!FP) {
      const list = []; FEEL.moods.forEach(({ mood, words }) => words.forEach((w) => list.push({ mood, w, re: feelPattern(w) })));
      list.sort((a, b) => b.w.length - a.w.length);
      FP = { list, seasons: FEEL.seasons.map(({ season, words }) => ({ season, res: words.map(feelPattern) })), neg: new RegExp(`(?<![a-z])(${FEEL.negations.map(reEsc).join("|")})\\s+(\\S+\\s+)?$`) };
    }
    const tt = (text || "").normalize("NFC").toLowerCase(); let work = tt; const scores = {}, hits = [];
    for (const { mood, re } of FP.list) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(work))) {
        const negated = !isBengali(m[0]) && FP.neg.test(tt.slice(Math.max(0, m.index - 25), m.index));
        if (negated && POSITIVE.has(mood)) { scores.bishad = (scores.bishad || 0) + 0.8; hits.push({ word: `not ${m[0].trim()}`, mood: "bishad" }); }
        else if (!negated) { scores[mood] = (scores[mood] || 0) + 1; hits.push({ word: m[0].trim(), mood }); }
        work = work.slice(0, m.index) + " ".repeat(m[0].length) + work.slice(m.index + m[0].length);
      }
    }
    let season = null, best = 0;
    for (const { season: name, res } of FP.seasons) { const n = res.reduce((c, re) => { re.lastIndex = 0; return c + (tt.match(re) || []).length; }, 0); if (n > best) { best = n; season = name; } }
    const max = Math.max(0, ...Object.values(scores));
    const moods = Object.entries(scores).filter(([, s]) => s >= max * 0.34).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m, s]) => ({ mood: m, weight: s / max, on: true }));
    return { moods, season, hits };
  }
  function buildPlaylist({ moods, season }, n) {
    const w = Object.fromEntries(moods.map((m) => [m.mood, m.weight])); const scored = [];
    for (const s of SONGS) {
      if (!hasRec(s) || isNever(s.id)) continue;
      const tags = s.moods || [], fit = tags.reduce((a, m, i) => a + (w[m] || 0) * (i === 0 ? 1 : 0.75), 0), inSeason = season && s.season === season;
      if (!fit && !inSeason) continue;
      scored.push({ s, score: fit * 2 + (inSeason ? 1 : 0) + (isLiked(s.id) ? 0.6 : 0) + (s.pop ? 0.4 * (1 - s.pop / 400) : 0) + Math.random() * 0.8, why: tags.filter((m) => w[m]).concat(inSeason ? [season] : []) });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, n);
  }

  /* ---------- links ---------- */
  const ytWatch = (v) => `https://www.youtube.com/watch?v=${v.id}`;
  const ytEmbed = (v, autoplay = true) => `https://www.${state.premium ? "youtube" : "youtube-nocookie"}.com/embed/${v.id}?autoplay=${autoplay ? 1 : 0}&rel=0&playsinline=1`;
  const thumb = (v, q = "hqdefault") => `https://i.ytimg.com/vi/${v.id}/${q}.jpg`;
  function askAiPrompt(s) {
    const facts = [s.parjay && `Parjay: ${s.parjay}${s.sub ? ` (${s.sub})` : ""}`, s.drama && `From the dance drama: ${s.drama}`, s.raag && `Raag: ${s.raagFull || s.raag}`, s.taal && `Taal: ${s.taal}`, s.written && `Written: ${s.written}`].filter(Boolean).join("; ");
    let lyrics = s.lyrics || ""; if (lyrics.length > 800) lyrics = lyrics.slice(0, 800).replace(/\n[^\n]*$/, "") + "\n… (opening verses only)";
    return `Explain the meaning of the Rabindrasangeet song "${s.bn || s.en}"${s.bn && s.en ? ` (${s.en})` : ""} by Rabindranath Tagore.` + (facts ? `\n${facts}.` : "") + (lyrics ? `\n\nBengali lyrics:\n${lyrics}` : "") + `\n\nPlease give:\n1. The meaning line by line in simple English, quoting each Bengali line first.\n2. The central idea and emotion of the song.\n3. Any known background: when and why Tagore wrote it, and how it is usually understood.\nIf you are unsure about any detail, say so rather than guessing.`;
  }
  const askAiUrl = (s) => `https://chatgpt.com/?q=${enc(askAiPrompt(s))}`;

  /* ---------- events ---------- */
  const subs = {};
  const on = (ev, fn) => ((subs[ev] = subs[ev] || []).push(fn), fn);
  const emit = (ev, ...a) => (subs[ev] || []).forEach((f) => f(...a));

  /* ---------- player (progress is simulated in the mockup; a real YouTube embed is loaded in the jukebox stage) ---------- */
  const EMPTY_F = { moods: [], parjays: [], seasons: [], raag: "", singer: "", likedOnly: false };
  const F = Object.assign({ ...EMPTY_F }, state.filters || {});
  const player = {
    current: null, upNext: null, history: [], playlist: null, playing: false, pos: 0, timer: null, embedded: false, queueAll: false,
    matches(s, f = F) {
      return hasRec(s) && !isNever(s.id) && (!f.likedOnly || isLiked(s.id)) && (!f.moods.length || (s.moods || []).some((m) => f.moods.includes(m)))
        && (!f.parjays.length || f.parjays.includes(s.parjay)) && (!f.seasons.length || f.seasons.includes(s.season)) && (!f.raag || s.raag === f.raag)
        && (!f.singer || s.videos.some((v) => (v.singers || []).includes(f.singer)));
    },
    pool(f = F) { return SONGS.filter((s) => player.matches(s, f)); },
    countWith(key, value) { const f = { ...F, [key]: Array.isArray(F[key]) ? [value] : value }; return player.pool(f).length; },
    pickSong(exclude = []) {
      const p = player.pool(); if (!p.length) return null;
      const avoid = new Set(state.recent.slice(-Math.min(40, Math.floor(p.length / 2))).concat(exclude));
      let list = p.filter((s) => !avoid.has(s.id)); if (!list.length) list = p.filter((s) => !exclude.includes(s.id)); if (!list.length) list = p;
      const w = list.map((s) => (isLiked(s.id) ? 4 : 1)); let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < list.length; i++) if ((r -= w[i]) <= 0) return list[i];
      return list[list.length - 1];
    },
    pickVideo(s) {
      let vids = s.videos; if (F.singer) vids = vids.filter((v) => (v.singers || []).includes(F.singer)); if (!vids.length) vids = s.videos;
      const w = vids.map((v) => Math.sqrt(v.views + 1)); let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let i = 0; i < vids.length; i++) if ((r -= w[i]) <= 0) return vids[i];
      return vids[0];
    },
    planNext() {
      const fromList = player.playlist && player.playlist.ids.slice(player.playlist.idx + 1).map((id) => BY_ID.get(id)).find((s) => s && !isNever(s.id));
      const s = fromList || player.pickSong(player.current ? [player.current.song.id] : []);
      player.upNext = s ? { song: s, video: player.pickVideo(s) } : null;
    },
    playItem(item, pos = 0) {
      player.current = item; player.pos = pos; player.playing = true;
      state.recent = state.recent.filter((id) => id !== item.song.id).concat(item.song.id).slice(-200);
      state.resume = { id: item.song.id, vid: item.video.id, pos }; save();
      player.planNext(); player.tick(true); emit("player");
    },
    tick(restart) {
      clearInterval(player.timer);
      player.timer = setInterval(() => {
        if (!player.playing || !player.current) return;
        player.pos += 1;
        if (player.pos >= player.current.video.sec) { player.next(); return; }
        if (player.pos % 5 === 0) { state.resume = { id: player.current.song.id, vid: player.current.video.id, pos: player.pos }; save(); }
        emit("progress");
      }, 1000);
    },
    play(song, video, pos = 0) {
      if (!song || !hasRec(song)) return;
      if (player.current) player.history.push(player.current);
      if (player.playlist && player.playlist.ids.includes(song.id)) player.playlist.idx = player.playlist.ids.indexOf(song.id);
      player.playItem({ song, video: video || player.pickVideo(song) }, pos);
    },
    playPlaylist(ids, label, moods, from = 0) {
      Object.assign(F, { ...EMPTY_F, moods: moods || [] }); state.filters = { ...F }; save();
      player.playlist = { label, ids, idx: from }; player.history = []; player.upNext = null;
      const s = BY_ID.get(ids[from]); player.playItem({ song: s, video: player.pickVideo(s) }); emit("filters");
    },
    next() {
      if (player.playlist) {
        const rest = player.playlist.ids.slice(player.playlist.idx + 1), k = rest.findIndex((id) => !isNever(id));
        if (k >= 0) { player.playlist.idx += k + 1; const s = BY_ID.get(player.playlist.ids[player.playlist.idx]); if (player.current) player.history.push(player.current); return player.playItem(player.upNext && player.upNext.song === s ? player.upNext : { song: s, video: player.pickVideo(s) }); }
        player.playlist = null; player.upNext = null;
      }
      if (player.upNext && !player.matches(player.upNext.song)) player.upNext = null;
      const item = player.upNext || (() => { const s = player.pickSong(); return s && { song: s, video: player.pickVideo(s) }; })();
      if (!item) { player.playing = false; emit("player"); return; }
      if (player.current) player.history.push(player.current);
      player.playItem(item);
    },
    prev() { const item = player.history.pop(); if (!item) return; const back = player.current; player.current = null; player.playItem(item); if (back) { player.upNext = back; emit("player"); } },
    toggle() { if (!player.current) return player.next(); player.playing = !player.playing; emit("player"); },
    start() { if (player.current) { player.playing = true; emit("player"); } else player.next(); },
    likeCurrent() { if (!player.current) return; toggleList("likes", player.current.song.id, !isLiked(player.current.song.id)); },
    neverCurrent() { if (!player.current) return; toggleList("never", player.current.song.id, true); player.next(); },
    setFilters(f) { Object.assign(F, { ...EMPTY_F, moods: [], parjays: [], seasons: [] }, f); player.playlist = null; state.filters = { ...F }; save(); player.filtersChanged(); },
    setFilter(kind, value) { const key = { mood: "moods", parjay: "parjays", season: "seasons" }[kind]; player.setFilters(key ? { [key]: [value] } : kind === "raag" ? { raag: value } : kind === "singer" ? { singer: value } : {}); },
    toggleFilter(key, value) {
      if (Array.isArray(F[key])) F[key] = F[key].includes(value) ? F[key].filter((x) => x !== value) : F[key].concat(value);
      else if (key === "likedOnly") F.likedOnly = !F.likedOnly; else F[key] = F[key] === value ? "" : value;
      player.playlist = null; state.filters = { ...F }; save(); player.filtersChanged();
    },
    clearFilters() { player.setFilters({}); },
    filtersChanged() {
      if (player.current && !player.matches(player.current.song)) { const s = player.pickSong(); if (s) { player.history = []; player.playItem({ song: s, video: player.pickVideo(s) }); } else { player.current = null; player.playing = false; } }
      player.planNext(); emit("filters"); emit("player");
    },
    activeChips() {
      return [...F.moods.map((v) => ["moods", v, nameOf("mood", v)]), ...F.seasons.map((v) => ["seasons", v, nameOf("season", v)]), ...F.parjays.map((v) => ["parjays", v, nameOf("parjay", v)]),
        ...(F.raag ? [["raag", F.raag, `${t("raag")} ${nameOf("raag", F.raag)}`]] : []), ...(F.singer ? [["singer", F.singer, nameOf("singer", F.singer)]] : []), ...(F.likedOnly ? [["likedOnly", "", t("likedOnly")]] : [])];
    },
    queue() {
      if (player.playlist) return player.playlist.ids.map((id) => BY_ID.get(id)).filter((s) => s && hasRec(s) && !isNever(s.id));
      const list = player.pool(); const order = (s) => s === player.current?.song ? 0 : s === player.upNext?.song ? 1 : 2;
      return list.sort((a, b) => order(a) - order(b) || (a.pop || 9999) - (b.pop || 9999) || title(a).localeCompare(title(b)));
    },
    F,
  };
  on("prefs", () => { if (player.current && isNever(player.current.song.id)) player.next(); });

  /* ---------- account / settings stubs ---------- */
  function setLang(l) { state.lang = l; save(); document.documentElement.lang = l; emit("lang"); }
  function setTheme(th) { state.theme = th; save(); if (th) document.documentElement.dataset.theme = th; else delete document.documentElement.dataset.theme; emit("theme"); }
  function toggleTheme() { const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches); setTheme(dark ? "light" : "dark"); }
  function signIn() { state.signedIn = true; state.email = "you@gmail.com"; save(); emit("account"); }
  function signOut() { state.signedIn = false; delete state.email; save(); emit("account"); }
  function setPremium(v) { state.premium = v; save(); emit("account"); emit("player"); }

  /* ---------- router ---------- */
  function parseHash() { const parts = location.hash.replace(/^#\/?/, "").split("/").map((p) => { try { return decodeURIComponent(p); } catch { return p; } }); return { page: parts[0] || "home", parts }; }
  const go = (h) => { location.hash = h; };

  /* ---------- load ---------- */
  function load() {
    return Promise.all([
      fetch("../../docs/songs.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch("../../docs/feelings.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([d, f]) => {
      META = d.meta; SONGS = d.songs; FEEL = f;
      for (const s of SONGS) {
        BY_ID.set(s.id, s);
        s._title = norm([s.bn, s.en, s.alias, s.id.replace(/-/g, " ")].join(" ")); s._lyrics = norm(s.lyrics);
        s._skels = [skelBn(s.bn), skelEn(s.en), skelEn(s.alias), skelEn(s.id)].filter(Boolean); s._skelLyrics = skelBn(s.lyrics);
      }
      // Demo: a "Welcome back" resume point exists the first time the mockup opens.
      if (state.resume === null) { const s = popular().find(hasRec); if (s) { state.resume = { id: s.id, vid: s.videos[0].id, pos: 72, demo: true }; save(); } }
      // URL switches for screenshots and demos (not saved): ?theme=dark|light &lang=bn|en &demo=play &dismiss=1
      const q = new URLSearchParams(location.search);
      if (q.get("theme")) state.theme = q.get("theme");
      if (q.get("lang")) state.lang = q.get("lang");
      if (q.get("dismiss")) state.resume = null;
      if (state.theme) document.documentElement.dataset.theme = state.theme;
      document.documentElement.lang = state.lang;
      if (q.get("demo") === "play") setTimeout(() => {
        const s = popular().filter(hasRec)[2] || popular().find(hasRec);
        if (s) { player.play(s, s.videos[0], 96); player.playing = false; clearInterval(player.timer); emit("player"); }
      }, 0);
      return { SONGS, BY_ID, META, FEEL };
    });
  }
  const data = () => ({ SONGS, BY_ID, META, FEEL });

  return { $, $$, esc, enc, state, save, isLiked, isNever, toggleList, t, num, T, nameOf, moodDesc, MOOD_BN, SEASONS, SEASON_ORDER, bengaliDate, currentSeason,
    data, title, title2, hasRec, fmtViews, fmtTime, singersOf, KINDS, groupsOf, popular, listFor, subGroups, searchSongs, findNames, relatedSongs, detectFeelings, buildPlaylist,
    ytWatch, ytEmbed, thumb, askAiUrl, on, emit, player, setLang, setTheme, toggleTheme, signIn, signOut, setPremium, parseHash, go, load };
})();
