import { encode } from './encode.js'
import { color, type QrStyle, within } from './style.js'

export interface PngOptions extends QrStyle {
  /** Pixels per module, from 1 to 64. Default 8. */
  scale?: number | undefined
}

const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

/** CRC-32, as every PNG chunk ends with. */
function crc32(bytes: Uint8Array): number {
  let crc = ~0
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return ~crc >>> 0
}

/** A PNG chunk: length, type, data, then the CRC of type and data. */
function chunk(type: string, data: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(data.length + 12)
  const view = new DataView(out.buffer)
  view.setUint32(0, data.length)
  out.set(new TextEncoder().encode(type), 4)
  out.set(data, 8)
  view.setUint32(data.length + 8, crc32(out.subarray(4, data.length + 8)))
  return out
}

/** Splits #rgb or #rrggbb into its three channels. */
function rgb(hex: string): number[] {
  const full = hex.length === 4 ? hex.replace(/[^#]/g, '$&$&') : hex
  return [1, 3, 5].map((at) => parseInt(full.slice(at, at + 2), 16))
}

/**
 * Encodes text as a QR code with square modules and returns it as PNG bytes:
 * one bit per pixel with a two-colour palette, so the file stays tiny. The bytes
 * can be the body of a `Response` or a `Blob` as they are.
 *
 * Needs `CompressionStream`: every current browser, Node, Workers, Deno, Bun.
 *
 * @throws RangeError when the text does not fit or an option is not usable.
 */
export async function qrPng(
  text: string,
  options: PngOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const { scale = 8, margin = 4, foreground = '#000000', background = '#ffffff' } = options
  const matrix = encode(text, options.ecc ?? 'M')
  const side = matrix.length + 2 * within(margin, 0, 20, 'The margin')
  const width = side * within(scale, 1, 64, 'The scale')

  // Every pixel row is a filter byte (0: none) followed by the pixels, most significant bit first.
  const stride = 1 + Math.ceil(width / 8)
  const pixels = new Uint8Array(stride * width)
  for (let line = 0; line < side; line++) {
    const modules = matrix[line - margin] ?? []
    const row = new Uint8Array(stride)
    for (let byte = 1; byte < stride; byte++) {
      let bits = 0
      for (let x = (byte - 1) * 8; x < byte * 8; x++) {
        bits = (bits << 1) | Number(modules[Math.floor(x / scale) - margin] === true)
      }
      row[byte] = bits
    }
    for (let repeat = 0; repeat < scale; repeat++) pixels.set(row, (line * scale + repeat) * stride)
  }

  const header = new DataView(new ArrayBuffer(13))
  header.setUint32(0, width)
  header.setUint32(4, width)
  header.setUint8(8, 1) // bit depth
  header.setUint8(9, 3) // colour type: palette
  const palette = [...rgb(color(background ?? '#ffffff')), ...rgb(color(foreground))]
  const deflated = new Blob([pixels]).stream().pipeThrough(new CompressionStream('deflate'))

  const png = new Blob([
    SIGNATURE,
    chunk('IHDR', new Uint8Array(header.buffer)),
    chunk('PLTE', Uint8Array.from(palette)),
    // No background: make palette entry 0 fully transparent.
    ...(background === null ? [chunk('tRNS', Uint8Array.of(0))] : []),
    chunk('IDAT', new Uint8Array(await new Response(deflated).arrayBuffer())),
    chunk('IEND', new Uint8Array()),
  ])
  return new Uint8Array(await png.arrayBuffer())
}
