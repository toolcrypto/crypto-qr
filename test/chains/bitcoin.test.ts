import { bech32, bech32m } from '@scure/base'
import { describe, expect, it } from 'vitest'
import { bitcoin, type Chain, dogecoin, litecoin, validateAddress } from '../../src/index.js'
import { BTC, BTC_LEGACY, DOGE, dead, EVM, LTC, SOL, TRX } from '../addresses.js'
import { base58check } from '../encoders.js'
import { BASE58, BECH32, bytes, code, SAMPLES, typo, valid } from '../helpers.js'
import * as bip350 from '../vectors/bip350.js'
import * as bitcoinCore from '../vectors/bitcoin-core.js'

/** The base58check address of a version byte. */
const legacy = (version: number) => base58check.encode(Uint8Array.of(version, ...dead(20)))
const TAPROOT = bech32m.encode('bc', [1, ...bech32m.toWords(dead(32))])
/** The shape of a Litecoin MWEB address: a version and two keys of 33 bytes, of any length. */
const mweb = (hrp: string) =>
  bech32.encode(hrp, [0, ...bech32.toWords(Uint8Array.of(...dead(33), ...dead(33)))], false)

/** What a scriptPubKey pays to, or undefined for a script the library draws no code for. */
function kindOf(script: string): string | undefined {
  if (/^76a914[0-9a-f]{40}88ac$/.test(script)) return 'p2pkh'
  if (/^a914[0-9a-f]{40}87$/.test(script)) return 'p2sh'
  if (/^0014[0-9a-f]{40}$/.test(script)) return 'p2wpkh'
  if (/^0020[0-9a-f]{64}$/.test(script)) return 'p2wsh'
  if (/^5120[0-9a-f]{64}$/.test(script)) return 'p2tr'
  return undefined
}

describe('bitcoin', () => {
  it.each([
    [BTC_LEGACY, 'p2pkh'],
    [legacy(5), 'p2sh'],
    [BTC, 'p2wpkh'],
    [bech32.encode('bc', [0, ...bech32.toWords(dead(32))]), 'p2wsh'],
    [TAPROOT, 'p2tr'],
  ])('accepts %s as %s', (address, kind) => {
    expect(valid(address, bitcoin)).toEqual({
      valid: true,
      address,
      kind,
      network: 'mainnet',
      warnings: [],
    })
  })

  it('writes uppercase bech32 in lowercase', () => {
    expect(valid(BTC.toUpperCase(), bitcoin).address).toBe(BTC)
  })

  it.each([
    ['a wrong base58 character', `${BTC_LEGACY.slice(0, -1)}i`, 'checksum'],
    ['a wrong bech32 character', `${BTC.slice(0, -1)}m`, 'checksum'],
    ['bech32 in both cases', BTC.replace('bc1q', 'bc1Q'), 'format'],
    ['a Tron address', TRX, 'wrong-chain'],
    ['a Litecoin address', legacy(48), 'wrong-chain'],
    ['a Litecoin SegWit address', LTC, 'wrong-chain'],
    ['a Solana address', SOL, 'format'],
    ['an EVM address', EVM, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, bitcoin)).toBe(expected)
  })
})

