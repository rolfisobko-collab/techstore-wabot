require("dotenv").config();
const { reloadConfig } = require("./src/configLoader");
const { createApp } = require("./src/api");
const { initFirebase } = require("./src/firebase");
const { initCloudinary } = require("./src/cloudinary");

process.on("uncaughtException", (err) => {
  console.error("[App] Uncaught exception (process kept alive):", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[App] Unhandled rejection (process kept alive):", reason);
});

const PORT = process.env.PORT || 8000;

async function main() {
  console.log("[App] Starting TechStore WhatsApp Bot...");

  initFirebase();
  initCloudinary();
  await reloadConfig();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[App] Panel running at http://localhost:${PORT}`);
  });

  console.log("[App] Ready. Connect WhatsApp numbers from the panel.");

  setImmediate(async () => {
    const { connectWhatsapp, NUM_INSTANCES } = require("./src/whatsapp");
    const { loadWaSession } = require("./src/firebase");
    const fs = require("fs");
    const path = require("path");
    for (let i = 1; i <= NUM_INSTANCES; i++) {
      const authPath = path.join(__dirname, `.wa_auth_${i}`);
      await loadWaSession(i, authPath);
      if (fs.existsSync(path.join(authPath, "creds.json"))) {
        console.log(`[App] Restoring session for instance ${i}...`);
        connectWhatsapp(i).catch(err => console.error(`[App] Auto-connect ${i}:`, err.message));
      }
    }
  });
}

process.on("SIGINT", () => {
  console.log("\n[App] Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  process.exit(0);
});

main().catch((err) => {
  console.error("[App] Fatal error:", err);
  process.exit(1);
});
