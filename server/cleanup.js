const db = require("./db");
const fs = require("fs");
const path = require("path");
const config = require("./config");
const seenBy = require("./seen");

// One retention pass: delete expired, unpinned items along with their files
// and any stale in-memory seenBy entries. Returns a promise so tests can await
// a single pass; the interval below just fires it and ignores the result.
function purgeExpired() {
  return new Promise((resolve) => {
    if (config.storage.retention === null) return resolve();
    const cutoff = Date.now() - config.storage.retention;

    db.all(
      `SELECT * FROM items WHERE created_at < ? AND pinned = 0`,
      [cutoff],
      (err, rows) => {
        if (err || !rows) return resolve();
        rows.forEach((item) => {
          if (item.filename) {
            const uploadsDir = process.env.INSTBYTE_UPLOADS
              || path.join(__dirname, "../uploads");
            const filePath = path.join(uploadsDir, item.filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }

          db.run(`DELETE FROM items WHERE id=?`, [item.id]);
          seenBy.delete(item.id); // drop stale in-memory seen tracking
        });
        resolve();
      }
    );
  });
}

const interval = setInterval(purgeExpired, 10 * 60 * 1000);
interval.unref(); // don't keep the process alive just for cleanup

module.exports = { purgeExpired };
