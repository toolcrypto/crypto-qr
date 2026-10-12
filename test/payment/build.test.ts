import { describe, expect, it } from 'vitest'
import {
  base,
  bitcoin,
  bitcoincash,
  buildPayment,
  chains,
  ethereum,
  type PaymentRequest,
  solana,
  stellar,
  ton,
  tron,
  xrp,
} from '../../src/index.js'
import { BTC, BTC_LEGACY, BTC_TESTNET, EVM, PAYEE, SOL, TRX, XLM, XRP } from '../addresses.js'
import { refusal } from '../helpers.js'

/** A token no chain lists here. */
const UNLISTED = { address: `0x${'c0ffee'.repeat(6)}c0ff`, decimals: 18 }

describe('buildPayment: an address alone', () => {
  // A Bitcoin Cash address is a URI as it stands: see test/uri/bip321.test.ts.
  it.each(chains.filter((chain) => chain !== bitcoincash))(
    'is all there is to encode on $name',
    (chain) => {
      const address = PAYEE[chain.id] ?? ''
      expect(buildPayment({ chain, address })).toEqual({ text: address, address, warnings: [] })
    },
  )

  it('is encoded in its canonical spelling', () => {
    expect(buildPayment({ chain: ethereum, address: EVM.toLowerCase() })).toMatchObject({
      text: EVM,
      address: EVM,
      warnings: ['no-checksum'],
    })
    expect(buildPayment({ chain: bitcoin, address: ` ${BTC.toUpperCase()} ` }).text).toBe(BTC)
  })

  it('is what a request with blank fields comes down to', () => {
    const blanks = { amount: '  ', label: '', message: ' ', memo: '\n' }
    expect(buildPayment({ chain: bitcoin, address: BTC, ...blanks })).toEqual({
      text: BTC,
      address: BTC,
      warnings: [],
    })
  })
})

describe('buildPayment: what the code cannot say', () => {
  it('writes no link on Tron, where wallets agree on none, and says what is left out', () => {
    const request = { chain: tron, address: TRX, token: 'USDT', amount: '10', memo: 'ref' }
    expect(buildPayment(request)).toEqual({
      text: TRX,
      address: TRX,
      token: { address: tron.tokens.USDT.address, decimals: 6, symbol: 'USDT' },
      amount: '10',
      atomicAmount: '10000000',
      warnings: ['amount-not-encoded', 'token-not-encoded', 'memo-not-encoded'],
    })
  })

  it('writes no link on the XRP Ledger either: the destination tag is given apart', () => {
    expect(buildPayment({ chain: xrp, address: XRP, amount: '25', memo: '123456' })).toEqual({
      text: XRP,
      address: XRP,
      amount: '25',
      atomicAmount: '25000000',
      warnings: ['amount-not-encoded', 'memo-not-encoded'],
    })
  })

  it('writes no link that cannot name the token: it would ask for its amount in coins', () => {
    const token = { address: BTC_LEGACY, decimals: 2, symbol: 'XYZ' }
    expect(buildPayment({ chain: bitcoin, address: BTC, token, amount: '5' })).toMatchObject({
      text: BTC,
      atomicAmount: '500',
      warnings: ['amount-not-encoded', 'token-not-encoded'],
    })
  })
})

describe('buildPayment: refusals', () => {
  it.each<[string, PaymentRequest, string]>([
    ['an empty address', { chain: bitcoin, address: '' }, 'address:empty'],
    ['a typo', { chain: bitcoin, address: `${BTC.slice(0, -1)}m` }, 'address:checksum'],
    ['another chain’s address', { chain: bitcoin, address: TRX }, 'address:wrong-chain'],
    ['a testnet address', { chain: bitcoin, address: BTC_TESTNET }, 'address:testnet'],
    [
      'a token’s contract as the payee',
      { chain: ethereum, address: ethereum.tokens.USDT.address },
      'address:token-contract',
    ],
    [
      'a token’s mint as the payee',
      { chain: solana, address: solana.tokens.USDC.address, amount: '1' },
      'address:token-contract',
    ],
    [
      'a token’s jetton master as the payee, in the other spelling of its address',
      { chain: ton, address: ton.tokens.USDT.address.replaceAll('_', '/') },
      'address:token-contract',
    ],
    [
      'a token’s issuer as the payee',
      { chain: stellar, address: stellar.tokens.USDC.address },
      'address:token-contract',
    ],
    ['an exponent', { chain: bitcoin, address: BTC, amount: '1e-8' }, 'amount:format'],
    [
      'too many decimals',
      { chain: bitcoin, address: BTC, amount: '0.000000001' },
      'amount:too-many-decimals',
    ],
    ['a zero amount', { chain: bitcoin, address: BTC, amount: '0.00' }, 'amount:zero'],
    [
      'too many decimals for the token',
      { chain: ethereum, address: EVM, token: 'USDT', amount: '0.0000001' },
      'amount:too-many-decimals',
    ],
    ['an unlisted ticker', { chain: ethereum, address: EVM, token: 'DOGE' }, 'token:unknown-token'],
    [
      'a ticker in another case',
      { chain: ethereum, address: EVM, token: 'usdt' },
      'token:unknown-token',
    ],
    [
      'a ticker that names a method',
      { chain: ethereum, address: EVM, token: 'toString' },
      'token:unknown-token',
    ],
    [
      'a token the chain does not list',
      { chain: base, address: EVM, token: 'USDT' },
      'token:unknown-token',
    ],
    [
      'a ticker on a chain without tokens',
      { chain: bitcoin, address: BTC, token: 'USDT' },
      'token:unknown-token',
    ],
    [
      'a malformed token address',
      { chain: ethereum, address: EVM, token: { address: 'nope', decimals: 6 } },
      'token:format',
    ],
    [
      'a token address of another chain',
      { chain: solana, address: SOL, token: UNLISTED },
      'token:format',
    ],
    [
      'impossible token decimals',
      { chain: ethereum, address: EVM, token: { ...UNLISTED, decimals: 1.5 } },
      'token:decimals',
    ],
  ])('refuses %s', (_case, request, expected) => {
    expect(refusal(request)).toBe(expected)
  })

  it('names the tickers a chain lists when it refuses one', () => {
    expect(() => buildPayment({ chain: base, address: EVM, token: 'USDT' })).toThrow(
      'USDT is not listed on Base (listed: USDC).',
    )
    expect(() => buildPayment({ chain: bitcoin, address: BTC, token: 'USDT' })).toThrow(
      'USDT is not listed on Bitcoin (listed: none).',
    )
  })

  it('accepts a testnet address when asked, and says so', () => {
    const request = { chain: bitcoin, address: BTC_TESTNET, allowTestnet: true }
    expect(buildPayment(request)).toMatchObject({ text: BTC_TESTNET, warnings: ['testnet'] })
    expect(buildPayment({ ...request, amount: '1' })).toMatchObject({
      text: `bitcoin:${BTC_TESTNET}?amount=1`,
      warnings: ['testnet'],
    })
  })

  it('says what to pass when it is given a chain’s name', () => {
    expect(() => buildPayment({ chain: 'stellar' as never, address: XLM })).toThrow(TypeError)
  })
})
