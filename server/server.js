require("./cleanup");
const fs = require("fs");
const os = require("os");
const net = require("net");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

let sharp = null;
try { sharp = require("sharp"); } catch (e) { }

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const db = require("./db");

const config = require("./config");

const UPLOADS_DIR = process.env.INSTBYTE_UPLOADS
  || path.join(__dirname, "../uploads");

// Create the uploads folder if it doesn't exist yet.
// Needed for Docker — the volume mount replaces anything created during build.
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* STARTUP ORPHAN SCAN
 Deletes any files in uploads dir that have no matching DB record.
 Catches ghost files left by aborted uploads before fix in v1.9.1 */
function scanOrphans() {
  fs.readdir(UPLOADS_DIR, (err, files) => {
    if (err || !files || !files.length) return;

    db.all("SELECT filename FROM items WHERE filename IS NOT NULL", (err, rows) => {
      if (err) return;

      const known = new Set(rows.map(r => r.filename));
      files.forEach(file => {
        if (!known.has(file)) {
          const orphan = path.join(UPLOADS_DIR, file);
          fs.unlink(orphan, err => {
            if (!err) console.log("Orphan removed:", file);
          });
        }
      });
    });
  });
}

const CLIENT_DIR = path.join(__dirname, "../client");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(helmet({
  contentSecurityPolicy: false  // disable CSP for now — it would block CDN scripts
}));

app.use((req, res, next) => {
  if (req.path === '/upload') return next();

  const ct = req.headers['content-type'] || '';

  if (ct.startsWith('text/plain')) {
    return express.text({ limit: '10mb' })(req, res, next);
  }

  express.json()(req, res, next);
});

app.use(cookieParser());
app.use(requireAuth);
app.use("/uploads", (req, res, next) => {
  const ext = req.path.split('.').pop().toLowerCase();
  if (FORCE_DOWNLOAD_EXTENSIONS.has(ext)) {
    const filename = path.basename(req.path);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  next();
}, express.static(UPLOADS_DIR));
app.use(express.static(CLIENT_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const safe = sanitiseFilename(file.originalname);
    const unique = Date.now() + "-" + safe;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.storage.maxFileSize },
});

// FILE SECURITY

// Extensions that must never be rendered inline by a browser.
// These are served with Content-Disposition: attachment always.
const FORCE_DOWNLOAD_EXTENSIONS = new Set([
  'svg', 'html', 'htm', 'xml', 'xhtml', 'js', 'mjs', 'php',
  'sh', 'bash', 'py', 'rb', 'pl', 'ps1', 'bat', 'cmd', 'exe',
  'dll', 'jar', 'vbs', 'ws', 'hta'
]);

// Magic number signatures — first bytes that identify real file types.
// Key = expected extension group, value = array of valid byte signatures.
const MAGIC_NUMBERS = {
  jpg: [Buffer.from([0xFF, 0xD8, 0xFF])],
  png: [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  gif: [Buffer.from([0x47, 0x49, 0x46, 0x38])],
  webp: [Buffer.from([0x52, 0x49, 0x46, 0x46])],
  pdf: [Buffer.from([0x25, 0x50, 0x44, 0x46])],
  zip: [Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from([0x50, 0x4B, 0x05, 0x06])],
  mp4: [Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from([0x00, 0x00, 0x00, 0x20])],
};

// Extension → magic group mapping
const EXT_TO_MAGIC = {
  jpg: 'jpg', jpeg: 'jpg',
  png: 'png',
  gif: 'gif',
  webp: 'webp',
  pdf: 'pdf',
  zip: 'zip',
  mp4: 'mp4',
};

function sanitiseFilename(name) {
  return name
    .replace(/[/\\?%*:|"<>\x00]/g, '_')  // strip path separators and dangerous chars
    .replace(/\.{2,}/g, '.')              // collapse .. sequences
    .trim()
    .slice(0, 255);                        // max filename length
}

function checkMagicNumber(filePath, ext) {
  const group = EXT_TO_MAGIC[ext.toLowerCase()];
  if (!group) return true; // no check defined for this type — allow through

  const signatures = MAGIC_NUMBERS[group];
  if (!signatures) return true;

  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(8);
    fs.readSync(fd, buf, 0, 8, 0);
    fs.closeSync(fd);
    return signatures.some(sig => buf.slice(0, sig.length).equals(sig));
  } catch (e) {
    return false; // can't read → reject
  }
}

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)]
    .map(x => Math.round(x * 255).toString(16).padStart(2, "0"))
    .join("");
}

function getLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function buildPalette(hex) {
  // Fallback if hex is invalid
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) hex = "#111827";

  const [h, s, l] = hexToHsl(hex);

  // Derive secondary as complementary (180° opposite on color wheel)
  const secondaryHex = hslToHex((h + 180) % 360, Math.min(s, 60), Math.max(l, 35));

  // Text on primary — white or dark based on contrast
  const onPrimary = getLuminance(hex) > 0.179 ? "#111827" : "#ffffff";
  const onSecondary = getLuminance(secondaryHex) > 0.179 ? "#111827" : "#ffffff";

  return {
    primary: hex,
    primaryHover: hslToHex(h, s, Math.max(l - 10, 10)),
    primaryLight: hslToHex(h, Math.min(s, 80), Math.min(l + 40, 96)),
    primaryDark: hslToHex(h, s, Math.max(l - 20, 5)),
    onPrimary,
    secondary: secondaryHex,
    secondaryHover: hslToHex((h + 180) % 360, Math.min(s, 60), Math.max(l - 10, 10)),
    secondaryLight: hslToHex((h + 180) % 360, Math.min(s, 60), Math.min(l + 40, 96)),
    onSecondary,
  };
}

const COOKIE_NAME = "instbyte_auth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Active sessions — token → true. Cleared on restart, which is intentional.
const sessions = new Map();

function requireAuth(req, res, next) {
  if (!config.auth.passphrase) return next();

  if (req.path === "/login" || req.path === "/info" || req.path === "/health") return next();

  // Terminal / API clients — accept passphrase via header
  const headerPass = req.headers["x-passphrase"];
  if (headerPass && headerPass === config.auth.passphrase) return next();

  // Browser clients — check session cookie
  const cookie = req.cookies[COOKIE_NAME];
  if (cookie && sessions.has(cookie)) return next();

  if (req.path.startsWith("/socket.io")) return next();

  // Return JSON 401 for any non-browser request
  const ct = req.headers["content-type"] || "";
  const isApiRequest = ct.startsWith("application/json") ||
    ct.startsWith("text/plain") ||
    req.xhr ||
    req.headers["x-passphrase"] !== undefined;

  if (isApiRequest) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.redirect("/login");
}


