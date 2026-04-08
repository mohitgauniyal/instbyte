"use strict";

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

function formatUptime(seconds) {
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

async function run() {
  const flags = parseArgs(argv);

  if (flags.help) {
    console.log("Usage: instbyte status [--server <url>] [--passphrase <pass>]");
    process.exit(0);
  }

  const { url, passphrase } = resolveServer(flags);
  const headers = passphrase ? { "X-Passphrase": passphrase } : {};

  let health, channels;

  try {
    const [hRes, cRes] = await Promise.all([
      fetch(`${url}/health`, { headers }),
      fetch(`${url}/channels`, { headers })
    ]);

    if (!hRes.ok) throw new Error(`${hRes.status}`);
    health   = await hRes.json();
    channels = await cRes.json();
  } catch {
    console.error(`✗ No Instbyte server found at ${url}`);
    console.error(`  Start one with:  npx instbyte`);
    console.error(`  Or specify:      instbyte status --server http://192.168.x.x:3000`);
    process.exit(1);
  }

  const channelNames = channels.map(c => c.name).join(", ");

  console.log(`✓ Instbyte v${health.version} running at ${url}`);
  console.log(`  Uptime:    ${formatUptime(health.uptime)}`);
  console.log(`  Connected: ${health.connected} user${health.connected !== 1 ? "s" : ""}`);
  console.log(`  Channels:  ${channelNames}`);
  if (health.hasAuth) console.log(`  Auth:      enabled`);
}

run();
