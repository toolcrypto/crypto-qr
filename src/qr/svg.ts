import { encode, type QrMatrix } from './encode.js'
import { encodeForLogo, type LinearGradient, logoBox, type QrLogo } from './logo.js'
import { color, oneOf, type QrStyle, within } from './style.js'

export type QrShape = 'square' | 'rounded' | 'dots'

export interface SvgOptions extends QrStyle {
  /** Width and height in pixels. Default 512. */
  size?: number | undefined
  /** Module style. `rounded` and `dots` also round the three finder patterns. */
  shape?: QrShape | undefined
  /**
   * A logo for the centre: one from `crypto-qr/logos`, shapes of your own, or
   * the address of an image. The code is then encoded at level Q or higher.
   */
  logo?: QrLogo | undefined
  /** Text alternative of the image. Default "QR code". */
  alt?: string | undefined
}

/** Tells whether a module is dark and still to be drawn. Out-of-range modules are light. */
type Dark = (x: number, y: number) => boolean

const SHAPES: readonly QrShape[] = ['square', 'rounded', 'dots']
const FINDER = 7
const IMAGE = /^(?:data:image\/(?:png|jpeg|gif|webp|svg\+xml)[;,]|https?:\/\/)/i
const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
}

/**
 * Writes an element. Every attribute value is escaped here and nowhere else,
 * so no option can add markup to the image.
 */
function tag(name: string, attributes: Record<string, string | number>, content?: string): string {
  const list = Object.entries(attributes)
    .map(
      ([key, value]) =>
        ` ${key}="${`${value}`.replace(/[&"<>]/g, (char) => ESCAPES[char] ?? char)}"`,
    )
    .join('')
  return content === undefined ? `<${name}${list}/>` : `<${name}${list}>${content}</${name}>`
}

/** One rectangle per horizontal run of dark modules. */
function squares(dark: Dark, modules: number): string {
  let path = ''
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      if (!dark(x, y)) continue
      let width = 1
      while (dark(x + width, y)) width++
      path += `M${x} ${y}h${width}v1h${-width}z`
      x += width
    }
  }
  return path
}

/**
 * A dot a quarter wider than its module, so that neighbours merge. Readers
 * that follow runs of dark pixels lose track of dots that stand apart.
 */
const dot = (x: number, y: number) =>
  `M${x - 0.125} ${y + 0.5}a.625 .625 0 1 0 1.25 0a.625 .625 0 1 0-1.25 0z`

/**
 * A module whose corners are rounded only where both neighbours on that corner
 * are light, so that touching modules merge into one smooth shape.
 */
function blob(dark: Dark, x: number, y: number): string {
  const [up, right, down, left] = [dark(x, y - 1), dark(x + 1, y), dark(x, y + 1), dark(x - 1, y)]
  const [topLeft, topRight, bottomRight, bottomLeft] = [
    !up && !left,
    !up && !right,
    !down && !right,
    !down && !left,
  ]
  const arc = (round: boolean, dx: number, dy: number) => (round ? `a.5 .5 0 0 1 ${dx} ${dy}` : '')
  return (
    `M${x + (topLeft ? 0.5 : 0)} ${y}` +
    `H${x + (topRight ? 0.5 : 1)}${arc(topRight, 0.5, 0.5)}` +
    `V${y + (bottomRight ? 0.5 : 1)}${arc(bottomRight, -0.5, 0.5)}` +
    `H${x + (bottomLeft ? 0.5 : 0)}${arc(bottomLeft, -0.5, -0.5)}` +
    `V${y + (topLeft ? 0.5 : 0)}${arc(topLeft, 0.5, -0.5)}z`
  )
}

/** One shape per dark module, as `draw` makes it. */
function each(dark: Dark, modules: number, draw: (x: number, y: number) => string): string {
  let path = ''
  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) if (dark(x, y)) path += draw(x, y)
  }
  return path
}

/** A clockwise rounded square. Radii are binary fractions, so every coordinate prints exactly. */
function roundedSquare(x: number, y: number, side: number, r: number): string {
  const edge = side - 2 * r
  const arc = (dx: number, dy: number) => `a${r} ${r} 0 0 1 ${dx} ${dy}`
  return (
    `M${x + r} ${y}h${edge}${arc(r, r)}v${edge}${arc(-r, r)}` +
    `h${-edge}${arc(-r, -r)}v${-edge}${arc(r, -r)}z`
  )
}

