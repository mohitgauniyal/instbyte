/**
 * tests/helpers/setup.js
 *
 * Sets up a clean, isolated environment for each integration test suite.
 *
 * What it does:
 *  - Points INSTBYTE_DATA and INSTBYTE_UPLOADS at a temp directory so tests
 *    never touch your real instbyte-data/ folder or db.sqlite
 *  - Stubs out cleanup.js so the 10-minute setInterval never fires in tests
 *  - Provides a ready-to-use `app` (Express) and `db` (SQLite) for each suite
 *  - Wipes and recreates the DB schema between tests via resetDb()
 *  - Deletes the temp directory after all tests finish
 *
 * Usage in a test file:
 *
 *   import { setup, resetDb, getApp, getDb } from '../helpers/setup.js'
 *
 *   setup()   // registers beforeAll / afterAll -- call once per file
 *
 *   beforeEach(async () => {
 *     await resetDb()   // fresh DB state before every test
 *   })
 *
 *   it('does something', async () => {
 *     const res = await request(getApp()).post('/text').send({ ... })
 *     expect(res.status).toBe(200)
 *   })
 */

import { beforeAll, afterAll } from 'vitest'
import os   from 'os'
import fs   from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// State
let _app    = null
let _db     = null
let _tmpDir = null

export const getApp = () => _app
export const getDb  = () => _db

// Schema — mirrors db.js exactly, DROP+CREATE gives a clean slate every time
const SCHEMA = `
  DROP TABLE IF EXISTS items;
  DROP TABLE IF EXISTS channels;

  CREATE TABLE items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT,
    content    TEXT,
    filename   TEXT,
    size       INTEGER DEFAULT 0,
    channel    TEXT,
    uploader   TEXT,
    pinned     INTEGER DEFAULT 0,
    created_at INTEGER,
    title      TEXT    DEFAULT '',
    edited_at  INTEGER DEFAULT NULL
  );

  CREATE TABLE channels (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT UNIQUE,
    pinned INTEGER DEFAULT 0
  );
`

function execSql(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => err ? reject(err) : resolve())
  })
}

function dbRun(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this)
    })
  })
}

async function seedDefaultChannels(db) {
  const defaults = ['general', 'projects', 'assets', 'temp']
  for (const name of defaults) {
    await dbRun(db, 'INSERT INTO channels (name) VALUES (?)', [name])
  }
}

/**
 * Wipe all tables, recreate schema, re-seed default channels.
 * Call in beforeEach to give every test a perfectly clean slate.
 */
export async function resetDb() {
  await execSql(_db, SCHEMA)
  await seedDefaultChannels(_db)
}

/**
 * Insert a text item directly into the DB — bypasses HTTP layer.
 * Useful for setting up preconditions quickly.
 */
export function insertItem(fields) {
  const {
    type = 'text',
    content = 'test content',
    filename = null,
    size = 0,
    channel = 'general',
    uploader = 'Tester',
    pinned = 0,
    created_at = Date.now()
  } = fields

  return new Promise((resolve, reject) => {
    _db.run(
      `INSERT INTO items (type, content, filename, size, channel, uploader, pinned, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [type, content, filename, size, channel, uploader, pinned, created_at],
      function (err) { err ? reject(err) : resolve(this.lastID) }
    )
  })
}

/**
 * Insert a channel directly into the DB.
 */
export function insertChannel(name, pinned = 0) {
  return new Promise((resolve, reject) => {
    _db.run(
      'INSERT INTO channels (name, pinned) VALUES (?, ?)',
      [name, pinned],
      function (err) { err ? reject(err) : resolve(this.lastID) }
    )
  })
}

export function setup() {
  beforeAll(async () => {

    // Step 1: isolated temp directory — nothing touches real instbyte-data/
    _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'instbyte-test-'))
    const uploadsDir = path.join(_tmpDir, 'uploads')
    fs.mkdirSync(uploadsDir)

    // Step 2: point db.js at the temp dir BEFORE requiring anything
    process.env.INSTBYTE_DATA    = _tmpDir
    process.env.INSTBYTE_UPLOADS = uploadsDir

    // Step 3: stub cleanup.js so its setInterval never fires during tests
    const cleanupPath = require.resolve('../../server/cleanup.js')
    require.cache[cleanupPath] = {
      id: cleanupPath, filename: cleanupPath, loaded: true, exports: {}
    }

    // Step 4: clear server + db from require cache so they reload fresh
    // with our new env vars (matters if a previous test file loaded them)
    const serverPath = require.resolve('../../server/server.js')
    const dbPath     = require.resolve('../../server/db.js')
    delete require.cache[serverPath]
    delete require.cache[dbPath]

    // Step 5: load the app
    const mod = require('../../server/server.js')
    _app = mod.app
    _db  = require('../../server/db.js')

    // Step 6: wait for db.js to finish its own async init.
    // db.js uses db.serialize() which queues CREATE TABLE + INSERT channel
    // statements asynchronously. We wait for those to land before our first
    // resetDb() call wipes them — otherwise resetDb() races with the seeding
    // and causes a UNIQUE constraint error.
    await new Promise(resolve => setTimeout(resolve, 300))
  })

  afterAll(async () => {
    // Close the SQLite connection before deleting the temp folder.
    // On Windows the .sqlite file stays locked until explicitly closed —
    // fs.rmSync throws EBUSY without this step.
    if (_db) {
      await new Promise(resolve => _db.close(() => resolve()))
    }

    if (_tmpDir && fs.existsSync(_tmpDir)) {
      fs.rmSync(_tmpDir, { recursive: true, force: true })
    }
  })
}
