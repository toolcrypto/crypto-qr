import { describe, expect, it } from 'vitest'
import { monero, validateAddress } from '../../src/index.js'
import { BTC_LEGACY, dead, EVM, KEY, XMR } from '../addresses.js'
import { moneroAddress } from '../encoders.js'
import { BASE58, bytes, code, SAMPLES, typo, valid } from '../helpers.js'

describe('monero', () => {
  it.each([
    ['a standard address', XMR, 'standard'],
    ['a subaddress', moneroAddress(42, KEY, KEY), 'subaddress'],
    ['an integrated address', moneroAddress(19, KEY, KEY, dead(8)), 'integrated'],
  ])('accepts %s', (_case, address, kind) => {
    expect(valid(address, monero)).toEqual({
      valid: true,
      address,
      kind,
      network: 'mainnet',
      warnings: [],
    })
  })

  it.each([
    ['a wrong character', `${XMR.slice(0, -1)}c`, 'checksum'],
    ['a missing character', XMR.slice(0, -1), 'format'],
    ['the type byte of another coin', moneroAddress(0xb2, KEY, KEY), 'wrong-chain'],
    ['a payment id on a standard address', moneroAddress(18, KEY, KEY, dead(8)), 'length'],
    ['an integrated address without its payment id', moneroAddress(19, KEY, KEY), 'length'],
    ['a Bitcoin address', BTC_LEGACY, 'format'],
    ['an EVM address', EVM, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, monero)).toBe(expected)
  })
})

describe('Monero addresses', () => {
  it.each([
    [18, 'standard', 'mainnet'],
    [19, 'integrated', 'mainnet'],
    [42, 'subaddress', 'mainnet'],
    [53, 'standard', 'testnet'],
    [54, 'integrated', 'testnet'],
    [63, 'subaddress', 'testnet'],
    // Stagenet is a test network too.
    [24, 'standard', 'testnet'],
    [25, 'integrated', 'testnet'],
    [36, 'subaddress', 'testnet'],
  ])('type %i: every one is accepted as %s on %s, every typo refused', (type, kind, network) => {
    for (let i = 0; i < SAMPLES; i++) {
      const label = `monero ${type} ${i}`
      const keys = [bytes(`${label} spend`), bytes(`${label} view`)]
      const id = kind === 'integrated' ? [bytes(`${label} id`, 8)] : []
      const address = moneroAddress(type, ...keys, ...id)
      expect(validateAddress(address, monero), address).toMatchObject({ address, kind, network })
      expect(code(typo(address, BASE58, label), monero), address).toBe('checksum')
    }
  })
})
