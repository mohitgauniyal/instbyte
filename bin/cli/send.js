"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");

const { resolveServer } = require("./resolve");

// argv after 'send'
const argv = process.argv.slice(3);

function parseArgs(argv) {
  const flags = {};
  let positional = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key  = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (positional === null) {
      positional = arg;
    }
  }

  return { flags, positional };
}

// Null byte in the first 512 bytes → binary
function isBinary(buf) {
  const limit = Math.min(buf.length, 512);
  for (let i = 0; i < limit; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

// fs.readFileSync(0) reads fd 0 (stdin) synchronously — more portable than
// event-based stream reading, and works correctly in Git Bash / MINGW64.
function readStdin() {
  return fs.readFileSync(0);
}

function fail(msg, hint) {
  console.error(`✗ ${msg}`);
  if (hint) console.error(`  ${hint}`);
  process.exit(1);
}

async function run() {
  const { flags, positional } = parseArgs(argv);

  if (flags.help) {
    console.log("Usage: instbyte send [<file|text>] [--channel <name>] [--server <url>] [--passphrase <pass>] [--uploader <name>] [--quiet]");
    process.exit(0);
  }

  const { url, passphrase } = resolveServer(flags);
  const channel  = flags.channel  || "general";
  const uploader = flags.uploader || os.userInfo().username;
  const quiet    = !!flags.quiet;

  const authHeader = passphrase ? { "X-Passphrase": passphrase } : {};

  // ── FILE ──────────────────────────────────────────────────────────────────
  if (positional && fs.existsSync(positional)) {
    const filePath = path.resolve(positional);
    const filename = path.basename(filePath);

    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(filePath)]), filename);
    form.append("channel",  channel);
    form.append("uploader", uploader);

    let res;
    try {
      res = await fetch(`${url}/upload`, { method: "POST", headers: authHeader, body: form });
    } catch {
      fail(
        "Connection failed — is the server running?",
        `Start with: npx instbyte\nOr specify: instbyte send ${positional} --server http://192.168.x.x:3000`
      );
    }

    if (res.status === 401) fail("Unauthorized — wrong passphrase or auth required");
    if (!res.ok) fail(`Server error: ${res.status}`);

    if (!quiet) console.log(`✓ Sent to ${channel} — ${url}`);
    process.exit(0);
  }

  // ── TEXT (positional arg that is not a file path) ─────────────────────────
  if (positional) {
    let res;
    try {
      res = await fetch(`${url}/push`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "text/plain", "X-Channel": channel, "X-Uploader": uploader },
        body: positional
      });
    } catch {
      fail(
        "Connection failed — is the server running?",
        `Start with: npx instbyte\nOr specify: instbyte send "${positional}" --server http://192.168.x.x:3000`
      );
    }

    if (res.status === 401) fail("Unauthorized — wrong passphrase or auth required");
    if (!res.ok) fail(`Server error: ${res.status}`);

    if (!quiet) console.log(`✓ Sent to ${channel} — ${url}`);
    process.exit(0);
  }

  // ── STDIN ─────────────────────────────────────────────────────────────────
  if (!process.stdin.isTTY) {
    let buf;
    try { buf = readStdin(); }
    catch { fail("Failed to read stdin"); }

    if (isBinary(buf)) {
      fail("Binary stdin detected — use `instbyte send ./file` to upload a file");
    }

    const content = buf.toString("utf-8");
    if (!content.trim()) fail("Empty input — nothing to send");

    let res;
    try {
      res = await fetch(`${url}/push`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "text/plain", "X-Channel": channel, "X-Uploader": uploader },
        body: content
      });
    } catch {
      fail(
        "Connection failed — is the server running?",
        "Start with: npx instbyte\nOr specify: instbyte send --server http://192.168.x.x:3000"
      );
    }

    if (res.status === 401) fail("Unauthorized — wrong passphrase or auth required");
    if (!res.ok) fail(`Server error: ${res.status}`);

    if (!quiet) console.log(`✓ Sent to ${channel} — ${url}`);
    process.exit(0);
  }

  // ── NO INPUT ──────────────────────────────────────────────────────────────
  console.error("Usage: instbyte send <file|text>");
  console.error("       cat file.log | instbyte send");
  process.exit(1);
}

run();