/**
 * A finder pattern for even-odd filling: a ring with a 5x5 hole, then the 3x3
 * centre. The centre keeps its flat sides: drawn as a disc, it gives readers
 * too few rows with the 1:1:3:1:1 signature, and a round logo can outscore it.
 */
const finder = (x: number, y: number) =>
  roundedSquare(x, y, 7, 2.25) +
  roundedSquare(x + 1, y + 1, 5, 1.25) +
  roundedSquare(x + 2, y + 2, 3, 0.75)

/**
 * A gradient and the id it goes by. The id spells out the gradient's own
 * values: where several codes share a page, equal gradients share an id and
 * different ones never do.
 */
function gradient({ from, to, stops }: LinearGradient): [id: string, markup: string] {
  const id = `g${[...from, ...to, ...stops.flat()].join('_').replaceAll('#', '')}`
  const [[x1, y1], [x2, y2]] = [from, to]
  const colours = stops.map(([offset, stop]) => tag('stop', { offset, 'stop-color': color(stop) }))
  const frame = { id, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 }
  return [id, tag('linearGradient', frame, colours.join(''))]
}

/** The logo in its square: an image, or shapes on their 24-unit grid. */
function drawLogo(logo: QrLogo, start: number, side: number): string {
  const box = { x: start, y: start, width: side, height: side }
  if (typeof logo === 'string') {
    if (IMAGE.test(logo)) return tag('image', { href: logo, ...box })
    throw new RangeError('A logo image must be a data:image URI or an http(s) URL.')
  }
  const shapes = logo.paths.map(({ d, fill, evenOdd }) => {
    const [id, definition] = typeof fill === 'string' ? [] : gradient(fill)
    const paint = typeof fill === 'string' ? color(fill) : `url(#${id})`
    return (
      (definition ?? '') +
      tag('path', { fill: paint, ...(evenOdd && { 'fill-rule': 'evenodd' }), d })
    )
  })
  return tag('svg', { ...box, viewBox: '0 0 24 24' }, shapes.join(''))
}

/** Draws an already encoded symbol. */
export function drawSvg(matrix: QrMatrix, options: SvgOptions = {}): string {
  const {
    size = 512,
    margin = 4,
    shape = 'square',
    foreground = '#000000',
    background = '#ffffff',
    alt = 'QR code',
    logo,
  } = options
  const modules = matrix.length
  const total = modules + 2 * within(margin, 0, 20, 'The margin')
  const far = modules - FINDER
  const hole = logo === undefined ? undefined : logoBox(matrix, logo)
  const styled = oneOf(shape, SHAPES, 'The shape') !== 'square'

  const inFinder = (x: number, y: number) =>
    (x < FINDER && y < FINDER) || (x >= far && y < FINDER) || (x < FINDER && y >= far)
  const inHole = (x: number, y: number) =>
    hole !== undefined && x >= hole.from && x < hole.to && y >= hole.from && y < hole.to
  // Styled shapes draw the finder patterns apart, as rounded rings scanners still lock onto.
  const dark: Dark = (x, y) =>
    matrix[y]?.[x] === true && !inHole(x, y) && !(styled && inFinder(x, y))

  const finders = finder(0, 0) + finder(far, 0) + finder(0, far)
  const symbol = styled
    ? tag('path', { d: each(dark, modules, shape === 'dots' ? dot : (x, y) => blob(dark, x, y)) }) +
      tag('path', { 'fill-rule': 'evenodd', d: finders })
    : // Square modules meet edge to edge: without anti-aliasing no seam shows between them.
      tag('path', { 'shape-rendering': 'crispEdges', d: squares(dark, modules) })

  return tag(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: `0 0 ${total} ${total}`,
      width: within(size, 16, 8192, 'The size'),
      height: size,
      role: 'img',
      'aria-label': alt,
    },
    (background === null
      ? ''
      : tag('rect', { width: '100%', height: '100%', fill: color(background) })) +
      tag(
        'g',
        { fill: color(foreground), transform: `translate(${margin} ${margin})` },
        symbol + (hole && logo !== undefined ? drawLogo(logo, hole.start, hole.side) : ''),
      ),
  )
}

/**
 * Encodes text as a QR code and returns it as a standalone SVG document. Every
 * option is validated or escaped: the result is safe to put in a page even
 * when the options come from someone else.
 *
 * @throws RangeError when the text does not fit or an option is not usable.
 */
export function qrSvg(text: string, options: SvgOptions = {}): string {
  const { logo, ecc } = options
  const matrix = logo === undefined ? encode(text, ecc ?? 'M') : encodeForLogo(text, logo, ecc)
  return drawSvg(matrix, options)
}
