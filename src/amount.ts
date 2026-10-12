export type AmountIssue =
  /** Not a plain decimal number. Exponents such as `1e-8` are refused: wallets do not read them. */
  | 'format'
  /** More fractional digits than the asset can represent. */
  | 'too-many-decimals'

/** Every token standard stores its decimals in one byte. */
export const MAX_DECIMALS = 255

/** What `parseAmount` throws for text that is not an amount the asset can have. */
export class AmountError extends Error {
  override readonly name = 'AmountError'
  readonly code: AmountIssue

  constructor(code: AmountIssue, message: string) {
    super(message)
    this.code = code
  }
}

export function isDecimals(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_DECIMALS
}

/** Returns the decimals, or throws when no asset can have that many. */
function places(decimals: number): number {
  if (isDecimals(decimals)) return decimals
  throw new RangeError(`Decimals must be a whole number from 0 to ${MAX_DECIMALS}.`)
}

/** Drops trailing zeros. A loop, because `/0+$/` is quadratic on a long run of zeros. */
function trimZeros(digits: string): string {
  let end = digits.length
  while (digits.charAt(end - 1) === '0') end--
  return digits.slice(0, end)
}

/**
 * Converts a decimal amount in display units ("0.001") to the asset's smallest
 * unit, without ever going through a float.
 *
 * @throws AmountError when the text is not a plain decimal that fits.
 */
export function parseAmount(text: string, decimals: number): bigint {
  const [, whole = '', fraction = ''] = /^(\d*)(?:\.(\d*))?$/.exec(text.trim()) ?? []
  if (!whole && !fraction) {
    throw new AmountError('format', 'Use a plain decimal number such as 0.001.')
  }
  const significant = trimZeros(fraction)
  if (significant.length > places(decimals)) {
    throw new AmountError('too-many-decimals', `This asset has ${decimals} decimal places at most.`)
  }
  return BigInt(whole + significant.padEnd(decimals, '0'))
}

/** Writes an amount in smallest units as a plain decimal, without trailing zeros. */
export function formatAmount(atomic: bigint, decimals: number): string {
  if (atomic < 0n) throw new RangeError('An amount cannot be negative.')
  const digits = atomic.toString().padStart(places(decimals) + 1, '0')
  const cut = digits.length - decimals
  const fraction = trimZeros(digits.slice(cut))
  return fraction ? `${digits.slice(0, cut)}.${fraction}` : digits.slice(0, cut)
}
