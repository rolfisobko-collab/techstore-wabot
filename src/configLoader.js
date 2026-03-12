const path = require("path");
const fs = require("fs");
const defaultConfig = require("./config");

const CONFIG_FILE = path.join(__dirname, "../data/config.json");

let activeConfig = { ...defaultConfig };

function reloadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      activeConfig = { ...defaultConfig, ...saved };
      console.log("[Config] Loaded from data/config.json");
    } else {
      activeConfig = { ...defaultConfig };
      console.log("[Config] Using default config.js");
    }
  } catch (err) {
    console.error("[Config] Failed to load saved config, using defaults:", err.message);
    activeConfig = { ...defaultConfig };
  }
}

function saveConfig(updates) {
  try {
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    activeConfig = { ...activeConfig, ...updates };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(activeConfig, null, 2), "utf8");
    console.log("[Config] Saved to data/config.json");
  } catch (err) {
    console.error("[Config] Failed to save config:", err.message);
    throw err;
  }
}

function getConfig() {
  return activeConfig;
}

module.exports = { reloadConfig, saveConfig, getConfig };
