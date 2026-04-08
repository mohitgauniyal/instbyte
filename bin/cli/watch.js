"use strict";

const { spawn }         = require("child_process");
const os                = require("os");
const { resolveServer } = require("./resolve");

const argv = process.argv.slice(3);

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key  = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) { flags[key] = next; i++; }
      else flags[key] = true;
    }
  }
  return flags;
}

// Write text to the system clipboard.
// Falls back to printing the text if the clipboard tool is not found.
function copyToClipboard(text) {
  let cmd, args;
  if (process.platform === "darwin") {
    cmd = "pbcopy"; args = [];
  } else if (process.platform === "win32") {
    cmd = "clip"; args = [];
  } else {
    cmd = "xclip"; args = ["-sel", "c"];
  }

  const proc = spawn(cmd, args, { stdio: ["pipe", "ignore", "ignore"] });
  proc.on("error", () => process.stdout.write(text + "\n")); // fallback
  proc.stdin.write(text, "utf-8");
  proc.stdin.end();
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + "…" : str;
}

function run() {
  const flags = parseArgs(argv);

  if (flags.help) {
    console.log("Usage: instbyte watch [--channel <name>] [--server <url>] [--passphrase <pass>] [--output]");
    process.exit(0);
  }

  const { url } = resolveServer(flags);
  const channel    = flags.channel || "general";
  const outputMode = !!flags.output;

  // In --output mode, status messages go to stderr so stdout stays clean for piping
  const status = outputMode
    ? (msg) => process.stderr.write(msg + "\n")
    : (msg) => process.stdout.write(msg + "\n");

  const { io } = require("socket.io-client");

  const socket = io(url, {
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000
  });

  let connected       = false;
  let connectErrShown = false;
  let stopping        = false;

  socket.on("connect", () => {
    socket.emit("join", os.userInfo().username);
    status(connected
      ? "Reconnected."
      : `Watching ${channel} on ${url}... (Ctrl+C to stop)`
    );
    connected       = true;
    connectErrShown = false;
  });

  socket.on("disconnect", () => {
    if (stopping) return;
    connected = false;
    status("Reconnecting...");
  });

  socket.on("connect_error", () => {
    if (!connectErrShown) {
      status(`✗ Cannot connect to ${url}`);
      status(`  Start a server with: npx instbyte`);
      connectErrShown = true;
    }
  });

  socket.on("new-item", (item) => {
    if (item.channel !== channel) return;

    if (item.type === "file") {
      process.stdout.write(`📎 File: ${url}/uploads/${item.filename}\n`);
      return;
    }

    if (item.type === "text") {
      if (outputMode) {
        process.stdout.write(item.content + "\n");
      } else {
        copyToClipboard(item.content);
        process.stdout.write(`✓ Copied: "${truncate(item.content, 60)}"\n`);
      }
    }
  });

  process.on("SIGINT", () => {
    stopping = true;
    socket.disconnect();
    process.stdout.write("\nStopped watching.\n");
    process.exit(0);
  });
}

run();
