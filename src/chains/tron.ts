import { type AddressResult, accept, badChecksum, checked, reject } from '../chain.js'
import { decodeBase58check } from './base58.js'
import * as unchecked from './unchecked.js'

/** base58check with the version byte 0x41, which makes every address start with "T". */
function checkAddress(text: string): AddressResult {
  if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(text)) {
    return reject('format', 'A Tron address starts with "T" and has 34 characters.')
  }
  const payload = decodeBase58check(text)
  if (!payload) return badChecksum()
  // A few other version bytes also give 34 characters that start with "T".
  return payload.at(0) === 0x41
    ? accept(text, 'account')
    : reject('wrong-chain', 'This is not a Tron address.')
}

export const tron: typeof unchecked.tron = /* @__PURE__ */ checked(unchecked.tron, checkAddress)
