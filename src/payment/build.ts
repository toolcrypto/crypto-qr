import { AmountError, formatAmount, isDecimals, MAX_DECIMALS, parseAmount } from '../amount.js'
import type { Draft, PaymentField, Token } from '../chain.js'
import type { Payment, PaymentIssue, PaymentRequest, PaymentWarning } from './types.js'

/** What `buildPayment` throws: `field` is the input at fault, `code` what is wrong with it. */
export class PaymentError extends Error {
  override readonly name = 'PaymentError'
  /** The input that is wrong. */
  readonly field: 'address' | 'amount' | 'token'
  readonly code: PaymentIssue

  constructor(field: PaymentError['field'], code: PaymentIssue, message: string) {
    super(message)
    this.field = field
    this.code = code
  }
}

/**
 * How a payment gets to rely on the address of its payee or of its token: the
 * chain checks it, or it is taken on trust. Everything that takes knowing the
 * address is decided here, so that nothing of it weighs on a build that does
 * not check.
 *
 * @internal
 */
export type Vouch = (
  address: string,
  request: PaymentRequest,
  field: 'address' | 'token',
) =>
  | { valid: true; address: string; warnings: readonly PaymentWarning[] }
  | { valid: false; code: PaymentIssue; message: string }

const FIELDS: readonly PaymentField[] = ['amount', 'token', 'label', 'message', 'memo']

function fail(...args: ConstructorParameters<typeof PaymentError>): never {
  throw new PaymentError(...args)
}

function resolveToken(request: PaymentRequest, vouch: Vouch): Token | undefined {
  const { chain, token } = request
  if (!token || token === chain.symbol) return undefined
  if (typeof token === 'string') {
    const listed = Object.hasOwn(chain.tokens, token) ? chain.tokens[token] : undefined
    if (listed) return { ...listed, symbol: token }
    const tickers = Object.keys(chain.tokens).join(', ') || 'none'
    fail('token', 'unknown-token', `${token} is not listed on ${chain.name} (listed: ${tickers}).`)
  }
  const vouched = vouch(token.address, request, 'token')
  if (!vouched.valid) fail('token', vouched.code, `Token address: ${vouched.message}`)
  if (!isDecimals(token.decimals)) {
    fail('token', 'decimals', `Token decimals must be a whole number from 0 to ${MAX_DECIMALS}.`)
  }
  return { address: vouched.address, decimals: token.decimals, symbol: token.symbol }
}

function resolveAmount(amount: string | undefined, decimals: number): bigint | undefined {
  if (!amount?.trim()) return undefined
  let atomic: bigint
  try {
    atomic = parseAmount(amount, decimals)
  } catch (error) {
    if (error instanceof AmountError) fail('amount', error.code, error.message)
    throw error
  }
  return atomic || fail('amount', 'zero', 'The amount must be greater than zero.')
}

/**
 * Turns a payment request into the text to put in a QR code, relying on its
 * addresses the way given.
 *
 * @internal
 */
export function build(request: PaymentRequest, vouch: Vouch): Payment {
  const { chain } = request
  const payee = vouch(request.address, request, 'address')
  if (!payee.valid) fail('address', payee.code, payee.message)

  const token = resolveToken(request, vouch)
  const decimals = token?.decimals ?? chain.decimals
  const atomic = resolveAmount(request.amount, decimals)
  const draft: Draft = {
    address: payee.address,
    token,
    atomic,
    amount: atomic === undefined ? undefined : formatAmount(atomic, decimals),
    label: request.label?.trim() || undefined,
    message: request.message?.trim() || undefined,
    memo: request.memo?.trim() || undefined,
  }

  const carried = chain.uri?.carries(draft) ?? []
  // A link that cannot name the token would ask for its amount in the native coin instead.
  const text = !token || carried.includes('token') ? chain.uri?.encode(draft) : undefined
  // A bare address carries nothing; a URI carries what its standard has a place for.
  const writer = text === undefined ? undefined : chain.uri
  const warnings: PaymentWarning[] = [...payee.warnings]
  for (const field of FIELDS) {
    if (draft[field] !== undefined && !(writer && carried.includes(field))) {
      warnings.push(`${field}-not-encoded`)
    }
  }
  const caveat = writer?.caveat?.(draft)
  if (caveat) warnings.push(caveat)

  return {
    text: text ?? draft.address,
    standard: writer?.standard,
    address: draft.address,
    token,
    amount: draft.amount,
    atomicAmount: atomic?.toString(),
    warnings,
  }
}
