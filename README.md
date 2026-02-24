
<p align="center">
  <img src="client/assets/logo.png" alt="Instbyte Logo" width="120">
</p>

<h1 align="center">Instbyte</h1>

**Instbyte** is a high-speed, real-time, short-lived LAN sharing utility
built for teams and developers who need to move snippets, links, files, and structured notes across devices instantly — without cloud accounts, logins, or
external services.

It operates entirely on your local network, acting as a lightweight
"digital dead-drop" for frictionless collaboration.


## Core Features

### Real-Time Sync
Every action (clipboard paste, file drop, channel update, rename, etc.)
is instantly synchronized across all connected devices.

### Zero-Friction Sharing
- **Paste Anywhere** — Copy text or links and paste directly onto the page.
- **Drag & Drop** — Drop files anywhere on the interface to upload.
- **Manual Upload** — Use the upload button when needed.
- **Hover Copy Button** — Instantly copy text snippets with visual feedback.

### Rich Text & Code Support
- Markdown rendering for formatted notes
- Syntax highlighting for code snippets
- Ideal for sharing API payloads, logs, and quick technical drafts

### Dynamic Channel Management
- Create channels on the fly
- Rename channels
- Pin / Unpin important channels
- Prevent deletion of pinned channels
- Move items between channels
- Delete channels (with safety checks)
- Automatic deletion of channel items when a channel is removed
- Prevent deletion of the final remaining channel
- Real-time sync of channel changes across all clients

### Searchable History
Full-text search across channels for previously shared snippets and files.

### Short-lived by Design
All shared content is automatically deleted after 24 hours via background cleanup.

### LAN Optimized
Designed for seamless operation across devices connected to the same WiFi or local network.

### Network Visibility & QR Join
- Server address displayed directly in the UI
- Built-in QR code generation for instant device joining
- Perfect for mobile-to-desktop transfers
- Optional default username assignment for new users on join

### Smart Port Handling
Automatically switches to the next available port if `3000` is already in use.

### Security & Configuration
- Optional passphrase protection via `instbyte.config.json`
- Rate limiting on login attempts (10 per 15 minutes)
- 7-day session cookie — login once, stay in
- All behaviour configurable without touching code

### Make It Yours
Instbyte can be fully white-labelled to match your team or brand — no code changes required.

- Custom app name across the entire interface and browser tab
- Your own logo served automatically
- Favicon auto-generated from your logo, or provide your own
- One primary color transforms the entire UI — buttons, active states, accents
- Secondary color auto-derived as a complementary match
- Login page inherits your branding too

The difference between *a tool you use* and *a tool you own.*

### Improved Upload Validation
- File size limits enforced
- Clear visual size indicators (100MB / 500MB / 1GB thresholds)
- Upload progress feedback

### Inline File Preview
- Images preview directly in the interface
- Video and audio playback without downloading
- PDF preview inside the browser
- Text and code files readable inline

---

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **(Optional) Create a config file**
```bash
   touch instbyte.config.json
```
   See the [Configuration](#configuration) section for available options.

3. **Start the Server**
   ```bash
   node server.js
   ```

4. **Access Instbyte**
   - Local: `http://localhost:<port>`
   - Network: Use the displayed LAN IP or scan the QR code from another device

5. **Share Instantly**
   Type, paste, drag, or upload. Done.

---

## Configuration

Instbyte works out of the box with zero configuration. For teams or advanced
users, create an `instbyte.config.json` file in the project root to customise
behaviour.

### Full Example
```json
{
  "server": {
    "port": 3000
  },
  "auth": {
    "passphrase": "myteam123"
  },
  "storage": {
    "maxFileSize": "2GB",
    "retention": "24h"
  }
}
```

### Options

| Key | Default | Description |
|---|---|---|
| `server.port` | `3000` | Port to run on. Overridden by `PORT` env var if set. |
| `auth.passphrase` | `""` | Shared password for access. Empty = no auth. |
| `storage.maxFileSize` | `"2GB"` | Max upload size. Accepts `KB`, `MB`, `GB`. |
| `storage.retention` | `"24h"` | How long before items are auto-deleted. Accepts `h`, `d`. |
| `branding` | — | White-label the app. See [Branding](#branding) section. |

Only include the keys you want to override. Missing keys fall back to defaults.

---

## Branding

Instbyte can be white-labelled to look and feel like your own internal tool.
Add a `branding` block to your `instbyte.config.json`:
```json
{
  "branding": {
    "appName": "Team Hub",
    "logoPath": "./assets/my-logo.png",
    "faviconPath": "./assets/my-favicon.png",
    "primaryColor": "#7c3aed"
  }
}
```

| Key | Default | Description |
|---|---|---|
| `branding.appName` | `"Instbyte"` | App name shown in the header and browser tab |
| `branding.logoPath` | — | Path to your logo file (PNG, JPG, WebP) relative to where you run the server |
| `branding.faviconPath` | — | Path to a custom favicon. If omitted, auto-generated from your logo |
| `branding.primaryColor` | `"#111827"` | Primary brand color in hex. All UI colors are derived from this automatically |

**Notes:**
- `faviconPath` is optional — if you provide a logo, a favicon is generated from it automatically via `sharp`
- Secondary and hover colors are derived automatically from your primary color — no manual tuning needed
- If `sharp` is not installed, favicon generation is skipped gracefully and the default favicon is used instead


---

## Ideal Use Cases

- **Sprint Collaboration**
  Quickly exchange API payloads, logs, screenshots, or temporary assets.

- **Cross-Device Bridge**
  Move content between phone and workstation instantly over WiFi.

- **Home Lab Utility**
  Share links or files across personal devices on the same network.

- **Temporary Team Workspace**
  Lightweight collaboration without Slack, email, or cloud dependencies.

---

## Versioning

Instbyte follows Semantic Versioning:

- **MAJOR** — Breaking changes  
- **MINOR** — New features & improvements  
- **PATCH** — Bug fixes  

See the GitHub [Releases](https://github.com/mohitgauniyal/instbyte/releases) section for full release notes.

---

## Contributing

Instbyte is designed to remain lightweight and LAN-first.

If you're interested in extending functionality — such as CLI companion,
UI themes, or Single command setup — feel free to open an issue
or submit a pull request.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