/* LOGIN PAGE */
app.get("/login", (req, res) => {
  if (!config.auth.passphrase) return res.redirect("/");
  if (sessions.has(req.cookies[COOKIE_NAME])) return res.redirect("/");

  const loginPalette = buildPalette(config.branding.primaryColor);
  const loginBrandingStyle = `
    button { background: ${loginPalette.primary}; color: ${loginPalette.onPrimary}; }
    button:hover { background: ${loginPalette.primaryHover}; }
`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>${config.branding.appName || "Instbyte"} — Login</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .box {
      background: #fff;
      border-radius: 12px;
      padding: 36px;
      width: 100%;
      max-width: 360px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      text-align: center;
    }
    .logo { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 6px; }
    .sub  { font-size: 13px; color: #9ca3af; margin-bottom: 28px; }
    input {
      width: 100%;
      padding: 11px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 12px;
      outline: none;
    }
    input:focus { border-color: #9ca3af; }
    button {
      width: 100%;
      padding: 11px;
      background: #111827;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    }
    button:hover { background: #1f2937; }
    .error {
      color: #b91c1c;
      font-size: 13px;
      margin-top: 10px;
      display: none;
    }
    
    ${loginBrandingStyle}

  </style>
</head>
<body>
  <div class="box">
    <div class="logo">${config.branding.appName || "Instbyte"}</div>
    <div class="sub">Enter passphrase to continue</div>
    <input type="password" id="pass" placeholder="Passphrase" autofocus
      onkeydown="if(event.key==='Enter') submit()">
    <button onclick="submit()">Continue</button>
    <div class="error" id="err">Incorrect passphrase</div>
  </div>
  <script>
    async function submit() {
      const pass = document.getElementById("pass").value;
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: pass })
      });
      if (res.ok) {
        window.location.href = "/";
      } else {
        document.getElementById("err").style.display = "block";
        document.getElementById("pass").value = "";
        document.getElementById("pass").focus();
      }
    }
  </script>
</body>
</html>`);
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, try again later" }
});

const dropLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: "Too many requests,  try again later" }
});

const channelLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: "Too many requests,  try again later" }
});

const broadcastLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: "Too many broadcast attempts, slow down" }
});

/* LOGIN POST */
app.post("/login", loginLimiter, (req, res) => {
  if (!config.auth.passphrase) return res.redirect("/");

  const { passphrase } = req.body;
  if (passphrase === config.auth.passphrase) {
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(token, true);
    res.cookie(COOKIE_NAME, token, {
      maxAge: COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: "strict"
    });
    return res.json({ ok: true });
  }

  res.status(401).json({ error: "Incorrect passphrase" });
});

/* LOGOUT */
app.post("/logout", (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  if (token) sessions.delete(token);
  res.clearCookie(COOKIE_NAME);
  res.redirect("/login");
});


/* FILE UPLOAD */
app.post("/upload", dropLimiter, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file received" });
  }

  // Magic number check — verify file content matches its extension
  const ext = req.file.originalname.split('.').pop().toLowerCase();
  const filePath = path.join(UPLOADS_DIR, req.file.filename);
  if (!checkMagicNumber(filePath, ext)) {
    fs.unlinkSync(filePath); // delete the suspicious file immediately
    return res.status(400).json({ error: "File content does not match its extension" });
  }

  const { channel, uploader } = req.body;

  const item = {
    type: "file",
    filename: req.file.filename,
    size: req.file.size,
    channel,
    uploader,
    created_at: Date.now(),
  };

  db.run(
    `INSERT INTO items (type, filename, size, channel, uploader, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["file", item.filename, item.size, channel, uploader, item.created_at],
    function (dbErr) {
      if (dbErr) {
        const orphan = path.join(UPLOADS_DIR, item.filename);
        if (fs.existsSync(orphan)) fs.unlinkSync(orphan);
        return res.status(500).json({ error: "Failed to save item" });
      }
      item.id = this.lastID;
      io.emit("new-item", item);
      res.json(item);
    }
  );
});

// Multer error handler — catches file size limit and other upload errors
app.use((err, req, res, next) => {
  if (err && err.code === "LIMIT_FILE_SIZE") {
    if (req.file) {
      const partial = path.join(UPLOADS_DIR, req.file.filename);
      if (fs.existsSync(partial)) fs.unlinkSync(partial);
    }
    return res.status(413).json({ error: "File exceeds limit" });
  }
  next(err);
});

/* TEXT/LINK — accepts application/json and text/plain */
function handleTextPost(req, res) {
  let content, channel, uploader;

  if (req.is("text/plain")) {
    // Terminal path — body is raw string, metadata comes from headers
    content = typeof req.body === "string" ? req.body : String(req.body);
    channel = (req.headers["x-channel"] || "general").trim();
    uploader = (req.headers["x-uploader"] || "terminal").trim();
  } else {
    // Browser / JSON path — existing behaviour unchanged
    ({ content, channel, uploader } = req.body || {});
  }

  if (!content || !content.trim()) {
    return res.status(400).json({ error: "Content is required" });
  }

  if (!channel) {
    return res.status(400).json({ error: "Channel is required" });
  }

  const item = {
    type: "text",
    content,
    channel,
    uploader,
    created_at: Date.now(),
  };

  db.run(
    `INSERT INTO items (type, content, channel, uploader, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["text", content, channel, uploader, item.created_at],
    function (err) {
      if (err) return res.status(500).json({ error: "Failed to save item" });
      item.id = this.lastID;
      io.emit("new-item", item);
      res.json(item);
    }
  );
}

app.post("/text", dropLimiter, handleTextPost);
app.post("/push", dropLimiter, handleTextPost); // terminal-friendly alias


/* DELETE ITEM */
app.delete("/item/:id", (req, res) => {
  const id = req.params.id;

  db.get(`SELECT * FROM items WHERE id=?`, [id], (err, item) => {
    if (!item) return res.sendStatus(404);

    if (item.filename) {
      const filePath = path.join(UPLOADS_DIR, item.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.run(`DELETE FROM items WHERE id=?`, [id], () => {
      seenBy.delete(parseInt(id));
      io.emit("delete-item", id);
      res.sendStatus(200);
    });
  });
});

/* PIN */
app.post("/pin/:id", (req, res) => {
  const id = req.params.id;

  db.run(
    `UPDATE items SET pinned = CASE WHEN pinned=1 THEN 0 ELSE 1 END WHERE id=?`,
    [id],
    () => {
      io.emit("pin-update");
      res.sendStatus(200);
    }
  );
});

/* GET ITEMS */
app.get("/items/:channel", (req, res) => {
  const channel = req.params.channel;
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  db.get(
    `SELECT COUNT(*) as count FROM items WHERE channel=? AND pinned=0`,
    [channel],
    (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });

      const totalUnpinned = row.count;
      const hasMore = offset + limit < totalUnpinned;

      db.all(
        `SELECT * FROM items WHERE channel=? AND pinned=0 
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [channel, limit, offset],
        (err, unpinned) => {
          if (err) return res.status(500).json({ error: "DB error" });

          if (page === 1) {
            // only fetch pinned on first page
            db.all(
              `SELECT * FROM items WHERE channel=? AND pinned=1 
               ORDER BY created_at DESC`,
              [channel],
              (err, pinned) => {
                if (err) return res.status(500).json({ error: "DB error" });
                res.json({ items: [...pinned, ...unpinned], hasMore, page });
              }
            );
          } else {
            res.json({ items: unpinned, hasMore, page });
          }
        }
      );
    }
  );
});


