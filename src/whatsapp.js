const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const path = require("path");
const fs = require("fs");
const { canSend, markSent, saveWaSession, loadWaSession } = require("./firebase");

const NUM_INSTANCES = 4;

function getAuthPath(id) {
  return path.join(__dirname, `../.wa_auth_${id}`);
}

const instances = {};

for (let i = 1; i <= NUM_INSTANCES; i++) {
  instances[i] = {
    id: i,
    sock: null,
    status: "disconnected",
    qrDataUrl: null,
    qrRaw: null,
    welcomeMessage: null,
    pdfPath: null,
  };
}

function getInstance(id) {
  return instances[id] || null;
}

function getAllStatus() {
  return Object.values(instances).map(({ id, status, qrDataUrl }) => ({ id, status, qrDataUrl }));
}

function getInstanceStatus(id) {
  const inst = instances[id];
  if (!inst) return null;
  return { id: inst.id, status: inst.status, qrDataUrl: inst.qrDataUrl };
}

function setInstanceConfig(id, { welcomeMessage, pdfPath }) {
  if (!instances[id]) return;
  if (welcomeMessage !== undefined) instances[id].welcomeMessage = welcomeMessage;
  if (pdfPath !== undefined) instances[id].pdfPath = pdfPath;
}

let pdfCache = null;
let pdfCacheMini = null;

function invalidatePdfCache() {
  pdfCache = null;
  console.log("[PDF] Cache invalidated");
}

function invalidatePdfCacheMini() {
  pdfCacheMini = null;
  console.log("[PDF mini] Cache invalidated");
}

async function getPdfBuffer() {
  if (pdfCache) return pdfCache;
  try {
    const { loadPdfBuffer } = require("./firebase");
    const result = await loadPdfBuffer();
    if (result) {
      pdfCache = { buffer: result.buffer, name: result.fileName || "lista-precios.pdf" };
      return pdfCache;
    }
  } catch (err) {
    console.error("[PDF] Load error:", err.message);
  }
  return null;
}

async function getPdfBufferMini() {
  if (pdfCacheMini) return pdfCacheMini;
  try {
    const { loadPdfBufferMini } = require("./firebase");
    const result = await loadPdfBufferMini();
    if (result) {
      pdfCacheMini = { buffer: result.buffer, name: result.fileName || "catalogo-miniatura.pdf" };
      return pdfCacheMini;
    }
  } catch (err) {
    console.error("[PDF mini] Load error:", err.message);
  }
  return null;
}

async function sendWelcome(inst, chatId) {
  const { getConfig, reloadConfig } = require("./configLoader");
  await reloadConfig();
  const cfg = getConfig();
  const msg = cfg.welcomeMessage;

  try {
    await inst.sock.sendPresenceUpdate("composing", chatId);
    const pdf = await getPdfBuffer();
    if (pdf) {
      await inst.sock.sendMessage(chatId, {
        document: pdf.buffer,
        mimetype: "application/pdf",
        fileName: pdf.name,
        caption: msg,
      });
    } else {
      await inst.sock.sendMessage(chatId, { text: msg });
    }
    await inst.sock.sendPresenceUpdate("available", chatId);
    console.log(`[WA-${inst.id}] Welcome sent to ${chatId}`);
  } catch (err) {
    console.error(`[WA-${inst.id}] Error sending welcome:`, err.message);
  }
}

async function sendCatalog(inst, chatId) {
  try {
    await inst.sock.sendPresenceUpdate("composing", chatId);
    const pdf = await getPdfBuffer();
    if (pdf) {
      await inst.sock.sendMessage(chatId, {
        document: pdf.buffer,
        mimetype: "application/pdf",
        fileName: pdf.name,
        caption: "📋 Aquí tienes nuestro catálogo actualizado.",
      });
    } else {
      await inst.sock.sendMessage(chatId, { text: "No hay catálogo disponible por el momento." });
    }
    await inst.sock.sendPresenceUpdate("available", chatId);
  } catch (err) {
    console.error(`[WA-${inst.id}] Error sending catalog:`, err.message);
  }
}

