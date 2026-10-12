import type { PaymentField, UriReader, UriWriter } from '../chain.js'
import { fromQuery, take, toQuery } from './query.js'

const PUBLIC_NETWORK = 'Public Global Stellar Network ; September 2015'
/** What an asset goes by, besides its issuer: 1 to 12 letters and digits. */
const ASSET_CODE = /^[a-z\d]{1,12}$/i

/**
 * How a memo is sent: a whole number under 2^64 as an id, which is what an
 * exchange hands out, anything else as text of 28 bytes at most. Undefined
 * when it is neither. A number written with leading zeros stays text, which
 * keeps them.
 */
function memoType(memo: string): 'MEMO_ID' | 'MEMO_TEXT' | undefined {
  if (/^(?:0|[1-9]\d{0,19})$/.test(memo) && BigInt(memo) < 2n ** 64n) return 'MEMO_ID'
  return new TextEncoder().encode(memo).length > 28 ? undefined : 'MEMO_TEXT'
}

/**
 * SEP-7 payment request:
 * `web+stellar:pay?destination=<address>&amount=<units>&asset_code=<ticker>`
 * `&asset_issuer=<issuer>&memo=<memo>&memo_type=<type>&msg=<note>`.
 * The amount is in display units. A token is named by its ticker and its issuer.
 *
 * @internal
 */
export const sep7: UriWriter = {
  standard: 'SEP-7',
  scheme: 'web+stellar',

  carries({ token, memo = '', message = '' }) {
    const fields: PaymentField[] = ['amount']
    if (ASSET_CODE.test(token?.symbol ?? '')) fields.push('token')
    if (memoType(memo)) fields.push('memo')
    // A note is 300 characters at most.
    if (message.length <= 300) fields.push('message')
    return fields
  },

  encode({ address, amount, token, memo, message }) {
    const type = memo === undefined ? undefined : memoType(memo)
    const request = {
      amount,
      asset_code: token?.symbol,
      asset_issuer: token?.address,
      memo: type && memo,
      memo_type: type,
      msg: message !== undefined && message.length > 300 ? undefined : message,
    }
    // Without anything to ask for, the URI says nothing a bare address does not.
    const asked = Object.values(request).some((value) => value !== undefined)
    return asked ? `web+stellar:pay${toQuery({ destination: address, ...request })}` : undefined
  },

  caveat: () => 'uri-support-varies',
}

/** @internal */
export const readSep7: UriReader = (rest, chains) => {
  const [, search] = /^pay\?(.*)$/.exec(rest) ?? []
  // Wallets read these URIs with a web URL parser, to which "+" is a space.
  const params = search === undefined ? undefined : fromQuery(search, { form: true })
  const fields =
    params &&
    take(
      params,
      'destination',
      'amount',
      'asset_code',
      'asset_issuer',
      'memo',
      'memo_type',
      'msg',
      'network_passphrase',
    )
  if (!fields) return undefined
  const [address = '', amount, symbol, token, memo, type = 'MEMO_TEXT', message, network] = fields
  // A ticker without its issuer names nothing, nor does an issuer alone. A
  // memo that is a hash is not one to show, and another network is not this chain.
  if (
    (symbol === undefined) !== (token === undefined) ||
    (memo !== undefined && type !== 'MEMO_TEXT' && type !== 'MEMO_ID') ||
    (network ?? PUBLIC_NETWORK) !== PUBLIC_NETWORK
  ) {
    return undefined
  }
  // Every asset on Stellar has 7 decimals.
  const decimals = token === undefined ? undefined : 7
  return { chains, address, token, symbol, decimals, amount, memo, message }
}
