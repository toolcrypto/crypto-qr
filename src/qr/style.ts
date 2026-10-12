import type { Ecc } from './encode.js'

/** Options shared by every output format. */
export interface QrStyle {
  /** Lowest error-correction level accepted. Default M, or Q with a logo. */
  ecc?: Ecc | undefined
  /** Quiet zone around the symbol, in modules. The standard asks for 4, the default. */
  margin?: number | undefined
  /** Module colour as #rgb or #rrggbb. Default #000000. */
  foreground?: string | undefined
  /** Background colour, or null for none. Default #ffffff. */
  background?: string | null | undefined
}

/** Returns the colour, or throws when it is not written as #rgb or #rrggbb. */
export function color(value: string): string {
  if (/^#(?:[\da-f]{3}){1,2}$/i.test(value)) return value
  throw new RangeError(`"${value}" is not a colour written as #rgb or #rrggbb.`)
}

/** Returns the number, or throws when it is not a whole number in the range. */
export function within(value: number, min: number, max: number, name: string): number {
  if (Number.isInteger(value) && value >= min && value <= max) return value
  throw new RangeError(`${name} must be a whole number from ${min} to ${max}.`)
}

/** Returns the value, or throws when it is not one of those allowed. */
export function oneOf<Value extends string>(
  value: Value,
  allowed: readonly Value[],
  name: string,
): Value {
  if (allowed.includes(value)) return value
  throw new RangeError(`${name} must be one of ${allowed.join(', ')}.`)
}
