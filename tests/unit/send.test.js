import { describe, it, expect } from 'vitest'

// Inlined from bin/cli/send.js — tests the binary stdin guard logic
function isBinary(buf) {
  const limit = Math.min(buf.length, 512);
  for (let i = 0; i < limit; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

describe('isBinary', () => {
  it('returns false for empty buffer', () => {
    expect(isBinary(Buffer.alloc(0))).toBe(false)
  })

  it('returns false for plain UTF-8 text', () => {
    expect(isBinary(Buffer.from('hello from terminal\n'))).toBe(false)
  })

  it('returns false for multiline text', () => {
    expect(isBinary(Buffer.from('line one\nline two\nline three\n'))).toBe(false)
  })

  it('returns true when null byte is at the start', () => {
    expect(isBinary(Buffer.from([0x00, 0x01, 0x02]))).toBe(true)
  })

  it('returns true when null byte is within the first 512 bytes', () => {
    const buf = Buffer.alloc(100, 0x41) // 'A' * 100
    buf[50] = 0x00
    expect(isBinary(buf)).toBe(true)
  })

  it('returns false when null byte is beyond the 512-byte sample window', () => {
    const buf = Buffer.alloc(600, 0x41) // 'A' * 600
    buf[513] = 0x00                     // null byte outside the check window
    expect(isBinary(buf)).toBe(false)
  })

  it('returns true for a buffer that starts with common binary magic bytes', () => {
    // ZIP magic number — PK\x03\x04
    const zip = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00])
    expect(isBinary(zip)).toBe(true)
  })

  it('returns false for JSON content', () => {
    const json = Buffer.from(JSON.stringify({ key: 'value', num: 42 }))
    expect(isBinary(json)).toBe(false)
  })
})
