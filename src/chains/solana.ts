import { type AddressResult, accept, checked, reject } from '../chain.js'
import { decodeBase58 } from './base58.js'
import * as unchecked from './unchecked.js'

/** Field prime of ed25519. */
const P = 2n ** 255n - 19n
/** Curve constant d = -121665/121666 mod p. */
const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n

/** `base` to the power `exponent`, modulo p. */
function powMod(base: bigint, exponent: bigint): bigint {
  let result = 1n
  let square = base % P
  for (let bits = exponent; bits > 0n; bits >>= 1n) {
    if (bits & 1n) result = (result * square) % P
    square = (square * square) % P
  }
  return result
}

/** Whether 32 bytes encode an ed25519 point (RFC 8032, section 5.1.3), as every wallet key does. */
function isCurvePoint(bytes: Uint8Array): boolean {
  // Little-endian: 255 bits of y, then the sign of x.
  const encoded = bytes.reduceRight((value, byte) => (value << 8n) | BigInt(byte), 0n)
  const y = encoded & ((1n << 255n) - 1n)
  if (y >= P) return false
  const y2 = (y * y) % P
  // The curve gives x^2 = (y^2 - 1) / (d y^2 + 1). By Euler's criterion that
  // has a root exactly when numerator times denominator is 0 or a square.
  const euler = powMod((y2 + P - 1n) * (D * y2 + 1n), (P - 1n) / 2n)
  // x = 0 has no sign, so its sign bit must be clear.
  return euler === 1n || (euler === 0n && encoded >> 255n === 0n)
}

/**
 * Solana addresses carry no checksum. The curve test is the only signal there
 * is: it cannot prove an address right, but it flags about half of all typos.
 */
function checkAddress(text: string): AddressResult {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) {
    return reject('format', 'A Solana address is 32 to 44 base58 characters.')
  }
  const bytes = decodeBase58(text, 32)
  if (!bytes) {
    return reject('length', 'A Solana address decodes to 32 bytes; this one does not.')
  }
  return accept(text, 'account', 'mainnet', isCurvePoint(bytes) ? [] : ['off-curve'])
}

export const solana: typeof unchecked.solana = /* @__PURE__ */ checked(
  unchecked.solana,
  checkAddress,
)