async function sendMiniCatalog(inst, chatId) {
  try {
    await inst.sock.sendPresenceUpdate("composing", chatId);
    const pdf = await getPdfBufferMini();
    if (pdf) {
      await inst.sock.sendMessage(chatId, {
        document: pdf.buffer,
        mimetype: "application/pdf",
        fileName: pdf.name,
        caption: "📋 Aquí tienes nuestro catálogo miniatura.",
      });
    } else {
      await inst.sock.sendMessage(chatId, { text: "No hay catálogo miniatura disponible por el momento." });
    }
    await inst.sock.sendPresenceUpdate("available", chatId);
  } catch (err) {
    console.error(`[WA-${inst.id}] Error sending mini catalog:`, err.message);
  }
}

async function connectWhatsapp(id) {
  const inst = instances[id];
  if (!inst) throw new Error(`Instance ${id} not found`);

  if (inst.status === "connected" || inst.status === "connecting") {
    console.log(`[WA-${id}] Already ${inst.status}, skipping`);
    return;
  }

  if (inst.sock) {
    inst.sock.ev.removeAllListeners();
    inst.sock.ws?.terminate();
    inst.sock = null;
    await new Promise((r) => setTimeout(r, 1000));
  }

  inst.status = "connecting";
  inst.qrDataUrl = null;
  inst.qrRaw = null;

  const authPath = getAuthPath(id);
  await loadWaSession(id, authPath);
  const { state, saveCreds } = await useMultiFileAuthState(authPath);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`[WA-${id}] Using WA version ${version.join(".")}`);

  inst.sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "22.04"],
    syncFullHistory: false,
    connectTimeoutMs: 20000,
  });

  inst.sock.ev.on("creds.update", async () => {
    await saveCreds();
    await saveWaSession(id, authPath);
  });

  inst.sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      inst.qrRaw = qr;
      inst.status = "qr_ready";
      try {
        inst.qrDataUrl = await qrcode.toDataURL(qr);
        console.log(`[WA-${id}] QR code ready — scan it in the panel`);
      } catch (err) {
        console.error(`[WA-${id}] QR generation error:`, err.message);
      }
    }

    if (connection === "open") {
      inst.status = "connected";
      inst.qrDataUrl = null;
      inst.qrRaw = null;
      console.log(`[WA-${id}] WhatsApp connected ✅`);
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`[WA-${id}] Connection closed (code ${code}), loggedOut: ${loggedOut}`);

      inst.sock = null;
      inst.status = "disconnected";
      inst.qrDataUrl = null;
      inst.qrRaw = null;

      if (loggedOut) {
        console.log(`[WA-${id}] Logged out, not reconnecting`);
      } else {
        console.log(`[WA-${id}] Reconnecting in 8s...`);
        setTimeout(() => connectWhatsapp(id), 8000);
      }
    }
  });

  inst.sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
    if (type !== "notify") return;

    for (const msg of msgs) {
      if (!msg.message) continue;

      const chatId = msg.key.remoteJid;
      if (chatId.endsWith("@g.us")) continue;

      if (msg.key.fromMe) continue;

      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || "").trim().toLowerCase();

      if (text === "#catalogo") {
        await sendCatalog(inst, chatId);
        continue;
      }

      if (text === "#miniatura") {
        await sendMiniCatalog(inst, chatId);
        continue;
      }

      const sender = msg.pushName || chatId;
      console.log(`[WA-${id}] Message from ${sender}`);

      const phone = chatId.replace(/[^0-9]/g, "");
      const ok = await canSend(phone);
      if (!ok) {
        console.log(`[WA-${id}] Cooldown active for ${phone}, skipping`);
        continue;
      }
      await sendWelcome(inst, chatId);
      await markSent(phone, { name: msg.pushName || null, waInstance: id });
    }
  });
}

async function disconnectWhatsapp(id, doLogout = false) {
  const inst = instances[id];
  if (!inst) return;
  if (inst.sock) {
    if (doLogout) {
      await inst.sock.logout().catch(() => {});
    } else {
      inst.sock.ev.removeAllListeners();
      inst.sock.ws?.terminate();
    }
    inst.sock = null;
  }
  inst.status = "disconnected";
  inst.qrDataUrl = null;
  inst.qrRaw = null;
  console.log(`[WA-${id}] Disconnected`);
}

module.exports = {
  connectWhatsapp,
  disconnectWhatsapp,
  getInstanceStatus,
  getAllStatus,
  setInstanceConfig,
  getInstance,
  invalidatePdfCache,
  invalidatePdfCacheMini,
  NUM_INSTANCES,
};
