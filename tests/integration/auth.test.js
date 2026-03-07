/**
 * tests/integration/auth.test.js
 *
 * Tests authentication — login, logout, protected routes, public routes.
 *
 * How auth works in Instbyte:
 *   - If config.auth.passphrase is empty, all routes are public (no auth)
 *   - If a passphrase is set, POST /login validates it and sets a cookie
 *     containing a random session token
 *   - The sessions Map in server.js holds valid tokens
 *   - requireAuth middleware checks the cookie against the sessions Map
 *   - /login, /info, /health are always public even when auth is enabled
 *
 * Test strategy:
 *   - We mutate config.auth.passphrase directly (it's the same object the
 *     server uses) to enable/disable auth per test
 *   - We inject tokens directly into the sessions Map to simulate a logged-in
 *     user without going through the full login flow
 *   - We always restore config.auth.passphrase to "" in afterEach so other
 *     test files are not affected
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createRequire } from 'module'
import { setup, resetDb, getApp } from '../helpers/setup.js'

const require = createRequire(import.meta.url)

setup()

// Grab the live config and sessions objects from the loaded modules.
// These are the exact same references the server uses at runtime.
let config
let sessions

beforeEach(async () => {
    await resetDb()
    config = require('../../server/config.js')
    sessions = require('../../server/server.js').sessions
    // ensure auth is off before each test — tests that need it turn it on
    config.auth.passphrase = ''
    sessions.clear()
})

afterEach(() => {
    // always restore so other test files run without auth
    config.auth.passphrase = ''
    sessions.clear()
})

// ─────────────────────────────────────────────────────────────────────────────
// No auth mode (default)
// ─────────────────────────────────────────────────────────────────────────────

describe('when no passphrase is set', () => {
    it('allows access to protected routes without any credentials', async () => {
        const res = await request(getApp()).get('/channels')
        expect(res.status).toBe(200)
    })

    it('allows POST /text without credentials', async () => {
        const res = await request(getApp())
            .post('/text')
            .send({ content: 'hello', channel: 'general', uploader: 'Alice' })
        expect(res.status).toBe(200)
    })

    it('/info reports hasAuth false', async () => {
        const res = await request(getApp()).get('/info')
        expect(res.status).toBe(200)
        expect(res.body.hasAuth).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Auth enabled — public routes still accessible
// ─────────────────────────────────────────────────────────────────────────────

describe('when passphrase is set — public routes', () => {
    beforeEach(() => {
        config.auth.passphrase = 'secret123'
    })

    it('/info is accessible without credentials', async () => {
        const res = await request(getApp()).get('/info')
        expect(res.status).toBe(200)
        expect(res.body.hasAuth).toBe(true)
    })

    it('/health is accessible without credentials', async () => {
        const res = await request(getApp()).get('/health')
        expect(res.status).toBe(200)
    })

    it('GET /login is accessible without credentials', async () => {
        const res = await request(getApp()).get('/login')
        expect(res.status).toBe(200)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Auth enabled — protected routes blocked
// ─────────────────────────────────────────────────────────────────────────────

describe('when passphrase is set — protected routes blocked', () => {
    beforeEach(() => {
        config.auth.passphrase = 'secret123'
    })

    it('blocks GET /channels with JSON 401 for API requests', async () => {
        const res = await request(getApp())
            .get('/channels')
            .set('Content-Type', 'application/json')
        expect(res.status).toBe(401)
    })

    it('blocks POST /text with 401', async () => {
        const res = await request(getApp())
            .post('/text')
            .set('Content-Type', 'application/json')
            .send({ content: 'hello', channel: 'general', uploader: 'Alice' })
        expect(res.status).toBe(401)
    })

    it('blocks GET /items/:channel with 401', async () => {
        const res = await request(getApp())
            .get('/items/general')
            .set('Content-Type', 'application/json')
        expect(res.status).toBe(401)
    })

    it('blocks DELETE /item/:id with 401', async () => {
        const res = await request(getApp())
            .delete('/item/1')
            .set('Content-Type', 'application/json')
        expect(res.status).toBe(401)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /login
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /login', () => {
    beforeEach(() => {
        config.auth.passphrase = 'secret123'
    })

    it('returns 200 and ok:true with correct passphrase', async () => {
        const res = await request(getApp())
            .post('/login')
            .send({ passphrase: 'secret123' })

        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
    })

    it('sets a session cookie on successful login', async () => {
        const res = await request(getApp())
            .post('/login')
            .send({ passphrase: 'secret123' })

        const cookie = res.headers['set-cookie']
        expect(cookie).toBeDefined()
        expect(cookie[0]).toMatch(/instbyte_auth/)
    })

    it('adds a token to the sessions Map on successful login', async () => {
        await request(getApp())
            .post('/login')
            .send({ passphrase: 'secret123' })

        expect(sessions.size).toBe(1)
    })

    it('returns 401 with wrong passphrase', async () => {
        const res = await request(getApp())
            .post('/login')
            .send({ passphrase: 'wrongpassword' })

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    it('does not add a token to sessions on failed login', async () => {
        await request(getApp())
            .post('/login')
            .send({ passphrase: 'wrongpassword' })

        expect(sessions.size).toBe(0)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// Authenticated requests
// ─────────────────────────────────────────────────────────────────────────────

describe('authenticated requests', () => {
    beforeEach(() => {
        config.auth.passphrase = 'secret123'
    })

    it('allows access to protected routes with a valid session cookie', async () => {
        // inject a token directly rather than going through login
        const token = 'test-token-abc123'
        sessions.set(token, true)

        const res = await request(getApp())
            .get('/channels')
            .set('Cookie', `instbyte_auth=${token}`)

        expect(res.status).toBe(200)
    })

    it('blocks access with an invalid session token', async () => {
        const res = await request(getApp())
            .get('/channels')
            .set('Cookie', 'instbyte_auth=not-a-valid-token')
            .set('Content-Type', 'application/json')

        expect(res.status).toBe(401)
    })

    it('full login flow grants access to protected routes', async () => {
        // login to get a real cookie
        const loginRes = await request(getApp())
            .post('/login')
            .send({ passphrase: 'secret123' })

        const cookie = loginRes.headers['set-cookie'][0].split(';')[0]

        // use that cookie to access a protected route
        const res = await request(getApp())
            .get('/channels')
            .set('Cookie', cookie)

        expect(res.status).toBe(200)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /logout
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /logout', () => {
    beforeEach(() => {
        config.auth.passphrase = 'secret123'
    })

    it('removes the token from the sessions Map', async () => {
        const token = 'logout-test-token'
        sessions.set(token, true)
        expect(sessions.size).toBe(1)

        await request(getApp())
            .post('/logout')
            .set('Cookie', `instbyte_auth=${token}`)

        expect(sessions.size).toBe(0)
    })

    it('after logout the token no longer grants access', async () => {
        const token = 'revoked-token'
        sessions.set(token, true)

        await request(getApp())
            .post('/logout')
            .set('Cookie', `instbyte_auth=${token}`)

        const res = await request(getApp())
            .get('/channels')
            .set('Cookie', `instbyte_auth=${token}`)
            .set('Content-Type', 'application/json')

        expect(res.status).toBe(401)
    })
})