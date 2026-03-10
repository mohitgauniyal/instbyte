/**
 * tests/integration/broadcast.test.js
 *
 * Tests broadcast HTTP endpoints:
 *   GET  /broadcast/status
 *   POST /broadcast/start
 *   POST /broadcast/end
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { setup, resetDb, getApp } from '../helpers/setup.js'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

setup()

beforeEach(async () => {
    await resetDb()
    // reset broadcast state between tests
    const mod = require('../../server/server.js')
    // access and clear currentBroadcast via the end endpoint
    // if a broadcast is live from a previous test, end it cleanly
    await request(getApp()).post('/broadcast/end')
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /broadcast/status
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /broadcast/status', () => {
    it('returns live:false when no broadcast is active', async () => {
        const res = await request(getApp()).get('/broadcast/status')
        expect(res.status).toBe(200)
        expect(res.body.live).toBe(false)
    })

    it('returns live:true with broadcast info when active', async () => {
        await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Alice', channel: 'general' })

        const res = await request(getApp()).get('/broadcast/status')
        expect(res.status).toBe(200)
        expect(res.body.live).toBe(true)
        expect(res.body.uploader).toBe('Alice')
        expect(res.body.channel).toBe('general')
        expect(res.body.startedAt).toBeDefined()
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /broadcast/start
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /broadcast/start', () => {
    it('starts a broadcast and returns 200', async () => {
        const res = await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Alice', channel: 'general' })

        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
        expect(res.body.uploader).toBe('Alice')
        expect(res.body.channel).toBe('general')
    })

    it('returns 409 if a broadcast is already in progress', async () => {
        await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Alice', channel: 'general' })

        const res = await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Bob', channel: 'general' })

        expect(res.status).toBe(409)
        expect(res.body.error).toBeDefined()
        expect(res.body.uploader).toBe('Alice')
    })

    it('returns 400 when uploader is missing', async () => {
        const res = await request(getApp())
            .post('/broadcast/start')
            .send({ channel: 'general' })

        expect(res.status).toBe(400)
    })

    it('returns 400 when channel is missing', async () => {
        const res = await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Alice' })

        expect(res.status).toBe(400)
    })

    it('status reflects live broadcast after start', async () => {
        await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Alice', channel: 'projects' })

        const status = await request(getApp()).get('/broadcast/status')
        expect(status.body.live).toBe(true)
        expect(status.body.channel).toBe('projects')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /broadcast/end
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /broadcast/end', () => {
    it('ends an active broadcast and returns 200', async () => {
        await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Alice', channel: 'general' })

        const res = await request(getApp()).post('/broadcast/end')
        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
    })

    it('status is live:false after broadcast ends', async () => {
        await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Alice', channel: 'general' })

        await request(getApp()).post('/broadcast/end')

        const status = await request(getApp()).get('/broadcast/status')
        expect(status.body.live).toBe(false)
    })

    it('returns 400 when no broadcast is in progress', async () => {
        const res = await request(getApp()).post('/broadcast/end')
        expect(res.status).toBe(400)
    })

    it('a new broadcast can start after the previous one ends', async () => {
        await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Alice', channel: 'general' })

        await request(getApp()).post('/broadcast/end')

        const res = await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Bob', channel: 'general' })

        expect(res.status).toBe(200)
        expect(res.body.uploader).toBe('Bob')
    })
})