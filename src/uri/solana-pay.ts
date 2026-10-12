import type { UriReader, UriWriter } from '../chain.js'
import { fromQuery, splitQuery, take, toQuery } from './query.js'

/**
 * Solana Pay transfer request:
 * `solana:<address>?amount=<units>&spl-token=<mint>&label=...&message=...&memo=...`.
 * The amount is in display units of SOL or of the token, not in lamports.
 *
 * @internal
 */
export const solanaPay: UriWriter = {
  standard: 'Solana Pay',
  scheme: 'solana',
  carries: () => ['amount', 'token', 'label', 'message', 'memo'],

  encode({ address, amount, token, label, message, memo }) {
    const query = toQuery({ amount, 'spl-token': token?.address, label, message, memo })
    return query ? `solana:${address}${query}` : undefined
  },
}

/** @internal */
export const readSolanaPay: UriReader = (rest, chains) => {
  const [address, search] = splitQuery(rest)
  // Wallets read these URIs with a web URL parser, to which "+" is a space.
  const params = fromQuery(search, { form: true })
  const fields = params && take(params, 'amount', 'spl-token', 'label', 'message', 'memo')
  if (!fields) return undefined
  const [amount, token, label, message, memo] = fields
  // The specification wants a digit on each side of the point.
  if (amount !== undefined && !/^\d+(?:\.\d+)?$/.test(amount)) return undefined
  return { chains, address, token, amount, label, message, memo }
}
