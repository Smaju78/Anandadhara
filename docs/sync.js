/* Anandadhara account sync (optional): Google sign-in with Firebase Authentication, data in Cloud Firestore.
   One document per person, anandadhara_users/{uid}, with only the keys prefs, prefsAt, lang, session, updated:
   likes, never-play, jukebox filters, language, the Premium setting and the resume point. The security rules let
   only that signed-in person read or write it. Without a config in firebase-config.js this module does nothing and
   the site keeps everything in the browser. Shares the Firebase project with Raagmala. */
import config from "./firebase-config.js";

const S = window.anandadharaSync;
const V = "10.12.2"; // Firebase JS SDK, loaded from Google's CDN (no build step)
const LINK_KEY = "anandadhara.syncedUid";

if (!S) {
  // app.js did not load; nothing to sync
} else if (!config || !config.apiKey) {
  S.resolveReady();
} else {
  start().catch((e) => { console.warn("Anandadhara sync disabled:", e); S.resolveReady(); });
}

async function start() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = initializeApp(config);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  let user = null, timer = null;
  const ref = () => F.doc(db, "anandadhara_users", user.uid);

  async function upload() {
    if (!user) return;
    const snap = clean(S.snapshot());
    await F.setDoc(ref(), { prefs: snap.prefs, prefsAt: snap.prefsAt, lang: snap.lang, session: snap.session || null, updated: F.serverTimestamp() });
    S.lastSync = Date.now();
  }
  const flush = () => { timer = null; upload().catch((e) => S.onError(e)); };

  // Settings and likes go up 3 s after the last change; the resume point at most every 30 s while playing.
  S.changed = (kind) => {
    if (!user) return;
    if (kind === "session") { if (!timer) timer = setTimeout(flush, 30000); return; }
    clearTimeout(timer);
    timer = setTimeout(flush, 3000);
  };
  S.signIn = () => A.signInWithPopup(auth, new A.GoogleAuthProvider()).catch((e) => S.onError(e));
  S.signOut = async () => { if (timer) { clearTimeout(timer); await upload().catch(() => {}); } await A.signOut(auth); };
  S.deleteData = async () => {
    if (!user) return;
    clearTimeout(timer); timer = null;
    try { await F.deleteDoc(ref()); } catch (e) { S.onError(e); return; }
    try { localStorage.removeItem(LINK_KEY); } catch { /* ignore */ }
    await A.signOut(auth);
  };

  A.onAuthStateChanged(auth, async (u) => {
    user = u;
    S.user = u ? { name: u.displayName, email: u.email, photo: u.photoURL } : null;
    if (u) {
      try {
        const d = await F.getDoc(ref());
        let linked = null;
        try { linked = localStorage.getItem(LINK_KEY); } catch { /* ignore */ }
        if (d.exists()) S.apply(d.data(), linked !== u.uid);
        try { localStorage.setItem(LINK_KEY, u.uid); } catch { /* ignore */ }
        await upload();
      } catch (e) { S.onError(e); } // e.g. rules not yet published: sign-in still works, data stays in this browser
    }
    S.userChanged();
    S.resolveReady();
  });

  // Last chance to save the resume point when the page is closed (best effort).
  window.addEventListener("pagehide", () => { if (user && timer) flush(); });
}

// Firestore rejects undefined values.
function clean(o) { return JSON.parse(JSON.stringify(o)); }