/* SEARCH */
app.get("/search/:channel/:q", (req, res) => {
  const { channel, q } = req.params;

  db.all(
    `SELECT * FROM items 
     WHERE channel=? AND (content LIKE ? OR filename LIKE ?)
     ORDER BY pinned DESC, created_at DESC`,
    [channel, `%${q}%`, `%${q}%`],
    (err, rows) => res.json(rows)
  );
});

/* GLOBAL SEARCH */
app.get("/search/:q", (req, res) => {
  const q = req.params.q;

  db.all(
    `SELECT * FROM items 
     WHERE content LIKE ? OR filename LIKE ?
     ORDER BY channel ASC, pinned DESC, created_at DESC`,
    [`%${q}%`, `%${q}%`],
    (err, rows) => {
      res.json(rows);
    }
  );
});

app.get("/channels", (req, res) => {
  db.all("SELECT * FROM channels ORDER BY pinned DESC, id ASC", (err, rows) => {
    res.json(rows);
  });
});

/* ADD CHANNEL */
app.post("/channels", channelLimiter, (req, res) => {

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 32) {
    return res.status(400).json({ error: "Channel name must be 1–32 characters" });
  }
  if (!/^[a-zA-Z0-9 _\-]+$/.test(trimmed)) {
    return res.status(400).json({ error: "Only letters, numbers, spaces, hyphens, and underscores allowed" });
  }

  db.get("SELECT COUNT(*) as count FROM channels", (err, row) => {

    if (row.count >= 10) {
      return res.status(400).json({ error: "Max 10 channels allowed" });
    }

    db.run("INSERT INTO channels (name) VALUES (?)", [trimmed], function (err) {

      if (err) {
        return res.status(400).json({ error: "Channel exists" });
      }
      io.emit("channel-added", { id: this.lastID, trimmed });
      res.json({ id: this.lastID, name: trimmed });

    });

  });

});


