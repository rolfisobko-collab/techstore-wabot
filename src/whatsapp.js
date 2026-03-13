const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode");
const path = require("path");
const fs = require("fs");
const { canSend, markSent } = require("./firebase");

const NUM_INSTANCES = 3;

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

async function sendWelcome(inst, chatId) {
  const { getConfig, reloadConfig } = require("./configLoader");
  await reloadConfig();
  const cfg = getConfig();
  const msg = cfg.welcomeMessage;
  const pdfUrl = cfg.pdfUrl || null;
  const pdfName = cfg.pdfName || "lista-precios.pdf";

  try {
    await inst.sock.sendPresenceUpdate("composing", chatId);

    if (pdfUrl) {
      const https = require("https");
      const http = require("http");
      const pdfBuffer = await new Promise((resolve, reject) => {
        const client = pdfUrl.startsWith("https") ? https : http;
        client.get(pdfUrl, (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
          res.on("error", reject);
        }).on("error", reject);
      });

      await inst.sock.sendMessage(chatId, {
        document: pdfBuffer,
        mimetype: "application/pdf",
        fileName: pdfName,
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

async function connectWhatsapp(id) {
  const inst = instances[id];
  if (!inst) throw new Error(`Instance ${id} not found`);

  if (inst.sock) {
    await disconnectWhatsapp(id);
    await new Promise((r) => setTimeout(r, 1000));
  }

  inst.status = "connecting";
  inst.qrDataUrl = null;
  inst.qrRaw = null;

  const authPath = getAuthPath(id);
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

  inst.sock.ev.on("creds.update", saveCreds);

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
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`[WA-${id}] Connection closed (code ${code}), reconnect: ${shouldReconnect}`);

      if (shouldReconnect) {
        inst.status = "connecting";
        setTimeout(() => connectWhatsapp(id), 5000);
      } else {
        inst.status = "disconnected";
        inst.sock = null;
      }
    }
  });

  inst.sock.ev.on("messages.upsert", async ({ messages: msgs, type }) => {
    if (type !== "notify") return;

    for (const msg of msgs) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const chatId = msg.key.remoteJid;
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

async function disconnectWhatsapp(id) {
  const inst = instances[id];
  if (!inst) return;
  if (inst.sock) {
    await inst.sock.logout().catch(() => {});
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
  NUM_INSTANCES,
};
