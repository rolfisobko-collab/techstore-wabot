require("dotenv").config();
const { reloadConfig } = require("./src/configLoader");
const { createApp } = require("./src/api");
const { initFirebase } = require("./src/firebase");

const PORT = process.env.PORT || 8000;

async function main() {
  console.log("[App] Starting TechStore WhatsApp Bot...");

  initFirebase();
  await reloadConfig();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[App] Panel running at http://localhost:${PORT}`);
  });

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
