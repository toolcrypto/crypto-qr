import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import {
  buildPayment,
  type Chain,
  PaymentError,
  type PaymentRequest,
  type ValidAddress,
  validateAddress,
} from '../src/index.js'

/** The result for an address that has to be valid. */
export function valid(address: string, chain: Chain): ValidAddress {
  const result = validateAddress(address, chain)
  if (!result.valid) throw new Error(`${address} was refused: ${result.message}`)
  return result
}

/** The code an address is refused with, or "valid". */
export function code(address: string, chain: Chain): string {
  const result = validateAddress(address, chain)
  return result.valid ? 'valid' : result.code
}

/** The `field:code` a request is refused with, or "accepted". */
export function refusal(
  request: PaymentRequest,
  build: typeof buildPayment = buildPayment,
): string {
  try {
    build(request)
  } catch (error) {
    if (error instanceof PaymentError) return `${error.field}:${error.code}`
    throw error
  }
  return 'accepted'
}

// What follows gives the bytes that test/encoders.ts turns into addresses, and
// damages those addresses one character at a time.

/** How many addresses a test builds for each form. */
export const SAMPLES = 200
export const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
export const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
export const HEX = '0123456789abcdef'

/** Reproducible bytes, 32 at most: the hash of a label. */
export const bytes = (label: string, length = 32): Uint8Array =>
  sha256(utf8ToBytes(label)).subarray(0, length)

const pick = (label: string, below: number) => (bytes(label).at(0) ?? 0) % below

/** The same text with one character, at `from` or after, replaced by another of its alphabet. */
export function typo(text: string, alphabet: string, label: string, from = 0): string {
  const at = from + pick(`${label} position`, text.length - from)
  const others = [...alphabet].filter((char) => char !== text.charAt(at))
  const other = others.at(pick(`${label} character`, others.length)) ?? ''
  return text.slice(0, at) + other + text.slice(at + 1)
}
