"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const RUNTIME_FILE = path.join("instbyte-data", ".runtime.json");

// Walk up from dir looking for instbyte-data/.runtime.json.
// Stops at the user's home directory.
function findRuntimeConfig(dir) {
  const candidate = path.join(dir, RUNTIME_FILE);
  if (fs.existsSync(candidate)) {
    try { return JSON.parse(fs.readFileSync(candidate, "utf-8")); }
    catch { return null; }
  }

  const parent = path.dirname(dir);
  if (parent === dir || dir === os.homedir()) return null; // reached root or home

  return findRuntimeConfig(parent);
}

// Returns { url, passphrase } for CLI commands.
// Priority: explicit flags → env vars → .runtime.json walk → localhost fallback
function resolveServer(flags = {}) {
  if (flags.server) {
    return {
      url:        flags.server.replace(/\/$/, ""),
      passphrase: flags.passphrase || process.env.INSTBYTE_PASS || ""
    };
  }

  if (process.env.INSTBYTE_URL) {
    return {
      url:        process.env.INSTBYTE_URL.replace(/\/$/, ""),
      passphrase: flags.passphrase || process.env.INSTBYTE_PASS || ""
    };
  }

  const runtime = findRuntimeConfig(process.cwd());
  if (runtime && runtime.url) {
    return {
      url:        runtime.url,
      passphrase: flags.passphrase || runtime.passphrase || ""
    };
  }

  return {
    url:        "http://localhost:3000",
    passphrase: flags.passphrase || ""
  };
}

module.exports = { resolveServer, findRuntimeConfig };
