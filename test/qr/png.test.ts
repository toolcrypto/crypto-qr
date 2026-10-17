import { describe, expect, it } from 'vitest'
import { qrMatrix, qrPng } from '../../src/index.js'
import { REQUEST, read, TEXTS } from './pixels.js'

/** Decodes the palette PNGs that qrPng writes into RGBA pixels. */
async function readPng(png: Uint8Array) {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  const chunks = new Map<string, Uint8Array>()
  for (let at = 8; at < png.length; at += 12 + view.getUint32(at)) {
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8))
    chunks.set(type, png.subarray(at + 8, at + 8 + view.getUint32(at)))
  }
  const chunk = (type: string) => chunks.get(type) ?? new Uint8Array()
  const [width, height] = [view.getUint32(16), view.getUint32(20)]
  const palette = chunk('PLTE')
  const inflated = new Blob([Uint8Array.from(chunk('IDAT'))])
    .stream()
    .pipeThrough(new DecompressionStream('deflate'))
  const raw = new Uint8Array(await new Response(inflated).arrayBuffer())
  const stride = 1 + Math.ceil(width / 8)
  const data = new Uint8Array(width * height * 4).fill(255)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = ((raw.at(y * stride + 1 + (x >> 3)) ?? 0) >> (7 - (x & 7))) & 1
      data.set(palette.subarray(index * 3, index * 3 + 3), (y * width + x) * 4)
    }
  }
  return {
    width,
    height,
    data,
    signature: [...png.subarray(0, 8)],
    header: [...chunk('IHDR').subarray(8)],
    palette: [...palette],
    transparency: chunks.get('tRNS'),
  }
}

describe('qrPng', () => {
  it.each(TEXTS)('writes a PNG that decodes back to exactly %s', async (text) => {
    const image = await readPng(await qrPng(text, { scale: 5 }))
    expect(image.signature).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    // One bit per pixel, palette, default compression, filter and interlace.
    expect(image.header).toEqual([1, 3, 0, 0, 0])
    expect(image.width).toBe((qrMatrix(text).length + 8) * 5)
    expect(image.height).toBe(image.width)
    expect(read(image)).toBe(text)
  })

  it('applies colours and transparency', async () => {
    const opaque = await readPng(
      await qrPng('hello', { foreground: '#102030', background: '#fff' }),
    )
    expect(opaque.palette).toEqual([255, 255, 255, 0x10, 0x20, 0x30])
    expect(opaque.transparency).toBeUndefined()
    const clear = await readPng(await qrPng('hello', { background: null }))
    expect([...(clear.transparency ?? [])]).toEqual([0])
  })

  it('stays small thanks to compression', async () => {
    const png = await qrPng(REQUEST, { scale: 16 })
    expect(png.length).toBeLessThan(3000)
  })

  it('can be the body of a Response or a Blob as it is', async () => {
    const png = await qrPng('hello')
    expect(new Uint8Array(await new Response(png).arrayBuffer())).toEqual(png)
    expect(new Blob([png], { type: 'image/png' }).size).toBe(png.length)
  })

  it('refuses a scale out of range', async () => {
    await expect(qrPng('x', { scale: 0 })).rejects.toThrow(RangeError)
  })
})
