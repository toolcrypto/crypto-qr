import { describe, expect, it } from 'vitest'
import { base, chains, ethereum, evm, qrSvg, solana, tron } from '../src/index.js'
import * as logos from '../src/logos/index.js'
import { EVM } from './addresses.js'

const { logoFor, ...marks } = logos

describe('logos', () => {
  it('has one logo per chain and per listed token, and nothing else', () => {
    const tickers = new Set(chains.flatMap((chain) => Object.keys(chain.tokens)))
    const expected = [...chains.map((chain) => chain.id), ...tickers].map(
      (name) => `${name.toLowerCase()}Logo`,
    )
    expect(Object.keys(marks).sort()).toEqual(expected.sort())
  })

  it.each(Object.entries(marks))(
    '%s is made of filled paths, and of nothing else',
    (_name, logo) => {
      expect(Object.keys(logo)).toEqual(['paths'])
      expect(logo.paths.length).toBeGreaterThan(0)
      for (const { d, fill } of logo.paths) {
        expect(d).toMatch(/^[Mm][\d\s.,a-zA-Z-]+$/)
        const colours = typeof fill === 'string' ? [fill] : fill.stops.map(([, colour]) => colour)
        for (const colour of colours) expect(colour).toMatch(/^#(?:[\da-f]{3}){1,2}$/i)
      }
      // Cardano's, a ring of dots, is the heaviest. The others are under 1.3 kB.
      expect(JSON.stringify(logo).length).toBeLessThan(3200)
    },
  )

  it.each(Object.entries(marks))('%s is drawn in a code', (_name, logo) => {
    const svg = qrSvg('hello', { logo })
    expect(svg.match(/<path /g)).toHaveLength(1 + logo.paths.length)
    expect(svg).toContain('viewBox="0 0 24 24"')
  })
})

describe('logoFor', () => {
  it('gives the chain’s logo for its native coin', () => {
    for (const chain of chains) {
      expect(logoFor({ chain }), chain.id).toBe(marks[`${chain.id}Logo` as keyof typeof marks])
    }
    expect(logoFor({ chain: ethereum, token: 'ETH' })).toBe(marks.ethereumLogo)
  })

  it('gives the token’s logo for a ticker the chain lists', () => {
    expect(logoFor({ chain: tron, token: 'USDT' })).toBe(marks.usdtLogo)
    expect(logoFor({ chain: solana, token: 'USDC' })).toBe(marks.usdcLogo)
  })

  it('falls back to the chain’s logo for a token it cannot vouch for', () => {
    // USDT is not listed on Base, and a token of the caller's may claim any symbol.
    expect(logoFor({ chain: base, token: 'USDT' })).toBe(marks.baseLogo)
    const custom = { address: EVM, decimals: 6, symbol: 'USDT' }
    expect(logoFor({ chain: ethereum, token: custom })).toBe(marks.ethereumLogo)
  })

  it('has nothing for a chain defined elsewhere', () => {
    expect(logoFor({ chain: evm({ id: 'linea', name: 'Linea', chainId: 59144 }) })).toBeUndefined()
  })
})
