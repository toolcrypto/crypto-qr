import { describe, expect, it } from 'vitest'
import { qrMatrix, qrSvg, type SvgOptions } from '../../src/index.js'
import { drawSvg } from '../../src/qr/svg.js'
import { REQUEST } from './pixels.js'

describe('qrSvg', () => {
  it('draws a standalone SVG with the quiet zone included', () => {
    const total = qrMatrix(REQUEST).length + 8
    const svg = qrSvg(REQUEST)
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" /)
    expect(svg).toMatch(/<\/svg>$/)
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}" width="512" height="512"`)
    expect(svg).toContain('role="img" aria-label="QR code"')
    expect(svg).toContain('<rect width="100%" height="100%" fill="#ffffff"/>')
    expect(svg).toContain('<g fill="#000000" transform="translate(4 4)">')
  })

  it('applies size, margin, colours and the text alternative', () => {
    const total = qrMatrix('hello').length + 4
    const options = { size: 300, margin: 2, foreground: '#123', background: '#fedcba', alt: 'Pay' }
    const svg = qrSvg('hello', options)
    expect(svg).toContain(`viewBox="0 0 ${total} ${total}" width="300" height="300"`)
    expect(svg).toContain('aria-label="Pay"')
    expect(svg).toContain('fill="#fedcba"')
    expect(svg).toContain('<g fill="#123" transform="translate(2 2)">')
  })

  it('leaves the background out when asked', () => {
    expect(qrSvg('hello', { background: null })).not.toContain('<rect')
  })

  it('draws one rectangle per run of dark modules, without anti-aliasing', () => {
    const matrix = [
      [true, true, false],
      [false, false, false],
      [true, false, true],
    ]
    expect(drawSvg(matrix)).toContain(
      '<path shape-rendering="crispEdges" d="M0 0h2v1h-2zM0 2h1v1h-1zM2 2h1v1h-1z"/>',
    )
  })

  it.each(['rounded', 'dots'] as const)('draws the finder patterns apart for %s', (shape) => {
    const svg = qrSvg(REQUEST, { shape })
    expect(svg).toContain('fill-rule="evenodd"')
    expect(svg).not.toContain('crispEdges')
    expect(qrSvg(REQUEST)).not.toContain('evenodd')
  })

  it.each<[string, SvgOptions]>([
    ['a colour name', { foreground: 'red' }],
    ['markup as a colour', { background: '"/><script>' }],
    ['a script URL as a logo', { logo: 'javascript:alert(1)' }],
    ['a non-image data URI as a logo', { logo: 'data:text/html,<script>' }],
    ['a colour that loads something in a logo', { logo: { paths: [{ d: '', fill: 'url(//x)' }] } }],
    ['a fractional margin', { margin: 1.5 }],
    ['a tiny size', { size: 2 }],
    ['a shape it does not draw', { shape: 'circle' as never }],
    ['a level that is not one', { ecc: 'h' as never }],
    ['a level that is not one, with a logo', { ecc: 'h' as never, logo: 'https://example.com/a' }],
  ])('refuses %s', (_case, options) => {
    expect(() => qrSvg('x', options)).toThrow(RangeError)
  })

  it('lets no option add markup', () => {
    const hostile = '"/><script>alert(1)</script><x y="'
    const gradient = { from: [hostile, 0], to: [0, 0], stops: [[hostile, '#000']] }
    const logo = {
      paths: [
        { d: hostile, fill: '#000' },
        { d: 'M0 0', fill: gradient },
      ],
    }
    for (const options of [
      { alt: hostile },
      { logo: `https://example.com/${hostile}` },
      // What a careless caller might pass on from a query string.
      { logo } as unknown as SvgOptions,
    ]) {
      const svg = qrSvg('x', options)
      expect(svg).not.toMatch(/<script|<x /)
      expect(svg.split('"').length % 2, 'quotes are balanced').toBe(1)
    }
    expect(qrSvg('x', { alt: 'a "b" <c> & d' })).toContain(
      'aria-label="a &quot;b&quot; &lt;c&gt; &amp; d"',
    )
  })
})
