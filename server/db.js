const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = process.env.INSTBYTE_DATA
  ? path.join(process.env.INSTBYTE_DATA, "db.sqlite")
  : path.join(__dirname, "../db.sqlite");

const db = new sqlite3.Database(dbPath);

db.serialize(() => {

  // ITEMS TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT,
      content TEXT,
      filename TEXT,
      size INTEGER DEFAULT 0,
      channel TEXT,
      uploader TEXT,
      pinned INTEGER DEFAULT 0,
      created_at INTEGER
    )
  `);

  // CHANNELS TABLE
  db.run(`
    CREATE TABLE IF NOT EXISTS channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      pinned INTEGER DEFAULT 0
    )
  `);

  db.run(`ALTER TABLE items ADD COLUMN size INTEGER DEFAULT 0`, () => { });
  db.run(`ALTER TABLE channels ADD COLUMN pinned INTEGER DEFAULT 0`, () => { });

  db.run(`ALTER TABLE items ADD COLUMN title TEXT DEFAULT ''`, () => { });
  db.run(`ALTER TABLE items ADD COLUMN edited_at INTEGER DEFAULT NULL`, () => { });

  // Insert default channels if empty
  db.get("SELECT COUNT(*) as count FROM channels", (err, row) => {
    if (err) {
      console.error("Channel count error:", err);
      return;
    }

    if (row.count === 0) {
      const defaults = ["general", "projects", "assets", "temp"];
      defaults.forEach(name => {
        db.run("INSERT INTO channels (name) VALUES (?)", [name]);
      });
    }
  });

});

module.exports = db;
