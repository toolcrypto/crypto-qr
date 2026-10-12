import type { UriReader, UriWriter } from '../chain.js'
import { fromQuery, splitQuery, take, toQuery } from './query.js'

/**
 * BIP-321 for Bitcoin, and BIP-21, which it replaced there, for the coins that
 * took it up under a scheme of their own:
 * `<scheme>:<address>?amount=<coins>&label=<payee>&message=<note>`. The amount
 * is in whole coins. A `prefixed` address already starts with its scheme, as
 * CashAddr does: it is a URI as it stands.
 *
 * @internal
 */
export const bip321 = (scheme: string, prefixed = false): UriWriter => ({
  standard: scheme === 'bitcoin' ? 'BIP-321' : 'BIP-21',
  scheme,
  carries: () => ['amount', 'label', 'message'],

  encode({ address, amount, label, message }) {
    const query = toQuery({ amount, label, message })
    if (prefixed) return address + query
    return query ? `${scheme}:${address}${query}` : undefined
  },
})

/** @internal */
export const readBip321: UriReader = (rest, chains) => {
  const [address, search] = splitQuery(rest)
  // Keys are case-insensitive: a URI is often written in capitals to make a denser QR code.
  const params = fromQuery(search, { caseless: true })
  // A payer must refuse a URI with a required parameter it does not understand.
  if (!params || [...params.keys()].some((key) => key.startsWith('req-'))) return undefined
  const fields = take(params, 'amount', 'label', 'message')
  if (!fields) return undefined
  const [amount, label, message] = fields
  return { chains, address, amount, label, message }
}
