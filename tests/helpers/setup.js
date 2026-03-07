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
 *   setup()   // registers beforeAll / afterAll — call once per file
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
import os from 'os'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

// createRequire gives us a CommonJS require() from inside this ESM-style
// Vitest file. All server-side code is CJS so we need this bridge.
const require = createRequire(import.meta.url)

// ─── State ───────────────────────────────────────────────────────────────────

let _app = null
let _db = null
let _tmpDir = null

export const getApp = () => _app
export const getDb = () => _db

// ─── Schema ──────────────────────────────────────────────────────────────────
// Full schema matching db.js — including all ALTER TABLE columns.
// Using DROP + CREATE means resetDb() always starts from a known clean state.

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

// ─── DB helpers ──────────────────────────────────────────────────────────────

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

/**
 * Seed the four default channels that db.js inserts on first boot.
 * Called automatically by resetDb().
 */
async function seedDefaultChannels(db) {
    const defaults = ['general', 'projects', 'assets', 'temp']
    for (const name of defaults) {
        await dbRun(db, 'INSERT INTO channels (name) VALUES (?)', [name])
    }
}

/**
 * Wipe all rows and recreate the schema.
 * Call in beforeEach to give every individual test a clean slate.
 */
export async function resetDb() {
    await execSql(_db, SCHEMA)
    await seedDefaultChannels(_db)
}

/**
 * Convenience: insert a text item directly into the DB.
 * Useful for setting up test state without going through the HTTP layer.
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
 * Convenience: insert a channel directly into the DB.
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

// ─── Main setup ──────────────────────────────────────────────────────────────

export function setup() {
    beforeAll(async () => {

        // ── Step 1: isolated temp directory ──────────────────────────────────────
        // Every test run gets its own folder under the OS temp dir.
        // Nothing ever touches your real instbyte-data/.
        _tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'instbyte-test-'))
        const uploadsDir = path.join(_tmpDir, 'uploads')
        fs.mkdirSync(uploadsDir)

        // ── Step 2: point db.js at the temp dir ──────────────────────────────────
        // db.js reads these at require-time, so they must be set before
        // anything requires db.js or server.js
        process.env.INSTBYTE_DATA = _tmpDir
        process.env.INSTBYTE_UPLOADS = uploadsDir

        // ── Step 3: stub cleanup.js ───────────────────────────────────────────────
        // cleanup.js calls setInterval() the moment it's required.
        // We inject a fake empty module into Node's require cache so that
        // when server.js does require('./cleanup') it gets nothing instead.
        const cleanupPath = require.resolve('../../server/cleanup.js')
        require.cache[cleanupPath] = {
            id: cleanupPath,
            filename: cleanupPath,
            loaded: true,
            exports: {}      // empty — no setInterval fires
        }

        // ── Step 4: clear server + db from cache so they re-initialise ───────────
        // If a previous test file already loaded server.js, it would have used
        // the old env vars. Clearing the cache forces a fresh require with our
        // new INSTBYTE_DATA value.
        const serverPath = require.resolve('../../server/server.js')
        const dbPath = require.resolve('../../server/db.js')
        delete require.cache[serverPath]
        delete require.cache[dbPath]

        // ── Step 5: load the app ─────────────────────────────────────────────────
        const mod = require('../../server/server.js')
        _app = mod.app
        _db = require('../../server/db.js')

        // ── Step 6: seed a clean DB for the first test ───────────────────────────
        await resetDb()
    })

    afterAll(() => {
        // Remove temp dir — uploads, sqlite file, everything
        if (_tmpDir && fs.existsSync(_tmpDir)) {
            fs.rmSync(_tmpDir, { recursive: true, force: true })
        }
    })
}