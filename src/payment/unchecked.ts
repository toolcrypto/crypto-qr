import { noAddress } from '../chain.js'
import { qrSvg, type SvgOptions } from '../qr/svg.js'
import { build, type Vouch } from './build.js'
import type { Payment, PaymentRequest } from './types.js'

/** Takes an address as it is written, provided there is one. */
const trust: Vouch = (address) => {
  const text = address.trim()
  return text ? { valid: true, address: text, warnings: [] } : noAddress()
}

/**
 * Turns a payment request into the text to put in a QR code, following the
 * chain's own standard and units. A request with nothing but an address, or
 * one the chain's standard cannot express, yields the bare address.
 *
 * The addresses of the payee and of a token are not checked: they go into the
 * text as they are given, typo included. They have to be in the spelling that
 * `validateAddress` of `crypto-qr` returns.
 *
 * @throws PaymentError when there is no address, or the token or amount is not usable.
 */
export function buildPayment(request: PaymentRequest): Payment {
  return build(request, trust)
}

/**
 * Builds a payment request, without checking its addresses, and draws its QR
 * code in one call.
 *
 * @throws PaymentError when there is no address, or the token or amount is not usable.
 */
export function paymentQr(
  request: PaymentRequest,
  options?: SvgOptions,
): { payment: Payment; svg: string } {
  const payment = buildPayment(request)
  return { payment, svg: qrSvg(payment.text, options) }
}
