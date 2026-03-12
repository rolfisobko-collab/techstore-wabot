const { initializeApp, getApps } = require("firebase/app");
const { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } = require("firebase/firestore");

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
  const ref = doc(db, "config", "main");
  await setDoc(ref, { ...updates, updatedAt: serverTimestamp() }, { merge: true });
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

module.exports = { initFirebase, canSend, markSent, getRemoteConfig, saveRemoteConfig };
