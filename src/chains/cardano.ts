import {
  type AddressKind,
  type AddressResult,
  accept,
  badChecksum,
  checked,
  reject,
} from '../chain.js'
import { decodeBech32, wordsToBytes } from './bech32.js'
import * as unchecked from './unchecked.js'

/** bech32 prefixes of payment addresses: mainnet, then the test networks. */
const PREFIXES = ['addr', 'addr_test']

/**
 * Header type, the high half of the first byte, to the kind of address and
 * its length in bytes (CIP-19). A pointer adds three numbers, of one byte or
 * more each, to the 29 bytes of an enterprise address.
 */
const TYPES: readonly (readonly [kind: AddressKind, size?: number])[] = [
  ['base', 57],
  ['base', 57],
  ['base', 57],
  ['base', 57],
  ['pointer'],
  ['pointer'],
  ['enterprise', 29],
  ['enterprise', 29],
]

/** A Shelley address: bech32 without a length limit, over a header byte and one or two hashes. */
function checkAddress(text: string): AddressResult {
  if (/^(?:Ae2|DdzFF)[1-9A-HJ-NP-Za-km-z]+$/.test(text)) {
    const hint = 'Byron addresses are not supported: use one that starts with "addr1".'
    return reject('unsupported', hint)
  }
  const lower = text.toLowerCase()
  if (
    !/^[a-z_]+1[02-9ac-hj-np-z]+$/.test(lower) ||
    (text !== lower && text !== text.toUpperCase())
  ) {
    return reject('format', 'A Cardano address starts with "addr1".')
  }
  const prefix = lower.slice(0, lower.lastIndexOf('1'))
  if (prefix.startsWith('stake')) {
    const hint = 'A stake address cannot be paid: use the address that starts with "addr1".'
    return reject('unsupported', hint)
  }
  const network = PREFIXES.indexOf(prefix)
  if (network === -1) return reject('wrong-chain', 'This is not a Cardano address.')

  const decoded = decodeBech32(lower, Number.POSITIVE_INFINITY)
  const bytes = decoded && !decoded.m ? wordsToBytes(decoded.words) : undefined
  if (!bytes) return badChecksum()
  const header = bytes.at(0) ?? 0xff
  const [kind, size] = TYPES[header >> 4] ?? []
  const sized = size === undefined ? bytes.length >= 32 : bytes.length === size
  // The low half of the header is the network: 1 for mainnet, 0 for a test network.
  if (!kind || !sized || (header & 15) !== 1 - network) {
    return reject('format', 'The address does not hold what its first byte announces.')
  }
  return accept(lower, kind, network ? 'testnet' : 'mainnet')
}

export const cardano: typeof unchecked.cardano = /* @__PURE__ */ checked(
  unchecked.cardano,
  checkAddress,
)
