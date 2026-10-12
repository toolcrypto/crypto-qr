import { describe, expect, it } from 'vitest'
import { AmountError, formatAmount, parseAmount } from '../src/index.js'

function issue(value: string, decimals: number): string {
  try {
    parseAmount(value, decimals)
  } catch (error) {
    if (error instanceof AmountError) return error.code
    throw error
  }
  return 'accepted'
}

describe('parseAmount', () => {
  it('converts decimals to the smallest unit exactly', () => {
    expect(parseAmount('1', 8)).toBe(100000000n)
    expect(parseAmount('0.001', 8)).toBe(100000n)
    expect(parseAmount('0.00000001', 8)).toBe(1n)
    expect(parseAmount('21000000', 8)).toBe(2100000000000000n)
    expect(parseAmount('1.5', 18)).toBe(1500000000000000000n)
    // 0.1 + 0.2 style float noise must not exist.
    expect(parseAmount('0.3', 18)).toBe(300000000000000000n)
    expect(parseAmount('123456789.123456789012345678', 18)).toBe(123456789123456789012345678n)
    expect(parseAmount('42', 0)).toBe(42n)
  })

  it('tolerates harmless spellings', () => {
    expect(parseAmount(' 1.50 ', 6)).toBe(1500000n)
    expect(parseAmount('.5', 6)).toBe(500000n)
    expect(parseAmount('5.', 6)).toBe(5000000n)
    expect(parseAmount('007', 6)).toBe(7000000n)
    // Trailing zeros beyond the precision carry no value.
    expect(parseAmount('1.2500000000', 6)).toBe(1250000n)
  })

  it('converts zero, which is a number like any other', () => {
    for (const value of ['0', '0.0', '.0', '000']) expect(parseAmount(value, 8), value).toBe(0n)
  })

  it('rejects what a wallet would not parse', () => {
    for (const value of [
      '',
      ' ',
      '.',
      'abc',
      '1e-8',
      '1E5',
      '-1',
      '+1',
      '1,5',
      '1.2.3',
      '0x10',
      '1 000',
      '١',
    ]) {
      expect(issue(value, 8), JSON.stringify(value)).toBe('format')
    }
  })

  it('rejects more precision than the asset has', () => {
    expect(issue('0.000000001', 8)).toBe('too-many-decimals')
    expect(issue('1.5', 0)).toBe('too-many-decimals')
    expect(issue('0.0000001', 6)).toBe('too-many-decimals')
  })

  it('refuses decimals that no asset can have', () => {
    for (const decimals of [-1, 1.5, 256, Number.NaN]) {
      expect(() => parseAmount('1', decimals), `${decimals}`).toThrow(RangeError)
      expect(() => formatAmount(1n, decimals), `${decimals}`).toThrow(RangeError)
    }
    expect(parseAmount('1', 255)).toBe(10n ** 255n)
  })

  it('reads hostile input in linear time', () => {
    // Both inputs took seconds with the backtracking patterns /^(\d*)\.?(\d*)$/ and /0+$/.
    const started = performance.now()
    expect(issue(`${'1'.repeat(200_000)}x`, 8)).toBe('format')
    expect(issue(`0.${'0'.repeat(200_000)}1`, 8)).toBe('too-many-decimals')
    expect(performance.now() - started).toBeLessThan(500)
  })
})

describe('formatAmount', () => {
  it('writes plain decimals without trailing zeros or exponents', () => {
    expect(formatAmount(0n, 8)).toBe('0')
    expect(formatAmount(1n, 8)).toBe('0.00000001')
    expect(formatAmount(100000n, 8)).toBe('0.001')
    expect(formatAmount(100000000n, 8)).toBe('1')
    expect(formatAmount(150000000n, 8)).toBe('1.5')
    expect(formatAmount(1n, 18)).toBe('0.000000000000000001')
    expect(formatAmount(42n, 0)).toBe('42')
  })

  it('refuses a negative amount', () => {
    expect(() => formatAmount(-1n, 8)).toThrow(RangeError)
  })

  it('round-trips with parseAmount', () => {
    for (const [value, decimals] of [
      ['0.00000001', 8],
      ['1234.5678', 6],
      ['0.000000000000000001', 18],
      ['99999999999', 9],
    ] as const) {
      expect(formatAmount(parseAmount(value, decimals), decimals)).toBe(value)
    }
  })
})
