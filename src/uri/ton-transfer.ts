import type { UriReader, UriWriter } from '../chain.js'
import { fromQuery, take, toQuery } from './query.js'

/**
 * TON transfer link:
 * `ton://transfer/<address>?jetton=<master>&amount=<units>&text=<comment>`.
 * The amount is in nanograms, or in the jetton's smallest unit when one is named.
 *
 * @internal
 */
export const tonTransfer: UriWriter = {
  standard: 'TON transfer link',
  scheme: 'ton',
  carries: () => ['amount', 'token', 'memo'],

  encode({ address, token, atomic, memo }) {
    const query = toQuery({ jetton: token?.address, amount: atomic?.toString(), text: memo })
    return query ? `ton://transfer/${address}${query}` : undefined
  },

  caveat: () => 'uri-support-varies',
}

/** @internal */
export const readTonTransfer: UriReader = (rest, chains) => {
  const [, address, search = ''] = /^\/\/transfer\/([^?]+)\??(.*)$/.exec(rest) ?? []
  const params = fromQuery(search, { form: true })
  // A binary body or a contract to deploy makes the link more than a payment.
  if (!address || !params || params.has('bin') || params.has('init')) return undefined
  const fields = take(params, 'jetton', 'amount', 'text')
  if (!fields) return undefined
  const [token, atomic, memo] = fields
  if (atomic !== undefined && !/^\d+$/.test(atomic)) return undefined
  return { chains, address, token, atomic, memo }
}
