import {
  type AddressKind,
  type AddressResult,
  accept,
  badChecksum,
  checked,
  reject,
} from '../chain.js'
import { crc16 } from './crc16.js'
import * as unchecked from './unchecked.js'

/** First byte of a user-friendly address, without its testnet bit. */
const TAGS: Readonly<Record<number, AddressKind>> = { 17: 'bounceable', 81: 'non-bounceable' }
const TESTNET_BIT = 0x80

/**
 * The user-friendly form: 36 bytes in base64, made of a tag, a workchain, a
 * 32-byte hash and a CRC-16 of all that comes before it.
 */
function checkAddress(text: string): AddressResult {
  if (/^-?\d+:[0-9a-f]{64}$/i.test(text)) {
    const hint = 'Raw TON addresses are not supported: use the form that starts with UQ or EQ.'
    return reject('unsupported', hint)
  }
  if (!/^[\w+/-]{48}$/.test(text)) {
    return reject('format', 'A TON address has 48 characters and usually starts with UQ or EQ.')
  }
  const standard = text.replaceAll('-', '+').replaceAll('_', '/')
  const bytes = Uint8Array.from(atob(standard), (char) => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  if (crc16(bytes.subarray(0, 34)) !== view.getUint16(34)) return badChecksum()
  const tag = view.getUint8(0)
  const kind = TAGS[tag & ~TESTNET_BIT]
  const workchain = view.getInt8(1)
  // Only the basechain (0) and the masterchain (-1) exist.
  if (!kind || workchain < -1 || workchain > 0) {
    return reject('unsupported', 'Unknown TON address type.')
  }
  const urlSafe = text.replaceAll('+', '-').replaceAll('/', '_')
  return accept(urlSafe, kind, tag & TESTNET_BIT ? 'testnet' : 'mainnet')
}

export const ton: typeof unchecked.ton = /* @__PURE__ */ checked(unchecked.ton, checkAddress)
