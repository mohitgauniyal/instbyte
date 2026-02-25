<p align="center">
  <img src="client/assets/logo.png" alt="Instbyte Logo" width="100">
</p>

<h1 align="center">Instbyte</h1>

<p align="center">
  A self-hosted LAN sharing utility you can make your own — files, links, and snippets across devices instantly, no cloud required.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/instbyte"><img src="https://img.shields.io/npm/v/instbyte" alt="npm version"></a>
  <a href="https://github.com/mohitgauniyal/instbyte/blob/main/LICENSE">
  <img src="https://img.shields.io/github/license/mohitgauniyal/instbyte" alt="license">
</a>
</p>

---

**Instbyte** is a high-speed, real-time, short-lived LAN sharing utility built for teams and developers who need to move snippets, links, files, and structured notes across devices instantly — without cloud accounts, logins, or external services.

It operates entirely on your local network, acting as a lightweight "digital dead-drop" for frictionless collaboration.

Instbyte can also be fully white-labelled — the difference between ***a tool you use*** and ***a tool you own***.

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
- Paste anywhere on the page → auto-sends
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

### Keeping It Running
For persistent team use, run it as a background process:

```bash
# using pm2
npm install -g pm2
pm2 start "npx instbyte" --name instbyte
pm2 save
```

Or use any process manager you already have — systemd, screen, tmux.

---

## Configuration

Instbyte works out of the box with zero configuration. All options are optional — only include what you want to override.

| Key | Default | Description |
|---|---|---|
| `server.port` | `3000` | Port to run on. Overridden by `PORT` env var if set |
| `auth.passphrase` | `""` | Shared passphrase for access. Empty = no auth |
| `storage.maxFileSize` | `"2GB"` | Max upload size. Accepts `KB`, `MB`, `GB` |
| `storage.retention` | `"24h"` | How long before items auto-delete. Accepts `h`, `d` |
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

**Short-lived by design** — all content auto-deletes after 24 hours. Nothing lingers.

**QR join** — built-in QR code so phones can join instantly without typing the URL.

---

## Manual / Self-hosted from Source

```bash
git clone https://github.com/mohitgauniyal/instbyte
cd instbyte
npm install
node server/server.js
```

---

## Use Cases

- Moving content between your phone and laptop over WiFi
- Sharing API payloads, logs, or screenshots during a sprint
- A lightweight team clipboard during standups or pair sessions
- Home lab file sharing without setting up NAS or cloud sync

---

## Versioning

Instbyte follows [Semantic Versioning](https://semver.org). See [Releases](https://github.com/mohitgauniyal/instbyte/releases) for full changelog.

---

## Contributing

Instbyte is intentionally lightweight and LAN-first. If you want to extend it — CLI tools, themes, integrations — open an issue or submit a pull request.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

