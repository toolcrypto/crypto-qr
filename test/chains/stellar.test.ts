import { describe, expect, it } from 'vitest'
import { stellar, validateAddress } from '../../src/index.js'
import { BTC_LEGACY, dead, EVM, KEY, XLM } from '../addresses.js'
import { strkey } from '../encoders.js'
import { BASE32, bytes, code, SAMPLES, typo, valid } from '../helpers.js'
import { INVALID, VALID } from '../vectors/sep23.js'

const ACCOUNT = 6 << 3
const MUXED = 12 << 3

describe('stellar', () => {
  it.each([
    ['an account', XLM, 'account'],
    ['a muxed account, which carries an id', strkey(MUXED, KEY, dead(8)), 'muxed'],
  ])('accepts %s', (_case, address, kind) => {
    expect(valid(address, stellar)).toEqual({
      valid: true,
      address,
      kind,
      network: 'mainnet',
      warnings: [],
    })
  })

  it('refuses a secret key, and says what it is', () => {
    const secret = strkey(18 << 3, dead(32))
    expect(secret).toMatch(/^S/)
    expect(validateAddress(secret, stellar)).toEqual({
      valid: false,
      code: 'format',
      message: 'This is a secret key, not an address: keep it to yourself.',
    })
  })

  it.each([
    ['a wrong character', `${XLM.slice(0, -1)}H`, 'checksum'],
    ['lowercase', XLM.toLowerCase(), 'format'],
    ['a missing character', XLM.slice(0, -1), 'format'],
    ['a contract', strkey(2 << 3, dead(32)), 'format'],
    ['an account with an id but not marked as muxed', strkey(ACCOUNT, KEY, dead(8)), 'format'],
    ['a Bitcoin address', BTC_LEGACY, 'format'],
    ['an EVM address', EVM, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, stellar)).toBe(expected)
  })
})

describe('stellar: SEP-23 test cases', () => {
  it.each(VALID)('%s: %s', (address, what) => {
    const result = validateAddress(address, stellar)
    const kind = /non-multiplexed account/.test(what)
      ? 'account'
      : /multiplexed account/.test(what)
        ? 'muxed'
        : undefined
    // A signed payload, a contract, a pool or a balance is not an address to pay.
    if (!kind) return expect(result).toMatchObject({ valid: false, code: 'format' })
    expect(result).toEqual({ valid: true, address, kind, network: 'mainnet', warnings: [] })
  })

  it.each(INVALID)('refuses %s: %s', (address) => {
    expect(validateAddress(address, stellar).valid).toBe(false)
  })
})

describe('Stellar addresses', () => {
  it.each([
    [ACCOUNT, 'account', 0],
    [MUXED, 'muxed', 8],
  ])('version %i: every one is accepted as %s, every typo refused', (version, kind, idSize) => {
    for (let i = 0; i < SAMPLES; i++) {
      const label = `stellar ${version} ${i}`
      const address = strkey(version, bytes(label), bytes(`${label} id`, idSize))
      expect(validateAddress(address, stellar), address).toMatchObject({ address, kind })
      expect(code(typo(address, BASE32, label), stellar), address).not.toBe('valid')
    }
  })
})
