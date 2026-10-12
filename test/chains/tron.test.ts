import { describe, expect, it } from 'vitest'
import { tron, validateAddress } from '../../src/index.js'
import { BTC_LEGACY, EVM, TRX } from '../addresses.js'
import { base58check } from '../encoders.js'
import { BASE58, bytes, code, SAMPLES, typo, valid } from '../helpers.js'

describe('tron', () => {
  it.each([
    ['a wallet', TRX],
    ['the address of twenty zero bytes', 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'],
  ])('accepts %s', (_case, address) => {
    expect(valid(address, tron)).toEqual({
      valid: true,
      address,
      kind: 'account',
      network: 'mainnet',
      warnings: [],
    })
  })

  it.each([
    ['a wrong character', `${TRX.slice(0, -1)}F`, 'checksum'],
    ['a missing character', TRX.slice(0, -1), 'format'],
    ['a Bitcoin address', BTC_LEGACY, 'format'],
    ['an EVM address', EVM, 'format'],
    // 34 characters that start with "T", under another version byte.
    [
      'another version byte',
      base58check.encode(Uint8Array.of(0x42, ...bytes('tron', 20))),
      'wrong-chain',
    ],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, tron)).toBe(expected)
  })
})

describe('Tron addresses', () => {
  it('every one is accepted, every typo refused', () => {
    for (let i = 0; i < SAMPLES; i++) {
      const address = base58check.encode(Uint8Array.of(0x41, ...bytes(`tron ${i}`, 20)))
      expect(validateAddress(address, tron), address).toMatchObject({ address, kind: 'account' })
      expect(code(typo(address, BASE58, `tron ${i}`), tron), address).not.toBe('valid')
    }
  })
})
