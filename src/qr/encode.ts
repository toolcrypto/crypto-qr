// `_alignmentPatterns` is the encoder's own table. It exports it for renderers
// such as this one, but outside its documented API: what makes it safe to rely
// on is that package.json asks for one exact version of `qr`.
import encodeQR, { _alignmentPatterns } from 'qr'
import { oneOf } from './style.js'

/** Error-correction level: L recovers about 7 % of damage, M 15 %, Q 25 %, H 30 %. */
export type Ecc = 'L' | 'M' | 'Q' | 'H'

/** A QR symbol without its quiet zone: `matrix[y][x]` is true for a dark module. */
export type QrMatrix = readonly (readonly boolean[])[]

const LEVELS = { L: 'low', M: 'medium', Q: 'quartile', H: 'high' } as const
const STRONGEST_FIRST: readonly Ecc[] = ['H', 'Q', 'M', 'L']

/** Side of a symbol in modules: 21 for version 1, four more for each version up to 40. */
export const sideOf = (version: number): number => 17 + 4 * version

/** The version of a symbol, from its side. */
export const versionOf = (matrix: QrMatrix): number => (matrix.length - 17) / 4

/**
 * Row and column indexes of the centres of a version's alignment patterns.
 * Every pair of them holds a 5x5 pattern, except under the finder patterns.
 */
export const alignmentCentres = (version: number): readonly number[] => _alignmentPatterns(version)

/** The symbol of one version, or of the smallest that fits. Undefined when the text has no room. */
function attempt(text: string, ecc: Ecc, version?: number): QrMatrix | undefined {
  try {
    // The encoder insists on a quiet zone of at least one module: ask for one, then strip it.
    const bordered = encodeQR(text, 'raw', { ecc: LEVELS[ecc], border: 1, version })
    return bordered.slice(1, -1).map((row) => row.slice(1, -1))
  } catch {
    return undefined
  }
}

/**
 * Encodes text in the smallest symbol that holds it at the level asked for,
 * among the versions `allows`. That symbol then gets the strongest level it
 * has room for: correction that costs no size.
 *
 * @throws RangeError when the text does not fit in a QR code.
 */
export function encode(
  text: string,
  ecc: Ecc,
  allows: (version: number) => boolean = () => true,
): QrMatrix {
  if (typeof text !== 'string') throw new TypeError('The text of a QR code must be a string.')
  // With the text and the level known to be sound, the encoder only fails for want of room.
  const smallest = attempt(text, oneOf(ecc, STRONGEST_FIRST, 'The error-correction level'))
  let version = smallest ? versionOf(smallest) : 41
  while (version <= 40 && !allows(version)) version++
  for (const level of version > 40 ? [] : STRONGEST_FIRST) {
    const matrix = attempt(text, level, version)
    if (matrix) return matrix
  }
  throw new RangeError('The text is too long for a QR code.')
}

/**
 * Encodes text as a QR symbol. Numeric and alphanumeric modes are used when the
 * whole text allows them. `ecc` is the lowest level accepted: a stronger one is
 * used whenever it fits the same symbol.
 *
 * @throws RangeError when the text does not fit in a QR code.
 */
export function qrMatrix(text: string, ecc: Ecc = 'M'): QrMatrix {
  return encode(text, ecc)
}
