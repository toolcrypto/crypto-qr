import { sha256 } from '@noble/hashes/sha2.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import { base32, base58xmr, base58xrp, base64url, bech32, createBase58check } from '@scure/base'

// Addresses written from bytes by code the library does not contain. The tests
// hold what the library reads against what these write.

export const base58check: ReturnType<typeof createBase58check> = createBase58check(sha256)

const join = (parts: readonly Uint8Array[]) => parts.flatMap((part) => [...part])

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index << 8
  for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
  return crc & 0xffff
})

/** CRC-16/XMODEM from a table, unlike the bitwise one the library has. */
export const crc16 = (data: Uint8Array): number =>
  data.reduce((crc, byte) => ((crc << 8) ^ (CRC_TABLE[(crc >> 8) ^ byte] ?? 0)) & 0xffff, 0)

/** EIP-55, written from its specification: an EVM address from its 40 digits in lowercase. */
export function eip55(lowerDigits: string): string {
  const hash = bytesToHex(keccak_256(utf8ToBytes(lowerDigits)))
  const cased = [...lowerDigits].map((digit, at) =>
    Number.parseInt(hash.charAt(at), 16) >= 8 ? digit.toUpperCase() : digit,
  )
  return `0x${cased.join('')}`
}

/** base58check in the XRP Ledger's alphabet: the bytes, then four of their double SHA-256. */
export const xrpEncode = (payload: Uint8Array): string =>
  base58xrp.encode(Uint8Array.of(...payload, ...sha256(sha256(payload)).subarray(0, 4)))

/**
 * A Monero address: a type byte, a spend key and a view key, for an integrated
 * address a payment id, then four bytes of their Keccak-256.
 */
export function moneroAddress(type: number, ...parts: Uint8Array[]): string {
  const body = Uint8Array.of(type, ...join(parts))
  return base58xmr.encode(Uint8Array.of(...body, ...keccak_256(body).subarray(0, 4)))
}

/** A Stellar strkey: a version byte and what it stands for, then their CRC-16, low byte first. */
export function strkey(version: number, ...parts: Uint8Array[]): string {
  const body = Uint8Array.of(version, ...join(parts))
  const crc = crc16(body)
  return base32.encode(Uint8Array.of(...body, crc & 0xff, crc >> 8)).replaceAll('=', '')
}

/** A user-friendly TON address: a tag, a workchain and a hash, then the CRC-16 of the three. */
export function tonAddress(tag: number, hash: Uint8Array, workchain = 0): string {
  const body = Uint8Array.of(tag, workchain, ...hash)
  const crc = crc16(body)
  return base64url.encode(Uint8Array.of(...body, crc >> 8, crc & 0xff))
}

/** A Shelley address of Cardano: bech32 without a length limit, over a header byte and the rest. */
export const shelley = (prefix: string, header: number, body: Uint8Array): string =>
  bech32.encode(prefix, bech32.toWords(Uint8Array.of(header, ...body)), false)
