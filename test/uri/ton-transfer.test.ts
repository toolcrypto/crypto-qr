import { describe, expect, it } from 'vitest'
import { buildPayment, chains, parsePayment, ton } from '../../src/index.js'
import { TON } from '../addresses.js'

const USDT = ton.tokens.USDT.address

const parse = (text: string) => parsePayment(text, chains)

describe('TON transfer link: writing', () => {
  it('writes the amount in the smallest unit and the memo as the comment', () => {
    expect(buildPayment({ chain: ton, address: TON, amount: '1.5', memo: 'Order 42' })).toEqual({
      text: `ton://transfer/${TON}?amount=1500000000&text=Order%2042`,
      standard: 'TON transfer link',
      address: TON,
      amount: '1.5',
      atomicAmount: '1500000000',
      warnings: ['uri-support-varies'],
    })
  })

  it('names the jetton, with the amount in its own units', () => {
    expect(buildPayment({ chain: ton, address: TON, token: 'USDT', amount: '10' })).toMatchObject({
      text: `ton://transfer/${TON}?jetton=${USDT}&amount=10000000`,
      atomicAmount: '10000000',
      warnings: ['uri-support-varies'],
    })
  })

  it('flags the label and the message, which it cannot carry', () => {
    const notes = { label: 'Shop', message: 'Order 7' }
    expect(buildPayment({ chain: ton, address: TON, amount: '1', ...notes }).warnings).toEqual([
      'label-not-encoded',
      'message-not-encoded',
      'uri-support-varies',
    ])
  })
})

describe('TON transfer link: reading', () => {
  it('reads a transfer link, jettons included', () => {
    expect(parse(`ton://transfer/${TON}?amount=1500000000&text=Order+42`)).toEqual({
      standard: 'TON transfer link',
      chains: [ton],
      address: TON,
      network: 'mainnet',
      amount: '1.5',
      atomicAmount: '1500000000',
      memo: 'Order 42',
    })
    expect(parse(`ton://transfer/${TON}?jetton=${USDT}&amount=5000000`)).toMatchObject({
      token: { address: USDT, symbol: 'USDT', decimals: 6 },
      amount: '5',
    })
  })

  it.each([
    ['a fractional number of units', `ton://transfer/${TON}?amount=1.5`],
    ['a binary body', `ton://transfer/${TON}?amount=1&bin=te6cckEBAQEAAgAAAEysuc0%3D`],
    ['a contract to deploy', `ton://transfer/${TON}?amount=1&init=te6cckEBAQEAAgAAAEysuc0%3D`],
    ['another action', `ton://dns/${TON}`],
    ['two amounts', `ton://transfer/${TON}?amount=1&amount=2`],
  ])('refuses a link with %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })
})
