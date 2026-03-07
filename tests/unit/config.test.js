import { describe, it, expect } from 'vitest'

// We test the parsing functions directly
// These are the same functions inside config.js

function parseFileSize(val) {
    if (typeof val === "number") return val;
    const units = { KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
    const match = String(val).match(/^(\d+(\.\d+)?)\s*(KB|MB|GB)$/i);
    if (!match) return 2 * 1024 * 1024 * 1024;
    return parseFloat(match[1]) * units[match[3].toUpperCase()];
}

function parseRetention(val) {
    if (String(val).toLowerCase() === "never") return null;
    if (typeof val === "number") return val;
    const units = { h: 3600000, d: 86400000 };
    const match = String(val).match(/^(\d+)(h|d)$/i);
    if (!match) return 24 * 60 * 60 * 1000;
    return parseInt(match[1]) * units[match[2].toLowerCase()];
}

describe('parseFileSize', () => {
    it('parses GB correctly', () => {
        expect(parseFileSize('2GB')).toBe(2 * 1024 ** 3)
    })

    it('parses MB correctly', () => {
        expect(parseFileSize('500MB')).toBe(500 * 1024 ** 2)
    })

    it('parses KB correctly', () => {
        expect(parseFileSize('100KB')).toBe(100 * 1024)
    })

    it('returns number as-is', () => {
        expect(parseFileSize(1234)).toBe(1234)
    })

    it('returns default on invalid input', () => {
        expect(parseFileSize('invalid')).toBe(2 * 1024 ** 3)
    })

    it('is case insensitive', () => {
        expect(parseFileSize('1gb')).toBe(1024 ** 3)
    })
})

describe('parseRetention', () => {
    it('parses hours correctly', () => {
        expect(parseRetention('24h')).toBe(24 * 3600000)
    })

    it('parses days correctly', () => {
        expect(parseRetention('7d')).toBe(7 * 86400000)
    })

    it('returns null for never', () => {
        expect(parseRetention('never')).toBeNull()
    })

    it('returns number as-is', () => {
        expect(parseRetention(1234)).toBe(1234)
    })

    it('returns default on invalid input', () => {
        expect(parseRetention('invalid')).toBe(24 * 60 * 60 * 1000)
    })

    it('is case insensitive', () => {
        expect(parseRetention('NEVER')).toBeNull()
    })
})