import { type AddressResult, accept, badChecksum, checked, reject } from '../chain.js'
import { decodeBase58check, RIPPLE } from './base58.js'
import * as unchecked from './unchecked.js'

/**
 * A classic address: base58check in the ledger's own alphabet. Its version
 * byte is 0, which that alphabet writes "r": the first letter of every address.
 */
function checkAddress(text: string): AddressResult {
  if (/^[XT][1-9A-HJ-NP-Za-km-z]{46}$/.test(text)) {
    const hint = 'X-addresses are not supported: use the address that starts with "r" and its tag.'
    return reject('unsupported', hint)
  }
  if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(text)) {
    return reject('format', 'An XRP Ledger address starts with "r" and has 25 to 35 characters.')
  }
  return decodeBase58check(text, 25, RIPPLE) ? accept(text, 'account') : badChecksum()
}

export const xrp: typeof unchecked.xrp = /* @__PURE__ */ checked(unchecked.xrp, checkAddress)
