import { bech32, bech32m } from '@scure/base'
import { describe, expect, it } from 'vitest'
import { validateAddress, zcash } from '../../src/index.js'
import { BTC, BTC_LEGACY, dead, EVM, ZEC } from '../addresses.js'
import { base58check } from '../encoders.js'
import { BASE58, BECH32, bytes, code, SAMPLES, typo, valid } from '../helpers.js'
import { UNIFIED } from '../vectors/zip316.js'

/** A transparent address: two version bytes and a hash. */
const transparent = (lead: number, hash: Uint8Array = dead(20)) =>
  base58check.encode(Uint8Array.of(lead >> 8, lead & 0xff, ...hash))

/** Reproducible bytes beyond the 32 a hash gives. */
const long = (label: string, length: number) =>
  Uint8Array.from({ length }, (_, at) => bytes(`${label} ${at >> 5}`).at(at & 31) ?? 0)

describe('zcash', () => {
  it.each([
    ['a transparent address', ZEC, 'p2pkh'],
    ['a transparent script address', transparent(0x1cbd), 'p2sh'],
    ['a Sapling address', bech32.encode('zs', bech32.toWords(dead(43))), 'sapling'],
    ['a TEX address', bech32m.encode('tex', bech32m.toWords(dead(20))), 'tex'],
  ])('accepts %s', (_case, address, kind) => {
    expect(valid(address, zcash)).toEqual({
      valid: true,
      address,
      kind,
      network: 'mainnet',
      warnings: [],
    })
  })

  it('accepts both addresses of the example of ZIP-320, which are one key', () => {
    expect(valid('t1VmmGiyjVNeCjxDZzg7vZmd99WyzVby9yC', zcash).kind).toBe('p2pkh')
    expect(valid('tex1s2rt77ggv6q989lr49rkgzmh5slsksa9khdgte', zcash).kind).toBe('tex')
  })

  it('writes uppercase bech32 in lowercase', () => {
    const sapling = bech32.encode('zs', bech32.toWords(dead(43)))
    expect(valid(sapling.toUpperCase(), zcash).address).toBe(sapling)
  })

  it.each([
    ['a wrong character', `${ZEC.slice(0, -1)}d`, 'checksum'],
    ['version bytes that are not Zcash’s', transparent(0x1cb9), 'wrong-chain'],
    ['a Sprout address', base58check.encode(Uint8Array.of(0x16, 0x9a, ...dead(64))), 'unsupported'],
    [
      'a Sapling address with the checksum of bech32m',
      bech32m.encode('zs', bech32m.toWords(dead(43))),
      'checksum',
    ],
    [
      'a TEX address with the checksum of bech32',
      bech32.encode('tex', bech32.toWords(dead(20))),
      'checksum',
    ],
    ['a Sapling address one byte short', bech32.encode('zs', bech32.toWords(dead(42))), 'length'],
    [
      'a unified address too short for a receiver',
      bech32m.encode('u', bech32m.toWords(dead(37))),
      'length',
    ],
    [
      'bech32 in both cases',
      bech32m.encode('tex', bech32m.toWords(dead(20))).replace('tex1', 'Tex1'),
      'format',
    ],
    ['a Bitcoin SegWit address', BTC, 'wrong-chain'],
    ['a Bitcoin address', BTC_LEGACY, 'format'],
    ['an EVM address', EVM, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, zcash)).toBe(expected)
  })
})

describe('zcash: ZIP-316 test vectors', () => {
  it.each(UNIFIED)('%s', (address) => {
    expect(validateAddress(address, zcash)).toEqual({
      valid: true,
      address,
      kind: 'unified',
      network: 'mainnet',
      warnings: [],
    })
    expect(code(typo(address, BECH32, address, 2), zcash)).toBe('checksum')
  })
})

describe('Zcash addresses', () => {
  it.each([
    ['1cb8', 'p2pkh', 'mainnet'],
    ['1cbd', 'p2sh', 'mainnet'],
    ['1d25', 'p2pkh', 'testnet'],
    ['1cba', 'p2sh', 'testnet'],
  ])(
    'transparent, version 0x%s: every one is accepted as %s on %s, every typo refused',
    (version, kind, network) => {
      for (let i = 0; i < SAMPLES; i++) {
        const label = `zcash ${version} ${i}`
        const address = transparent(Number.parseInt(version, 16), bytes(label, 20))
        expect(validateAddress(address, zcash), address).toMatchObject({ address, kind, network })
        expect(code(typo(address, BASE58, label), zcash), address).not.toBe('valid')
      }
    },
  )

  it.each([
    { prefix: 'zs', codec: bech32, kind: 'sapling', size: 43, network: 'mainnet' },
    { prefix: 'ztestsapling', codec: bech32, kind: 'sapling', size: 43, network: 'testnet' },
    { prefix: 'tex', codec: bech32m, kind: 'tex', size: 20, network: 'mainnet' },
    { prefix: 'textest', codec: bech32m, kind: 'tex', size: 20, network: 'testnet' },
    { prefix: 'u', codec: bech32m, kind: 'unified', size: 38, network: 'mainnet' },
    { prefix: 'utest', codec: bech32m, kind: 'unified', size: 83, network: 'testnet' },
    { prefix: 'zu', codec: bech32m, kind: 'unified', size: 83, network: 'mainnet' },
    { prefix: 'zutest', codec: bech32m, kind: 'unified', size: 59, network: 'testnet' },
    { prefix: 'tu', codec: bech32m, kind: 'unified', size: 141, network: 'mainnet' },
    { prefix: 'tutest', codec: bech32m, kind: 'unified', size: 38, network: 'testnet' },
  ])('$prefix: every one is accepted as $kind on $network, every typo refused', (row) => {
    const { prefix, codec, kind, size, network } = row
    for (let i = 0; i < SAMPLES / 4; i++) {
      const label = `zcash ${prefix} ${i}`
      const address = codec.encode(prefix, codec.toWords(long(label, size)), false)
      expect(validateAddress(address, zcash), address).toMatchObject({ address, kind, network })
      expect(code(typo(address, BECH32, label, prefix.length + 1), zcash), address).toBe('checksum')
    }
  })
})
