import { describe, expect, it } from 'vitest'
import { buildPayment, chains, parsePayment, solana } from '../../src/index.js'
import { SOL } from '../addresses.js'

const USDC = solana.tokens.USDC.address
const USDT = solana.tokens.USDT.address

/** The first transfer request the specification gives as an example, paid to the test address. */
const EXAMPLE =
  `solana:${SOL}?amount=1&label=Michael&message=Thanks%20for%20all%20the%20fish` +
  '&memo=OrderId12345'

const parse = (text: string) => parsePayment(text, chains)

describe('Solana Pay: writing', () => {
  // The two transfer requests the specification gives as examples, paid to the test address.
  it('writes the examples of the specification', () => {
    const notes = { label: 'Michael', message: 'Thanks for all the fish', memo: 'OrderId12345' }
    expect(buildPayment({ chain: solana, address: SOL, amount: '1', ...notes }).text).toBe(EXAMPLE)
    expect(buildPayment({ chain: solana, address: SOL, token: 'USDC', amount: '0.01' }).text).toBe(
      `solana:${SOL}?amount=0.01&spl-token=${USDC}`,
    )
  })

  it('keeps the amount in display units and still reports the smallest unit', () => {
    expect(buildPayment({ chain: solana, address: SOL, amount: '0.5' })).toEqual({
      text: `solana:${SOL}?amount=0.5`,
      standard: 'Solana Pay',
      address: SOL,
      amount: '0.5',
      atomicAmount: '500000000',
      warnings: [],
    })
  })

  it('names the token even without an amount', () => {
    expect(buildPayment({ chain: solana, address: SOL, token: 'USDT' })).toMatchObject({
      text: `solana:${SOL}?spl-token=${USDT}`,
      warnings: [],
    })
  })
})

describe('Solana Pay: reading', () => {
  it('reads a transfer request', () => {
    expect(parse(EXAMPLE)).toEqual({
      standard: 'Solana Pay',
      chains: [solana],
      address: SOL,
      network: 'mainnet',
      amount: '1',
      atomicAmount: '1000000000',
      label: 'Michael',
      message: 'Thanks for all the fish',
      memo: 'OrderId12345',
    })
    expect(parse(`solana:${SOL}?amount=0.01&spl-token=${USDC}`)).toMatchObject({
      token: { address: USDC, symbol: 'USDC', decimals: 6 },
      amount: '0.01',
      atomicAmount: '10000',
    })
  })

  it('reads "+" as a space, the way the official library writes one', () => {
    const uri =
      `solana:${SOL}?amount=0&label=Jungle+Cats&message=1%2B1` +
      `&reference=${USDC}&reference=${USDT}`
    expect(parse(uri)).toMatchObject({ amount: '0', label: 'Jungle Cats', message: '1+1' })
  })

  it.each([
    ['a transaction request, which is a link to follow', 'solana:https://example.com/solana-pay'],
    ['an amount without a leading zero', `solana:${SOL}?amount=.5`],
    ['more decimals than a lamport', `solana:${SOL}?amount=0.0000000001`],
    ['more decimals than the token has', `solana:${SOL}?amount=0.0000001&spl-token=${USDC}`],
    ['a mint that is not an address', `solana:${SOL}?amount=1&spl-token=USDC`],
    ['two amounts', `solana:${SOL}?amount=1&amount=2`],
  ])('refuses %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })
})
