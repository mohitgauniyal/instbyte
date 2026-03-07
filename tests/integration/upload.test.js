/**
 * tests/integration/upload.test.js
 *
 * Tests the file upload route and related file I/O behaviour:
 *   POST /upload       — happy path, missing file, DB record
 *   DELETE /item/:id   — file removed from disk on delete
 *   File persistence   — uploaded file actually exists on disk
 *
 * These tests use real files written to the isolated temp uploads directory
 * that setup.js creates. Nothing touches your real instbyte-data/uploads/.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'
import { setup, resetDb, getApp } from '../helpers/setup.js'

const require = createRequire(import.meta.url)

setup()

beforeEach(async () => {
    await resetDb()
})

// Helper — get the uploads dir the running server is actually using
function getUploadsDir() {
    return process.env.INSTBYTE_UPLOADS
}

// Helper — list all files currently in the uploads dir
function getUploadedFiles() {
    const dir = getUploadsDir()
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir)
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /upload — happy path
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /upload', () => {
    it('uploads a file and returns item with correct fields', async () => {
        const res = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('hello file'), 'hello.txt')

        expect(res.status).toBe(200)
        expect(res.body.id).toBeDefined()
        expect(res.body.type).toBe('file')
        expect(res.body.channel).toBe('general')
        expect(res.body.uploader).toBe('Alice')
        expect(res.body.filename).toBeDefined()
        expect(res.body.size).toBeGreaterThan(0)
    })

    it('file actually exists on disk after upload', async () => {
        const res = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('disk check'), 'diskcheck.txt')

        const uploadedFiles = getUploadedFiles()
        expect(uploadedFiles.some(f => f === res.body.filename)).toBe(true)
    })

    it('uploaded file appears in GET /items/:channel', async () => {
        const res = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('content'), 'myfile.txt')

        const itemsRes = await request(getApp()).get('/items/general')
        expect(itemsRes.body.items.some(i => i.id === res.body.id)).toBe(true)
    })

    it('stores the correct file size in bytes', async () => {
        const content = Buffer.from('exactly this content')

        const res = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', content, 'sized.txt')

        expect(res.body.size).toBe(content.length)
    })

    it('assigns a created_at timestamp', async () => {
        const before = Date.now()

        const res = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('ts test'), 'ts.txt')

        const after = Date.now()
        expect(res.body.created_at).toBeGreaterThanOrEqual(before)
        expect(res.body.created_at).toBeLessThanOrEqual(after)
    })

    it('can upload to any channel', async () => {
        const res = await request(getApp())
            .post('/upload')
            .field('channel', 'projects')
            .field('uploader', 'Bob')
            .attach('file', Buffer.from('proj file'), 'proj.txt')

        expect(res.status).toBe(200)
        expect(res.body.channel).toBe('projects')
    })

    it('returns 400 when no file is attached', async () => {
        const res = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })

    it('can upload an image file', async () => {
        // minimal 1x1 white PNG (valid PNG bytes)
        const png = Buffer.from(
            '89504e470d0a1a0a0000000d49484452000000010000000108020000009001' +
            '2e00000000c4944415478016360f8cfc00000000200016736170000000049454e44ae426082',
            'hex'
        )

        const res = await request(getApp())
            .post('/upload')
            .field('channel', 'assets')
            .field('uploader', 'Alice')
            .attach('file', png, 'pixel.png')

        expect(res.status).toBe(200)
        expect(res.body.filename).toMatch(/\.png$/)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// File cleanup on delete
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /item/:id — file cleanup', () => {
    it('deletes the file from disk when the item is deleted', async () => {
        const uploadRes = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('delete me'), 'deleteme.txt')

        const { id, filename } = uploadRes.body

        // confirm file is on disk
        const filePath = path.join(getUploadsDir(), filename)
        expect(fs.existsSync(filePath)).toBe(true)

        // delete the item
        await request(getApp()).delete(`/item/${id}`)

        // file should be gone
        expect(fs.existsSync(filePath)).toBe(false)
    })

    it('item is removed from DB after delete', async () => {
        const uploadRes = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('gone'), 'gone.txt')

        const { id } = uploadRes.body

        await request(getApp()).delete(`/item/${id}`)

        const itemsRes = await request(getApp()).get('/items/general')
        expect(itemsRes.body.items.some(i => i.id === id)).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Multiple files
// ─────────────────────────────────────────────────────────────────────────────

describe('multiple uploads', () => {
    it('each upload gets a unique filename even with the same original name', async () => {
        const res1 = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('first'), 'same.txt')

        const res2 = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('second'), 'same.txt')

        expect(res1.body.filename).not.toBe(res2.body.filename)
    })

    it('deleting one file does not affect other uploaded files', async () => {
        const res1 = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('keep me'), 'keep.txt')

        const res2 = await request(getApp())
            .post('/upload')
            .field('channel', 'general')
            .field('uploader', 'Alice')
            .attach('file', Buffer.from('delete me'), 'delete.txt')

        await request(getApp()).delete(`/item/${res2.body.id}`)

        const keepPath = path.join(getUploadsDir(), res1.body.filename)
        expect(fs.existsSync(keepPath)).toBe(true)
    })
})