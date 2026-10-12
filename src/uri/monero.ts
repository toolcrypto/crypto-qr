import type { UriReader, UriWriter } from '../chain.js'
import { fromQuery, splitQuery, take, toQuery } from './query.js'

/**
 * Monero URI, as its reference wallet writes it:
 * `monero:<address>?tx_amount=<xmr>&recipient_name=<payee>&tx_description=<note>`.
 * The amount is in whole monero.
 *
 * @internal
 */
export const moneroUri: UriWriter = {
  standard: 'Monero URI',
  scheme: 'monero',
  carries: () => ['amount', 'label', 'message'],

  encode({ address, amount, label, message }) {
    const query = toQuery({ tx_amount: amount, recipient_name: label, tx_description: message })
    return query ? `monero:${address}${query}` : undefined
  },
}

/** @internal */
export const readMoneroUri: UriReader = (rest, chains) => {
  const [address, search] = splitQuery(rest)
  const params = fromQuery(search)
  const fields = params && take(params, 'tx_amount', 'recipient_name', 'tx_description')
  if (!fields) return undefined
  const [amount, label, message] = fields
  return { chains, address, amount, label, message }
}
