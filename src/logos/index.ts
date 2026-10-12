import type { PaymentRequest } from '../payment/types.js'
import type { VectorLogo } from '../qr/logo.js'
import * as marks from './marks.js'

export * from './marks.js'

const MARKS: Readonly<Record<string, VectorLogo>> = marks

/**
 * The logo for a payment request: the token's when `token` is a ticker the
 * chain lists, otherwise the chain's. Undefined for a chain that has none
 * here. Importing this function brings in every logo; import one by name
 * (`bitcoinLogo`, `usdtLogo`, ...) to keep a bundle small.
 */
export function logoFor({
  chain,
  token,
}: Pick<PaymentRequest, 'chain' | 'token'>): VectorLogo | undefined {
  const listed = typeof token === 'string' && Object.hasOwn(chain.tokens, token)
  return MARKS[`${(listed ? token : chain.id).toLowerCase()}Logo`]
}
