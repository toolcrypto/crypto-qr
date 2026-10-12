import { describe, expect, it } from 'vitest'
import {
  arbitrum,
  avalanche,
  base,
  bitcoin,
  bsc,
  buildPayment,
  chains,
  ethereum,
  evm,
  parsePayment,
} from '../../src/index.js'
import { EVM } from '../addresses.js'
import { valid } from '../helpers.js'

const USDT = ethereum.tokens.USDT.address
const EVM_IDS = ['ethereum', 'optimism', 'bsc', 'polygon', 'base', 'arbitrum', 'avalanche']
/** A token no chain lists here, in lowercase as a caller might have it. */
const UNLISTED = `0x${'c0ffee'.repeat(6)}c0ff`

const parse = (text: string) => parsePayment(text, chains)

describe('EIP-681: writing', () => {
  it('writes native amounts in wei and always names the chain', () => {
    expect(buildPayment({ chain: ethereum, address: EVM, amount: '1.5' })).toEqual({
      text: `ethereum:${EVM}@1?value=1500000000000000000`,
      standard: 'EIP-681',
      address: EVM,
      amount: '1.5',
      atomicAmount: '1500000000000000000',
      warnings: ['uri-support-varies'],
    })
  })

  it.each([bsc, base, arbitrum, evm({ id: 'linea', name: 'Linea', chainId: 59144 })])(
    'names the chain id of $name',
    (chain) => {
      expect(buildPayment({ chain, address: EVM, amount: '0.1' }).text).toBe(
        `ethereum:${EVM}@${chain.evmChainId}?value=100000000000000000`,
      )
    },
  )

  it('addresses a token transfer to the contract, with the amount in token units', () => {
    expect(
      buildPayment({ chain: ethereum, address: EVM, token: 'USDT', amount: '25.5' }),
    ).toMatchObject({
      text: `ethereum:${USDT}@1/transfer?address=${EVM}&uint256=25500000`,
      token: { address: USDT, decimals: 6, symbol: 'USDT' },
      amount: '25.5',
      atomicAmount: '25500000',
      warnings: ['erc20-uri-risk'],
    })
  })

  it('uses 18 decimals for the stablecoins of BNB Smart Chain', () => {
    expect(buildPayment({ chain: bsc, address: EVM, token: 'USDT', amount: '1' }).text).toBe(
      `ethereum:${bsc.tokens.USDT.address}@56/transfer?address=${EVM}&uint256=1000000000000000000`,
    )
  })

  it('falls back to the bare address for a request without an amount', () => {
    expect(buildPayment({ chain: ethereum, address: EVM, token: 'USDC' })).toMatchObject({
      text: EVM,
      warnings: ['token-not-encoded'],
    })
  })

  it('accepts a token of the caller’s and checksums its address', () => {
    const contract = valid(UNLISTED, ethereum).address
    const token = { address: UNLISTED, decimals: 18, symbol: 'COFFEE' }
    expect(buildPayment({ chain: ethereum, address: EVM, token, amount: '3' })).toMatchObject({
      text: `ethereum:${contract}@1/transfer?address=${EVM}&uint256=3000000000000000000`,
      token: { address: contract, decimals: 18, symbol: 'COFFEE' },
    })
  })

  it('treats the native ticker as no token', () => {
    const payment = buildPayment({ chain: ethereum, address: EVM, token: 'ETH', amount: '1' })
    expect(payment.token).toBeUndefined()
    expect(payment.text).toBe(`ethereum:${EVM}@1?value=1000000000000000000`)
  })

  it('flags each note, which it cannot carry', () => {
    const notes = { label: 'Shop', message: 'Order 7', memo: 'ref' }
    expect(buildPayment({ chain: ethereum, address: EVM, amount: '1', ...notes }).warnings).toEqual(
      ['label-not-encoded', 'message-not-encoded', 'memo-not-encoded', 'uri-support-varies'],
    )
  })
})

describe('EIP-681: reading', () => {
  it('reads its scientific notation', () => {
    expect(parse(`ethereum:${EVM.toLowerCase()}@1?value=2.014e18`)).toMatchObject({
      standard: 'EIP-681',
      chains: [ethereum],
      address: EVM,
      amount: '2.014',
      atomicAmount: '2014000000000000000',
    })
    for (const [written, units] of [
      ['1e18', '1000000000000000000'],
      ['+25.5E6', '25500000'],
      ['1500000.0', '1500000'],
      ['0', '0'],
    ]) {
      expect(parse(`ethereum:${EVM}@1?value=${written}`)?.atomicAmount, written).toBe(units)
    }
  })

  it('names the token and its amount once the chain is certain', () => {
    const transfer = `ethereum:${USDT}@1/transfer?address=${EVM}&uint256=25500000`
    expect(parse(transfer)).toMatchObject({
      chains: [ethereum],
      address: EVM,
      token: { address: USDT, symbol: 'USDT', decimals: 6 },
      amount: '25.5',
    })
    expect(parse(`ethereum:pay-${EVM}@8453?value=1000000000000000`)).toMatchObject({
      chains: [base],
      amount: '0.001',
    })
  })

  it('leaves the chain open when the URI names none', () => {
    expect(parse(`ethereum:${EVM}?value=1`)?.chains.map((chain) => chain.id)).toEqual(EVM_IDS)
    // The same contract address can be another token elsewhere: only the units are certain.
    const transfer = parse(`ethereum:${USDT}/transfer?address=${EVM}&uint256=25500000`)
    expect(transfer).toMatchObject({ token: { address: USDT }, atomicAmount: '25500000' })
    expect(transfer?.amount).toBeUndefined()
    expect(transfer?.token?.symbol).toBeUndefined()
    // With one EVM chain to choose from, there is no doubt left.
    expect(parsePayment(`ethereum:${EVM}?value=1`, [bitcoin, avalanche])?.chains).toEqual([
      avalanche,
    ])
  })

  it('reads a token it does not list, without guessing its decimals', () => {
    const transfer = parse(`ethereum:${UNLISTED}@1/transfer?address=${EVM}&uint256=1`)
    expect(transfer).toMatchObject({
      address: EVM,
      token: { address: valid(UNLISTED, ethereum).address },
      atomicAmount: '1',
    })
    expect(transfer?.amount).toBeUndefined()
  })

  it.each([
    ['a chain that is not among those given', `ethereum:${EVM}@99999?value=1`],
    ['a call other than transfer', `ethereum:${USDT}@1/approve?address=${EVM}&uint256=1`],
    ['a transfer without a payee', `ethereum:${USDT}@1/transfer?uint256=1`],
    ['a fractional number of wei', `ethereum:${EVM}@1?value=1.5`],
    ['a negative value', `ethereum:${EVM}@1?value=-1`],
    ['two values', `ethereum:${EVM}@1?value=1&value=2`],
    ['an ENS name', 'ethereum:example.eth@1?value=1'],
    ['a wrong checksum', `ethereum:${EVM.replace('0xD', '0xd')}@1`],
    ['another EVM chain’s name as scheme', `base:${EVM}`],
  ])('refuses a URI with %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })
})
