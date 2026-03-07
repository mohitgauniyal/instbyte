/**
 * tests/integration/items.test.js
 *
 * Tests all item-related HTTP routes:
 *   POST   /text
 *   GET    /items/:channel
 *   DELETE /item/:id
 *   POST   /pin/:id
 *   PATCH  /item/:id/move
 *   PATCH  /item/:id/content
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { setup, resetDb, getApp, insertItem } from '../helpers/setup.js'

// ── wire up the isolated server + DB ─────────────────────────────────────────
setup()

beforeEach(async () => {
    await resetDb()
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /text
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /text', () => {
    it('creates a text item and returns it with an id', async () => {
        const res = await request(getApp())
            .post('/text')
            .send({ content: 'hello world', channel: 'general', uploader: 'Alice' })

        expect(res.status).toBe(200)
        expect(res.body.id).toBeDefined()
        expect(res.body.type).toBe('text')
        expect(res.body.content).toBe('hello world')
        expect(res.body.channel).toBe('general')
        expect(res.body.uploader).toBe('Alice')
    })

    it('persists the item so it appears in GET /items/:channel', async () => {
        await request(getApp())
            .post('/text')
            .send({ content: 'persisted', channel: 'general', uploader: 'Alice' })

        const res = await request(getApp()).get('/items/general')
        expect(res.status).toBe(200)
        expect(res.body.items.some(i => i.content === 'persisted')).toBe(true)
    })

    it('assigns a created_at timestamp', async () => {
        const before = Date.now()
        const res = await request(getApp())
            .post('/text')
            .send({ content: 'timestamped', channel: 'general', uploader: 'Alice' })
        const after = Date.now()

        expect(res.body.created_at).toBeGreaterThanOrEqual(before)
        expect(res.body.created_at).toBeLessThanOrEqual(after)
    })

    it('can post to any channel', async () => {
        const res = await request(getApp())
            .post('/text')
            .send({ content: 'in projects', channel: 'projects', uploader: 'Bob' })

        expect(res.status).toBe(200)
        expect(res.body.channel).toBe('projects')
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /items/:channel
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /items/:channel', () => {
    it('returns empty items array for a channel with no content', async () => {
        const res = await request(getApp()).get('/items/general')

        expect(res.status).toBe(200)
        expect(res.body.items).toEqual([])
        expect(res.body.hasMore).toBe(false)
    })

    it('returns only items belonging to the requested channel', async () => {
        await insertItem({ content: 'in general', channel: 'general' })
        await insertItem({ content: 'in projects', channel: 'projects' })

        const res = await request(getApp()).get('/items/general')

        expect(res.body.items).toHaveLength(1)
        expect(res.body.items[0].content).toBe('in general')
    })

    it('returns items newest first', async () => {
        await insertItem({ content: 'first', channel: 'general', created_at: 1000 })
        await insertItem({ content: 'second', channel: 'general', created_at: 2000 })
        await insertItem({ content: 'third', channel: 'general', created_at: 3000 })

        const res = await request(getApp()).get('/items/general')
        const contents = res.body.items.map(i => i.content)

        expect(contents).toEqual(['third', 'second', 'first'])
    })

    it('returns pinned items first regardless of age', async () => {
        await insertItem({ content: 'old pinned', channel: 'general', pinned: 1, created_at: 1000 })
        await insertItem({ content: 'new unpinned', channel: 'general', pinned: 0, created_at: 9000 })

        const res = await request(getApp()).get('/items/general')
        const contents = res.body.items.map(i => i.content)

        expect(contents[0]).toBe('old pinned')
    })

    it('paginates — hasMore is true when more than 10 unpinned items exist', async () => {
        for (let i = 0; i < 11; i++) {
            await insertItem({ content: `item ${i}`, channel: 'general' })
        }

        const res = await request(getApp()).get('/items/general?page=1')
        expect(res.body.items).toHaveLength(10)
        expect(res.body.hasMore).toBe(true)
    })

    it('paginates — page 2 returns the remaining items', async () => {
        for (let i = 0; i < 11; i++) {
            await insertItem({ content: `item ${i}`, channel: 'general' })
        }

        const res = await request(getApp()).get('/items/general?page=2')
        expect(res.body.items).toHaveLength(1)
        expect(res.body.hasMore).toBe(false)
    })

    it('pinned items only appear on page 1', async () => {
        await insertItem({ content: 'pinned', channel: 'general', pinned: 1 })
        for (let i = 0; i < 11; i++) {
            await insertItem({ content: `item ${i}`, channel: 'general' })
        }

        const page1 = await request(getApp()).get('/items/general?page=1')
        const page2 = await request(getApp()).get('/items/general?page=2')

        expect(page1.body.items.some(i => i.content === 'pinned')).toBe(true)
        expect(page2.body.items.some(i => i.content === 'pinned')).toBe(false)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /item/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /item/:id', () => {
    it('deletes the item and returns 200', async () => {
        const id = await insertItem({ content: 'to be deleted', channel: 'general' })

        const res = await request(getApp()).delete(`/item/${id}`)
        expect(res.status).toBe(200)
    })

    it('item no longer appears in GET after deletion', async () => {
        const id = await insertItem({ content: 'gone soon', channel: 'general' })

        await request(getApp()).delete(`/item/${id}`)

        const res = await request(getApp()).get('/items/general')
        expect(res.body.items.some(i => i.id === id)).toBe(false)
    })

    it('returns 404 for a non-existent id', async () => {
        const res = await request(getApp()).delete('/item/99999')
        expect(res.status).toBe(404)
    })

    it('can delete a pinned item', async () => {
        const id = await insertItem({ content: 'pinned but deletable', channel: 'general', pinned: 1 })

        const res = await request(getApp()).delete(`/item/${id}`)
        expect(res.status).toBe(200)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /pin/:id
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /pin/:id', () => {
    it('pins an unpinned item', async () => {
        const id = await insertItem({ content: 'pin me', channel: 'general', pinned: 0 })

        await request(getApp()).post(`/pin/${id}`)

        const res = await request(getApp()).get('/items/general')
        const item = res.body.items.find(i => i.id === id)
        expect(item.pinned).toBe(1)
    })

    it('unpins a pinned item (toggles)', async () => {
        const id = await insertItem({ content: 'unpin me', channel: 'general', pinned: 1 })

        await request(getApp()).post(`/pin/${id}`)

        const res = await request(getApp()).get('/items/general')
        const item = res.body.items.find(i => i.id === id)
        expect(item.pinned).toBe(0)
    })

    it('returns 200', async () => {
        const id = await insertItem({ content: 'test', channel: 'general' })
        const res = await request(getApp()).post(`/pin/${id}`)
        expect(res.status).toBe(200)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /item/:id/move
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /item/:id/move', () => {
    it('moves item to a different channel', async () => {
        const id = await insertItem({ content: 'moveable', channel: 'general' })

        const res = await request(getApp())
            .patch(`/item/${id}/move`)
            .send({ channel: 'projects' })

        expect(res.status).toBe(200)
        expect(res.body.channel).toBe('projects')
    })

    it('item appears in new channel after move', async () => {
        const id = await insertItem({ content: 'moving out', channel: 'general' })

        await request(getApp())
            .patch(`/item/${id}/move`)
            .send({ channel: 'projects' })

        const generalRes = await request(getApp()).get('/items/general')
        const projectsRes = await request(getApp()).get('/items/projects')

        expect(generalRes.body.items.some(i => i.id === id)).toBe(false)
        expect(projectsRes.body.items.some(i => i.id === id)).toBe(true)
    })

    it('returns 400 when channel is missing from request body', async () => {
        const id = await insertItem({ content: 'test', channel: 'general' })

        const res = await request(getApp())
            .patch(`/item/${id}/move`)
            .send({})

        expect(res.status).toBe(400)
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /item/:id/content
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /item/:id/content', () => {
    it('updates the content of a text item', async () => {
        const id = await insertItem({ content: 'original', channel: 'general' })

        const res = await request(getApp())
            .patch(`/item/${id}/content`)
            .send({ content: 'updated' })

        expect(res.status).toBe(200)
        expect(res.body.content).toBe('updated')
    })

    it('updated content appears in GET', async () => {
        const id = await insertItem({ content: 'old text', channel: 'general' })

        await request(getApp())
            .patch(`/item/${id}/content`)
            .send({ content: 'new text' })

        const res = await request(getApp()).get('/items/general')
        const item = res.body.items.find(i => i.id === id)
        expect(item.content).toBe('new text')
    })

    it('trims whitespace from updated content', async () => {
        const id = await insertItem({ content: 'original', channel: 'general' })

        const res = await request(getApp())
            .patch(`/item/${id}/content`)
            .send({ content: '  padded  ' })

        expect(res.body.content).toBe('padded')
    })

    it('returns 400 when content is missing', async () => {
        const id = await insertItem({ content: 'test', channel: 'general' })

        const res = await request(getApp())
            .patch(`/item/${id}/content`)
            .send({})

        expect(res.status).toBe(400)
    })

    it('returns 400 when content is empty string', async () => {
        const id = await insertItem({ content: 'test', channel: 'general' })

        const res = await request(getApp())
            .patch(`/item/${id}/content`)
            .send({ content: '   ' })

        expect(res.status).toBe(400)
    })

    it('returns 404 for a non-existent item', async () => {
        const res = await request(getApp())
            .patch('/item/99999/content')
            .send({ content: 'anything' })

        expect(res.status).toBe(404)
    })
})