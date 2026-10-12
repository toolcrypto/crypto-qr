export const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]
/** What the checksum of valid text comes to: 1 in BIP-173, this constant in BIP-350. */
const BECH32M = 0x2bc830a3

/** The BCH checksum of BIP-173 over 5-bit values. */
function polymod(values: readonly number[]): number {
  let checksum = 1
  for (const value of values) {
    const top = checksum >>> 25
    checksum = ((checksum & 0x1ffffff) << 5) ^ value
    for (const [bit, generator] of GENERATOR.entries()) if ((top >>> bit) & 1) checksum ^= generator
  }
  return checksum
}

/**
 * Decodes lowercase bech32 text into its 5-bit words, checksum left out. `m`
 * tells which checksum it had: BIP-350's, or BIP-173's. Undefined when the
 * text is malformed or the checksum is neither. BIP-173 caps the text at 90
 * characters; the formats built on it elsewhere do not.
 */
export function decodeBech32(
  text: string,
  limit: number = 90,
): { words: number[]; m: boolean } | undefined {
  const separator = text.lastIndexOf('1')
  const data = Array.from(text.slice(separator + 1), (char) => BECH32.indexOf(char))
  if (separator < 1 || text.length > limit || data.length < 6 || data.includes(-1)) return undefined
  const prefix = Array.from(text.slice(0, separator), (char) => char.charCodeAt(0))
  const expanded = [...prefix.map((code) => code >> 5), 0, ...prefix.map((code) => code & 31)]
  const checksum = polymod([...expanded, ...data])
  return checksum === 1 || checksum === BECH32M
    ? { words: data.slice(0, -6), m: checksum === BECH32M }
    : undefined
}

/** Regroups 5-bit words into bytes. Undefined when the padding is not a few zero bits. */
export function wordsToBytes(words: readonly number[]): Uint8Array | undefined {
  const bytes: number[] = []
  let [buffer, bits] = [0, 0]
  for (const word of words) {
    buffer = ((buffer & 0xff) << 5) | word
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  // BIP-173: what is left over must be under five bits, all zeros.
  return bits < 5 && (buffer & ((1 << bits) - 1)) === 0 ? Uint8Array.from(bytes) : undefined
}
