/**
 * tests/integration/search.test.js
 *
 * Tests search routes:
 *   GET /search/:q               (global search across all channels)
 *   GET /search/:channel/:q      (search within a specific channel)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { setup, resetDb, getApp, insertItem } from '../helpers/setup.js'

setup()

beforeEach(async () => {
    await resetDb()
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /search/:q  (global)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /search/:q (global)', () => {
    it('returns an empty array when nothing matches', async () => {
        const res = await request(getApp()).get('/search/zzznomatch')

        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('finds an item by content', async () => {
        await insertItem({ content: 'hello world', channel: 'general' })

        const res = await request(getApp()).get('/search/hello')

        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(1)
        expect(res.body[0].content).toBe('hello world')
    })

    it('is case insensitive', async () => {
        await insertItem({ content: 'Hello World', channel: 'general' })

        const res = await request(getApp()).get('/search/hello')
        expect(res.body).toHaveLength(1)
    })

    it('matches partial words', async () => {
        await insertItem({ content: 'deployment pipeline', channel: 'general' })

        const res = await request(getApp()).get('/search/deploy')
        expect(res.body).toHaveLength(1)
    })

    it('searches across all channels', async () => {
        await insertItem({ content: 'result one', channel: 'general' })
        await insertItem({ content: 'result two', channel: 'projects' })
        await insertItem({ content: 'result three', channel: 'assets' })

        const res = await request(getApp()).get('/search/result')
        expect(res.body).toHaveLength(3)
    })

    it('does not return items that do not match', async () => {
        await insertItem({ content: 'matching item', channel: 'general' })
        await insertItem({ content: 'unrelated item', channel: 'general' })

        const res = await request(getApp()).get('/search/matching')
        expect(res.body).toHaveLength(1)
        expect(res.body[0].content).toBe('matching item')
    })

    it('returns results ordered by channel then pinned then newest', async () => {
        await insertItem({ content: 'alpha result', channel: 'projects', created_at: 1000 })
        await insertItem({ content: 'beta result', channel: 'general', created_at: 2000 })
        await insertItem({ content: 'gamma result', channel: 'general', created_at: 3000, pinned: 1 })

        const res = await request(getApp()).get('/search/result')
        const items = res.body

        // general comes before projects alphabetically
        // within general: pinned first, then newest
        expect(items[0].content).toBe('gamma result')  // general, pinned
        expect(items[1].content).toBe('beta result')   // general, unpinned
        expect(items[2].content).toBe('alpha result')  // projects
    })

    it('finds items by filename', async () => {
        await insertItem({
            type: 'file',
            filename: 'report-2024.pdf',
            channel: 'assets'
        })

        const res = await request(getApp()).get('/search/report')
        expect(res.body).toHaveLength(1)
        expect(res.body[0].filename).toBe('report-2024.pdf')
    })

    it('returns empty array when db has no items', async () => {
        const res = await request(getApp()).get('/search/anything')
        expect(res.body).toEqual([])
    })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /search/:channel/:q  (channel-scoped)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /search/:channel/:q (channel-scoped)', () => {
    it('returns an empty array when nothing matches', async () => {
        const res = await request(getApp()).get('/search/general/zzznomatch')

        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('finds an item by content within the channel', async () => {
        await insertItem({ content: 'scoped result', channel: 'general' })

        const res = await request(getApp()).get('/search/general/scoped')
        expect(res.body).toHaveLength(1)
        expect(res.body[0].content).toBe('scoped result')
    })

    it('does not return items from other channels', async () => {
        await insertItem({ content: 'shared keyword', channel: 'general' })
        await insertItem({ content: 'shared keyword', channel: 'projects' })

        const res = await request(getApp()).get('/search/general/shared')
        expect(res.body).toHaveLength(1)
        expect(res.body[0].channel).toBe('general')
    })

    it('finds items by filename within the channel', async () => {
        await insertItem({
            type: 'file',
            filename: 'budget.xlsx',
            channel: 'projects'
        })
        await insertItem({
            type: 'file',
            filename: 'budget.xlsx',
            channel: 'general'
        })

        const res = await request(getApp()).get('/search/projects/budget')
        expect(res.body).toHaveLength(1)
        expect(res.body[0].channel).toBe('projects')
    })

    it('returns pinned items before unpinned items', async () => {
        await insertItem({ content: 'keyword unpinned', channel: 'general', pinned: 0, created_at: 9000 })
        await insertItem({ content: 'keyword pinned', channel: 'general', pinned: 1, created_at: 1000 })

        const res = await request(getApp()).get('/search/general/keyword')
        expect(res.body[0].content).toBe('keyword pinned')
    })

    it('is case insensitive', async () => {
        await insertItem({ content: 'Deploy Script', channel: 'general' })

        const res = await request(getApp()).get('/search/general/deploy')
        expect(res.body).toHaveLength(1)
    })

    it('returns empty array for a channel with no items', async () => {
        const res = await request(getApp()).get('/search/assets/anything')
        expect(res.body).toEqual([])
    })
})