import decodeQR from 'qr/decode.js'
import { ethereum, type QrMatrix } from '../../src/index.js'
import { BTC, BTC_LEGACY, EVM, SOL, TON, TRX } from '../addresses.js'

/** A request of 64 bytes: with a logo, it goes in a symbol of 41 modules. */
export const REQUEST: string = `bitcoin:${BTC_LEGACY}?amount=0.001&label=Shop`

/** What payment codes hold: links of several shapes, and a bare address. */
export const TEXTS: readonly string[] = [
  REQUEST,
  `BITCOIN:${BTC.toUpperCase()}`,
  `ethereum:${ethereum.tokens.USDT.address}@1/transfer?address=${EVM}&uint256=25500000`,
  `solana:${SOL}?amount=1&message=Thanks%20for%20all%20the%20fish`,
  TRX,
  `ton://transfer/${TON}?amount=1500000000&text=%C3%A7a%20marche`,
]

/** Text of an exact length that only fits the byte mode. */
export const filler = (length: number): string =>
  Array.from({ length }, (_, at) => 'payment-uri:0123456789'.charAt((at * 7) % 22)).join('')

export interface Pixels {
  width: number
  height: number
  data: Uint8Array
}

/** The text of the code in an image, read by a decoder other than the encoder. */
export function read(image: Pixels): string | undefined {
  try {
    return decodeQR(image)
  } catch {
    return undefined
  }
}

/** Paints a matrix as RGBA pixels, the way a renderer with square modules would. */
export function rasterize(matrix: QrMatrix, scale = 6, margin = 4): Pixels {
  const width = (matrix.length + margin * 2) * scale
  const data = new Uint8Array(width * width * 4).fill(255)
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const dark = matrix[Math.floor(y / scale) - margin]?.[Math.floor(x / scale) - margin]
      if (dark) data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3)
    }
  }
  return { width, height: width, data }
}

/**
 * The level a symbol declares. Bits 14 and 13 of its format information sit
 * left of the top-left finder pattern, at (0, 8) and (1, 8), masked with 1 and 0.
 */
export function levelOf(matrix: QrMatrix): string {
  const [high, low] = [Number(matrix[8]?.[0]) ^ 1, Number(matrix[8]?.[1])]
  return 'MLHQ'.charAt(high * 2 + low)
}
