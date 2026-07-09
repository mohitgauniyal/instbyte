/**
 * tests/integration/info.test.js
 *
 * Tests that GET /info exposes the broadcast ICE-server config to the client.
 * We mutate the live config object (the same reference the server uses) to
 * simulate different instbyte.config.json settings, and restore it afterwards.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createRequire } from 'module'
import { setup, resetDb, getApp } from '../helpers/setup.js'

const require = createRequire(import.meta.url)

setup()

const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }]
let config

beforeEach(async () => {
    await resetDb()
    config = require('../../server/config.js')
    config.broadcast.iceServers = DEFAULT_ICE
})

afterEach(() => {
    // restore default so other test files are unaffected
    config.broadcast.iceServers = DEFAULT_ICE
})

describe('GET /info — iceServers exposure', () => {
    it('exposes the default Google STUN server', async () => {
        const res = await request(getApp()).get('/info')
        expect(res.status).toBe(200)
        expect(res.body.iceServers).toEqual(DEFAULT_ICE)
    })

    it('exposes a custom iceServers list (e.g. TURN)', async () => {
        const custom = [{ urls: 'turn:turn.lan:3478', username: 'u', credential: 'p' }]
        config.broadcast.iceServers = custom

        const res = await request(getApp()).get('/info')
        expect(res.body.iceServers).toEqual(custom)
    })

    it('exposes an empty list for air-gapped (no STUN)', async () => {
        config.broadcast.iceServers = []

        const res = await request(getApp()).get('/info')
        expect(res.body.iceServers).toEqual([])
    })
})
