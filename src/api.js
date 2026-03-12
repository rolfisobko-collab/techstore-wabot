const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, "../data/uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const name = `pricelist_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── Config ──────────────────────────────────────────────────
router.get("/config", (req, res) => {
  const { getConfig } = require("./configLoader");
  res.json(getConfig());
});

router.post("/config", (req, res) => {
  try {
    const { saveConfig } = require("./configLoader");
    const allowed = ["welcomeMessage", "businessName"];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    saveConfig(updates);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PDF upload ───────────────────────────────────────────────
router.post("/pdf/upload", upload.single("pdf"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const { saveConfig } = require("./configLoader");
    saveConfig({ pdfPath: req.file.path });
    res.json({ ok: true, fileName: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/pdf/info", (req, res) => {
  const { getConfig } = require("./configLoader");
  const { pdfPath } = getConfig();
  if (pdfPath && fs.existsSync(pdfPath)) {
    res.json({ fileName: path.basename(pdfPath), exists: true });
  } else {
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
  const distPath = path.join(__dirname, "../panel/dist");
  app.use(express.static(distPath));
  app.get("/{*path}", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  return app;
}

module.exports = { createApp };
