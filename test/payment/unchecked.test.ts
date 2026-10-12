import { describe, expect, it } from 'vitest'
import {
  bitcoin,
  buildPayment,
  type Chain,
  chains,
  detectChains,
  ethereum,
  evm,
  type PaymentRequest,
  parsePayment,
  qrSvg,
  tron,
  validateAddress,
  xrp,
} from '../../src/index.js'
import * as unchecked from '../../src/unchecked.js'
import { BTC, BTC_TESTNET, EVM, TRX, XRP } from '../addresses.js'
import { refusal } from '../helpers.js'
import { REQUESTS, summary } from './requests.js'

/** The chain of the same id in `crypto-qr/unchecked`. */
function twin(chain: Chain): Chain {
  const found = unchecked.chains.find(({ id }) => id === chain.id)
  if (!found) throw new Error(`${chain.id} is missing from crypto-qr/unchecked`)
  return found
}

const TYPO = `${BTC.slice(0, -1)}m`

describe('crypto-qr/unchecked: chains', () => {
  it('lists the chains of crypto-qr, in the same order', () => {
    expect(unchecked.chains.map((chain) => chain.id)).toEqual(chains.map((chain) => chain.id))
  })

  it.each(chains)('describes $name as crypto-qr does, short of its address check', (chain) => {
    const trusting = twin(chain)
    expect(trusting).not.toHaveProperty('checkAddress')
    expect(chain).toEqual({ ...trusting, checkAddress: expect.any(Function) })
  })

  it('defines an EVM chain that is not listed', () => {
    const linea = unchecked.evm({ id: 'linea', name: 'Linea', chainId: 59144 })
    const request = { address: EVM, amount: '1' }
    expect(linea).not.toHaveProperty('checkAddress')
    expect(unchecked.buildPayment({ ...request, chain: linea })).toEqual(
      buildPayment({ ...request, chain: evm({ id: 'linea', name: 'Linea', chainId: 59144 }) }),
    )
  })
})

describe('crypto-qr/unchecked: buildPayment', () => {
  const requests: PaymentRequest[] = [
    ...REQUESTS,
    { chain: tron, address: TRX, token: 'USDT', amount: '10', memo: 'ref' },
    { chain: xrp, address: XRP, amount: '25', memo: '123456' },
  ]

  it.each(requests.map((request) => [summary(request), request] as const))(
    'writes what crypto-qr writes on %s',
    (_summary, request) => {
      const trusting = { ...request, chain: twin(request.chain) }
      expect(unchecked.buildPayment(trusting)).toEqual(buildPayment(request))
    },
  )

  it('is tried on every chain', () => {
    const tried = new Set(requests.map((request) => request.chain))
    expect(chains.filter((chain) => !tried.has(chain))).toEqual([])
  })

  it('takes an address as it is given, typo included', () => {
    expect(refusal({ chain: bitcoin, address: TYPO })).toBe('address:checksum')
    const request = { chain: unchecked.bitcoin, address: ` ${TYPO}\n`, amount: '1' }
    expect(unchecked.buildPayment(request)).toMatchObject({
      text: `bitcoin:${TYPO}?amount=1`,
      address: TYPO,
      warnings: [],
    })
  })

  it('neither rewrites an address nor warns about it', () => {
    const lower = EVM.toLowerCase()
    expect(unchecked.buildPayment({ chain: unchecked.ethereum, address: lower })).toEqual({
      text: lower,
      address: lower,
      warnings: [],
    })
    expect(unchecked.buildPayment({ chain: unchecked.bitcoin, address: BTC_TESTNET })).toEqual({
      text: BTC_TESTNET,
      address: BTC_TESTNET,
      warnings: [],
    })
  })

  it('does not look at what the address is: a token’s own is taken like any other', () => {
    const address = ethereum.tokens.USDT.address
    expect(refusal({ chain: ethereum, address })).toBe('address:token-contract')
    expect(unchecked.buildPayment({ chain: unchecked.ethereum, address })).toEqual({
      text: address,
      address,
      warnings: [],
    })
  })

  it('takes the address of a token the same way', () => {
    const token = { address: `0x${'c0ffee'.repeat(6)}c0ff`, decimals: 6 }
    const request = { chain: unchecked.ethereum, address: EVM, token, amount: '1.5' }
    expect(unchecked.buildPayment(request).text).toBe(
      `ethereum:${token.address}@1/transfer?address=${EVM}&uint256=1500000`,
    )
  })

  it.each<[string, PaymentRequest, string]>([
    ['no address', { chain: unchecked.bitcoin, address: '  ' }, 'address:empty'],
    ['an exponent', { chain: unchecked.bitcoin, address: BTC, amount: '1e-8' }, 'amount:format'],
    ['a zero amount', { chain: unchecked.bitcoin, address: BTC, amount: '0' }, 'amount:zero'],
    [
      'too many decimals',
      { chain: unchecked.ethereum, address: EVM, token: 'USDC', amount: '0.0000001' },
      'amount:too-many-decimals',
    ],
    [
      'an unlisted ticker',
      { chain: unchecked.base, address: EVM, token: 'USDT' },
      'token:unknown-token',
    ],
    [
      'impossible token decimals',
      { chain: unchecked.ethereum, address: EVM, token: { address: EVM, decimals: 256 } },
      'token:decimals',
    ],
  ])('still refuses %s', (_case, request, expected) => {
    expect(refusal(request, unchecked.buildPayment)).toBe(expected)
  })
})

describe('crypto-qr/unchecked: paymentQr', () => {
  it('builds the payment and its code in one call', () => {
    const request = { chain: unchecked.bitcoin, address: BTC, amount: '0.001' }
    const { payment, svg } = unchecked.paymentQr(request, { shape: 'dots' })
    expect(payment.text).toBe(`bitcoin:${BTC}?amount=0.001`)
    expect(svg).toBe(qrSvg(payment.text, { shape: 'dots' }))
  })
})

describe('crypto-qr/unchecked: chains where an address is checked', () => {
  it('are refused outright: nothing passes for checked that was not', () => {
    const uri = `bitcoin:${BTC}?amount=1`
    expect(() => validateAddress(BTC, unchecked.bitcoin)).toThrow(TypeError)
    expect(() => detectChains(BTC, unchecked.chains)).toThrow(TypeError)
    expect(() => parsePayment(BTC, unchecked.chains)).toThrow(TypeError)
    expect(() => parsePayment(uri, unchecked.chains)).toThrow(TypeError)
    expect(() => buildPayment({ chain: unchecked.bitcoin, address: BTC })).toThrow(
      'not its name, nor a chain from "crypto-qr/unchecked"',
    )
  })
})
