import { describe, expect, it } from 'vitest'
import { bitcoin, paymentQr, qrSvg } from '../../src/index.js'
import { BTC } from '../addresses.js'

describe('paymentQr', () => {
  it('builds the payment and its code in one call', () => {
    const request = { chain: bitcoin, address: BTC, amount: '0.001' }
    const { payment, svg } = paymentQr(request, { shape: 'dots' })
    expect(payment.text).toBe(`bitcoin:${BTC}?amount=0.001`)
    expect(svg).toBe(qrSvg(payment.text, { shape: 'dots' }))
  })

  it('draws nothing for an address it refuses', () => {
    expect(() => paymentQr({ chain: bitcoin, address: `${BTC.slice(0, -1)}m` })).toThrow(
      'The checksum does not match',
    )
  })
})
