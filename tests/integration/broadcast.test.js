/**
 * tests/integration/broadcast.test.js
 *
 * Tests broadcast HTTP endpoints:
 *   GET  /broadcast/status
 *   POST /broadcast/start   — returns a server-issued ownerToken
 *   POST /broadcast/end     — requires the ownerToken (only the owner may end)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { setup, resetDb, getApp } from '../helpers/setup.js'

setup()

// Track the owner token of whatever broadcast a test starts, so afterEach can
// tear it down — ending now requires proof of ownership.
let activeToken = null

async function start(body) {
    const res = await request(getApp()).post('/broadcast/start').send(body)
    if (res.body && res.body.ownerToken) activeToken = res.body.ownerToken
    return res
}

function end(token) {
    const req = request(getApp()).post('/broadcast/end')
    return token ? req.set('x-broadcast-token', token) : req
}

beforeEach(async () => {
    await resetDb()
})

afterEach(async () => {
    // Clean up any broadcast left running (ignore result — may already be ended).
    if (activeToken) {
        await request(getApp()).post('/broadcast/end').set('x-broadcast-token', activeToken)
        activeToken = null
    }
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
        await start({ uploader: 'Alice', channel: 'general' })

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
    it('starts a broadcast and returns 200 with an ownerToken', async () => {
        const res = await start({ uploader: 'Alice', channel: 'general' })

        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
        expect(res.body.uploader).toBe('Alice')
        expect(res.body.channel).toBe('general')
        expect(typeof res.body.ownerToken).toBe('string')
        expect(res.body.ownerToken.length).toBeGreaterThan(0)
    })

    it('does not leak the socketId in the start response', async () => {
        const res = await start({ uploader: 'Alice', channel: 'general', socketId: 'sock-1' })
        expect(res.body.socketId).toBeUndefined()
    })

    it('returns 409 if a broadcast is already in progress', async () => {
        await start({ uploader: 'Alice', channel: 'general' })

        const res = await request(getApp())
            .post('/broadcast/start')
            .send({ uploader: 'Bob', channel: 'general' })

        expect(res.status).toBe(409)
        expect(res.body.error).toBeDefined()
        expect(res.body.uploader).toBe('Alice')
    })

    it('returns 400 when uploader is missing', async () => {
        const res = await start({ channel: 'general' })
        expect(res.status).toBe(400)
    })

    it('returns 400 when channel is missing', async () => {
        const res = await start({ uploader: 'Alice' })
        expect(res.status).toBe(400)
    })

    it('status reflects live broadcast after start', async () => {
        await start({ uploader: 'Alice', channel: 'projects' })

        const status = await request(getApp()).get('/broadcast/status')
        expect(status.body.live).toBe(true)
        expect(status.body.channel).toBe('projects')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /broadcast/end — ownership
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /broadcast/end', () => {
    it('the owner can end the broadcast with the correct token', async () => {
        const res = await start({ uploader: 'Alice', channel: 'general' })

        const endRes = await end(res.body.ownerToken)
        expect(endRes.status).toBe(200)
        expect(endRes.body.ok).toBe(true)
    })

    it('status is live:false after the owner ends the broadcast', async () => {
        const res = await start({ uploader: 'Alice', channel: 'general' })
        await end(res.body.ownerToken)

        const status = await request(getApp()).get('/broadcast/status')
        expect(status.body.live).toBe(false)
    })

    it('a NON-owner cannot end the broadcast (no token) — stays live', async () => {
        await start({ uploader: 'Alice', channel: 'general' })

        // Someone else hits /broadcast/end without the owner token
        const attack = await request(getApp()).post('/broadcast/end')
        expect(attack.status).toBe(403)

        // The broadcast must still be live
        const status = await request(getApp()).get('/broadcast/status')
        expect(status.body.live).toBe(true)
        expect(status.body.uploader).toBe('Alice')
    })

    it('a NON-owner cannot end the broadcast with a wrong token', async () => {
        await start({ uploader: 'Alice', channel: 'general' })

        const attack = await end('not-the-real-token')
        expect(attack.status).toBe(403)

        const status = await request(getApp()).get('/broadcast/status')
        expect(status.body.live).toBe(true)
    })

    it('returns 400 when no broadcast is in progress', async () => {
        const res = await end('any-token')
        expect(res.status).toBe(400)
    })

    it('a new broadcast can start after the owner ends the previous one', async () => {
        const first = await start({ uploader: 'Alice', channel: 'general' })
        await end(first.body.ownerToken)

        const res = await start({ uploader: 'Bob', channel: 'general' })
        expect(res.status).toBe(200)
        expect(res.body.uploader).toBe('Bob')
    })
})
