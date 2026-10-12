import { ed25519 } from '@noble/curves/ed25519.js'
import { base58 } from '@scure/base'
import { describe, expect, it } from 'vitest'
import { solana } from '../../src/index.js'
import { BTC_LEGACY, dead, EVM, SOL, TRX } from '../addresses.js'
import { bytes, code, valid } from '../helpers.js'

describe('solana', () => {
  it.each([
    ['a wallet', SOL],
    ['the system program', '11111111111111111111111111111111'],
    ['the wrapped SOL mint', 'So11111111111111111111111111111111111111112'],
  ])('accepts %s', (_case, address) => {
    expect(valid(address, solana)).toEqual({
      valid: true,
      address,
      kind: 'account',
      network: 'mainnet',
      warnings: [],
    })
  })

  it('flags an address that cannot be a wallet key', () => {
    // The bytes de ad be ef, repeated, are not a point of the curve.
    expect(valid(base58.encode(dead(32)), solana).warnings).toEqual(['off-curve'])
  })

  it.each([
    ['a Tron address', TRX, 'length'],
    ['a Bitcoin address', BTC_LEGACY, 'length'],
    ['too many characters', `${SOL}v`, 'format'],
    ['the system program with a "1" too many', '1'.repeat(33), 'length'],
    ['as many "1" as an address can have', '1'.repeat(44), 'length'],
    ['a character outside base58', `${SOL.slice(0, -1)}0`, 'format'],
    ['an EVM address', EVM, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, solana)).toBe(expected)
  })
})

describe('Solana addresses', () => {
  /** Ground truth from an audited implementation. */
  function onCurve(key: Uint8Array): boolean {
    try {
      ed25519.Point.fromBytes(key)
      return true
    } catch {
      return false
    }
  }

  const flaggedOffCurve = (key: Uint8Array) =>
    valid(base58.encode(key), solana).warnings.includes('off-curve')

  /** Little-endian point encoding: 255 bits of y, then the sign of x. */
  function encodePoint(y: bigint, sign = false): Uint8Array {
    const key = Uint8Array.from({ length: 32 }, (_, i) => Number((y >> BigInt(8 * i)) & 0xffn))
    if (sign) key[31] = (key.at(31) ?? 0) | 0x80
    return key
  }

  const keys = Array.from({ length: 2000 }, (_, i) => bytes(`key ${i}`))

  it('the curve test agrees with @noble/curves on 2000 pseudo-random keys', () => {
    for (const key of keys) expect(flaggedOffCurve(key)).toBe(!onCurve(key))
    // About half of all 32-byte strings are curve points.
    const share = keys.filter(onCurve).length / keys.length
    expect(share).toBeGreaterThan(0.4)
    expect(share).toBeLessThan(0.6)
  })

  it('agrees on edge encodings', () => {
    const p = 2n ** 255n - 19n
    const cases = [0n, 1n, 2n, p - 1n, p, p + 1n, 2n ** 255n - 1n].flatMap((y) => [
      encodePoint(y),
      encodePoint(y, true),
    ])
    for (const key of cases) expect(flaggedOffCurve(key), `${key}`).toBe(!onCurve(key))
  })
})
