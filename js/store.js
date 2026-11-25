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
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("tiempo agotado")), ms))]);

async function fromFirestore(slug) {
  const c = await core();
  if (!c) return null;
  const snap = await c.fs.getDoc(c.fs.doc(c.db, "people", slug));
  if (snap.exists() && snap.data().current) {
    const d = snap.data();
    return { cv: d.current, source: "firestore", version: d.version, pdf: d.pdf || null };
  }
  if (snap.exists() && snap.data().pdf) return { cv: null, source: "firestore", pdf: snap.data().pdf };
  return null;
}

export async function loadCv(slug) {
  try {
    const r = await withTimeout(fromFirestore(slug), 5000);
    if (r) return r;
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
  // mergeFields reemplaza `current` completo; así un dato borrado en el formulario también desaparece del público.
  // El documento público no guarda el correo de quien edita (eso queda solo en el historial, que no es público);
  // deleteField limpia el que hubieran dejado versiones anteriores del código.
  batch.set(ref, { current: clean, version: n, updatedAt: fs.serverTimestamp(), updatedBy: fs.deleteField() },
    { mergeFields: ["current", "version", "updatedAt", "updatedBy"] });
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

// ---- PDF dentro de Firestore (sin Firebase Storage) ----
// El PDF vive en people/{slug}/files/cv como bytes; en people/{slug} queda solo su ficha (nombre y tamaño).
// Firestore limita cada documento a 1 MiB, por eso el tope de 900 KB.
export const PDF_MAX_BYTES = 900 * 1024;

export async function savePdf(slug, name, bytes, user) {
  const { fs, db } = await core();
  const batch = fs.writeBatch(db);
  batch.set(fs.doc(db, "people", slug, "files", "cv"), {
    name, size: bytes.length, data: fs.Bytes.fromUint8Array(bytes), updatedAt: fs.serverTimestamp()
  });
  // mergeFields reemplaza la ficha completa, así desaparece el correo que guardaba la versión anterior.
  batch.set(fs.doc(db, "people", slug), {
    pdf: { name, size: bytes.length, updatedAt: fs.serverTimestamp() }
  }, { mergeFields: ["pdf"] });
  await batch.commit();
}

export async function downloadPdf(slug, name) {
  const { fs, db } = await core();
  const snap = await fs.getDoc(fs.doc(db, "people", slug, "files", "cv"));
  if (!snap.exists()) throw new Error("El PDF no está disponible.");
  const blob = new Blob([snap.data().data.toUint8Array()], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name || "curriculo.pdf";
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
