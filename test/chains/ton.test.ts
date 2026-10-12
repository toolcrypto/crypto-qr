import { describe, expect, it } from 'vitest'
import { ton, validateAddress } from '../../src/index.js'
import { dead, SOL, TON } from '../addresses.js'
import { tonAddress } from '../encoders.js'
import { BASE64URL, bytes, code, SAMPLES, typo, valid } from '../helpers.js'

describe('ton', () => {
  it.each([
    [TON, 'non-bounceable'],
    [tonAddress(0x11, dead(32)), 'bounceable'],
  ])('accepts %s as %s', (address, kind) => {
    expect(valid(address, ton)).toEqual({
      valid: true,
      address,
      kind,
      network: 'mainnet',
      warnings: [],
    })
  })

  it('writes standard base64 in the URL-safe alphabet', () => {
    const standard = TON.replaceAll('-', '+').replaceAll('_', '/')
    expect(standard).not.toBe(TON)
    expect(valid(standard, ton).address).toBe(TON)
  })

  it.each([
    ['a wrong character', `${TON.slice(0, -1)}h`, 'checksum'],
    ['a missing character', TON.slice(0, -1), 'format'],
    ['the raw form', `0:${'deadbeef'.repeat(8)}`, 'unsupported'],
    ['a Solana address', SOL, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, ton)).toBe(expected)
  })
})

describe('TON addresses', () => {
  it.each([
    [0x11, 'bounceable', 'mainnet'],
    [0x51, 'non-bounceable', 'mainnet'],
    [0x91, 'bounceable', 'testnet'],
    [0xd1, 'non-bounceable', 'testnet'],
  ])('tag %i: every one is accepted as %s on %s, every typo refused', (tag, kind, network) => {
    for (let i = 0; i < SAMPLES; i++) {
      const label = `ton ${tag} ${i}`
      const address = tonAddress(tag, bytes(label))
      expect(validateAddress(address, ton), address).toMatchObject({ address, kind, network })
      expect(code(typo(address, BASE64URL, label), ton), address).not.toBe('valid')
    }
  })

  it('accepts the masterchain, and refuses a tag or a workchain that does not exist', () => {
    expect(code(tonAddress(0x11, bytes('ton masterchain'), 0xff), ton)).toBe('valid')
    expect(code(tonAddress(0x12, bytes('ton tag')), ton)).toBe('unsupported')
    expect(code(tonAddress(0x11, bytes('ton workchain'), 1), ton)).toBe('unsupported')
  })
})
