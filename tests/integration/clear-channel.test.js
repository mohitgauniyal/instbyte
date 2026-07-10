/**
 * tests/integration/clear-channel.test.js
 *
 * Tests POST /channels/:name/clear — deletes every NON-pinned item in a
 * channel at once while protecting pinned items, cleans up their files from
 * the configured uploads dir, and reports how many were removed.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import fs from 'fs'
import path from 'path'
import { setup, resetDb, getApp, insertItem } from '../helpers/setup.js'

setup()

beforeEach(async () => {
    await resetDb()
})

describe('POST /channels/:name/clear', () => {
    it('deletes all non-pinned items in the target channel', async () => {
        await insertItem({ content: 'one', channel: 'general' })
        await insertItem({ content: 'two', channel: 'general' })

        const res = await request(getApp()).post('/channels/general/clear')
        expect(res.status).toBe(200)

        const items = await request(getApp()).get('/items/general')
        expect(items.body.items).toHaveLength(0)
    })

    it('leaves pinned items untouched', async () => {
        await insertItem({ content: 'keep me', channel: 'general', pinned: 1 })
        await insertItem({ content: 'drop me', channel: 'general' })

        await request(getApp()).post('/channels/general/clear')

        const items = await request(getApp()).get('/items/general')
        const contents = items.body.items.map(i => i.content)
        expect(contents).toEqual(['keep me'])
    })

    it('leaves other channels untouched', async () => {
        await insertItem({ content: 'general item', channel: 'general' })
        await insertItem({ content: 'projects item', channel: 'projects' })

        await request(getApp()).post('/channels/general/clear')

        const projects = await request(getApp()).get('/items/projects')
        expect(projects.body.items.map(i => i.content)).toEqual(['projects item'])
    })

    it('returns the correct count of removed items', async () => {
        await insertItem({ content: 'a', channel: 'general' })
        await insertItem({ content: 'b', channel: 'general' })
        await insertItem({ content: 'pinned', channel: 'general', pinned: 1 })

        const res = await request(getApp()).post('/channels/general/clear')
        expect(res.body.cleared).toBe(2) // pinned one is excluded
    })

    it('returns cleared:0 for a channel with only pinned items', async () => {
        await insertItem({ content: 'pinned only', channel: 'general', pinned: 1 })

        const res = await request(getApp()).post('/channels/general/clear')
        expect(res.body.cleared).toBe(0)

        const items = await request(getApp()).get('/items/general')
        expect(items.body.items).toHaveLength(1)
    })

    it('removes the files of deleted items from the configured uploads dir', async () => {
        const uploadsDir = process.env.INSTBYTE_UPLOADS
        const filename = 'clear-me.txt'
        const filePath = path.join(uploadsDir, filename)
        fs.writeFileSync(filePath, 'goodbye')

        await insertItem({ type: 'file', filename, channel: 'general' })
        expect(fs.existsSync(filePath)).toBe(true)

        await request(getApp()).post('/channels/general/clear')

        expect(fs.existsSync(filePath)).toBe(false)
    })

    it('keeps the file of a pinned item on the configured uploads dir', async () => {
        const uploadsDir = process.env.INSTBYTE_UPLOADS
        const filename = 'pinned-keep.txt'
        const filePath = path.join(uploadsDir, filename)
        fs.writeFileSync(filePath, 'stay')

        await insertItem({ type: 'file', filename, channel: 'general', pinned: 1 })

        await request(getApp()).post('/channels/general/clear')

        expect(fs.existsSync(filePath)).toBe(true)
    })
})
