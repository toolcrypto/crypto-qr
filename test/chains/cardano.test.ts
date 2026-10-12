import { bech32m } from '@scure/base'
import { describe, expect, it } from 'vitest'
import { cardano, validateAddress } from '../../src/index.js'
import { ADA, BTC, BTC_LEGACY, dead, EVM } from '../addresses.js'
import { shelley } from '../encoders.js'
import { BECH32, bytes, code, SAMPLES, typo, valid } from '../helpers.js'
import { ADDRESSES } from '../vectors/cip19.js'

/** Header type to the kind of address, and how many bytes follow the header. */
const TYPES = [
  ['base', 56],
  ['base', 56],
  ['base', 56],
  ['base', 56],
  ['pointer', 31],
  ['pointer', 31],
  ['enterprise', 28],
  ['enterprise', 28],
] as const

describe('cardano', () => {
  it('accepts an address with a payment part and a stake part', () => {
    expect(valid(ADA, cardano)).toEqual({
      valid: true,
      address: ADA,
      kind: 'base',
      network: 'mainnet',
      warnings: [],
    })
    expect(ADA).toBe(shelley('addr', 0x01, dead(56)))
  })

  it('writes uppercase bech32 in lowercase', () => {
    expect(valid(ADA.toUpperCase(), cardano).address).toBe(ADA)
  })

  it.each([
    ['a wrong character', `${ADA.slice(0, -1)}q`, 'checksum'],
    ['both cases', ADA.replace('addr1q', 'addr1Q'), 'format'],
    [
      'the checksum of bech32m',
      bech32m.encode('addr', bech32m.toWords(Uint8Array.of(0x61, ...dead(28)))),
      'checksum',
    ],
    ['a stake address', shelley('stake', 0xe1, dead(28)), 'unsupported'],
    ['what starts as a Byron address does', `Ae2${BTC_LEGACY}`, 'unsupported'],
    ['a mainnet address under the test prefix', shelley('addr_test', 0x01, dead(56)), 'format'],
    ['a test address under the mainnet prefix', shelley('addr', 0x00, dead(56)), 'format'],
    ['a header type that is not Shelley’s', shelley('addr', 0x81, dead(56)), 'format'],
    [
      'a payment part alone where two parts are announced',
      shelley('addr', 0x01, dead(28)),
      'format',
    ],
    ['a Bitcoin SegWit address', BTC, 'wrong-chain'],
    ['an EVM address', EVM, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, cardano)).toBe(expected)
  })
})

describe('cardano: CIP-19 test vectors', () => {
  it.each(ADDRESSES)('%s', (address, type) => {
    const result = validateAddress(address, cardano)
    const [kind] = TYPES[type] ?? []
    // Types 14 and 15 are stake addresses: they receive rewards, not payments.
    if (!kind) return expect(result).toMatchObject({ valid: false, code: 'unsupported' })
    expect(result).toEqual({
      valid: true,
      address,
      kind,
      network: address.startsWith('addr_test') ? 'testnet' : 'mainnet',
      warnings: [],
    })
  })
})

describe('Cardano addresses', () => {
  it.each(
    TYPES.flatMap(([kind, size], type) => [
      { type, kind, size, prefix: 'addr', network: 'mainnet' },
      { type, kind, size, prefix: 'addr_test', network: 'testnet' },
    ]),
  )('type $type under $prefix: every one is accepted as $kind, every typo refused', (row) => {
    const { type, kind, size, prefix, network } = row
    for (let i = 0; i < SAMPLES / 4; i++) {
      const label = `cardano ${type} ${prefix} ${i}`
      const body = Uint8Array.of(
        ...bytes(`${label} payment`, 28),
        ...bytes(`${label} rest`, size - 28),
      )
      const address = shelley(prefix, (type << 4) | Number(network === 'mainnet'), body)
      expect(validateAddress(address, cardano), address).toMatchObject({ address, kind, network })
      expect(code(typo(address, BECH32, label, prefix.length + 1), cardano), address).toBe(
        'checksum',
      )
    }
  })
})
