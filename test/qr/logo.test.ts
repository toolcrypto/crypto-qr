import { _alignmentPatterns } from 'qr'
import { describe, expect, it } from 'vitest'
import { type QrLogo, type QrMatrix, qrMatrix, qrSvg, type VectorLogo } from '../../src/index.js'
import { encodeForLogo, logoBox } from '../../src/qr/logo.js'
import { drawSvg } from '../../src/qr/svg.js'
import { filler, levelOf, REQUEST, rasterize, read, TEXTS } from './pixels.js'

const IMAGE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4='
const MARK: VectorLogo = { paths: [{ fill: '#f7931a', d: 'M0 0h24v24H0z' }] }
const TESTED: VectorLogo = { ...MARK, overPattern: true }

/** The symbol as it is drawn with a logo: the square cleared for it reads as light. */
function cleared(text: string, logo: QrLogo, extra = 0): QrMatrix {
  const matrix = encodeForLogo(text, logo)
  const { from, to } = logoBox(matrix, logo)
  const inside = (at: number) => at >= from - extra && at < to + extra
  return matrix.map((row, y) => row.map((dark, x) => dark && !(inside(x) && inside(y))))
}

describe('a logo', () => {
  it('draws a vector logo in the code itself', () => {
    const svg = qrSvg(REQUEST, { logo: MARK })
    expect(svg).toContain(
      '<svg x="16" y="16" width="9" height="9" viewBox="0 0 24 24">' +
        '<path fill="#f7931a" d="M0 0h24v24H0z"/></svg></g></svg>',
    )
    // Square modules are drawn without anti-aliasing; the logo must not inherit that.
    expect(svg.match(/crispEdges/g)).toHaveLength(1)
  })

  it('draws gradients and even-odd shapes, and names a gradient after its values', () => {
    const fill = {
      from: [3, 16.3],
      to: [21.4, 15.6],
      stops: [
        [0, '#599DB0'],
        [1, '#47F8C3'],
      ],
    } as const
    const logo: VectorLogo = { paths: [{ d: 'M0 0h9v9z', fill, evenOdd: true }] }
    const id = 'g3_16.3_21.4_15.6_0_599DB0_1_47F8C3'
    expect(qrSvg('x', { logo })).toContain(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse"` +
        ' x1="3" y1="16.3" x2="21.4" y2="15.6">' +
        '<stop offset="0" stop-color="#599DB0"/><stop offset="1" stop-color="#47F8C3"/>' +
        `</linearGradient><path fill="url(#${id})" fill-rule="evenodd" d="M0 0h9v9z"/>`,
    )
  })

  it('draws an image logo by reference', () => {
    expect(qrSvg(REQUEST, { logo: IMAGE })).toContain(
      `<image href="${IMAGE}" x="16" y="16" width="9" height="9"/>`,
    )
    expect(qrSvg('x', { logo: 'https://example.com/logo.png?a=1&b=2' })).toContain(
      'href="https://example.com/logo.png?a=1&amp;b=2"',
    )
  })

  it('draws nothing on the modules cleared for the logo', () => {
    const matrix = encodeForLogo(REQUEST, MARK)
    const { from, to } = logoBox(matrix, MARK)
    const path = /crispEdges" d="([^"]+)"/.exec(drawSvg(matrix, { logo: MARK }))?.[1] ?? ''
    const runs = [...path.matchAll(/M(\d+) (\d+)h(\d+)/g)].map((run) => run.slice(1).map(Number))
    expect(runs.length).toBeGreaterThan(100)
    for (const [x = 0, y = 0, width = 0] of runs) {
      const overlaps = y >= from && y < to && x < to && x + width > from
      expect(overlaps, `run at ${x},${y}`).toBe(false)
    }
  })

  it('uses version 4 at least, and level Q at least', () => {
    expect(qrMatrix('hello').length).toBe(21)
    expect(encodeForLogo('hello', MARK).length).toBe(33)
    for (const bytes of [10, 40, 60, 74, 100, 200, 300]) {
      expect('QH', `${bytes} bytes`).toContain(levelOf(encodeForLogo(filler(bytes), TESTED)))
    }
    expect(levelOf(encodeForLogo(filler(46), MARK))).toBe('Q')
    // The level rises when the symbol has room, and when it is asked for.
    expect(levelOf(encodeForLogo(filler(34), MARK))).toBe('H')
    expect(levelOf(encodeForLogo(filler(46), MARK, 'H'))).toBe('H')
    expect(encodeForLogo(filler(46), MARK, 'H').length).toBeGreaterThan(33)
  })

  it('keeps an untested logo off the alignment pattern in the centre of versions 7 to 13', () => {
    // 74 bytes fill version 6 at level Q; one more would need version 7.
    expect(encodeForLogo(filler(74), MARK).length).toBe(41)
    expect(encodeForLogo(filler(75), MARK).length).toBe(73)
    expect(encodeForLogo(filler(75), IMAGE).length).toBe(73)
  })

  it('lets a tested logo cover it, for a symbol with far fewer modules', () => {
    expect(encodeForLogo(filler(75), TESTED).length).toBe(45)
    expect(encodeForLogo(filler(133), TESTED).length).toBe(57)
  })

  it.each([10, 34, 46, 60, 74, 75, 86, 130, 151, 241, 258, 259, 482, 483, 700])(
    'keeps the logo clear of every other alignment pattern for %i bytes of text',
    (bytes) => {
      for (const logo of [MARK, TESTED]) {
        const matrix = encodeForLogo(filler(bytes), logo)
        const { from, to, side } = logoBox(matrix, logo)
        const centre = (matrix.length - 1) / 2
        expect(side % 2).toBe(1)
        expect(side).toBeGreaterThanOrEqual(7)
        expect(side / matrix.length).toBeLessThanOrEqual(0.22)
        expect(from + to).toBe(matrix.length)
        // A pattern covers the two modules on each side of its centre.
        for (const at of _alignmentPatterns((matrix.length - 17) / 4)) {
          const covered = at + 2 >= from && at - 2 < to
          expect(covered, `pattern at ${at}`).toBe(logo.overPattern === true && at === centre)
        }
      }
    },
  )

  it('refuses a text too long for any version with room', () => {
    expect(() => encodeForLogo(filler(2000), MARK)).toThrow(RangeError)
  })

  it.each(TEXTS)('a payment code still reads with its centre cleared: %s', (text) => {
    for (const logo of [MARK, TESTED]) expect(read(rasterize(cleared(text, logo)))).toBe(text)
  })

  // Level Q capacity in bytes of versions a logo is drawn in, with and without a pattern under it.
  it.each([
    [4, 46],
    [5, 60],
    [6, 74],
    [7, 86],
    [8, 108],
    [10, 151],
    [13, 241],
    [14, 258],
    [17, 364],
  ])(
    'a full version %i symbol reads, even with one more ring of modules cleared',
    (version, bytes) => {
      const text = filler(bytes)
      expect(encodeForLogo(text, TESTED).length).toBe(17 + 4 * version)
      expect(read(rasterize(cleared(text, TESTED)))).toBe(text)
      expect(read(rasterize(cleared(text, TESTED, 1)))).toBe(text)
    },
  )
})
