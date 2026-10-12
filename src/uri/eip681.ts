import type { UriReader, UriWriter } from '../chain.js'
import { fromQuery, take, toQuery } from './query.js'

/** What follows `ethereum:`: an address, then if any a chain id, a function to call and a query. */
const SHAPE = /^(?:pay-)?(0x[0-9a-fA-F]{40})(?:@(\d+))?(?:\/(\w+))?(?:\?(.*))?$/

/**
 * Reads an EIP-681 number, which may have a decimal point and an exponent
 * ("2.014e18"), as a whole number. Undefined when it is not one.
 */
function wholeNumber(text: string): string | undefined {
  const match = /^\+?(\d*)(?:\.(\d+))?(?:e(\d{0,3}))?$/i.exec(text)
  if (!match) return undefined
  const [, whole = '', fraction = '', exponent = ''] = match
  const digits = whole + fraction
  if (!digits) return undefined
  const shift = Number(exponent) - fraction.length
  if (shift >= 0) return digits + '0'.repeat(shift)
  // Whatever the exponent leaves behind the point must be zeros.
  return /^0*$/.test(digits.slice(shift)) ? digits.slice(0, shift) || '0' : undefined
}

/**
 * EIP-681, shared by every EVM chain:
 * `ethereum:<address>@<chain id>?value=<wei>` for the native coin and
 * `ethereum:<token>@<chain id>/transfer?address=<payee>&uint256=<units>` for a
 * token. Amounts are in the smallest unit.
 *
 * The chain id is always written. Without one, the standard leaves the choice
 * to "the client's current network": the payer's wallet would send on
 * whichever chain it happens to be on.
 *
 * @internal
 */
export const eip681 = (chainId: number): UriWriter => ({
  standard: 'EIP-681',
  scheme: 'ethereum',
  carries: () => ['amount', 'token'],

  encode({ address, token, atomic }) {
    // Without an amount the URI says nothing a bare address does not.
    if (atomic === undefined) return undefined
    return token
      ? `ethereum:${token.address}@${chainId}/transfer${toQuery({ address, uint256: `${atomic}` })}`
      : `ethereum:${address}@${chainId}${toQuery({ value: `${atomic}` })}`
  },

  caveat: ({ token }) => (token ? 'erc20-uri-risk' : 'uri-support-varies'),
})

/** @internal */
export const readEip681: UriReader = (rest, chains) => {
  const [, target, id, call, search = ''] = SHAPE.exec(rest) ?? []
  const params = fromQuery(search)
  if (!target || !params || (call !== undefined && call !== 'transfer')) return undefined
  const fields = take(params, call ? 'uint256' : 'value', 'address')
  if (!fields) return undefined
  const [amount, payee = ''] = fields
  const atomic = amount === undefined ? undefined : wholeNumber(amount)
  if (amount !== undefined && atomic === undefined) return undefined
  // A URI without a chain id is for whichever EVM chain the payer's wallet is on.
  const on = id === undefined ? chains : chains.filter((chain) => chain.evmChainId === Number(id))
  return call
    ? { chains: on, address: payee, token: target, atomic }
    : { chains: on, address: target, atomic }
}
