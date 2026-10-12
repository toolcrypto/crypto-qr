import type { Draft, UriReader, UriWriter } from '../chain.js'
import { fromQuery, splitQuery, take, toQuery } from './query.js'

/**
 * The memo of a request in base64url, as ZIP-321 wants it. Undefined when the
 * URI cannot hold it: an address that starts with "t" is transparent, or may
 * be, and takes no memo; a shielded one takes 512 bytes at most.
 */
function memoOf({ address, memo = '' }: Draft): string | undefined {
  const bytes = new TextEncoder().encode(memo)
  if (address.startsWith('t') || bytes.length > 512) return undefined
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

/** The text of a memo written in base64url. Undefined when it is not 512 bytes of UTF-8 at most. */
function readMemo(encoded: string): string | undefined {
  if (!/^[\w-]*$/.test(encoded)) return undefined
  try {
    const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return bytes.length > 512 ? undefined : new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

/**
 * ZIP-321 payment request:
 * `zcash:<address>?amount=<zec>&label=<payee>&message=<note>&memo=<base64url>`.
 * The amount is in whole zcash.
 *
 * @internal
 */
export const zip321: UriWriter = {
  standard: 'ZIP-321',
  scheme: 'zcash',
  carries: (draft) =>
    memoOf(draft) === undefined
      ? ['amount', 'label', 'message']
      : ['amount', 'label', 'message', 'memo'],

  encode(draft) {
    const { address, amount, label, message, memo } = draft
    const query = toQuery({ amount, label, message, memo: memo && memoOf(draft) })
    return query ? `zcash:${address}${query}` : undefined
  },
}

/** @internal */
export const readZip321: UriReader = (rest, chains) => {
  const [address, search] = splitQuery(rest)
  // Percent-encoding is for labels and messages: not for a name, an amount or a memo.
  if (/(?:^|&)(?:[^=&]*|amount=[^&]*|memo=[^&]*)%/.test(search)) return undefined
  const params = fromQuery(search)
  // A required parameter that is not understood, or a second payee, cannot be honoured.
  const beyond = (key: string) => /^req-|^address$|\.\d+$/.test(key)
  if (!params || [...params.keys()].some(beyond)) return undefined
  const fields = take(params, 'amount', 'label', 'message', 'memo')
  if (!fields) return undefined
  const [amount, label, message, encoded] = fields
  // A digit before the point, eight at most after it, and no more zcash than can exist.
  const payable =
    amount === undefined || (/^\d+(?:\.\d{1,8})?$/.test(amount) && Number(amount) <= 21e6)
  const memo = encoded === undefined ? undefined : readMemo(encoded)
  // A memo that cannot be read, or sent to a transparent address, voids the request.
  const noted = encoded === undefined || (memo !== undefined && !address.startsWith('t'))
  return payable && noted ? { chains, address, amount, label, message, memo } : undefined
}
