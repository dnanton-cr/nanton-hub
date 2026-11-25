// Capa de datos. Es el único archivo que conoce Firebase; el resto del sitio pide y guarda currículos con estas funciones.
//
// Modelo en Firestore:
//   people/{slug}                 → { current: <currículo>, version: n, updatedAt, updatedBy }   lectura pública
//   people/{slug}/versions/{id}   → { cv, version, note, createdAt, createdBy }                  solo editores
//   members/{correo}              → { slug, admin }                                              quién puede editar
import { firebaseConfig, FIREBASE_ENABLED } from "./config.js";

const SDK = "https://www.gstatic.com/firebasejs/10.14.1/";
let _core, _kit;

async function core() {
  if (!FIREBASE_ENABLED) return null;
  if (!_core) {
    const [app, fs] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-firestore.js")]);
    const a = app.initializeApp(firebaseConfig);
    _core = { app: a, fs, db: fs.getFirestore(a) };
  }
  return _core;
}

async function kit() {
  if (!_kit) {
    const c = await core();
    const auth = await import(SDK + "firebase-auth.js");
    _kit = { ...c, auth, au: auth.getAuth(c.app) };
  }
  return _kit;
}

// Lee el currículo publicado. Si Firestore no responde o está vacío, usa data/{slug}.json del repositorio.
export async function loadCv(slug) {
  try {
    const c = await core();
    if (c) {
      const snap = await c.fs.getDoc(c.fs.doc(c.db, "people", slug));
      if (snap.exists() && snap.data().current) return { cv: snap.data().current, source: "firestore", version: snap.data().version };
    }
  } catch (e) { console.warn("Firestore no disponible, se usa el archivo.", e); }
  try {
    const r = await fetch(new URL(`../data/${slug}.json`, import.meta.url));
    if (r.ok) return { cv: await r.json(), source: "archivo" };
  } catch (e) { /* sin archivo */ }
  return null;
}

// Guarda una versión nueva y la deja como vigente, en una sola operación.
export async function saveCv(slug, cv, note, user) {
  const { fs, db } = await core();
  const clean = JSON.parse(JSON.stringify(cv));
  const ref = fs.doc(db, "people", slug);
  const snap = await fs.getDoc(ref);
  const n = (snap.exists() ? snap.data().version || 0 : 0) + 1;
  const vref = fs.doc(fs.collection(db, "people", slug, "versions"));
  const batch = fs.writeBatch(db);
  batch.set(vref, { cv: clean, version: n, note: note || "", createdAt: fs.serverTimestamp(), createdBy: user.email });
  batch.set(ref, { current: clean, version: n, updatedAt: fs.serverTimestamp(), updatedBy: user.email }, { merge: true });
  await batch.commit();
  return n;
}

export async function listVersions(slug) {
  const { fs, db } = await core();
  const q = fs.query(fs.collection(db, "people", slug, "versions"), fs.orderBy("createdAt", "desc"), fs.limit(20));
  const res = await fs.getDocs(q);
  return res.docs.map((d) => {
    const v = d.data();
    return { id: d.id, version: v.version, note: v.note, by: v.createdBy, at: v.createdAt?.toDate?.() || null, cv: v.cv };
  });
}

export async function signIn() { const k = await kit(); await k.auth.signInWithPopup(k.au, new k.auth.GoogleAuthProvider()); }
export async function signOutUser() { const k = await kit(); await k.auth.signOut(k.au); }
export async function onUser(cb) { const k = await kit(); k.auth.onAuthStateChanged(k.au, cb); }
export async function getMember(email) {
  const k = await kit();
  const s = await k.fs.getDoc(k.fs.doc(k.db, "members", email));
  return s.exists() ? s.data() : null;
}
