import {
  type AddressKind,
  type AddressResult,
  accept,
  badChecksum,
  type Chain,
  checked,
  type Network,
  reject,
} from '../chain.js'
import { decodeBase58check } from './base58.js'
import { decodeBech32, wordsToBytes } from './bech32.js'
import * as unchecked from './unchecked.js'

/** What a base58check version byte stands for. `legacy` marks a form wallets no longer produce. */
type Version = readonly [kind: 'p2pkh' | 'p2sh', network?: Network, legacy?: 'legacy-format']

interface Formats {
  /** bech32 prefixes, mainnet first and test networks after. None when the chain has no SegWit. */
  hrps?: readonly string[]
  /** bech32 prefixes of the forms that are not handled, each with what to say of it. */
  unsupported?: Readonly<Record<string, string>>
  versions: Readonly<Record<number, Version>>
}

/** Witness version to program length in bytes to address type (BIP-141, BIP-341). */
const PROGRAMS: Readonly<Record<number, Readonly<Record<number, AddressKind>>>> = {
  0: { 20: 'p2wpkh', 32: 'p2wsh' },
  1: { 32: 'p2tr' },
}

/** A version byte and a 20-byte hash come out as 26 to 35 characters. */
const BASE58CHECK = /^[1-9A-HJ-NP-Za-km-z]{26,35}$/
const BECH32 = /^[a-z]+1[02-9ac-hj-np-z]+$/i

/** Gives a chain the check of Bitcoin's address formats: base58check and, with `hrps`, SegWit. */
function bitcoinLike<C extends Chain>(
  chain: C,
  { hrps = [], unsupported = {}, versions }: Formats,
): C {
  const foreign = () => reject('wrong-chain', `This is not a ${chain.name} address.`)

  function fromBase58(text: string): AddressResult {
    const payload = decodeBase58check(text)
    if (!payload) return badChecksum()
    const [kind, network, legacy] = versions[payload.at(0) ?? -1] ?? []
    return kind ? accept(text, kind, network, legacy && [legacy]) : foreign()
  }

  function fromBech32(text: string): AddressResult {
    const lower = text.toLowerCase()
    if (text !== lower && text !== text.toUpperCase()) {
      return reject('format', 'A bech32 address is all lowercase or all uppercase.')
    }
    const prefix = lower.slice(0, lower.indexOf('1'))
    const hint = Object.hasOwn(unsupported, prefix) ? unsupported[prefix] : undefined
    if (hint) return reject('unsupported', hint)
    const network = hrps.indexOf(prefix)
    if (network === -1) return foreign()

    const decoded = decodeBech32(lower)
    if (!decoded) return badChecksum()
    const [version, ...data] = decoded.words
    const program = wordsToBytes(data)
    if (version === undefined || version > 16 || !program) {
      return reject('format', 'This does not hold a witness version and its program.')
    }
    // BIP-350: witness version 0 is checksummed with bech32, later versions with bech32m.
    if ((version === 0) === decoded.m) {
      return reject('checksum', 'The checksum type does not match the witness version.')
    }

    const kind = PROGRAMS[version]?.[program.length]
    if (kind) return accept(lower, kind, network ? 'testnet' : 'mainnet')
    // BIP-141: a program is 2 to 40 bytes, and one of version 0 is 20 or 32.
    return version === 0 || program.length < 2 || program.length > 40
      ? reject('length', 'The witness program has the wrong length.')
      : reject('unsupported', `Witness version ${version} is not in use with this length.`)
  }

  return checked(chain, (text) => {
    // base58check goes first: a bech32 shape can also be spelled with its alphabet.
    if (BASE58CHECK.test(text)) return fromBase58(text)
    if (BECH32.test(text)) return fromBech32(text)
    return reject('format', `This is not shaped like a ${chain.name} address.`)
  })
}

export const bitcoin: typeof unchecked.bitcoin = /* @__PURE__ */ bitcoinLike(unchecked.bitcoin, {
  hrps: ['bc', 'tb', 'bcrt'],
  versions: {
    0: ['p2pkh'],
    5: ['p2sh'],
    111: ['p2pkh', 'testnet'],
    196: ['p2sh', 'testnet'],
  },
})

const MWEB = 'MWEB addresses are not supported: use one that starts with "ltc1", "L" or "M".'

export const litecoin: typeof unchecked.litecoin = /* @__PURE__ */ bitcoinLike(unchecked.litecoin, {
  hrps: ['ltc', 'tltc', 'rltc'],
  unsupported: { ltcmweb: MWEB, tmweb: MWEB },
  versions: {
    48: ['p2pkh'],
    50: ['p2sh'],
    // "3..." script addresses predate the "M..." form and collide with Bitcoin's.
    5: ['p2sh', 'mainnet', 'legacy-format'],
    111: ['p2pkh', 'testnet'],
    58: ['p2sh', 'testnet'],
    196: ['p2sh', 'testnet', 'legacy-format'],
  },
})

/** Dogecoin has no SegWit. */
export const dogecoin: typeof unchecked.dogecoin = /* @__PURE__ */ bitcoinLike(unchecked.dogecoin, {
  versions: {
    30: ['p2pkh'],
    22: ['p2sh'],
    113: ['p2pkh', 'testnet'],
    196: ['p2sh', 'testnet'],
  },
})
