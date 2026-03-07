import { beforeAll, afterAll, afterEach } from 'vitest'

// Override the data path before anything loads
process.env.INSTBYTE_DATA = ':memory:' // SQLite in-memory
process.env.INSTBYTE_UPLOADS = '/tmp/instbyte-test-uploads'

import fs from 'fs'

// Create test uploads dir
if (!fs.existsSync('/tmp/instbyte-test-uploads')) {
    fs.mkdirSync('/tmp/instbyte-test-uploads', { recursive: true })
}