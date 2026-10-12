import { alignmentCentres, type Ecc, encode, type QrMatrix, sideOf, versionOf } from './encode.js'

/** A linear gradient across the 24-unit grid of a vector logo. */
export interface LinearGradient {
  from: readonly [x: number, y: number]
  to: readonly [x: number, y: number]
  /** Colours along the way, each with its position from 0 to 1. */
  stops: readonly (readonly [offset: number, color: string])[]
}

/** One filled shape of a vector logo. */
export interface LogoPath {
  /** SVG path data on a 24-unit grid. */
  d: string
  /** Colour as #rgb or #rrggbb, or a gradient. */
  fill: string | LinearGradient
  /** Fill by the even-odd rule instead of the non-zero one. */
  evenOdd?: boolean | undefined
}

/**
 * A logo given as shapes, not as markup. It is drawn in the code itself, where
 * every renderer shows it, and nothing in it can run or load.
 */
export interface VectorLogo {
  paths: readonly LogoPath[]
  /**
   * Lets the logo lie on the alignment pattern at the centre of a mid-sized
   * code, which keeps a longer text in a far smaller code. A reader that
   * looks for that pattern can take artwork for it: set this only for a logo
   * whose codes you have read back, at every size, with the readers that count.
   */
  overPattern?: boolean | undefined
}

/** A vector logo, or the address of an image: a `data:image/...` URI or an http(s) URL. */
export type QrLogo = string | VectorLogo

/** Logo width as a share of the symbol's. With its ring it hides under 7.5 % of the modules. */
const SHARE = 0.22
/** Clear modules kept around the logo. */
const RING = 1
/** Smaller symbols cannot spare their centre. */
const MIN_VERSION = 4

/**
 * The largest logo, in modules, that touches no alignment pattern of a
 * version. Versions 7 to 13, 21 to 27 and 35 to 40 have one in the very
 * centre: there is no room in them, unless the logo may cover it.
 */
function room(version: number, overPattern: boolean): number {
  const centre = (sideOf(version) - 1) / 2
  const gaps = alignmentCentres(version)
    .map((at) => Math.abs(at - centre))
    .filter((gap) => gap > 0 || !overPattern)
  // A pattern reaches two modules from its centre, and the logo has its ring.
  return 2 * (Math.min(...gaps) - 2 - RING) - 1
}

/** Side of the logo in modules, odd so that it sits centred on the grid. Negative without room. */
function logoSide(version: number, logo: QrLogo): number {
  const wanted = Math.floor(sideOf(version) * SHARE)
  const overPattern = typeof logo !== 'string' && logo.overPattern === true
  return Math.min(wanted % 2 ? wanted : wanted - 1, room(version, overPattern))
}

/**
 * Encodes text for a symbol that carries a logo: at level Q or higher, in the
 * smallest version from 4 up in which the logo has room.
 *
 * Level Q, not H: Q restores what the logo hides with room to spare, and H
 * would need a larger symbol for the same text, whose smaller modules are
 * harder to read than a wider margin of correction is worth.
 */
export function encodeForLogo(text: string, logo: QrLogo, ecc: Ecc = 'Q'): QrMatrix {
  return encode(
    text,
    ecc === 'L' || ecc === 'M' ? 'Q' : ecc,
    (version) => version >= MIN_VERSION && logoSide(version, logo) > 0,
  )
}

/** Where the logo goes in a symbol, in modules: the logo itself, then the square cleared for it. */
export function logoBox(
  matrix: QrMatrix,
  logo: QrLogo,
): { start: number; side: number; from: number; to: number } {
  const side = logoSide(versionOf(matrix), logo)
  const start = (matrix.length - side) / 2
  return { start, side, from: start - RING, to: start + side + RING }
}
