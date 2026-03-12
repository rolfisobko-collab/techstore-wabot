const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Config ──────────────────────────────────────────────────
router.get("/config", (req, res) => {
  const { getConfig } = require("./configLoader");
  res.json(getConfig());
});

router.post("/config", async (req, res) => {
  try {
    const { saveConfig } = require("./configLoader");
    const allowed = ["welcomeMessage", "businessName", "pdfUrl", "pdfName"];
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
    const { uploadPdf } = require("./cloudinary");
    const { saveConfig } = require("./configLoader");
    const { url, fileName } = await uploadPdf(req.file.buffer, req.file.originalname);
    await saveConfig({ pdfUrl: url, pdfName: fileName });
    res.json({ ok: true, fileName: req.file.originalname, url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/pdf/info", (req, res) => {
  const { getConfig } = require("./configLoader");
  const { pdfUrl, pdfName } = getConfig();
  if (pdfUrl) {
    res.json({ fileName: pdfName || "pricelist.pdf", exists: true, url: pdfUrl });
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
  const fs = require("fs");
  const distPath = path.join(__dirname, "../panel/dist");
  const indexPath = path.join(distPath, "index.html");
  console.log("[App] Serving frontend from:", distPath);
  console.log("[App] index.html exists:", fs.existsSync(indexPath));
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
