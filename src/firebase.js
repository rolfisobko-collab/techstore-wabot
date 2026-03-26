const { initializeApp, getApps } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

const firebaseConfig = {
  apiKey: "AIzaSyDVDoij_-CZuYzZKykc6YJZvN4kQfCm05Q",
  authDomain: "techstore-d12a3.firebaseapp.com",
  projectId: "techstore-d12a3",
  storageBucket: "techstore-d12a3.firebasestorage.app",
  messagingSenderId: "968802638282",
  appId: "1:968802638282:web:c47f8957c938b20ec1d733",
};

let db = null;

const COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours

// In-memory fallback
const memoryCache = new Map();

function initFirebase() {
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("[Firebase] Firestore connected ✅");
  } catch (err) {
    console.error("[Firebase] Failed to init:", err.message);
  }
}

async function getRemoteConfig() {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, "config", "main"));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.error("[Firebase] getRemoteConfig error:", err.message);
    return null;
  }
}

async function saveRemoteConfig(updates) {
  if (!db) throw new Error("Firestore not initialized");
  const clean = {};
  for (const [k, v] of Object.entries(updates)) {
    clean[k] = v === undefined ? null : v;
  }
  const ref = doc(db, "config", "main");
  await setDoc(ref, { ...clean, updatedAt: serverTimestamp() }, { merge: true });
}

async function canSend(phone) {
  const now = Date.now();

  if (!db) {
    const last = memoryCache.get(phone) || 0;
    return now - last > COOLDOWN_MS;
  }

  try {
    const ref = doc(db, "clientes", phone);
    const snap = await getDoc(ref);
    if (!snap.exists()) return true;
    const { lastSent } = snap.data();
    return now - lastSent > COOLDOWN_MS;
  } catch (err) {
    console.error("[Firebase] canSend error:", err.message);
    return true;
  }
}

async function markSent(phone, { name, waInstance } = {}) {
  const now = Date.now();

  if (!db) {
    memoryCache.set(phone, now);
    return;
  }

  try {
    const ref = doc(db, "clientes", phone);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        phone,
        name: name || null,
        waInstance: waInstance || null,
        firstContact: now,
        lastSent: now,
        totalMessages: 1,
        updatedAt: serverTimestamp(),
      });
    } else {
      const data = snap.data();
      await updateDoc(ref, {
        lastSent: now,
        totalMessages: (data.totalMessages || 0) + 1,
        waInstance: waInstance || data.waInstance,
        name: name || data.name,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    console.error("[Firebase] markSent error:", err.message);
  }
}

async function saveWaSession(id, authPath) {
  if (!db || !fs.existsSync(authPath)) return;
  try {
    const files = {};
    for (const f of fs.readdirSync(authPath)) {
      const full = path.join(authPath, f);
      if (fs.statSync(full).isFile()) {
        files[f.replace(/\./g, "__dot__")] = fs.readFileSync(full, "utf8");
      }
    }
    if (!Object.keys(files).length) return;
    await setDoc(doc(db, "wa_sessions", String(id)), { files, updatedAt: serverTimestamp() });
  } catch (err) {
    console.error(`[Firebase] saveWaSession(${id}):`, err.message);
  }
}

async function loadWaSession(id, authPath) {
  if (!db) return;
  try {
    const snap = await getDoc(doc(db, "wa_sessions", String(id)));
    if (!snap.exists()) return;
    const { files } = snap.data();
    if (!files || !Object.keys(files).length) return;
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });
    for (const [key, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(authPath, key.replace(/__dot__/g, ".")), content, "utf8");
    }
    console.log(`[Firebase] WA session ${id} restored ✅`);
  } catch (err) {
    console.error(`[Firebase] loadWaSession(${id}):`, err.message);
  }
}

const CHUNK_SIZE = 700 * 1024; // 700KB per chunk

async function savePdfChunks(buffer, fileName) {
  if (!db) throw new Error("Firestore not initialized");
  const totalChunks = Math.ceil(buffer.length / CHUNK_SIZE);
  await setDoc(doc(db, "pdf_data", "meta"), {
    fileName,
    totalChunks,
    size: buffer.length,
    updatedAt: serverTimestamp(),
  });
  for (let i = 0; i < totalChunks; i++) {
    const chunk = buffer.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    await setDoc(doc(db, "pdf_data", `chunk_${i}`), { data: chunk.toString("base64"), index: i });
  }
  console.log(`[Firebase] PDF saved in ${totalChunks} chunks (${buffer.length} bytes)`);
}

async function loadPdfBuffer() {
  if (!db) return null;
  try {
    const metaSnap = await getDoc(doc(db, "pdf_data", "meta"));
    if (!metaSnap.exists()) return null;
    const { fileName, totalChunks } = metaSnap.data();
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const snap = await getDoc(doc(db, "pdf_data", `chunk_${i}`));
      if (!snap.exists()) return null;
      chunks.push(Buffer.from(snap.data().data, "base64"));
    }
    const buffer = Buffer.concat(chunks);
    console.log(`[Firebase] PDF loaded: ${buffer.length} bytes`);
    return { buffer, fileName };
  } catch (err) {
    console.error("[Firebase] loadPdfBuffer error:", err.message);
    return null;
  }
}

module.exports = { initFirebase, canSend, markSent, getRemoteConfig, saveRemoteConfig, saveWaSession, loadWaSession, savePdfChunks, loadPdfBuffer };
