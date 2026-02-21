require("./cleanup");
const fs = require("fs");
const os = require("os");
const net = require("net");

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const db = require("./db");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
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
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }
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
  res.json({ url: `http://${localIP}:${PORT}`, hostname: os.hostname() });
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

const PREFERRED = parseInt(process.env.PORT) || 3000;
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
