/**
 * tests/integration/cleanup.test.js
 *
 * Tests the retention job in server/cleanup.js — specifically that expiring an
 * item purges its entry from the shared in-memory seenBy map, not just the DB.
 *
 * This suite does NOT use helpers/setup.js: that helper stubs out cleanup.js so
 * its interval never fires. Here we need the real module, so we wire up our own
 * isolated temp DB and load db.js / seen.js / cleanup.js directly.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let db, seenBy, purgeExpired, tmpDir

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this) })
  })
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row))
  })
}

async function waitForDbReady(maxWaitMs = 5000) {
  const start = Date.now()
  while (Date.now() - start < maxWaitMs) {
    try {
      const row = await dbGet('SELECT COUNT(*) as count FROM channels')
      if (row && row.count >= 4) return
    } catch (e) { /* table not ready yet */ }
    await new Promise(r => setTimeout(r, 20))
  }
  throw new Error('DB did not become ready in time')
}

const HOUR = 60 * 60 * 1000

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'instbyte-cleanup-'))
  fs.mkdirSync(path.join(tmpDir, 'uploads'))
  process.env.INSTBYTE_DATA = tmpDir
  process.env.INSTBYTE_UPLOADS = path.join(tmpDir, 'uploads')

  // Load fresh with our env — never reuse a cached instance from another suite.
  delete require.cache[require.resolve('../../server/db.js')]
  delete require.cache[require.resolve('../../server/seen.js')]
  delete require.cache[require.resolve('../../server/cleanup.js')]

  db = require('../../server/db.js')
  seenBy = require('../../server/seen.js')
  ;({ purgeExpired } = require('../../server/cleanup.js'))

  await waitForDbReady()
})

afterAll(async () => {
  if (db) await new Promise(resolve => db.close(() => resolve()))
  if (tmpDir && fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await dbRun('DELETE FROM items')
  seenBy.clear()
})

describe('cleanup — seenBy purge on expiry', () => {
  it('removes seenBy entries for items that expire', async () => {
    // Item created far in the past → older than any retention window.
    const { lastID: id } = await dbRun(
      `INSERT INTO items (type, content, channel, pinned, created_at)
       VALUES ('text', 'old', 'general', 0, ?)`,
      [1000]
    )
    seenBy.set(id, new Set(['alice']))
    expect(seenBy.has(id)).toBe(true)

    await purgeExpired()

    // gone from the DB...
    const row = await dbGet('SELECT * FROM items WHERE id=?', [id])
    expect(row).toBeUndefined()
    // ...and gone from the in-memory map (the leak this fix closes)
    expect(seenBy.has(id)).toBe(false)
  })

  it('keeps seenBy entries for items that are still fresh', async () => {
    const { lastID: id } = await dbRun(
      `INSERT INTO items (type, content, channel, pinned, created_at)
       VALUES ('text', 'fresh', 'general', 0, ?)`,
      [Date.now()]
    )
    seenBy.set(id, new Set(['bob']))

    await purgeExpired()

    expect(seenBy.has(id)).toBe(true)
  })

  it('does not purge seenBy for pinned expired items', async () => {
    const { lastID: id } = await dbRun(
      `INSERT INTO items (type, content, channel, pinned, created_at)
       VALUES ('text', 'pinned old', 'general', 1, ?)`,
      [1000]
    )
    seenBy.set(id, new Set(['carol']))

    await purgeExpired()

    // pinned items survive retention, so their seen tracking stays too
    expect(seenBy.has(id)).toBe(true)
  })
})
