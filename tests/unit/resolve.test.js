import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'
import fs   from 'fs'
import path from 'path'
import os   from 'os'

const require = createRequire(import.meta.url)
const { resolveServer, findRuntimeConfig } = require('../../bin/cli/resolve.js')

// Helpers
function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'instbyte-resolve-'))
}

function writeRuntime(dir, data) {
  const dataDir = path.join(dir, 'instbyte-data')
  fs.mkdirSync(dataDir, { recursive: true })
  fs.writeFileSync(path.join(dataDir, '.runtime.json'), JSON.stringify(data), 'utf-8')
}

describe('findRuntimeConfig', () => {
  let tmpDir

  beforeEach(() => { tmpDir = makeTmpDir() })
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }) })

  it('finds config in the same directory', () => {
    writeRuntime(tmpDir, { url: 'http://192.168.1.5:3000', passphrase: '' })
    const result = findRuntimeConfig(tmpDir)
    expect(result).toEqual({ url: 'http://192.168.1.5:3000', passphrase: '' })
  })

  it('finds config by walking up one level', () => {
    writeRuntime(tmpDir, { url: 'http://192.168.1.5:3000', passphrase: '' })
    const child = path.join(tmpDir, 'sub')
    fs.mkdirSync(child)
    const result = findRuntimeConfig(child)
    expect(result).toEqual({ url: 'http://192.168.1.5:3000', passphrase: '' })
  })

  it('finds config by walking up two levels', () => {
    writeRuntime(tmpDir, { url: 'http://192.168.1.5:3000', passphrase: '' })
    const deep = path.join(tmpDir, 'sub', 'deeper')
    fs.mkdirSync(deep, { recursive: true })
    const result = findRuntimeConfig(deep)
    expect(result).toEqual({ url: 'http://192.168.1.5:3000', passphrase: '' })
  })

  it('returns null when no config exists', () => {
    const result = findRuntimeConfig(tmpDir)
    expect(result).toBeNull()
  })

  it('returns null on malformed JSON', () => {
    const dataDir = path.join(tmpDir, 'instbyte-data')
    fs.mkdirSync(dataDir)
    fs.writeFileSync(path.join(dataDir, '.runtime.json'), 'not json', 'utf-8')
    const result = findRuntimeConfig(tmpDir)
    expect(result).toBeNull()
  })
})

describe('resolveServer', () => {
  let tmpDir
  let originalCwd
  let originalEnv

  beforeEach(() => {
    tmpDir = makeTmpDir()
    originalCwd = process.cwd()
    originalEnv = { ...process.env }
    delete process.env.INSTBYTE_URL
    delete process.env.INSTBYTE_PASS
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    process.env = originalEnv
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('explicit --server flag wins', () => {
    writeRuntime(tmpDir, { url: 'http://192.168.1.5:3000', passphrase: '' })
    process.env.INSTBYTE_URL = 'http://10.0.0.1:3000'
    const result = resolveServer({ server: 'http://1.2.3.4:9000' })
    expect(result.url).toBe('http://1.2.3.4:9000')
  })

  it('env var wins over config file', () => {
    writeRuntime(tmpDir, { url: 'http://192.168.1.5:3000', passphrase: '' })
    process.env.INSTBYTE_URL = 'http://10.0.0.1:3000'
    const result = resolveServer({})
    expect(result.url).toBe('http://10.0.0.1:3000')
  })

  it('config file found when no flag or env', () => {
    writeRuntime(tmpDir, { url: 'http://192.168.1.5:3000', passphrase: 'secret' })
    const result = resolveServer({})
    expect(result.url).toBe('http://192.168.1.5:3000')
    expect(result.passphrase).toBe('secret')
  })

  it('falls back to localhost:3000 when nothing found', () => {
    const result = resolveServer({})
    expect(result.url).toBe('http://localhost:3000')
    expect(result.passphrase).toBe('')
  })

  it('explicit --passphrase flag overrides config file passphrase', () => {
    writeRuntime(tmpDir, { url: 'http://192.168.1.5:3000', passphrase: 'fromfile' })
    const result = resolveServer({ passphrase: 'fromflag' })
    expect(result.passphrase).toBe('fromflag')
  })

  it('strips trailing slash from URL', () => {
    const result = resolveServer({ server: 'http://192.168.1.5:3000/' })
    expect(result.url).toBe('http://192.168.1.5:3000')
  })
})
