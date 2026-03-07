/**
 * tests/integration/channels.test.js
 *
 * Tests all channel-related HTTP routes:
 *   GET    /channels
 *   POST   /channels
 *   DELETE /channels/:name
 *   PATCH  /channels/:name        (rename)
 *   POST   /channels/:name/pin
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { setup, resetDb, getApp, insertItem, insertChannel } from '../helpers/setup.js'

setup()

beforeEach(async () => {
    await resetDb()
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /channels
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /channels', () => {
    it('returns the four default channels after reset', async () => {
        const res = await request(getApp()).get('/channels')

        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(4)
        const names = res.body.map(c => c.name)
        expect(names).toContain('general')
        expect(names).toContain('projects')
        expect(names).toContain('assets')
        expect(names).toContain('temp')
    })

    it('returns pinned channels first', async () => {
        await request(getApp()).post('/channels/general/pin')

        const res = await request(getApp()).get('/channels')
        expect(res.body[0].name).toBe('general')
        expect(res.body[0].pinned).toBe(1)
    })

    it('includes id, name, and pinned fields on each channel', async () => {
        const res = await request(getApp()).get('/channels')
        const ch = res.body[0]

        expect(ch).toHaveProperty('id')
        expect(ch).toHaveProperty('name')
        expect(ch).toHaveProperty('pinned')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /channels
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /channels', () => {
    it('creates a new channel and returns it', async () => {
        const res = await request(getApp())
            .post('/channels')
            .send({ name: 'design' })

        expect(res.status).toBe(200)
        expect(res.body.name).toBe('design')
        expect(res.body.id).toBeDefined()
    })

    it('new channel appears in GET /channels', async () => {
        await request(getApp()).post('/channels').send({ name: 'design' })

        const res = await request(getApp()).get('/channels')
        expect(res.body.some(c => c.name === 'design')).toBe(true)
    })

    it('trims whitespace from channel name', async () => {
        const res = await request(getApp())
            .post('/channels')
            .send({ name: '  design  ' })

        expect(res.status).toBe(200)
        expect(res.body.name).toBe('design')
    })

    it('returns 400 when name is missing', async () => {
        const res = await request(getApp())
            .post('/channels')
            .send({})

        expect(res.status).toBe(400)
    })

    it('returns 400 for a duplicate channel name', async () => {
        await request(getApp()).post('/channels').send({ name: 'design' })

        const res = await request(getApp())
            .post('/channels')
            .send({ name: 'design' })

        expect(res.status).toBe(400)
    })

    it('returns 400 for name longer than 32 characters', async () => {
        const res = await request(getApp())
            .post('/channels')
            .send({ name: 'a'.repeat(33) })

        expect(res.status).toBe(400)
    })

    it('returns 400 for name with invalid characters', async () => {
        const res = await request(getApp())
            .post('/channels')
            .send({ name: 'bad@name!' })

        expect(res.status).toBe(400)
    })

    it('accepts names with letters, numbers, hyphens, underscores, spaces', async () => {
        const valid = ['my-channel', 'my_channel', 'channel 1', 'Channel2']
        for (const name of valid) {
            const res = await request(getApp()).post('/channels').send({ name })
            expect(res.status).toBe(200)
            // clean up between iterations
            await request(getApp()).delete(`/channels/${name}`)
        }
    })

    it('returns 400 when channel limit of 10 is reached', async () => {
        // already have 4 default channels — add 6 more to hit the limit
        for (let i = 5; i <= 10; i++) {
            await request(getApp()).post('/channels').send({ name: `ch${i}` })
        }

        const res = await request(getApp())
            .post('/channels')
            .send({ name: 'overflow' })

        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/max/i)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /channels/:name
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /channels/:name', () => {
    it('deletes a channel and returns 200', async () => {
        await request(getApp()).post('/channels').send({ name: 'to-delete' })

        const res = await request(getApp()).delete('/channels/to-delete')
        expect(res.status).toBe(200)
    })

    it('deleted channel no longer appears in GET /channels', async () => {
        await request(getApp()).post('/channels').send({ name: 'to-delete' })
        await request(getApp()).delete('/channels/to-delete')

        const res = await request(getApp()).get('/channels')
        expect(res.body.some(c => c.name === 'to-delete')).toBe(false)
    })

    it('also deletes all items inside the channel', async () => {
        await request(getApp()).post('/channels').send({ name: 'doomed' })
        await insertItem({ content: 'will be gone', channel: 'doomed' })

        await request(getApp()).delete('/channels/doomed')

        const res = await request(getApp()).get('/items/doomed')
        expect(res.body.items).toHaveLength(0)
    })

    it('returns 404 for a non-existent channel', async () => {
        const res = await request(getApp()).delete('/channels/doesnotexist')
        expect(res.status).toBe(404)
    })

    it('returns 403 when trying to delete a pinned channel', async () => {
        await request(getApp()).post('/channels/general/pin')

        const res = await request(getApp()).delete('/channels/general')
        expect(res.status).toBe(403)
    })

    it('returns 400 when trying to delete the last remaining channel', async () => {
        // delete 3 of the 4 default channels
        await request(getApp()).delete('/channels/projects')
        await request(getApp()).delete('/channels/assets')
        await request(getApp()).delete('/channels/temp')

        // now only general remains — should be protected
        const res = await request(getApp()).delete('/channels/general')
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/at least one/i)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /channels/:name  (rename)
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /channels/:name (rename)', () => {
    it('renames a channel and returns old and new name', async () => {
        const res = await request(getApp())
            .patch('/channels/general')
            .send({ name: 'main' })

        expect(res.status).toBe(200)
        expect(res.body.oldName).toBe('general')
        expect(res.body.newName).toBe('main')
    })

    it('renamed channel appears under new name in GET /channels', async () => {
        await request(getApp()).patch('/channels/general').send({ name: 'main' })

        const res = await request(getApp()).get('/channels')
        const names = res.body.map(c => c.name)
        expect(names).toContain('main')
        expect(names).not.toContain('general')
    })

    it('items in the channel move to the new name', async () => {
        await insertItem({ content: 'test item', channel: 'general' })

        await request(getApp()).patch('/channels/general').send({ name: 'main' })

        const res = await request(getApp()).get('/items/main')
        expect(res.body.items.some(i => i.content === 'test item')).toBe(true)
    })

    it('returns 404 for a non-existent channel', async () => {
        const res = await request(getApp())
            .patch('/channels/doesnotexist')
            .send({ name: 'new-name' })

        expect(res.status).toBe(404)
    })

    it('returns 400 when new name is missing', async () => {
        const res = await request(getApp())
            .patch('/channels/general')
            .send({})

        expect(res.status).toBe(400)
    })

    it('returns 400 when new name is longer than 32 characters', async () => {
        const res = await request(getApp())
            .patch('/channels/general')
            .send({ name: 'a'.repeat(33) })

        expect(res.status).toBe(400)
    })

    it('returns 400 when new name has invalid characters', async () => {
        const res = await request(getApp())
            .patch('/channels/general')
            .send({ name: 'bad@name!' })

        expect(res.status).toBe(400)
    })

    it('returns 400 when renaming to an already existing channel name', async () => {
        const res = await request(getApp())
            .patch('/channels/general')
            .send({ name: 'projects' })

        expect(res.status).toBe(400)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /channels/:name/pin
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /channels/:name/pin', () => {
    it('pins an unpinned channel', async () => {
        const res = await request(getApp()).post('/channels/general/pin')

        expect(res.status).toBe(200)
        expect(res.body.pinned).toBe(1)
    })

    it('unpins a pinned channel (toggles)', async () => {
        await request(getApp()).post('/channels/general/pin')

        const res = await request(getApp()).post('/channels/general/pin')
        expect(res.body.pinned).toBe(0)
    })

    it('pinned channel appears first in GET /channels', async () => {
        await request(getApp()).post('/channels/temp/pin')

        const res = await request(getApp()).get('/channels')
        expect(res.body[0].name).toBe('temp')
    })

    it('pinned channel is protected from deletion', async () => {
        await request(getApp()).post('/channels/general/pin')

        const res = await request(getApp()).delete('/channels/general')
        expect(res.status).toBe(403)
    })
})