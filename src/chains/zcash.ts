import {
  type AddressKind,
  type AddressResult,
  accept,
  badChecksum,
  checked,
  type Network,
  reject,
} from '../chain.js'
import { decodeBase58check } from './base58.js'
import { decodeBech32, wordsToBytes } from './bech32.js'
import * as unchecked from './unchecked.js'

/** The two bytes a transparent address starts with, and what they stand for. */
const TRANSPARENT: readonly (readonly [lead: number, kind: AddressKind, network?: Network])[] = [
  [0x1cb8, 'p2pkh'],
  [0x1cbd, 'p2sh'],
  [0x1d25, 'p2pkh', 'testnet'],
  [0x1cba, 'p2sh', 'testnet'],
]

type Encoding = readonly [kind: AddressKind, m: boolean, size?: number]
const SAPLING: Encoding = ['sapling', false, 43]
const TEX: Encoding = ['tex', true, 20]
const UNIFIED: Encoding = ['unified', true]

/**
 * bech32 prefix to the kind of address, the checksum it takes, BIP-350's for
 * the forms that came after Sapling, and its length in bytes. A unified
 * address (ZIP-316) has no fixed length, and starts with "u" or, since its
 * second revision, with "zu" or "tu". Prefixes with "test" are testnet's.
 */
const ENCODED: ReadonlyMap<string, Encoding> = /* @__PURE__ */ new Map([
  ['zs', SAPLING],
  ['ztestsapling', SAPLING],
  ['tex', TEX],
  ['textest', TEX],
  ['u', UNIFIED],
  ['utest', UNIFIED],
  ['zu', UNIFIED],
  ['zutest', UNIFIED],
  ['tu', UNIFIED],
  ['tutest', UNIFIED],
])

const foreign = () => reject('wrong-chain', 'This is not a Zcash address.')

function fromBase58(text: string): AddressResult {
  const payload = decodeBase58check(text, 26)
  if (!payload) return badChecksum()
  const lead = ((payload.at(0) ?? 0) << 8) | (payload.at(1) ?? 0)
  const [, kind, network] = TRANSPARENT.find(([start]) => start === lead) ?? []
  return kind ? accept(text, kind, network) : foreign()
}

/**
 * The checksum of a unified address is verified, and its length; the
 * receivers inside it, which only a wallet can use, are not decoded.
 */
function fromBech32(text: string): AddressResult {
  const lower = text.toLowerCase()
  if (text !== lower && text !== text.toUpperCase()) {
    return reject('format', 'A bech32 address is all lowercase or all uppercase.')
  }
  const prefix = lower.slice(0, lower.lastIndexOf('1'))
  const [kind, m, size] = ENCODED.get(prefix) ?? []
  if (!kind) return foreign()
  const decoded = decodeBech32(lower, Number.POSITIVE_INFINITY)
  const bytes = decoded && decoded.m === m ? wordsToBytes(decoded.words) : undefined
  if (!bytes) return badChecksum()
  // ZIP-316: a unified address holds 38 bytes at least.
  return bytes.length === size || (size === undefined && bytes.length >= 38)
    ? accept(lower, kind, prefix.includes('test') ? 'testnet' : 'mainnet')
    : reject('length', 'The address holds the wrong number of bytes.')
}

function checkAddress(text: string): AddressResult {
  if (/^t[1-9A-HJ-NP-Za-km-z]{34}$/.test(text)) return fromBase58(text)
  if (/^z[ct][1-9A-HJ-NP-Za-km-z]{93}$/.test(text)) {
    return reject('unsupported', 'Sprout addresses are retired: use a current address.')
  }
  if (/^[a-z]+1[02-9ac-hj-np-z]+$/i.test(text)) return fromBech32(text)
  return reject('format', 'This is not shaped like a Zcash address.')
}

export const zcash: typeof unchecked.zcash = /* @__PURE__ */ checked(unchecked.zcash, checkAddress)
