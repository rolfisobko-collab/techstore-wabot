require("dotenv").config();
const { reloadConfig } = require("./src/configLoader");
const { createApp } = require("./src/api");
const { initFirebase } = require("./src/firebase");
const { initCloudinary } = require("./src/cloudinary");

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

  const { connectWhatsapp, NUM_INSTANCES } = require("./src/whatsapp");
  const fs = require("fs");
  const path = require("path");
  for (let i = 1; i <= NUM_INSTANCES; i++) {
    const authPath = path.join(__dirname, `.wa_auth_${i}`);
    const credsFile = path.join(authPath, "creds.json");
    if (fs.existsSync(credsFile)) {
      console.log(`[App] Found saved session for instance ${i}, reconnecting...`);
      connectWhatsapp(i).catch(err => console.error(`[App] Auto-connect ${i} error:`, err.message));
    }
  }

  console.log("[App] Ready. Connect WhatsApp numbers from the panel.");
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
