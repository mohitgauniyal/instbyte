const db = require("./db");
const fs = require("fs");
const path = require("path");
const config = require("./config");

setInterval(() => {
  if (config.storage.retention === null) return;
  const cutoff = Date.now() - config.storage.retention;

  db.all(
    `SELECT * FROM items WHERE created_at < ? AND pinned = 0`,
    [cutoff],
    (err, rows) => {
      rows.forEach((item) => {
        if (item.filename) {
          const uploadsDir = process.env.INSTBYTE_UPLOADS
            || path.join(__dirname, "../uploads");
          const filePath = path.join(uploadsDir, item.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        db.run(`DELETE FROM items WHERE id=?`, [item.id]);
      });
    }
  );
}, 10 * 60 * 1000);
