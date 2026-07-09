/**
 * tests/unit/offline.test.js
 *
 * Guards the "no cloud / LAN-only" promise: the client's own HTML and JS must
 * not reference any external CDN / web service. All third-party libs are
 * vendored under client/assets/ and served locally.
 *
 * Note: this checks the app's own files (index.html, js/app.js), not the
 * vendored library bundles themselves — those may legitimately contain
 * license-header URLs or SVG xmlns identifiers, which are not network calls.
 */

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const clientDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../client')
const read = rel => fs.readFileSync(path.join(clientDir, rel), 'utf-8')

const EXTERNAL_HOSTS = ['cdnjs.cloudflare.com', 'api.qrserver.com']

describe('offline: no external asset dependencies', () => {
  it('index.html references no external CDN/web-service hosts', () => {
    const html = read('index.html')
    for (const host of EXTERNAL_HOSTS) {
      expect(html, `index.html should not reference ${host}`).not.toContain(host)
    }
  })

  it('app.js makes no external host calls', () => {
    const js = read('js/app.js')
    for (const host of EXTERNAL_HOSTS) {
      expect(js, `app.js should not reference ${host}`).not.toContain(host)
    }
  })

  it('all third-party libs are vendored locally under assets/', () => {
    for (const asset of [
      'assets/marked.min.js',
      'assets/highlight.min.js',
      'assets/qrcode.min.js',
      'assets/github.min.css',
    ]) {
      expect(fs.existsSync(path.join(clientDir, asset)), `${asset} missing`).toBe(true)
    }
  })
})
