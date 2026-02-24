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
    if (typeof val === "number") return val;
    const units = { h: 3600000, d: 86400000 };
    const match = String(val).match(/^(\d+)(h|d)$/i);
    if (!match) return defaults.storage.retention;
    return parseInt(match[1]) * units[match[2].toLowerCase()];
}

function loadConfig() {
    const configPath = path.join(process.cwd(), "instbyte.config.json");
    let userConfig = {};

    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, "utf-8");
            userConfig = JSON.parse(raw);
            console.log("Config loaded from instbyte.config.json");
        } catch (e) {
            console.warn("Warning: instbyte.config.json is invalid JSON, using defaults.");
        }
    }

    // Deep merge user config over defaults
    const config = {
        server: { ...defaults.server, ...(userConfig.server || {}) },
        auth: { ...defaults.auth, ...(userConfig.auth || {}) },
        storage: { ...defaults.storage, ...(userConfig.storage || {}) },
        branding: { ...defaults.branding, ...(userConfig.branding || {}) }
    };

    // Parse human-readable values like "500MB" or "48h"
    config.storage.maxFileSize = parseFileSize(config.storage.maxFileSize);
    config.storage.retention = parseRetention(config.storage.retention);

    return config;
}

module.exports = loadConfig();