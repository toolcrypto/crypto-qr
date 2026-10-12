import { describe, expect, it } from 'vitest'
import {
  bitcoin,
  bitcoincash,
  type Chain,
  cardano,
  chains,
  detectChains,
  ethereum,
  litecoin,
  parsePayment,
  solana,
  ton,
  validateAddress,
} from '../src/index.js'
import { ADA, BCH, BTC, BTC_LEGACY, BTC_TESTNET, dead, EVM, LTC, PAYEE, TON } from './addresses.js'
import { base58check } from './encoders.js'
import { valid } from './helpers.js'

const EVM_CHAINS = chains.filter((chain) => chain.evmChainId !== undefined)

describe('validateAddress', () => {
  it('ignores surrounding whitespace', () => {
    expect(valid(`  ${BTC}\n`, bitcoin).address).toBe(BTC)
  })

  it.each(chains)('asks for an address when $name is given none', (chain) => {
    expect(validateAddress('   ', chain)).toEqual({
      valid: false,
      code: 'empty',
      message: 'Enter an address.',
    })
  })

  it('says what to pass when it is given a chain’s name, or the chain first', () => {
    expect(() => validateAddress(BTC, 'bitcoin' as never)).toThrow(TypeError)
    expect(() => validateAddress(BTC, undefined as never)).toThrow(
      'Pass a chain of the main entry, such as `bitcoin`',
    )
    expect(() => validateAddress(bitcoin as never, BTC as never)).toThrow(TypeError)
  })
})

describe('the spelling an address is returned in', () => {
  it.each<{ form: string; chain: Chain; written: string }>([
    { form: 'bech32 in capitals', chain: bitcoin, written: BTC.toUpperCase() },
    { form: 'bech32 in capitals', chain: litecoin, written: LTC.toUpperCase() },
    { form: 'bech32 in capitals', chain: cardano, written: ADA.toUpperCase() },
    { form: 'an address without its capitals', chain: ethereum, written: EVM.toLowerCase() },
    { form: 'CashAddr without its prefix', chain: bitcoincash, written: BCH.slice(12) },
    { form: 'CashAddr in capitals', chain: bitcoincash, written: BCH.toUpperCase() },
    { form: 'the form inherited from Bitcoin', chain: bitcoincash, written: BTC_LEGACY },
    {
      form: 'base64 that is not URL-safe',
      chain: ton,
      written: TON.replaceAll('-', '+').replaceAll('_', '/'),
    },
  ])('differs from $form on $chain.name, and is accepted as it stands', ({ chain, written }) => {
    const first = valid(written, chain)
    expect(first.address).not.toBe(written)
    expect(valid(first.address, chain)).toEqual({ ...first, warnings: [] })
  })
})

describe('text that is no address', () => {
  // Names that every object answers to, alone and in the shapes the chains read,
  // then text of the wrong alphabet, length or kind.
  const NAMES = ['constructor', 'toString', 'valueOf', 'hasOwnProperty', '__proto__', 'prototype']
  const TEXTS = [
    ...NAMES.flatMap((name) => [
      name,
      name.toUpperCase(),
      `${name}1qqqqqqqq`,
      `${name}:qqqqqqqq`,
      `${name}:${name}?${name}=${name}`,
      `0x${name}`,
    ]),
    ...['bitcoin', 'ethereum', 'solana', 'zcash', 'monero', 'web+stellar', 'web+cardano'].flatMap(
      (scheme) => [`${scheme}:constructor1qqqqqqqq`, `${scheme}:__proto__?amount=1`, `${scheme}:`],
    ),
    'ton://transfer/__proto__',
    'web+stellar:pay?destination=constructor&asset_code=toString&asset_issuer=valueOf',
    `ethereum:${EVM}@constructor/transfer?address=__proto__`,
    '1'.repeat(26),
    '1'.repeat(40),
    'q'.repeat(60),
    'A'.repeat(48),
    'é'.repeat(42),
    '💸'.repeat(21),
    `${BTC}\u0000`,
    `${BTC}\n${BTC}`,
    '0'.repeat(10_000),
  ]

  it.each(chains)('is refused on $name, whatever it is', (chain) => {
    for (const text of TEXTS) expect(validateAddress(text, chain).valid, text).toBe(false)
  })

  it('asks for no payment', () => {
    for (const text of TEXTS) expect(parsePayment(text, chains), text).toBeUndefined()
  })
})

