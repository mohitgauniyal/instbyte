require("./cleanup");
const fs = require("fs");
const os = require("os");
const net = require("net");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const db = require("./db");

const config = require("./config");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cookieParser());
app.use(requireAuth);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../client")));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + file.originalname;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.storage.maxFileSize },
});


const COOKIE_NAME = "instbyte_auth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

function requireAuth(req, res, next) {
  if (!config.auth.passphrase) return next(); // no passphrase set, skip

  // Allow the login route itself through
  if (req.path === "/login" || req.path === "/info") return next();


  // Check cookie
  const cookie = req.cookies[COOKIE_NAME];
  if (cookie && cookie === config.auth.passphrase) return next();

  // Not authenticated
  if (req.path.startsWith("/socket.io")) return next();
  if (req.headers["content-type"] === "application/json" || req.xhr) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.redirect("/login");
}


/* LOGIN PAGE */
app.get("/login", (req, res) => {
  if (!config.auth.passphrase) return res.redirect("/");
  if (req.cookies[COOKIE_NAME] === config.auth.passphrase) return res.redirect("/");

  res.send(`<!DOCTYPE html>
<html>
<head>
  <title>Instbyte — Login</title>
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
  </style>
</head>
<body>
  <div class="box">
    <div class="logo">Instbyte</div>
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

/* LOGIN POST */
app.post("/login", loginLimiter, (req, res) => {
  if (!config.auth.passphrase) return res.redirect("/");

  const { passphrase } = req.body;
  if (passphrase === config.auth.passphrase) {
    res.cookie(COOKIE_NAME, passphrase, {
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
  res.clearCookie(COOKIE_NAME);
  res.redirect("/login");
});


/* FILE UPLOAD */
app.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err && err.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ error: "File exceeds 2GB limit" });
    }
    if (err) {
      return res.status(500).json({ error: "Upload failed" });
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
      function () {
        item.id = this.lastID;
        io.emit("new-item", item);
        res.json(item);
      }
    );
  });
});

/* TEXT/LINK */
app.post("/text", (req, res) => {
  const { content, channel, uploader } = req.body;

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
    function () {
      item.id = this.lastID;
      io.emit("new-item", item);
      res.json(item);
    }
  );
});

/* DELETE ITEM */
app.delete("/item/:id", (req, res) => {
  const id = req.params.id;

  db.get(`SELECT * FROM items WHERE id=?`, [id], (err, item) => {
    if (!item) return res.sendStatus(404);

    if (item.filename) {
      const filePath = path.join(__dirname, "../uploads", item.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    db.run(`DELETE FROM items WHERE id=?`, [id], () => {
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

  db.all(
    `SELECT * FROM items WHERE channel=? ORDER BY pinned DESC, created_at DESC`,
    [channel],
    (err, rows) => {
      res.json(rows);
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
app.post("/channels", (req, res) => {

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Name required" });

  db.get("SELECT COUNT(*) as count FROM channels", (err, row) => {

    if (row.count >= 10) {
      return res.status(400).json({ error: "Max 10 channels allowed" });
    }

    db.run("INSERT INTO channels (name) VALUES (?)", [name], function (err) {

      if (err) {
        return res.status(400).json({ error: "Channel exists" });
      }
      io.emit("channel-added", { id: this.lastID, name });
      res.json({ id: this.lastID, name });

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

/* RENAME CHANNEL */
app.patch("/channels/:name", (req, res) => {
  const oldName = req.params.name;
  const { name: newName } = req.body;

  if (!newName) return res.status(400).json({ error: "Name required" });

  db.get("SELECT * FROM channels WHERE name=?", [oldName], (err, row) => {
    if (!row) return res.status(404).json({ error: "Channel not found" });

    db.run("UPDATE channels SET name=? WHERE name=?", [newName, oldName], (err) => {
      if (err) return res.status(400).json({ error: "Channel name already exists" });

      db.run("UPDATE items SET channel=? WHERE channel=?", [newName, oldName], () => {
        io.emit("channel-renamed", { oldName, newName });
        res.json({ oldName, newName });
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
    hasAuth: !!config.auth.passphrase
  });
});

/* ============================
   SOCKET CONNECTION LOGGING
============================ */

let connectedUsers = 0;

io.on("connection", (socket) => {
  connectedUsers++;

  let username = "Unknown";

  socket.on("join", (name) => {
    username = name || "Unknown";
    console.log(username + " connected | total:", connectedUsers);
  });

  socket.on("disconnect", () => {
    connectedUsers--;
    console.log(username + " disconnected | total:", connectedUsers);
  });
});


/* ============================
   SHOW LOCAL + LAN URL
============================ */

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
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
  });
});
