import type { UriReader, UriWriter } from '../chain.js'
import { fromQuery, splitQuery, take } from './query.js'

/**
 * CIP-13 payment URI: `web+cardano:<address>?amount=<ada>`. The amount is in whole ada.
 *
 * @internal
 */
export const cip13: UriWriter = {
  standard: 'CIP-13',
  scheme: 'web+cardano',
  carries: () => ['amount'],

  encode: ({ address, amount }) =>
    amount === undefined ? undefined : `web+cardano:${address}?amount=${amount}`,

  caveat: () => 'uri-support-varies',
}

/** @internal */
export const readCip13: UriReader = (rest, chains) => {
  // With an authority, as in "//stake", the URI asks for something other than a payment.
  if (rest.startsWith('//')) return undefined
  const [address, search] = splitQuery(rest)
  const params = fromQuery(search)
  const fields = params && take(params, 'amount')
  return fields && { chains, address, amount: fields[0] }
}
