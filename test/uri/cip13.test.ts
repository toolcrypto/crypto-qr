import { describe, expect, it } from 'vitest'
import { buildPayment, cardano, chains, parsePayment } from '../../src/index.js'
import { ADA } from '../addresses.js'

const parse = (text: string) => parsePayment(text, chains)

describe('CIP-13: writing', () => {
  it('writes the amount in whole ada', () => {
    expect(buildPayment({ chain: cardano, address: ADA, amount: '12.50' })).toEqual({
      text: `web+cardano:${ADA}?amount=12.5`,
      standard: 'CIP-13',
      address: ADA,
      amount: '12.5',
      atomicAmount: '12500000',
      warnings: ['uri-support-varies'],
    })
  })

  it('flags every note: an amount is all it has a place for', () => {
    const notes = { label: 'Shop', message: 'Order 7', memo: 'ref' }
    expect(buildPayment({ chain: cardano, address: ADA, amount: '1', ...notes }).warnings).toEqual([
      'label-not-encoded',
      'message-not-encoded',
      'memo-not-encoded',
      'uri-support-varies',
    ])
  })

  it('is not written without an amount: the address says as much', () => {
    expect(buildPayment({ chain: cardano, address: ADA, label: 'Shop' })).toMatchObject({
      text: ADA,
      warnings: ['label-not-encoded'],
    })
  })
})

describe('CIP-13: reading', () => {
  it('reads a payment', () => {
    expect(parse(`web+cardano:${ADA}?amount=12.5`)).toEqual({
      standard: 'CIP-13',
      chains: [cardano],
      address: ADA,
      network: 'mainnet',
      amount: '12.5',
      atomicAmount: '12500000',
    })
    expect(parse(`web+cardano:${ADA}`)).toMatchObject({ standard: 'CIP-13', address: ADA })
  })

  it.each([
    ['a stake pool to delegate to', 'web+cardano://stake?pool1deadbeef'],
    ['two amounts', `web+cardano:${ADA}?amount=1&amount=2`],
    ['more decimals than a lovelace', `web+cardano:${ADA}?amount=0.0000001`],
    ['a mistyped address', `web+cardano:${ADA.slice(0, -1)}q?amount=1`],
    ['the scheme without "web+"', `cardano:${ADA}?amount=1`],
  ])('refuses a URI with %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })
})