describe('bitcoin: BIP-350 test vectors', () => {
  it.each(bip350.VALID)('%s', (address, script) => {
    const result = validateAddress(address, bitcoin)
    const kind = kindOf(script)
    if (!kind) return expect(result).toMatchObject({ valid: false, code: 'unsupported' })
    expect(result).toEqual({
      valid: true,
      address: address.toLowerCase(),
      kind,
      network: /^bc1/i.test(address) ? 'mainnet' : 'testnet',
      warnings: [],
    })
  })

  it.each(bip350.INVALID)('%s: %s', (address, reason) => {
    const expected = /human-readable/.test(reason)
      ? 'wrong-chain'
      : /checksum \(/.test(reason)
        ? 'checksum'
        : /program length/.test(reason)
          ? 'length'
          : 'format'
    expect(code(address, bitcoin)).toBe(expected)
  })
})

describe('bitcoin: Bitcoin Core test vectors', () => {
  it.each(bitcoinCore.VALID)('%s', (address, script, chain) => {
    const result = validateAddress(address, bitcoin)
    const kind = kindOf(script)
    if (!kind) return expect(result).toMatchObject({ valid: false, code: 'unsupported' })
    expect(result).toEqual({
      valid: true,
      address: /^(?:bc|tb|bcrt)1/i.test(address) ? address.toLowerCase() : address,
      kind,
      network: chain === 'main' ? 'mainnet' : 'testnet',
      warnings: [],
    })
  })

  it.each(bitcoinCore.INVALID)('refuses %j', (text) => {
    expect(validateAddress(text, bitcoin).valid).toBe(false)
  })
})

describe('litecoin and dogecoin', () => {
  it.each([
    { chain: litecoin, address: legacy(48), kind: 'p2pkh' },
    { chain: litecoin, address: legacy(50), kind: 'p2sh' },
    { chain: litecoin, address: LTC, kind: 'p2wpkh' },
    { chain: dogecoin, address: DOGE, kind: 'p2pkh' },
    { chain: dogecoin, address: legacy(22), kind: 'p2sh' },
  ])('$chain.name accepts $address as $kind', ({ chain, address, kind }) => {
    expect(valid(address, chain)).toMatchObject({ address, kind, network: 'mainnet', warnings: [] })
  })

  it('accepts the old Litecoin "3..." script form with a warning', () => {
    expect(valid(legacy(5), litecoin)).toMatchObject({ kind: 'p2sh', warnings: ['legacy-format'] })
  })

  it.each([
    { chain: litecoin, address: `${legacy(48).slice(0, -1)}1`, expected: 'checksum' },
    { chain: litecoin, address: `${LTC.slice(0, -1)}q`, expected: 'checksum' },
    // "b" is not in the bech32 alphabet at all.
    { chain: litecoin, address: `${LTC.slice(0, -1)}b`, expected: 'format' },
    { chain: litecoin, address: BTC_LEGACY, expected: 'wrong-chain' },
    { chain: litecoin, address: BTC, expected: 'wrong-chain' },
    { chain: litecoin, address: mweb('ltcmweb'), expected: 'unsupported' },
    { chain: litecoin, address: mweb('tmweb'), expected: 'unsupported' },
    // Only Litecoin has the form.
    { chain: bitcoin, address: mweb('ltcmweb'), expected: 'wrong-chain' },
    { chain: dogecoin, address: `${DOGE.slice(0, -1)}M`, expected: 'checksum' },
    { chain: dogecoin, address: BTC_LEGACY, expected: 'wrong-chain' },
    // Dogecoin has no SegWit.
    { chain: dogecoin, address: BTC, expected: 'wrong-chain' },
  ])('$chain.name refuses $address: $expected', ({ chain, address, expected }) => {
    expect(code(address, chain)).toBe(expected)
  })
})

describe('base58check addresses', () => {
  it.each([
    { chain: bitcoin, version: 0, kind: 'p2pkh', network: 'mainnet' },
    { chain: bitcoin, version: 5, kind: 'p2sh', network: 'mainnet' },
    { chain: bitcoin, version: 111, kind: 'p2pkh', network: 'testnet' },
    { chain: bitcoin, version: 196, kind: 'p2sh', network: 'testnet' },
    { chain: litecoin, version: 48, kind: 'p2pkh', network: 'mainnet' },
    { chain: litecoin, version: 50, kind: 'p2sh', network: 'mainnet' },
    { chain: litecoin, version: 58, kind: 'p2sh', network: 'testnet' },
    { chain: dogecoin, version: 30, kind: 'p2pkh', network: 'mainnet' },
    { chain: dogecoin, version: 22, kind: 'p2sh', network: 'mainnet' },
    { chain: dogecoin, version: 113, kind: 'p2pkh', network: 'testnet' },
  ])('$chain.name, version $version: every one is accepted, every typo refused', (row) => {
    const { chain, version, kind, network } = row
    for (let i = 0; i < SAMPLES; i++) {
      const label = `${chain.id} ${version} ${i}`
      const address = base58check.encode(Uint8Array.of(version, ...bytes(label, 20)))
      expect(validateAddress(address, chain), address).toMatchObject({ address, kind, network })
      expect(code(typo(address, BASE58, label), chain), address).not.toBe('valid')
    }
  })

  it('a version byte belongs to its chain alone', () => {
    const others: [Chain, number][] = [
      [bitcoin, 48],
      [bitcoin, 30],
      [bitcoin, 0x41],
      [litecoin, 0],
      [litecoin, 30],
      [dogecoin, 0],
      [dogecoin, 48],
    ]
    for (const [chain, version] of others) {
      expect(code(legacy(version), chain), `${chain.id} ${version}`).toBe('wrong-chain')
    }
  })
})

describe('SegWit addresses', () => {
  it.each([
    { chain: bitcoin, hrp: 'bc', network: 'mainnet', kind: 'p2wpkh', size: 20 },
    { chain: bitcoin, hrp: 'bc', network: 'mainnet', kind: 'p2wsh', size: 32 },
    { chain: bitcoin, hrp: 'bc', network: 'mainnet', kind: 'p2tr', size: 32 },
    { chain: bitcoin, hrp: 'tb', network: 'testnet', kind: 'p2wpkh', size: 20 },
    { chain: bitcoin, hrp: 'bcrt', network: 'testnet', kind: 'p2tr', size: 32 },
    { chain: litecoin, hrp: 'ltc', network: 'mainnet', kind: 'p2wpkh', size: 20 },
    { chain: litecoin, hrp: 'ltc', network: 'mainnet', kind: 'p2tr', size: 32 },
    { chain: litecoin, hrp: 'tltc', network: 'testnet', kind: 'p2wsh', size: 32 },
  ])('$hrp, $kind: every one is accepted, every typo refused', (row) => {
    const { chain, hrp, network, kind, size } = row
    const [codec, version] = kind === 'p2tr' ? [bech32m, 1] : [bech32, 0]
    for (let i = 0; i < SAMPLES; i++) {
      const label = `${hrp} ${kind} ${i}`
      const address = codec.encode(hrp, [version, ...codec.toWords(bytes(label, size))])
      expect(validateAddress(address, chain), address).toMatchObject({ address, kind, network })
      expect(validateAddress(address.toUpperCase(), chain)).toMatchObject({ address })
      // bech32 detects any four wrong characters: one is always caught.
      expect(code(typo(address, BECH32, label, hrp.length + 1), chain), address).not.toBe('valid')
    }
  })
})
