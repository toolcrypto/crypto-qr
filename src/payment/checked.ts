import { validateAddress } from '../address.js'
import { qrSvg, type SvgOptions } from '../qr/svg.js'
import { build, type Vouch } from './build.js'
import type { Payment, PaymentRequest } from './types.js'

/**
 * Checks an address on the chain of a request. That of a payee is also refused
 * on a test network, unless the request allows it, and when it is a listed
 * token's own: whatever is sent there is lost.
 */
const check: Vouch = (address, { chain, allowTestnet }, field) => {
  const result = validateAddress(address, chain)
  if (!result.valid || field === 'token') return result
  const testnet = result.network === 'testnet'
  if (testnet && !allowTestnet) {
    return { valid: false, code: 'testnet', message: 'This is a test-network address.' }
  }
  if (Object.values(chain.tokens).some((token) => token.address === result.address)) {
    const message = 'This is the address of a token, not of a wallet.'
    return { valid: false, code: 'token-contract', message }
  }
  return testnet ? { ...result, warnings: [...result.warnings, 'testnet'] } : result
}

/**
 * Turns a payment request into the text to put in a QR code, following the
 * chain's own standard and units. A request with nothing but an address, or
 * one the chain's standard cannot express, yields the bare address.
 *
 * @throws PaymentError when the address, token or amount is not usable.
 */
export function buildPayment(request: PaymentRequest): Payment {
  return build(request, check)
}

/**
 * Validates a payment request and draws its QR code in one call.
 *
 * @throws PaymentError when the address, token or amount is not usable.
 */
export function paymentQr(
  request: PaymentRequest,
  options?: SvgOptions,
): { payment: Payment; svg: string } {
  const payment = buildPayment(request)
  return { payment, svg: qrSvg(payment.text, options) }
}
