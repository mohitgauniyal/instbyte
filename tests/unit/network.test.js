/**
 * tests/unit/network.test.js
 *
 * Tests pickLanIP() — the LAN IP selection behind /info and the QR code.
 * The key case: when the only external IPv4 lives on a virtual adapter
 * (VPN tun/tap, WSL vEthernet, …), it must still be returned rather than
 * falling back to "localhost" (which is useless for other devices to reach).
 */

import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { pickLanIP } = require('../../server/netutil.js')

// Build an os.networkInterfaces()-shaped entry
const ip = (address, internal = false) => ({ family: 'IPv4', internal, address })

describe('pickLanIP', () => {
  it('returns the physical Wi-Fi LAN IP', () => {
    const nets = {
      'Wi-Fi': [ip('192.168.29.64')],
      'Loopback Pseudo-Interface 1': [ip('127.0.0.1', true)],
    }
    expect(pickLanIP(nets)).toBe('192.168.29.64')
  })

  it('prefers a physical adapter over a VMware host-only adapter', () => {
    const nets = {
      'VMware Network Adapter VMnet8': [ip('192.168.56.1')],
      'Wi-Fi': [ip('192.168.29.64')],
    }
    expect(pickLanIP(nets)).toBe('192.168.29.64')
  })

  it('returns a virtual-adapter IP instead of localhost when it is the only external IPv4', () => {
    // Regression: with only a VPN/WSL/Hyper-V adapter present, the old code
    // filtered it out and fell back to "localhost" — so the QR pointed at
    // localhost and no other device could open it.
    const nets = {
      'vEthernet (WSL)': [ip('172.20.10.2')],
      'Loopback Pseudo-Interface 1': [ip('127.0.0.1', true)],
    }
    expect(pickLanIP(nets)).toBe('172.20.10.2')
  })

  it('falls back to localhost only when there is no external IPv4 at all', () => {
    const nets = { 'Loopback Pseudo-Interface 1': [ip('127.0.0.1', true)] }
    expect(pickLanIP(nets)).toBe('localhost')
  })

  it('prefers 192.168 over 10.x over 172.x', () => {
    const nets = {
      eth0: [ip('10.0.0.5')],
      eth1: [ip('192.168.1.20')],
      eth2: [ip('172.16.0.9')],
    }
    expect(pickLanIP(nets)).toBe('192.168.1.20')
  })

  it('ignores IPv6 and internal addresses', () => {
    const nets = {
      'Wi-Fi': [
        { family: 'IPv6', internal: false, address: 'fe80::1' },
        ip('192.168.29.64'),
      ],
    }
    expect(pickLanIP(nets)).toBe('192.168.29.64')
  })

  it('handles empty or malformed input without throwing', () => {
    expect(pickLanIP({})).toBe('localhost')
    expect(pickLanIP(undefined)).toBe('localhost')
  })
})
