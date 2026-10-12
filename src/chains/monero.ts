import { keccak_256 } from '@noble/hashes/sha3.js'
import {
  type AddressKind,
  type AddressResult,
  accept,
  badChecksum,
  checked,
  type Network,
  reject,
} from '../chain.js'
import { BASE58 } from './base58.js'
import * as unchecked from './unchecked.js'

/** First byte of an address: mainnet, then testnet, then stagenet, which is a test network too. */
const TYPES: Readonly<Record<number, readonly [kind: AddressKind, network?: Network]>> = {
  18: ['standard'],
  19: ['integrated'],
  42: ['subaddress'],
  53: ['standard', 'testnet'],
  54: ['integrated', 'testnet'],
  63: ['subaddress', 'testnet'],
  24: ['standard', 'testnet'],
  25: ['integrated', 'testnet'],
  36: ['subaddress', 'testnet'],
}

/**
 * Monero's base58 works in blocks: 11 characters for 8 bytes, and at the end
 * of an address 7 characters for 5 bytes.
 */
function decode(text: string): Uint8Array | undefined {
  const bytes: number[] = []
  for (let at = 0; at < text.length; at += 11) {
    const block = text.slice(at, at + 11)
    const size = block.length === 11 ? 8 : 5
    let value = 0n
    for (const char of block) value = value * 58n + BigInt(BASE58.indexOf(char))
    if (value >> BigInt(8 * size)) return undefined
    for (let byte = size - 1; byte >= 0; byte--) {
      bytes.push(Number((value >> BigInt(8 * byte)) & 0xffn))
    }
  }
  return Uint8Array.from(bytes)
}

/**
 * A type byte, a spend key and a view key, then the first four bytes of their
 * Keccak-256. An integrated address also holds an 8-byte payment id.
 */
function checkAddress(text: string): AddressResult {
  if (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(text) || (text.length !== 95 && text.length !== 106)) {
    return reject('format', 'A Monero address has 95 characters, or 106 with a payment id.')
  }
  const bytes = decode(text)
  if (!bytes) return badChecksum()
  const body = bytes.subarray(0, -4)
  const checksum = keccak_256(body)
  if (!bytes.subarray(-4).every((byte, at) => byte === checksum[at])) return badChecksum()
  const [kind, network] = TYPES[body.at(0) ?? -1] ?? []
  if (!kind) return reject('wrong-chain', 'This is not a Monero address.')
  // A payment id makes the address longer, and only an integrated address has one.
  return (kind === 'integrated') === (text.length === 106)
    ? accept(text, kind, network)
    : reject('length', 'The address does not have the length of its type.')
}

export const monero: typeof unchecked.monero = /* @__PURE__ */ checked(
  unchecked.monero,
  checkAddress,
)
