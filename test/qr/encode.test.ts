import { describe, expect, it } from 'vitest'
import { qrMatrix } from '../../src/index.js'
import { BTC } from '../addresses.js'
import { filler, levelOf, rasterize, read, TEXTS } from './pixels.js'

describe('qrMatrix', () => {
  it.each(TEXTS)('produces a square symbol of a standard size for %s', (text) => {
    const matrix = qrMatrix(text)
    expect(matrix.length).toBeGreaterThanOrEqual(21)
    expect((matrix.length - 17) % 4).toBe(0)
    expect(matrix.every((row) => row.length === matrix.length)).toBe(true)
  })

  it('is indexed [y][x]', () => {
    // Every QR symbol has one module that is always dark at x = 8, y = size - 8.
    // With rows and columns swapped it would land on a format bit instead,
    // which is light for at least one of these inputs.
    const matrices = Array.from({ length: 12 }, (_, i) => qrMatrix(`payment ${i}`))
    expect(matrices.every((matrix) => matrix.at(-8)?.[8])).toBe(true)
    expect(matrices.every((matrix) => matrix[8]?.at(-8))).toBe(false)
  })

  it.each(TEXTS)('decodes back to exactly %s', (text) => {
    for (const ecc of ['L', 'M', 'Q', 'H'] as const) {
      expect(read(rasterize(qrMatrix(text, ecc))), ecc).toBe(text)
    }
  })

  it('uses the denser alphanumeric mode for uppercase bech32', () => {
    const upper = qrMatrix(`BITCOIN:${BTC.toUpperCase()}`)
    expect(upper.length).toBeLessThan(qrMatrix(`bitcoin:${BTC}`).length)
  })

  it('declares the level asked for when the symbol is full', () => {
    // A version 1 symbol holds 17, 14, 11 or 7 bytes, by level.
    for (const [level, bytes] of [
      ['L', 17],
      ['M', 14],
      ['Q', 11],
      ['H', 7],
    ] as const) {
      const matrix = qrMatrix(filler(bytes), level)
      expect(matrix.length, level).toBe(21)
      expect(levelOf(matrix), level).toBe(level)
    }
  })

  it('raises the level as far as the symbol has room, never the size', () => {
    expect(levelOf(qrMatrix(filler(7), 'L'))).toBe('H')
    expect(levelOf(qrMatrix(filler(11), 'L'))).toBe('Q')
    expect(levelOf(qrMatrix(filler(12), 'L'))).toBe('M')
    expect(qrMatrix(filler(12), 'L').length).toBe(21)
    expect(qrMatrix(filler(12), 'H').length).toBeGreaterThan(21)
  })

  it('throws when the text does not fit', () => {
    expect(() => qrMatrix('x'.repeat(5000))).toThrow(RangeError)
  })

  it('refuses a level that is not one, or text that is not text', () => {
    for (const level of ['h', 'high', 'constructor', '']) {
      expect(() => qrMatrix('x', level as never), level).toThrow(
        'The error-correction level must be one of H, Q, M, L.',
      )
    }
    expect(() => qrMatrix(42 as never)).toThrow(TypeError)
    expect(() => qrMatrix(undefined as never)).toThrow('The text of a QR code must be a string.')
  })
})
