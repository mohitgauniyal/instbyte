const fs = require("fs");
const path = require("path");

// These are the defaults — what you get with zero config file
const defaults = {
    server: {
        port: 3000,
    },
    auth: {
        passphrase: ""        // empty = no password required
    },
    storage: {
        maxFileSize: 2 * 1024 * 1024 * 1024,  // 2GB in bytes
        retention: 24 * 60 * 60 * 1000,        // 24 hours in ms
    },
    branding: {
        appName: "Instbyte",
        logoPath: "",
        faviconPath: "",
        primaryColor: "#111827"
    },
    broadcast: {
        // WebRTC ICE servers for screen-broadcast, same shape as
        // RTCPeerConnection's iceServers. Default is Google's public STUN.
        // Set to [] to disable STUN entirely for pure-LAN / air-gapped use,
        // or add TURN entries: [{ urls: "turn:host:3478", username, credential }]
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    }
};

function parseFileSize(val) {
    if (typeof val === "number") return val;
    const units = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
    const match = String(val).match(/^(\d+(\.\d+)?)\s*(KB|MB|GB)$/i);
    if (!match) return defaults.storage.maxFileSize;
    return parseFloat(match[1]) * units[match[3].toUpperCase()];
}

function parseRetention(val) {
    if (String(val).toLowerCase() === "never") return null;
    if (typeof val === "number") return val;
    const units = { h: 3600000, d: 86400000 };
    const match = String(val).match(/^(\d+)(h|d)$/i);
    if (!match) return defaults.storage.retention;
    return parseInt(match[1]) * units[match[2].toLowerCase()];
}

function parseIceServers(val) {
    // Must be an array of RTCPeerConnection iceServer entries. An empty array is
    // valid and means "no ICE servers" (pure-LAN), so we only fall back to the
    // default when the value is missing or not an array.
    if (!Array.isArray(val)) return defaults.broadcast.iceServers;
    return val;
}

function loadConfig() {
    const configPath = path.join(process.cwd(), "instbyte.config.json");
    let userConfig = {};

    if (fs.existsSync(configPath)) {
        if (fs.statSync(configPath).isDirectory()) {
            console.error(
                "Error: instbyte.config.json is a directory, not a file.\n" +
                "This usually happens in Docker when the config file doesn't exist on the host before the container starts.\n" +
                "Fix: stop the container, run `rm -rf instbyte.config.json && touch instbyte.config.json`, then start again.\n" +
                "Using defaults for now."
            );
        } else {
            try {
                const raw = fs.readFileSync(configPath, "utf-8");
                userConfig = JSON.parse(raw);
                console.log("Config loaded from instbyte.config.json");
            } catch (e) {
                console.warn("Warning: instbyte.config.json is invalid JSON, using defaults.");
            }
        }
    }

    // Deep merge user config over defaults
    const config = {
        server: { ...defaults.server, ...(userConfig.server || {}) },
        auth: { ...defaults.auth, ...(userConfig.auth || {}) },
        storage: { ...defaults.storage, ...(userConfig.storage || {}) },
        branding: { ...defaults.branding, ...(userConfig.branding || {}) },
        broadcast: { ...defaults.broadcast, ...(userConfig.broadcast || {}) }
    };

    // Parse human-readable values like "500MB" or "48h"
    config.storage.maxFileSize = parseFileSize(config.storage.maxFileSize);
    config.storage.retention = parseRetention(config.storage.retention);
    config.broadcast.iceServers = parseIceServers(config.broadcast.iceServers);

    return config;
}

module.exports = loadConfig();