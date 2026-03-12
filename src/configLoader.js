const defaultConfig = require("./config");

let activeConfig = { ...defaultConfig };

async function reloadConfig() {
  try {
    const { getRemoteConfig } = require("./firebase");
    const remote = await getRemoteConfig();
    if (remote) {
      activeConfig = { ...defaultConfig, ...remote };
      console.log("[Config] Loaded from Firestore");
    } else {
      activeConfig = { ...defaultConfig };
      console.log("[Config] Using default config.js");
    }
  } catch (err) {
    console.error("[Config] Failed to load from Firestore, using defaults:", err.message);
    activeConfig = { ...defaultConfig };
  }
}

async function saveConfig(updates) {
  const { saveRemoteConfig } = require("./firebase");
  activeConfig = { ...activeConfig, ...updates };
  await saveRemoteConfig(updates);
  console.log("[Config] Saved to Firestore");
}

function getConfig() {
  return activeConfig;
}

module.exports = { reloadConfig, saveConfig, getConfig };
