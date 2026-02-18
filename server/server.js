require("./cleanup");
const fs = require("fs");

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

const upload = multer({ storage });

/* FILE UPLOAD */
app.post("/upload", upload.single("file"), (req, res) => {
  const { channel, uploader } = req.body;

  const item = {
    type: "file",
    filename: req.file.filename,
    channel,
    uploader,
    created_at: Date.now(),
  };

  db.run(
    `INSERT INTO items (type, filename, channel, uploader, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    ["file", item.filename, channel, uploader, item.created_at],
    function () {
      item.id = this.lastID;
      io.emit("new-item", item);
      res.json(item);
    }
  );
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


/* GET ITEMS */
app.get("/items/:channel", (req, res) => {
  const channel = req.params.channel;

  db.all(
    `SELECT * FROM items WHERE channel=? ORDER BY created_at DESC`,
    [channel],
    (err, rows) => {
      res.json(rows);
    }
  );
});

/* SOCKET */
io.on("connection", () => {
  console.log("user connected");
});

server.listen(3000, () => {
  console.log("Instbyte running on http://localhost:3000");
});
