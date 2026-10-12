import { sha256 } from '@noble/hashes/sha2.js'

export const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
/** The XRP Ledger's own ordering of the same characters. */
export const RIPPLE = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'

/** Decodes base58 text into `size` bytes. Undefined when it does not stand for that many. */
export function decodeBase58(
  text: string,
  size: number,
  alphabet: string = BASE58,
): Uint8Array | undefined {
  let value = 0n
  for (const char of text) {
    const digit = alphabet.indexOf(char)
    if (digit === -1) return undefined
    value = value * 58n + BigInt(digit)
  }
  const bytes = new Uint8Array(size)
  for (let at = size - 1; at >= 0; at--) {
    bytes[at] = Number(value & 0xffn)
    value >>= 8n
  }
  // Each leading zero digit stands for one zero byte, and nothing else does.
  let [digits, zeros] = [0, 0]
  while (text.charAt(digits) === alphabet.charAt(0)) digits++
  while (bytes[zeros] === 0) zeros++
  return value === 0n && digits === zeros ? bytes : undefined
}

/**
 * Decodes base58check text of `size` bytes, checksum included, into what
 * comes before the checksum: for an address, a version and a hash. Undefined
 * when a character, the length or the checksum is wrong.
 */
export function decodeBase58check(
  text: string,
  size: number = 25,
  alphabet: string = BASE58,
): Uint8Array | undefined {
  const bytes = decodeBase58(text, size, alphabet)
  if (!bytes) return undefined
  const payload = bytes.subarray(0, -4)
  const checksum = sha256(sha256(payload))
  return bytes.subarray(-4).every((byte, at) => byte === checksum[at]) ? payload : undefined
}
