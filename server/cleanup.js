const db = require("./db");
const fs = require("fs");
const path = require("path");

const DAY = 24 * 60 * 60 * 1000;

setInterval(() => {
  const cutoff = Date.now() - DAY;

  db.all(
    `SELECT * FROM items WHERE created_at < ?`,
    [cutoff],
    (err, rows) => {
      rows.forEach((item) => {
        if (item.filename) {
          const filePath = path.join(__dirname, "../uploads", item.filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }

        db.run(`DELETE FROM items WHERE id=?`, [item.id]);
      });
    }
  );
}, 10 * 60 * 1000);