describe('detectChains', () => {
  const ids = (address: string) => detectChains(address, chains).map((chain) => chain.id)

  it.each(chains)('finds $name from its address', (chain) => {
    const found = detectChains(PAYEE[chain.id] ?? '', chains)
    expect(found).toEqual(chain.evmChainId === undefined ? [chain] : EVM_CHAINS)
  })

  it.each([
    // Also Bitcoin Cash's old form, and a "3..." address Litecoin's: neither is reported.
    ['an address in the format Bitcoin started with', BTC_LEGACY, ['bitcoin']],
    [
      'a script address of that format',
      base58check.encode(Uint8Array.of(5, ...dead(20))),
      ['bitcoin'],
    ],
    ['a Bitcoin Cash address without its prefix', BCH.slice(12), ['bitcoincash']],
    ['a test-network address', BTC_TESTNET, []],
    ['a word', 'hello', []],
    ['nothing', '', []],
  ])('for %s', (_case, address, expected) => {
    expect(ids(address)).toEqual(expected)
  })

  it('only looks at the chains it is given, and answers in their order', () => {
    expect(detectChains(EVM, [bitcoin, ethereum])).toEqual([ethereum])
    expect(detectChains(EVM, [...EVM_CHAINS].reverse())).toEqual([...EVM_CHAINS].reverse())
    expect(detectChains(EVM, [bitcoin, solana])).toEqual([])
  })
})

describe('chains', () => {
  it('lists every chain, those that share an address format together', () => {
    expect(chains.map((chain) => chain.id)).toEqual([
      'bitcoin',
      'litecoin',
      'dogecoin',
      'zcash',
      'bitcoincash',
      'xrp',
      'monero',
      'stellar',
      'ethereum',
      'optimism',
      'bsc',
      'polygon',
      'base',
      'arbitrum',
      'avalanche',
      'cardano',
      'tron',
      'solana',
      'ton',
    ])
  })

  it('lists the EVM chains by chain id, Ethereum first', () => {
    const evmIds = EVM_CHAINS.map((chain) => chain.evmChainId ?? 0)
    expect(evmIds).toEqual([1, 10, 56, 137, 8453, 42161, 43114])
    expect(evmIds).toEqual([...evmIds].sort((a, b) => a - b))
  })

  it('has no two chains with the same id, name or EVM chain id', () => {
    for (const key of ['id', 'name', 'evmChainId'] as const) {
      const values = chains.map((chain) => chain[key]).filter((value) => value !== undefined)
      expect(new Set(values).size, key).toBe(values.length)
    }
  })

  it.each(chains)('describes $name', (chain) => {
    expect(chain.id).toMatch(/^[a-z]+$/)
    expect(chain.symbol).toMatch(/^[A-Z]{2,5}$/)
    expect(Number.isInteger(chain.decimals) && chain.decimals > 0).toBe(true)
    expect(Object.keys(chain.tokens)).not.toContain(chain.symbol)
  })

  const listed = chains.flatMap((chain) =>
    Object.entries(chain.tokens).map(([symbol, token]) => ({ chain, symbol, token })),
  )

  it.each(listed)('$symbol on $chain.name has a valid address in canonical spelling', (entry) => {
    expect(valid(entry.token.address, entry.chain)).toMatchObject({
      address: entry.token.address,
      network: 'mainnet',
      warnings: [],
    })
    expect(entry.token.symbol).toBeUndefined()
  })
})
