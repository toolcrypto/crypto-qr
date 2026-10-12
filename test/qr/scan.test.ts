import { readFileSync } from 'node:fs'
import jsqr from 'jsqr'
import decodeQR from 'qr/decode.js'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader'
import { ethereum, type QrLogo, type QrShape, qrSvg, stellar } from '../../src/index.js'
import * as logos from '../../src/logos/index.js'
import { BTC, EVM, XLM } from '../addresses.js'

// Every code is drawn, turned into pixels by a real SVG renderer, and read
// back by three decoders that share no code with each other or with the
// encoder.

const { logoFor, ...marks } = logos

// jsQR is CommonJS with types written for ES modules: the import is the function itself.
const jsQR = jsqr as unknown as typeof jsqr.default

// ZXing would download its WebAssembly from a CDN: it gets the file of the installed package.
const wasm = new URL(import.meta.resolve('zxing-wasm/reader/zxing_reader.wasm'))
prepareZXingModule({ overrides: { wasmBinary: readFileSync(wasm) } })

const USDT = ethereum.tokens.USDT.address
const USDC = stellar.tokens.USDC.address
const NOTE = 'Order%2042%3A%20two%20coffees%20and%20a%20croissant'

/** One text per size of symbol a logo ends up in: 33, 41, 73 and 77 modules a side. */
const TEXTS = {
  'an address': BTC,
  'a request': `bitcoin:${BTC}?amount=0.001`,
  // Past 74 bytes a logo needs a symbol without an alignment pattern at its centre.
  'a token request': `ethereum:${USDT}@1/transfer?address=${EVM}&uint256=25500000`,
  'a token request with a memo and a note, the longest kind':
    `web+stellar:pay?destination=${XLM}&amount=25.5&asset_code=USDC&asset_issuer=${USDC}` +
    `&memo=1234567890&memo_type=MEMO_ID&msg=${NOTE}`,
}

/**
 * Pixels per module: a sharp drawing, then about as few as a reader can work
 * with. Whole numbers, so that the test is about the drawing and not about the
 * luck of resampling.
 */
const SCALES = [10, 3]

type Reader = (png: Uint8Array, image: ImageData) => Promise<string | undefined>

const READERS: Record<string, Reader> = {
  'ZXing-C++': async (png) => (await readBarcodes(png, { formats: ['QRCode'] })).at(0)?.text,
  jsQR: async (_png, image) => jsQR(image.data, image.width, image.height)?.data,
  'paulmillr/qr': async (_png, image) => {
    try {
      return decodeQR(image)
    } catch {
      return undefined
    }
  },
}

/** The readers that fail to give back the text of a code, with the scale they failed at. */
async function unread(text: string, shape: QrShape, logo?: QrLogo): Promise<string[]> {
  const modules = Number(/viewBox="0 0 (\d+)/.exec(qrSvg(text, { logo }))?.[1])
  const failed: string[] = []
  for (const scale of SCALES) {
    const svg = qrSvg(text, { shape, logo, size: modules * scale })
    const drawing = sharp(new TextEncoder().encode(svg))
    const png = new Uint8Array(await drawing.png().toBuffer())
    const { data, info } = await drawing.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const image = { data: new Uint8ClampedArray(data), width: info.width, height: info.height }
    for (const [name, read] of Object.entries(READERS)) {
      if ((await read(png, image as ImageData)) !== text) failed.push(`${name} at ${scale} px`)
    }
  }
  return failed
}

const LOGOS: [string, QrLogo | undefined][] = [['no logo', undefined], ...Object.entries(marks)]

describe.each(Object.entries(TEXTS))('%s', (_kind, text) => {
  it.each(LOGOS)('reads with %s', async (_name, logo) => {
    expect(await unread(text, 'square', logo)).toEqual([])
  })
})

describe.each(['rounded', 'dots'] as const)('the %s style', (shape) => {
  it.each(LOGOS)('reads with %s', async (_name, logo) => {
    for (const text of Object.values(TEXTS)) expect(await unread(text, shape, logo)).toEqual([])
  })
})

describe('an image logo', () => {
  it('is drawn by a renderer that follows data URIs', async () => {
    const dot =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2">' +
      '<circle cx="1" cy="1" r="1" fill="#f7931a"/></svg>'
    const logo = `data:image/svg+xml,${encodeURIComponent(dot)}`
    expect(await unread(TEXTS['a token request'], 'square', logo)).toEqual([])
  })
})

describe('a logo allowed over the alignment pattern', () => {
  it('reads in the smaller symbol it then fits', async () => {
    const logo = { ...marks.usdtLogo, overPattern: true }
    const sides = [marks.usdtLogo, logo].map((mark) =>
      Number(/viewBox="0 0 (\d+)/.exec(qrSvg(TEXTS['a token request'], { logo: mark }))?.[1]),
    )
    expect(sides).toEqual([73 + 8, 53 + 8])
    expect(await unread(TEXTS['a token request'], 'square', logo)).toEqual([])
  })
})
