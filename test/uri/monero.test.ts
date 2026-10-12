import { describe, expect, it } from 'vitest'
import { buildPayment, chains, monero, parsePayment } from '../../src/index.js'
import { XMR } from '../addresses.js'

const parse = (text: string) => parsePayment(text, chains)

describe('Monero URI: writing', () => {
  it('writes the amount in whole monero, under the names the reference wallet reads', () => {
    const notes = { label: 'Corner shop', message: 'Order 42' }
    expect(buildPayment({ chain: monero, address: XMR, amount: '0.5', ...notes })).toEqual({
      text: `monero:${XMR}?tx_amount=0.5&recipient_name=Corner%20shop&tx_description=Order%2042`,
      standard: 'Monero URI',
      address: XMR,
      amount: '0.5',
      atomicAmount: '500000000000',
      warnings: [],
    })
  })

  it('flags a memo: what tells a payment from another is in the address itself', () => {
    expect(buildPayment({ chain: monero, address: XMR, amount: '1', memo: 'ref' })).toMatchObject({
      text: `monero:${XMR}?tx_amount=1`,
      warnings: ['memo-not-encoded'],
    })
  })
})

describe('Monero URI: reading', () => {
  it('reads a request, and leaves aside what it does not know', () => {
    const uri =
      `monero:${XMR}?tx_amount=0.000000000001&recipient_name=Corner%20shop` +
      '&tx_description=Order%2042&tx_payment_id=0'
    expect(parse(uri)).toEqual({
      standard: 'Monero URI',
      chains: [monero],
      address: XMR,
      network: 'mainnet',
      amount: '0.000000000001',
      atomicAmount: '1',
      label: 'Corner shop',
      message: 'Order 42',
    })
  })

  it.each([
    ['two amounts', `monero:${XMR}?tx_amount=1&tx_amount=2`],
    ['more decimals than a piconero', `monero:${XMR}?tx_amount=0.0000000000001`],
    ['a mistyped address', `monero:${XMR.slice(0, -1)}c?tx_amount=1`],
  ])('refuses a URI with %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })
})
