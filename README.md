<p align="center">
  <img src="client/assets/logo.png" alt="Instbyte Logo" width="100">
</p>

<h1 align="center">Instbyte</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/instbyte"><img src="https://img.shields.io/npm/v/instbyte" alt="npm version"></a>
  <a href="https://github.com/mohitgauniyal/instbyte/blob/main/LICENSE">
  <img src="https://img.shields.io/github/license/mohitgauniyal/instbyte" alt="license">
</a>
</p>

---

<p align="center">
  <img src="assets/instbyte-ad.png" width="900">
</p>

```bash
npx instbyte
```

You're three feet from your teammate. *A quick share* still leaves your building before it reaches them.

Your chat app is for conversation. Your cloud storage is for files. Your email is for async.

None of them are for *right now, on this network, gone tomorrow.*

That's what **Instbyte** is for.

---

## Install & Run

**Requires Node.js 18 or higher.**

The fastest way — no installation needed:
```bash
npx instbyte
```

Or install globally and run from anywhere:
```bash
npm install -g instbyte
instbyte
```
Data and config live in the directory you run the command from. To keep a permanent instance, always run from the same folder or use a process manager like pm2.

That's it. Open the displayed URL in any browser on the same network.

---

## How It Works

One person runs the server — everyone else on the same WiFi opens the URL in their browser. No accounts, no setup on client devices.

```
[Your Machine] — runs: npx instbyte
                        ↓
               http://192.168.x.x:3000
                        ↓
   [Phone] [Laptop] [Tablet] — open URL in browser
```

**Sharing is instant:**
- Type or paste text → hit Send
- Paste anywhere on the page → auto-sends text or uploads images directly
- Drag a file anywhere onto the page → uploads
- Click any text item → copies to clipboard
- Click any file item → downloads

Everything syncs in real time across all connected devices. Content auto-deletes after 24 hours.

---

## For Teams

### Quick Setup (No Config)
Run `npx instbyte` on the machine that will act as the server. Share the displayed network URL with your team. Done.

### With Config File
For teams who want auth, custom retention, or branding — create `instbyte.config.json` in the directory where you run the command:

```json
{
  "server": {
    "port": 3000
  },
  "auth": {
    "passphrase": "yourteampassword"
  },
  "storage": {
    "maxFileSize": "2GB",
    "retention": "24h"
  },
  "branding": {
    "appName": "Team Hub",
    "primaryColor": "#7c3aed",
    "logoPath": "./logo.png"
  }
}
```

Then run `npx instbyte` in the same directory. The config is picked up automatically.

For persistent deployment options including pm2, systemd, and Docker, see the [Deployment Guide](docs/deployment.md).

---

## Docker

For Docker setup, persistent data, and config file mounting, see [Deployment Guide](docs/deployment.md).

---

## Reverse Proxy

For Nginx, Caddy, and HTTPS setup, see [Deployment Guide](docs/deployment.md).

---

## Configuration

Instbyte works out of the box with zero configuration. All options are optional — only include what you want to override.

| Key | Default | Description |
|---|---|---|
| `server.port` | `3000` | Port to run on. Overridden by `PORT` env var if set |
| `auth.passphrase` | `""` | Shared passphrase for access. Empty = no auth |
| `storage.maxFileSize` | `"2GB"` | Max upload size. Accepts `KB`, `MB`, `GB` |
| `storage.retention` | `"24h"` | How long before items auto-delete. Accepts `h`, `d`, or `"never"` to disable cleanup entirely |
| `branding.appName` | `"Instbyte"` | App name in header and browser tab |
| `branding.primaryColor` | `"#111827"` | Primary brand color in hex. Full palette auto-derived |
| `branding.logoPath` | — | Path to your logo file relative to where you run the command |
| `branding.faviconPath` | — | Path to custom favicon. Auto-generated from logo if omitted |

---

## Branding

Instbyte can be fully white-labelled — no code changes required. Set a name, a color, and a logo and the entire UI updates automatically including the login page, favicon, buttons, and active states.

```json
{
  "branding": {
    "appName": "Team Hub",
    "primaryColor": "#7c3aed",
    "logoPath": "./my-logo.png"
  }
}
```

