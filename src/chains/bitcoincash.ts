import {
  type AddressKind,
  type AddressResult,
  accept,
  badChecksum,
  checked,
  reject,
} from '../chain.js'
import { decodeBase58check } from './base58.js'
import { BECH32, wordsToBytes } from './bech32.js'
import * as unchecked from './unchecked.js'

/** Prefixes of CashAddr: mainnet first, then the test networks. */
const PREFIXES = ['bitcoincash', 'bchtest', 'bchreg']
const GENERATOR = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n]

/**
 * Type bits of the version byte. Types 2 and 3 are the token-aware forms of
 * CashTokens: they pay to the same scripts.
 */
const TYPES: readonly AddressKind[] = ['p2pkh', 'p2sh', 'p2pkh', 'p2sh']
/** Size bits of the version byte to the length of the hash in bytes. */
const SIZES = [20, 24, 28, 32, 40, 48, 56, 64]

/**
 * Version byte of the base58check form inherited from Bitcoin, to the prefix
 * and the type bits of the same address in CashAddr.
 */
const LEGACY: Readonly<Record<number, readonly [prefix: string, type: number]>> = {
  0: ['bitcoincash', 0],
  5: ['bitcoincash', 1],
  111: ['bchtest', 0],
  196: ['bchtest', 1],
}

/**
 * The 40-bit checksum of CashAddr over 5-bit values: the prefix, a zero, then
 * the payload. Zero when the payload ends with the checksum that matches.
 */
function polymod(prefix: string, payload: readonly number[]): bigint {
  let checksum = 1n
  for (const value of [...Array.from(prefix, (char) => char.charCodeAt(0) & 31), 0, ...payload]) {
    const top = checksum >> 35n
    checksum = ((checksum & 0x07ffffffffn) << 5n) ^ BigInt(value)
    for (const [bit, generator] of GENERATOR.entries()) {
      if ((top >> BigInt(bit)) & 1n) checksum ^= generator
    }
  }
  return checksum ^ 1n
}

/** A number as `count` values of five bits, the highest first. */
const fives = (value: bigint, count: number): number[] =>
  Array.from({ length: count }, (_, at) => Number((value >> BigInt(5 * (count - 1 - at))) & 31n))

/** Writes a 20-byte hash as CashAddr. */
function encode(prefix: string, type: number, hash: Uint8Array): string {
  const bits = hash.reduce((value, byte) => (value << 8n) | BigInt(byte), BigInt(type << 3))
  // The version byte and the hash are 168 bits: 34 values, the last padded with two zero bits.
  const payload = fives(bits << 2n, 34)
  const checksum = fives(polymod(prefix, [...payload, 0, 0, 0, 0, 0, 0, 0, 0]), 8)
  return `${prefix}:${[...payload, ...checksum].map((value) => BECH32.charAt(value)).join('')}`
}

const foreign = () => reject('wrong-chain', 'This is not a Bitcoin Cash address.')

function fromCashAddr(text: string): AddressResult {
  const lower = text.toLowerCase()
  if (text !== lower && text !== text.toUpperCase()) {
    return reject('format', 'A CashAddr address is all lowercase or all uppercase.')
  }
  const colon = lower.indexOf(':')
  const payload = lower.slice(colon + 1)
  const values = Array.from(payload, (char) => BECH32.indexOf(char))
  // The checksum covers the prefix: an address written without it is tried against each.
  const prefix = (colon === -1 ? PREFIXES : [lower.slice(0, colon)]).find(
    (candidate) => polymod(candidate, values) === 0n,
  )
  if (prefix === undefined) return badChecksum()
  if (!PREFIXES.includes(prefix)) return foreign()

  const bytes = wordsToBytes(values.slice(0, -8))
  const version = bytes?.at(0) ?? 0
  const kind = TYPES[version >> 3]
  const size = (bytes?.length ?? 0) - 1
  if (size !== SIZES[version & 7]) {
    return reject('format', 'The address does not hold a hash of the length it announces.')
  }
  // Keys are paid to by a 20-byte hash, scripts by one of 20 or 32 bytes.
  return kind && (size === 20 || (size === 32 && kind === 'p2sh'))
    ? accept(`${prefix}:${payload}`, kind, prefix === PREFIXES[0] ? 'mainnet' : 'testnet')
    : reject('unsupported', 'This type of CashAddr address is not in use.')
}

function fromLegacy(text: string): AddressResult {
  const payload = decodeBase58check(text)
  if (!payload) return badChecksum()
  const [prefix, type] = LEGACY[payload.at(0) ?? -1] ?? []
  if (prefix === undefined || type === undefined) return foreign()
  // The same text is a Bitcoin address: it is rewritten in the form that tells the two apart.
  const rewritten = fromCashAddr(encode(prefix, type, payload.subarray(1)))
  return rewritten.valid ? { ...rewritten, warnings: ['legacy-format'] } : rewritten
}

function checkAddress(text: string): AddressResult {
  if (/^[1-9A-HJ-NP-Za-km-z]{26,35}$/.test(text)) return fromLegacy(text)
  if (/^(?:[a-z]+:)?[02-9ac-hj-np-z]{42,112}$/i.test(text)) return fromCashAddr(text)
  return reject('format', 'This is not shaped like a Bitcoin Cash address.')
}

/**
 * An address is returned as CashAddr with its prefix, which its checksum
 * covers. In that form it is its own payment URI, and cannot be taken for a
 * Bitcoin address.
 */
export const bitcoincash: typeof unchecked.bitcoincash = /* @__PURE__ */ checked(
  unchecked.bitcoincash,
  checkAddress,
)
