import { describe, expect, it } from 'vitest'
import { bitcoincash, validateAddress } from '../../src/index.js'
import { BCH, BTC, BTC_LEGACY, dead, EVM } from '../addresses.js'
import { base58check } from '../encoders.js'
import { BASE58, BECH32, bytes, code, SAMPLES, typo, valid } from '../helpers.js'
import { SIZES, TOKEN_AWARE, TRANSLATIONS } from '../vectors/cashaddr.js'

const KINDS = ['p2pkh', 'p2sh', 'p2pkh', 'p2sh']
const NETWORKS: Record<string, string> = {
  bitcoincash: 'mainnet',
  bchtest: 'testnet',
  bchreg: 'testnet',
}
const VECTORS = [...SIZES, ...TOKEN_AWARE]
const prefixOf = (address: string) => address.slice(0, address.indexOf(':'))

/** The bytes a CashAddr address holds before its checksum, regrouped from its 5-bit characters. */
function payloadOf(address: string): number[] {
  const characters = address.slice(address.indexOf(':') + 1, -8)
  const bits = Array.from(characters, (char) => BECH32.indexOf(char).toString(2).padStart(5, '0'))
  return (bits.join('').match(/.{8}/g) ?? []).map((byte) => Number.parseInt(byte, 2))
}

describe('bitcoincash', () => {
  it.each([
    ['with its prefix', BCH],
    ['without its prefix', BCH.slice(12)],
    ['in capitals', BCH.toUpperCase()],
    ['in capitals without its prefix', BCH.slice(12).toUpperCase()],
  ])('accepts a CashAddr address %s, and returns it whole in lowercase', (_case, address) => {
    expect(valid(address, bitcoincash)).toEqual({
      valid: true,
      address: BCH,
      kind: 'p2pkh',
      network: 'mainnet',
      warnings: [],
    })
  })

  it('holds the hash it was built from', () => {
    expect(payloadOf(BCH)).toEqual([0, ...dead(20)])
  })

  it.each([
    ['a wrong character', `${BCH.slice(0, -1)}q`, 'checksum'],
    ['a wrong character without the prefix', `${BCH.slice(12, -1)}q`, 'checksum'],
    ['both cases', BCH.replace(':qr', ':Qr'), 'format'],
    ['capitals behind a lowercase prefix', `bitcoincash:${BCH.slice(12).toUpperCase()}`, 'format'],
    ['a Litecoin address', base58check.encode(Uint8Array.of(48, ...dead(20))), 'wrong-chain'],
    ['a Bitcoin SegWit address', BTC, 'format'],
    ['an EVM address', EVM, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, bitcoincash)).toBe(expected)
  })
})

describe('bitcoincash: the format inherited from Bitcoin', () => {
  it.each(TRANSLATIONS)('rewrites %s as %s, with a warning', (legacy, cashAddr) => {
    expect(valid(legacy, bitcoincash)).toEqual({
      valid: true,
      address: cashAddr,
      kind: cashAddr.startsWith('bitcoincash:q') ? 'p2pkh' : 'p2sh',
      network: 'mainnet',
      warnings: ['legacy-format'],
    })
    expect(valid(cashAddr, bitcoincash)).toMatchObject({ address: cashAddr, warnings: [] })
  })

  it.each([
    { version: 0, prefix: 'bitcoincash', type: 0, network: 'mainnet' },
    { version: 5, prefix: 'bitcoincash', type: 1, network: 'mainnet' },
    { version: 111, prefix: 'bchtest', type: 0, network: 'testnet' },
    { version: 196, prefix: 'bchtest', type: 1, network: 'testnet' },
  ])('version $version: every one keeps its hash under $prefix, every typo is refused', (row) => {
    const { version, prefix, type, network } = row
    for (let i = 0; i < SAMPLES; i++) {
      const label = `bch ${version} ${i}`
      const hash = bytes(label, 20)
      const legacy = base58check.encode(Uint8Array.of(version, ...hash))
      const result = valid(legacy, bitcoincash)
      expect(result).toMatchObject({ kind: KINDS[type], network, warnings: ['legacy-format'] })
      expect(prefixOf(result.address)).toBe(prefix)
      expect(payloadOf(result.address)).toEqual([type << 3, ...hash])
      // What it is rewritten as is an address like any other.
      expect(valid(result.address, bitcoincash)).toMatchObject({ address: result.address })
      expect(code(typo(legacy, BASE58, label), bitcoincash), legacy).not.toBe('valid')
    }
  })

  it('is the same text as a Bitcoin address, which is why it is rewritten', () => {
    expect(valid(BTC_LEGACY, bitcoincash).address).toBe(BCH)
  })
})

describe('bitcoincash: CashAddr test vectors', () => {
  it.each(VECTORS)('%s', (address, type, hash) => {
    const network = NETWORKS[prefixOf(address)]
    const kind = KINDS[type]
    // Keys are paid to by a hash of 20 bytes, scripts by one of 20 or 32.
    const used = hash.length === 40 || (hash.length === 64 && kind === 'p2sh')
    const result = validateAddress(address, bitcoincash)
    if (!network) return expect(result).toMatchObject({ valid: false, code: 'wrong-chain' })
    if (!kind || !used) return expect(result).toMatchObject({ valid: false, code: 'unsupported' })
    expect(result).toEqual({ valid: true, address, kind, network, warnings: [] })
    expect(
      payloadOf(address)
        .slice(1)
        .map((byte) => byte.toString(16).padStart(2, '0')),
    ).toEqual(hash.match(/../g))
    // The checksum covers the prefix, so the payload alone says which network it is for.
    expect(validateAddress(address.slice(address.indexOf(':') + 1), bitcoincash)).toEqual(result)
    expect(validateAddress(address.toUpperCase(), bitcoincash)).toEqual(result)
  })

  it.each(VECTORS)('%s with one wrong character', (address) => {
    const from = address.indexOf(':') + 1
    expect(code(typo(address, BECH32, address, from), bitcoincash)).toBe('checksum')
    expect(code(typo(address.slice(from), BECH32, address), bitcoincash)).toBe('checksum')
  })
})