The difference between *a tool you use* and *a tool you own.*

---

## Features

**Real-time sync** — every action is instantly reflected across all connected devices via WebSockets.

**Channels** — organise shared content into named channels. Create, rename, pin, and delete channels on the fly. Pinned channels are protected from accidental deletion.

**Rich content** — markdown rendering, syntax highlighting for code, inline image preview, video and audio playback, PDF preview, and text file viewing — all without downloading.

**Search** — full-text search across all channels.

**Smart port handling** — if port 3000 is busy, Instbyte finds the next available port automatically.

**Short-lived by design** — content auto-deletes after 24 hours by default. Configure retention per your needs, or disable cleanup entirely.

**QR join** — built-in QR code so phones can join instantly without typing the URL.

**Dark mode** — follows system preference automatically. Override with the toggle in the header.

**Undo delete** — recover accidentally removed items instantly before they’re gone.

**New drop alerts** — get a notification sound when something is added in your current channel and visual indicators for activity in others.

**Presence awareness** — see how many people are currently connected in real time.

**Live broadcast** — share your screen in real time with everyone on the network. Viewers join instantly from their browser, no plugins or installs needed. Built on WebRTC for smooth, low-latency video. Includes mic audio, viewer mute/unmute, raise hand, and screen capture to channel.

**Read receipts** — see how many devices have viewed each shared item. Updates live as teammates open the page.

**Item management** — add optional titles to label any item for future reference. Edit text items inline without deleting and re-pasting. Pinned items are protected from both manual deletion and auto-cleanup.

**Mobile ready** — install as a PWA directly from your browser. Add to Home Screen on iOS or Android for a native app feel without the App Store.

**Security hardened** — rate limiting on all write endpoints, magic number file validation, filename sanitisation, and forced download for executable file types.

**CLI companion** — `instbyte send`, `instbyte watch`, and `instbyte status` let you push files, pipe command output, sync clipboard, and check server health without opening a browser. Auto-discovers the running server from your working directory.

---

## Broadcasting

One person shares their screen — everyone else on the network watches live in their browser. No plugins, no accounts, no external services. Built on WebRTC.

Viewers can save the current frame to a channel, raise a hand to notify the broadcaster, and toggle audio from the panel.

For HTTPS setup and advanced network configuration, see the [Deployment Guide](docs/deployment.md#broadcasting).

---

## Keyboard Shortcuts

```
| Key | Action |
|---|---|
| `/` | Focus search |
| `Escape` | Close previews, menus, or blur input |
| `Ctrl/Cmd + Enter` | Send message |
| `Ctrl/Cmd + K` | Jump to message input |
| `Tab` | Cycle channels |

---

## Manual / Self-hosted from Source

```bash
git clone https://github.com/mohitgauniyal/instbyte
cd instbyte
npm install
node bin/instbyte.js
```

---

## Use Cases

- Moving content between your phone and laptop, or just any device over WiFi
- Sharing API payloads, logs, or screenshots during a sprint
- A lightweight team clipboard during standups or pair sessions
- Home lab file sharing without setting up NAS or cloud sync
- Piping build logs or stack traces from CI or terminal directly into a shared channel
- Sharing sensitive credentials or config files over LAN without leaving a cloud trail
- Live screen sharing during standups, design reviews, or debugging sessions — no Zoom link needed

---

## CLI & Terminal Usage

Send files, pipe command output, watch channels, and check server status from your terminal — no browser needed.

```bash
instbyte send ./build.zip --channel assets
instbyte send "http://staging.myapp.com"
git log --oneline -20 | instbyte send
instbyte watch --channel projects
instbyte status
```

See the [Terminal Usage Guide](docs/terminal-usage.md) for the full CLI reference, CI/CD setup, and raw curl fallback.

---

## Versioning

Instbyte follows [Semantic Versioning](https://semver.org). See [Releases](https://github.com/mohitgauniyal/instbyte/releases) for full changelog.

---

## Contributing

Instbyte is intentionally lightweight and LAN-first. If you want to extend it — CLI tools, themes, integrations — open an issue or submit a pull request.

The codebase has a full test suite (214 tests across unit and integration). Run `npm test` before submitting anything. Issues tagged **good first issue** are a good starting point.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