/* DELETE CHANNEL */
app.delete("/channels/:name", (req, res) => {
  const name = req.params.name;

  db.get("SELECT * FROM channels WHERE name=?", [name], (err, ch) => {
    if (!ch) return res.status(404).json({ error: "Channel not found" });

    if (ch.pinned) {
      return res.status(403).json({ error: "Unpin this channel before deleting" });
    }

    db.get("SELECT COUNT(*) as count FROM channels", (err, row) => {
      if (row.count <= 1) {
        return res.status(400).json({ error: "At least one channel required" });
      }

      db.all("SELECT * FROM items WHERE channel=?", [name], (err, rows) => {
        rows.forEach(item => {
          if (item.filename) {
            const filePath = path.join(__dirname, "../uploads", item.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        });

        db.run("DELETE FROM items WHERE channel=?", [name], () => {
          db.run("DELETE FROM channels WHERE name=?", [name], () => {
            io.emit("channel-deleted", { name });
            res.sendStatus(200);
          });
        });
      });
    });
  });
});

/* MOVE ROW */
app.patch("/item/:id/move", (req, res) => {
  const { id } = req.params;
  const { channel } = req.body;

  if (!channel) return res.status(400).json({ error: "Channel required" });

  db.run("UPDATE items SET channel=? WHERE id=?", [channel, id], function (err) {
    if (err) return res.status(500).json({ error: "Move failed" });
    io.emit("item-moved", { id: parseInt(id), channel });
    res.json({ id, channel });
  });
});

/* UPDATE ITEM TITLE */
app.patch("/item/:id/title", (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  if (title === undefined) return res.status(400).json({ error: "Title required" });

  db.run(
    "UPDATE items SET title=? WHERE id=?",
    [title.trim(), id],
    function (err) {
      if (err) return res.status(500).json({ error: "Update failed" });
      if (this.changes === 0) return res.status(404).json({ error: "Item not found" });
      io.emit("item-updated", { id: parseInt(id), title: title.trim() });
      res.json({ id, title: title.trim() });
    }
  );
});

/* UPDATE ITEM CONTENT */
app.patch("/item/:id/content", (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (content === undefined) return res.status(400).json({ error: "Content required" });
  if (content.trim() === "") return res.status(400).json({ error: "Content cannot be empty" });

  db.run(
    "UPDATE items SET content=?, edited_at=? WHERE id=? AND type='text'",
    [content.trim(), Date.now(), id],
    function (err) {
      if (err) return res.status(500).json({ error: "Update failed" });
      if (this.changes === 0) return res.status(404).json({ error: "Item not found or not editable" });
      io.emit("item-updated", { id: parseInt(id), content: content.trim(), edited_at: Date.now() });
      res.json({ id, content: content.trim() });
    }
  );
});

/* RENAME CHANNEL */
app.patch("/channels/:name", (req, res) => {
  const oldName = req.params.name;
  const { name: newName } = req.body;
  if (!newName) return res.status(400).json({ error: "Name required" });

  const trimmed = newName.trim();
  if (trimmed.length < 1 || trimmed.length > 32) {
    return res.status(400).json({ error: "Channel name must be 1–32 characters" });
  }
  if (!/^[a-zA-Z0-9 _\-]+$/.test(trimmed)) {
    return res.status(400).json({ error: "Only letters, numbers, spaces, hyphens, and underscores allowed" });
  }

  db.get("SELECT * FROM channels WHERE name=?", [oldName], (err, row) => {
    if (!row) return res.status(404).json({ error: "Channel not found" });

    db.run("UPDATE channels SET name=? WHERE name=?", [trimmed, oldName], (err) => {
      if (err) return res.status(400).json({ error: "Channel name already exists" });

      db.run("UPDATE items SET channel=? WHERE channel=?", [trimmed, oldName], () => {
        io.emit("channel-renamed", { oldName, newName: trimmed });
        res.json({ oldName, newName: trimmed });
      });
    });
  });
});

/* PIN CHANNEL */
app.post("/channels/:name/pin", (req, res) => {
  db.run(
    `UPDATE channels SET pinned = CASE WHEN pinned=1 THEN 0 ELSE 1 END WHERE name=?`,
    [req.params.name],
    function (err) {
      if (err) return res.status(500).json({ error: "Pin failed" });
      db.get("SELECT pinned FROM channels WHERE name=?", [req.params.name], (err, row) => {
        io.emit("channel-pin-update", { name: req.params.name, pinned: row.pinned });
        res.json({ pinned: row.pinned });
      });
    }
  );
});


/*  */
app.get("/info", (req, res) => {
  res.json({
    url: `http://${localIP}:${PORT}`,
    hasAuth: !!config.auth.passphrase,
    retention: config.storage.retention  // null means "never"
  });
});


/* BRAND */
app.get("/branding", (req, res) => {
  const b = config.branding;
  const palette = buildPalette(b.primaryColor);

  res.json({
    appName: b.appName || "Instbyte",
    hasLogo: !!b.logoPath,
    palette
  });
});

/* PWA MANIFEST */
app.get("/manifest.json", (req, res) => {
  const b = config.branding;
  const name = b.appName || "Instbyte";
  const color = b.primaryColor || "#111827";

  res.json({
    name,
    short_name: name.length > 12 ? name.slice(0, 12) : name,
    description: "Real-time LAN sharing — no cloud, no accounts",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: color,
    icons: [
      {
        src: "/logo-dynamic.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/logo-dynamic.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  });
});

/* HEALTH MONITOR */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    version: require("../package.json").version
  });
});

/*   BROADCAST*/
/* GET /broadcast/status — returns current broadcast or null */
app.get("/broadcast/status", (req, res) => {
  if (!currentBroadcast) return res.json({ live: false });
  res.json({
    live: true,
    uploader: currentBroadcast.uploader,
    channel: currentBroadcast.channel,
    startedAt: currentBroadcast.startedAt
  });
});

/* POST /broadcast/start */
app.post("/broadcast/start", broadcastLimiter, (req, res) => {

  if (currentBroadcast) {
    return res.status(409).json({
      error: "Broadcast already in progress",
      uploader: currentBroadcast.uploader
    });
  }

  const { uploader, channel, socketId } = req.body;
  if (!uploader || !channel) {
    return res.status(400).json({ error: "uploader and channel required" });
  }

  currentBroadcast = {
    uploader,
    channel,
    startedAt: Date.now(),
    lastFrame: null,
    socketId
  };

  io.emit("broadcast-started", {
    uploader: currentBroadcast.uploader,
    channel: currentBroadcast.channel,
    startedAt: currentBroadcast.startedAt
  });

  console.log(`Broadcast started by ${uploader}`);
  res.json({ ok: true, ...currentBroadcast });
});

/* POST /broadcast/end */
app.post("/broadcast/end", (req, res) => {
  if (!currentBroadcast) return res.status(400).json({ error: "No broadcast in progress" });

  const uploader = currentBroadcast.uploader;
  currentBroadcast = null;

  io.emit("broadcast-ended", { uploader });
  console.log(`Broadcast ended by ${uploader}`);
  res.json({ ok: true });
});

/* FAVICON */
app.get("/favicon-dynamic.png", async (req, res) => {
  const b = config.branding;

  // User provided their own favicon — serve it directly
  if (b.faviconPath) {
    const fp = path.resolve(process.cwd(), b.faviconPath);
    if (fs.existsSync(fp)) return res.sendFile(fp);
  }

  // Try to generate favicon from logo using sharp
  if (b.logoPath && sharp) {
    const lp = path.resolve(process.cwd(), b.logoPath);
    if (fs.existsSync(lp)) {
      try {
        const buf = await sharp(lp).resize(32, 32).png().toBuffer();
        res.set("Content-Type", "image/png");
        return res.send(buf);
      } catch (e) { }
    }
  }

  // Fall back to default favicon
  const defaultFavicon = path.join(__dirname, "../client/assets/favicon.png");
  if (fs.existsSync(defaultFavicon)) return res.sendFile(defaultFavicon);

  res.sendStatus(404);
});



/* LOGO */
app.get("/logo-dynamic.png", (req, res) => {
  const b = config.branding;

  if (b.logoPath) {
    const lp = path.resolve(process.cwd(), b.logoPath);
    if (fs.existsSync(lp)) return res.sendFile(lp);
  }

  // Fall back to default logo
  const defaultLogo = path.join(__dirname, "../client/assets/logo.png");
  if (fs.existsSync(defaultLogo)) return res.sendFile(defaultLogo);

  res.sendStatus(404);
});

/* ============================
   SOCKET CONNECTION LOGGING
============================ */
// in-memory seen tracking — item id → Set of socket ids
// resets on server restart, no DB needed
const seenBy = new Map();

// Broadcast state — null when IDLE, populated when LIVE
let currentBroadcast = null;

let connectedUsers = 0;

io.on("connection", (socket) => {
  connectedUsers++;
  io.emit("user-count", connectedUsers);

  let username = "Unknown";

  socket.on("join", (name) => {
    username = name || "Unknown";
    console.log(username + " connected | total:", connectedUsers);
  });

  socket.on("seen", ({ id, name }) => {
    if (!id || !name) return;
    if (!seenBy.has(id)) seenBy.set(id, new Set());
    seenBy.get(id).add(name); // name instead of socket.id
    const count = seenBy.get(id).size;
    console.log(`seen: item ${id} | count: ${count}`);
    io.emit("seen-update", { id, count });
  });

  // WebRTC — viewer joins, notify broadcaster to initiate peer connection
  socket.on("broadcast-join", () => {
    if (!currentBroadcast) return;
    // tell broadcaster a new viewer has joined, pass viewer's socket id
    const broadcasterSocket = io.sockets.sockets.get(currentBroadcast.socketId);
    if (broadcasterSocket) {
      broadcasterSocket.emit("webrtc-viewer-joined", { viewerId: socket.id });
    }
  });

  // WebRTC — broadcaster sends offer to a specific viewer
  socket.on("webrtc-offer", ({ offer, viewerId }) => {
    const viewerSocket = io.sockets.sockets.get(viewerId);
    if (viewerSocket) {
      viewerSocket.emit("webrtc-offer", { offer, broadcasterId: socket.id });
    }
  });

  // WebRTC — viewer sends answer back to broadcaster
  socket.on("webrtc-answer", ({ answer, broadcasterId }) => {
    const broadcasterSocket = io.sockets.sockets.get(broadcasterId);
    if (broadcasterSocket) {
      broadcasterSocket.emit("webrtc-answer", { answer, viewerId: socket.id });
    }
  });

  // WebRTC — ICE candidate exchange, both directions
  socket.on("webrtc-ice", ({ candidate, targetId }) => {
    const targetSocket = io.sockets.sockets.get(targetId);
    if (targetSocket) {
      targetSocket.emit("webrtc-ice", { candidate, fromId: socket.id });
    }
  });

  // Broadcast — raise hand, relay to broadcaster
  socket.on("broadcast-reaction", ({ from }) => {
    if (!currentBroadcast) return;
    io.emit("broadcast-reaction-received", { from });
  });

  socket.on("disconnect", () => {
    connectedUsers--;
    console.log(username + " disconnected | total:", connectedUsers);
    io.emit("user-count", connectedUsers);

    if (currentBroadcast && currentBroadcast.socketId === socket.id) {
      currentBroadcast = null;
      io.emit("broadcast-ended");
      console.log("Broadcast ended — broadcaster disconnected");
    }
  });
});


/* ============================
   SHOW LOCAL + LAN URL
============================ */

function getLocalIP() {
  const nets = os.networkInterfaces();
  const candidates = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family !== "IPv4" || net.internal) continue;

      const n = name.toLowerCase();
      if (/loopback|vmware|virtualbox|vethernet|wsl|hyper|utun|tun|tap|docker|br-|vbox/.test(n)) continue;

      candidates.push({ name, address: net.address });
    }
  }

  const preferred =
    candidates.find(c => c.address.startsWith("192.168.")) ||
    candidates.find(c => c.address.startsWith("10.")) ||
    candidates.find(c => c.address.startsWith("172.16.")) ||
    candidates[0];

  return preferred ? preferred.address : "localhost";
}

function findFreePort(start) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(start, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on("error", () => resolve(findFreePort(start + 1)));
  });
}

const PREFERRED = parseInt(process.env.PORT) || config.server.port;

const localIP = getLocalIP();

let PORT;
if (process.env.INSTBYTE_BOOT === '1') {
  findFreePort(PREFERRED).then(p => {
    PORT = p;
    server.listen(PORT, () => {
      console.log("\nInstbyte running");
      console.log("Local:   http://localhost:" + PORT);
      console.log("Network: http://" + localIP + ":" + PORT);
      if (PORT !== PREFERRED) {
        console.log(`(port ${PREFERRED} was busy, switched to ${PORT})`);
      }
      console.log("");
      scanOrphans();
    });
  });
}

module.exports = { app, server, sessions };


// ========================
// GRACEFUL SHUTDOWN
// ========================
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully...`);

  // stop accepting new connections
  server.close(() => {
    console.log("HTTP server closed");

    // close database connection
    db.close((err) => {
      if (err) console.error("Error closing database:", err);
      else console.log("Database connection closed");
      console.log("Shutdown complete");
      process.exit(0);
    });
  });

  // force exit after 10 seconds if something hangs
  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));