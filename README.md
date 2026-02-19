
<p align="center">
  <img src="client/assets/logo.png" alt="Instbyte Logo" width="120">
</p>

<h1 align="center">Instbyte</h1>

**Instbyte** is a high-speed, real-time, short-lived LAN sharing utility
built for teams and developers who need to move snippets, links, and
files across devices instantly — without cloud accounts, logins, or
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

### Dynamic Channel Management
- Create channels on the fly
- Rename channels
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

### Smart Port Handling
Automatically switches to the next available port if `3000` is already in use.

### Improved Upload Validation
- File size limits enforced
- Clear visual size indicators (100MB / 500MB / 1GB thresholds)
- Upload progress feedback

---

## Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   node server.js
   ```

3. **Access Instbyte**
   - Local: `http://localhost:<port>`
   - Network: Use the displayed LAN IP or scan the QR code from another device

4. **Share Instantly**
   Type, paste, drag, or upload. Done.

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

If you're interested in extending functionality — such as optional
authentication, configurable cleanup windows, encryption, or UI themes —
feel free to open an issue or submit a pull request.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
