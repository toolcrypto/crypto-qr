import { keccak_256 } from '@noble/hashes/sha3.js'
import { type AddressResult, accept, type Chain, checked, reject } from '../chain.js'
import * as unchecked from './unchecked.js'

/**
 * EIP-55: a hex digit is written in capitals when the matching hex digit of
 * the hash of the lowercase address is 8 or more, that is, has its high bit set.
 */
function checksum(lowerDigits: string): string {
  const hash = keccak_256(new TextEncoder().encode(lowerDigits))
  const cased = Array.from(lowerDigits, (digit, i) =>
    (hash.at(i >> 1) ?? 0) & (i % 2 ? 0x08 : 0x80) ? digit.toUpperCase() : digit,
  )
  return `0x${cased.join('')}`
}

/** The same account format on every EVM chain. */
function checkAddress(text: string): AddressResult {
  if (!/^0x[0-9a-fA-F]*$/.test(text)) {
    return reject('format', 'An EVM address is "0x" followed by 40 hexadecimal digits.')
  }
  if (text.length !== 42) {
    return reject('length', `An EVM address has 42 characters; this one has ${text.length}.`)
  }
  const digits = text.slice(2)
  const canonical = checksum(digits.toLowerCase())
  // A single-case address is valid but carries no checksum to verify.
  if (digits === digits.toLowerCase() || digits === digits.toUpperCase()) {
    return accept(canonical, 'account', 'mainnet', ['no-checksum'])
  }
  return text === canonical
    ? accept(canonical, 'account')
    : reject('checksum', 'The capital letters do not match the checksum: a character is wrong.')
}

const withCheck = <C extends Chain>(chain: C): C => checked(chain, checkAddress)

/**
 * Defines an EVM chain. Every one of them shares the address format and the
 * payment URIs, so a chain that is not listed here takes one line:
 * `evm({ id: 'linea', name: 'Linea', chainId: 59144 })`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function evm<Ticker extends string = never>(spec: unchecked.EvmSpec<Ticker>): Chain<Ticker> {
  return withCheck(unchecked.evm(spec))
}

export const ethereum: typeof unchecked.ethereum = /* @__PURE__ */ withCheck(unchecked.ethereum)
export const optimism: typeof unchecked.optimism = /* @__PURE__ */ withCheck(unchecked.optimism)
export const bsc: typeof unchecked.bsc = /* @__PURE__ */ withCheck(unchecked.bsc)
export const polygon: typeof unchecked.polygon = /* @__PURE__ */ withCheck(unchecked.polygon)
export const base: typeof unchecked.base = /* @__PURE__ */ withCheck(unchecked.base)
export const arbitrum: typeof unchecked.arbitrum = /* @__PURE__ */ withCheck(unchecked.arbitrum)
export const avalanche: typeof unchecked.avalanche = /* @__PURE__ */ withCheck(unchecked.avalanche)
