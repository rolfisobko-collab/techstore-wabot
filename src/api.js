const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const router = express.Router();

const fs = require("fs");
const UPLOADS_DIR = require("path").join(__dirname, "../data/uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Config ──────────────────────────────────────────────────
router.get("/config", (req, res) => {
  const { getConfig } = require("./configLoader");
  res.json(getConfig());
});

router.post("/config", async (req, res) => {
  try {
    const { saveConfig } = require("./configLoader");
    const allowed = ["welcomeMessage", "businessName", "pdfPath", "pdfName"];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    await saveConfig(updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PDF upload ───────────────────────────────────────────────
router.post("/pdf/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { savePdfChunks } = require("./firebase");
    const { saveConfig } = require("./configLoader");
    const { invalidatePdfCache } = require("./whatsapp");
    const fileName = req.file.originalname;
    console.log(`[PDF] Saving to Firestore (${req.file.buffer.length} bytes)...`);
    await savePdfChunks(req.file.buffer, fileName);
    await saveConfig({ pdfName: fileName, pdfUrl: null, pdfPath: null });
    invalidatePdfCache();
    res.json({ ok: true, fileName });
  } catch (err) {
    console.error("[PDF] Upload error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/pdf/info", async (req, res) => {
  try {
    const { getFirestore, doc, getDoc } = require("firebase/firestore");
    const db = getFirestore();
    const snap = await getDoc(doc(db, "pdf_data", "meta"));
    if (snap.exists()) {
      const { fileName, size } = snap.data();
      res.json({ fileName, exists: true, size });
    } else {
      res.json({ fileName: null, exists: false });
    }
  } catch {
    res.json({ fileName: null, exists: false });
  }
});

// ── WhatsApp instances ───────────────────────────────────────
router.get("/whatsapp/status", (req, res) => {
  const { getAllStatus } = require("./whatsapp");
  res.json(getAllStatus());
});

router.get("/whatsapp/:id/status", (req, res) => {
  const { getInstanceStatus } = require("./whatsapp");
  const id = parseInt(req.params.id);
  const s = getInstanceStatus(id);
  if (!s) return res.status(404).json({ error: "Instance not found" });
  res.json(s);
});

router.get("/whatsapp/:id/qr", (req, res) => {
  const { getInstanceStatus } = require("./whatsapp");
  const id = parseInt(req.params.id);
  const s = getInstanceStatus(id);
  if (!s) return res.status(404).json({ error: "Instance not found" });
  res.json({ qrDataUrl: s.qrDataUrl, status: s.status });
});

router.post("/whatsapp/:id/connect", async (req, res) => {
  try {
    const { connectWhatsapp } = require("./whatsapp");
    const id = parseInt(req.params.id);
    await connectWhatsapp(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/whatsapp/:id/clear-session", async (req, res) => {
  try {
    const { disconnectWhatsapp } = require("./whatsapp");
    const { loadWaSession } = require("./firebase");
    const fs = require("fs");
    const path = require("path");
    const id = parseInt(req.params.id);
    await disconnectWhatsapp(id, true);
    const authPath = path.join(__dirname, `../.wa_auth_${id}`);
    fs.rmSync(authPath, { recursive: true, force: true });
    const { getFirestore, doc, deleteDoc } = require("firebase/firestore");
    const db = getFirestore();
    await deleteDoc(doc(db, "wa_sessions", String(id))).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/whatsapp/:id/disconnect", async (req, res) => {
  try {
    const { disconnectWhatsapp } = require("./whatsapp");
    const id = parseInt(req.params.id);
    await disconnectWhatsapp(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/api", router);

  // Serve frontend in production
  const fs = require("fs");
  const distPath = path.join(__dirname, "../panel/dist");
  const indexPath = path.join(distPath, "index.html");
  app.use(express.static(distPath));
  app.get("/{*splat}", (req, res) => {
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send("<h1>TechStore Bot</h1><p>Panel building... refresh in 30 seconds.</p>");
    }
  });

  return app;
}

module.exports = { createApp };
