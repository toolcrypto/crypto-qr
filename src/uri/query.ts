/**
 * Writes a query string, leading "?" included, skipping absent values. Spaces
 * become %20, which every wallet reads back as a space; "+" would not be.
 */
export function toQuery(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params).flatMap(([key, value]) =>
    value === undefined ? [] : `${key}=${encodeURIComponent(value)}`,
  )
  return pairs.length ? `?${pairs.join('&')}` : ''
}

/** Splits "address?query" into its two parts. */
export function splitQuery(text: string): [head: string, search: string] {
  const mark = text.indexOf('?')
  return mark === -1 ? [text, ''] : [text.slice(0, mark), text.slice(mark + 1)]
}

interface QueryStyle {
  /** Keys are matched whatever their case, and come out in lowercase. */
  caseless?: boolean
  /** "+" stands for a space, as in a web form. */
  form?: boolean
}

/**
 * Reads a query string into the values of each key, in order. Returns
 * undefined when the percent-encoding is malformed.
 */
export function fromQuery(
  search: string,
  { caseless, form }: QueryStyle = {},
): Map<string, string[]> | undefined {
  const decode = (text: string) => decodeURIComponent(form ? text.replaceAll('+', ' ') : text)
  const params = new Map<string, string[]>()
  try {
    for (const pair of search.split('&')) {
      if (!pair) continue
      const [name = '', ...rest] = pair.split('=')
      const key = caseless ? decode(name).toLowerCase() : decode(name)
      const value = decode(rest.join('='))
      const values = params.get(key)
      if (values) values.push(value)
      else params.set(key, [value])
    }
  } catch {
    return undefined
  }
  return params
}

/**
 * The value of each key, in the order asked. Returns undefined when one of
 * them appears more than once: the request would be ambiguous.
 */
export function take<Keys extends string[]>(
  params: Map<string, string[]>,
  ...keys: Keys
): { [Index in keyof Keys]: string | undefined } | undefined {
  const values = keys.map((key) => params.get(key) ?? [])
  return values.some((found) => found.length > 1)
    ? undefined
    : (values.map(([value]) => value) as { [Index in keyof Keys]: string | undefined })
}
