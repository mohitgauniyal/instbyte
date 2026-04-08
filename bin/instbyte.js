#!/usr/bin/env node

"use strict";

const path = require("path");
const fs   = require("fs");

const args = process.argv.slice(2);
const subcommand = args[0];

const SUBCOMMANDS = ["send", "watch", "status"];

// ========================
// HELP
// ========================
function showHelp() {
  console.log(`
Usage:
  instbyte                         Start the server
  instbyte send <file|text>        Send a file or text to a channel
  instbyte send                    Read from stdin and send
  instbyte watch                   Watch a channel, copy new text to clipboard
  instbyte status                  Check if a server is running

Options (send / watch / status):
  --server <url>                   Server URL  (overrides auto-discovery)
  --channel <name>                 Target channel  (default: general)
  --passphrase <pass>              Passphrase if auth is enabled
  --uploader <name>                Display name for sent items  (default: OS username)
  --output                         watch: print to stdout instead of clipboard
  --quiet                          send: suppress confirmation output

Examples:
  instbyte send ./build.zip --channel assets
  instbyte send "http://staging.myapp.com"
  git log --oneline -20 | instbyte send
  instbyte watch --channel projects
  instbyte watch --output | grep error
  instbyte status --server http://192.168.1.10:3000
`);
}

// ========================
// ROUTE
// ========================
if (args.includes("--help") || args.includes("-h")) {
  if (!SUBCOMMANDS.includes(subcommand)) {
    showHelp();
    process.exit(0);
  }
}

if (SUBCOMMANDS.includes(subcommand)) {
  // Each command module is loaded only when needed
  const mod = path.join(__dirname, "cli", subcommand + ".js");
  if (!fs.existsSync(mod)) {
    console.error(`${subcommand}: not implemented yet`);
    process.exit(1);
  }
  require(mod);

} else if (subcommand && !subcommand.startsWith("-")) {
  console.error(`Unknown command: ${subcommand}`);
  showHelp();
  process.exit(1);

} else {
  // No subcommand (or only flags) — start the server
  startServer();
}

// ========================
// SERVER START
// ========================
function startServer() {
  if (!process.env.INSTBYTE_DATA) {
    process.env.INSTBYTE_DATA = path.join(process.cwd(), "instbyte-data");
  }

  if (!process.env.INSTBYTE_UPLOADS) {
    process.env.INSTBYTE_UPLOADS = path.join(process.env.INSTBYTE_DATA, "uploads");
  }

  const dataDir    = process.env.INSTBYTE_DATA;
  const uploadsDir = process.env.INSTBYTE_UPLOADS;

  if (!fs.existsSync(dataDir))    fs.mkdirSync(dataDir,    { recursive: true });
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  process.env.INSTBYTE_BOOT = "1";
  require("../server/server.js");
}
