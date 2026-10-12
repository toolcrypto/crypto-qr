import { describe, expect, it } from 'vitest'
import {
  bitcoin,
  bitcoincash,
  buildPayment,
  chains,
  ethereum,
  parsePayment,
  solana,
} from '../../src/index.js'
import { BTC, BTC_TESTNET, EVM, PAYEE, TRX } from '../addresses.js'
import { EVM_CHAINS, REQUESTS, summary } from './requests.js'

const parse = (text: string) => parsePayment(text, chains)

describe('parsePayment: an address alone', () => {
  // A Bitcoin Cash address is a URI as it stands: see test/uri/bip321.test.ts.
  it.each(chains.filter((chain) => chain !== bitcoincash))('is read on $name', (chain) => {
    const address = PAYEE[chain.id] ?? ''
    expect(parse(address)).toEqual({
      chains: chain.evmChainId === undefined ? [chain] : EVM_CHAINS,
      address,
      network: 'mainnet',
    })
  })

  it('is returned in its canonical spelling, whatever surrounds it', () => {
    expect(parse(`  ${EVM.toLowerCase()}\n`)).toMatchObject({ address: EVM })
  })

  it('is not read on a test network, nor on a chain that was not given', () => {
    expect(parse(BTC_TESTNET)).toBeUndefined()
    expect(parsePayment(EVM, [bitcoin, solana])).toBeUndefined()
  })
})

describe('parsePayment: anything else', () => {
  it.each([
    '',
    'hello',
    'https://example.com',
    'mailto:a@b.c',
    'bitcoin:',
    `tron:${TRX}`,
    'WIFI:S:net;;',
  ])('returns undefined for %j', (text) => {
    expect(parse(text)).toBeUndefined()
  })

  it('only reads the standards of the chains it is given', () => {
    expect(parsePayment(`bitcoin:${BTC}?amount=1`, [ethereum, solana])).toBeUndefined()
  })
})

describe('parsePayment: what buildPayment wrote', () => {
  it.each(REQUESTS.map((request) => [summary(request), request] as const))(
    'is read back on %s',
    (_summary, request) => {
      const built = buildPayment(request)
      const parsed = parse(built.text)
      expect(built.standard).toBeDefined()
      expect(built.warnings.filter((warning) => warning.endsWith('-not-encoded'))).toEqual([])
      expect(parsed?.chains).toEqual([request.chain])
      expect(parsed?.address).toBe(built.address)
      expect(parsed?.network).toBe('mainnet')
      expect(parsed?.token).toEqual(built.token)
      for (const field of ['standard', 'amount', 'atomicAmount'] as const) {
        expect(parsed?.[field], field).toBe(built[field])
      }
      for (const note of ['label', 'message', 'memo'] as const) {
        expect(parsed?.[note], note).toBe(request[note])
      }
    },
  )

  it('is tried on every chain that writes links', () => {
    const tried = new Set(REQUESTS.map((request) => request.chain))
    expect(chains.filter((chain) => chain.uri && !tried.has(chain))).toEqual([])
  })
})
