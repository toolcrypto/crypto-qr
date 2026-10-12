import {
  type AddressKind,
  type AddressResult,
  accept,
  badChecksum,
  checked,
  reject,
} from '../chain.js'
import { wordsToBytes } from './bech32.js'
import { crc16 } from './crc16.js'
import * as unchecked from './unchecked.js'

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Version byte to the kind of address and its length in bytes (SEP-23): 6 << 3
 * for an account, 12 << 3 for a muxed one.
 */
const VERSIONS: Readonly<Record<number, readonly [kind: AddressKind, size: number]>> = {
  48: ['account', 35],
  96: ['muxed', 43],
}

/**
 * A strkey: base32 of a version byte, a public key, for a muxed account an
 * 8-byte id, then a CRC-16 of all that, low byte first.
 */
function checkAddress(text: string): AddressResult {
  if (/^S[A-Z2-7]{55}$/.test(text)) {
    return reject('format', 'This is a secret key, not an address: keep it to yourself.')
  }
  if (!/^[GM][A-Z2-7]+$/.test(text) || (text.length !== 56 && text.length !== 69)) {
    return reject('format', 'A Stellar address starts with "G" and has 56 characters.')
  }
  // Base32 groups bits by five, as bech32 does: spare bits at the end must be zeros.
  const bytes = wordsToBytes(Array.from(text, (char) => BASE32.indexOf(char)))
  const [kind, size] = VERSIONS[bytes?.at(0) ?? -1] ?? []
  if (!bytes || !kind || bytes.length !== size) {
    return reject('format', 'This is not a Stellar account address.')
  }
  const checksum = (bytes.at(-2) ?? 0) | ((bytes.at(-1) ?? 0) << 8)
  return crc16(bytes.subarray(0, -2)) === checksum ? accept(text, kind) : badChecksum()
}

export const stellar: typeof unchecked.stellar = /* @__PURE__ */ checked(
  unchecked.stellar,
  checkAddress,
)
