import { describe, expect, it } from 'vitest'
import {
  bitcoin,
  bitcoincash,
  buildPayment,
  chains,
  dogecoin,
  litecoin,
  parsePayment,
} from '../../src/index.js'
import { BCH, BTC, BTC_LEGACY, BTC_TESTNET, DOGE, LTC } from '../addresses.js'

const parse = (text: string) => parsePayment(text, chains)

describe('BIP-321: writing', () => {
  it.each([
    ['0.001', `bitcoin:${BTC}?amount=0.001`, '100000'],
    // The smallest unit must not come out as "1e-8".
    ['0.00000001', `bitcoin:${BTC}?amount=0.00000001`, '1'],
    ['1.50', `bitcoin:${BTC}?amount=1.5`, '150000000'],
  ])('writes %s BTC in whole coins as a plain decimal', (amount, text, atomicAmount) => {
    expect(buildPayment({ chain: bitcoin, address: BTC, amount })).toMatchObject({
      text,
      standard: 'BIP-321',
      atomicAmount,
      warnings: [],
    })
  })

  it('percent-encodes the label and the message', () => {
    const notes = { label: 'Corner shop', message: 'Order 42 & more? 1+1' }
    expect(buildPayment({ chain: bitcoin, address: BTC, amount: '50', ...notes }).text).toBe(
      `bitcoin:${BTC}?amount=50&label=Corner%20shop&message=Order%2042%20%26%20more%3F%201%2B1`,
    )
  })

  it('writes a label alone, without an amount', () => {
    expect(buildPayment({ chain: bitcoin, address: BTC, label: 'Shop' }).text).toBe(
      `bitcoin:${BTC}?label=Shop`,
    )
  })

  it('flags a memo, which it cannot carry', () => {
    expect(
      buildPayment({ chain: bitcoin, address: BTC, amount: '1', memo: 'order 7' }),
    ).toMatchObject({ text: `bitcoin:${BTC}?amount=1`, warnings: ['memo-not-encoded'] })
  })

  it('is BIP-21 under the name of each coin that took it up', () => {
    expect(buildPayment({ chain: litecoin, address: LTC, amount: '2' })).toMatchObject({
      text: `litecoin:${LTC}?amount=2`,
      standard: 'BIP-21',
    })
    expect(buildPayment({ chain: dogecoin, address: DOGE, amount: '100' })).toMatchObject({
      text: `dogecoin:${DOGE}?amount=100`,
      standard: 'BIP-21',
    })
  })
})

describe('BIP-321: reading', () => {
  it('reads a request', () => {
    expect(parse(`bitcoin:${BTC}?amount=50&label=Corner%20shop&message=Order%2042`)).toEqual({
      standard: 'BIP-321',
      chains: [bitcoin],
      address: BTC,
      network: 'mainnet',
      amount: '50',
      atomicAmount: '5000000000',
      label: 'Corner shop',
      message: 'Order 42',
    })
  })

  it('reads a URI written in capitals, keys included', () => {
    expect(parse(`BITCOIN:${BTC.toUpperCase()}?AMOUNT=0.5&LABEL=Shop`)).toMatchObject({
      chains: [bitcoin],
      address: BTC,
      amount: '0.5',
      label: 'Shop',
    })
  })

  it('reads the other coins, test networks and unknown parameters', () => {
    expect(parse(`litecoin:${LTC}?amount=2`)).toMatchObject({
      standard: 'BIP-21',
      chains: [litecoin],
      atomicAmount: '200000000',
    })
    expect(parse(`bitcoin:${BTC_TESTNET}`)).toMatchObject({ network: 'testnet' })
    expect(parse(`bitcoin:${BTC}?somethingyoudontunderstand=50&lightning=lnbc1`)).toMatchObject({
      address: BTC,
    })
  })

  it('keeps "+" as it is written and accepts a zero amount', () => {
    expect(parse(`bitcoin:${BTC}?amount=0&label=C++`)).toMatchObject({
      amount: '0',
      atomicAmount: '0',
      label: 'C++',
    })
  })

  it.each([
    ['a required parameter it does not know', `bitcoin:${BTC}?req-something=50`],
    ['the same in capitals', `bitcoin:${BTC}?REQ-SOMETHING=50`],
    ['two amounts', `bitcoin:${BTC}?amount=42&amount=10`],
    ['the same amount twice', `bitcoin:${BTC}?amount=42&AMOUNT=42`],
    ['two labels', `bitcoin:${BTC}?label=Shop&label=Store`],
    ['a malformed amount', `bitcoin:${BTC}?amount=abc`],
    ['more decimals than a satoshi', `bitcoin:${BTC}?amount=0.000000001`],
    ['a mistyped address', `bitcoin:${BTC.slice(0, -1)}m?amount=1`],
    ['another coin’s address', `litecoin:${BTC}`],
    ['no address', 'bitcoin:?lightning=lnbc420bogusinvoice'],
    ['broken percent-encoding', `bitcoin:${BTC}?label=%E0%A4%A`],
  ])('refuses a URI with %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })
})

describe('BIP-21 on Bitcoin Cash', () => {
  it('writes an address as it stands: with its prefix, it is a URI already', () => {
    expect(buildPayment({ chain: bitcoincash, address: BCH.slice(12) })).toEqual({
      text: BCH,
      standard: 'BIP-21',
      address: BCH,
      warnings: [],
    })
  })

  it('adds the request to the address', () => {
    const request = { chain: bitcoincash, address: BCH, amount: '0.5', label: 'Shop' }
    expect(buildPayment(request).text).toBe(`${BCH}?amount=0.5&label=Shop`)
  })

  it('writes an address in Bitcoin’s format as CashAddr, which no Bitcoin wallet reads', () => {
    expect(buildPayment({ chain: bitcoincash, address: BTC_LEGACY, amount: '1' })).toMatchObject({
      text: `${BCH}?amount=1`,
      address: BCH,
      warnings: ['legacy-format'],
    })
  })

  it('keeps the prefix of a test network, which is the scheme its wallets read', () => {
    // An address of the CashTokens test vectors.
    const address = 'bchtest:qr7fzmep8g7h7ymfxy74lgc0v950j3r295pdnvy3hr'
    const request = { chain: bitcoincash, address, amount: '1', allowTestnet: true }
    expect(buildPayment(request).text).toBe(`${address}?amount=1`)
    // Its scheme is not one that is read back.
    expect(parse(`${address}?amount=1`)).toBeUndefined()
  })

  it.each([
    ['in lowercase', `${BCH}?amount=1`],
    ['in capitals', `${BCH.toUpperCase()}?AMOUNT=1`],
    ['with the address in Bitcoin’s format', `bitcoincash:${BTC_LEGACY}?amount=1`],
  ])('reads a request written %s', (_case, uri) => {
    expect(parse(uri)).toEqual({
      standard: 'BIP-21',
      chains: [bitcoincash],
      address: BCH,
      network: 'mainnet',
      amount: '1',
      atomicAmount: '100000000',
    })
  })

  it('reads an address alone as the URI it is', () => {
    expect(parse(BCH)).toEqual({
      standard: 'BIP-21',
      chains: [bitcoincash],
      address: BCH,
      network: 'mainnet',
    })
  })
})
