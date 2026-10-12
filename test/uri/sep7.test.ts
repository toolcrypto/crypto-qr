import { describe, expect, it } from 'vitest'
import { buildPayment, chains, parsePayment, stellar } from '../../src/index.js'
import { dead, XLM } from '../addresses.js'
import { strkey } from '../encoders.js'

const USDC = stellar.tokens.USDC.address
/** A second account, for a token that is not listed. */
const ISSUER = strkey(6 << 3, dead(32))

const parse = (text: string) => parsePayment(text, chains)
const pay = (query: string) => `web+stellar:pay?destination=${XLM}${query}`

describe('SEP-7: writing', () => {
  it('writes the amount in lumens', () => {
    expect(buildPayment({ chain: stellar, address: XLM, amount: '120.1234567' })).toEqual({
      text: pay('&amount=120.1234567'),
      standard: 'SEP-7',
      address: XLM,
      amount: '120.1234567',
      atomicAmount: '1201234567',
      warnings: ['uri-support-varies'],
    })
  })

  it('names a token by its ticker and its issuer', () => {
    expect(
      buildPayment({ chain: stellar, address: XLM, token: 'USDC', amount: '5' }),
    ).toMatchObject({
      text: pay(`&amount=5&asset_code=USDC&asset_issuer=${USDC}`),
      atomicAmount: '50000000',
    })
    const token = { address: ISSUER, decimals: 7, symbol: 'yXLM' }
    expect(buildPayment({ chain: stellar, address: XLM, token }).text).toBe(
      pay(`&asset_code=yXLM&asset_issuer=${ISSUER}`),
    )
  })

  it.each([
    ['no ticker', undefined],
    ['an empty ticker', ''],
    ['a ticker with a space', 'not a code'],
    ['a ticker of thirteen characters', 'THIRTEENCHARS'],
  ])('does not ask for a token it cannot name: %s', (_case, symbol) => {
    const token = { address: ISSUER, decimals: 7, symbol }
    expect(buildPayment({ chain: stellar, address: XLM, token, amount: '5' })).toMatchObject({
      text: XLM,
      warnings: ['amount-not-encoded', 'token-not-encoded'],
    })
  })

  it.each([
    ['a whole number as an id, which is what an exchange hands out', '123456789', 'MEMO_ID'],
    ['the largest id', '18446744073709551615', 'MEMO_ID'],
    ['a number too large for an id as text', '18446744073709551616', 'MEMO_TEXT'],
    ['a number with leading zeros as text, which keeps them', '007', 'MEMO_TEXT'],
    ['anything else as text', 'Order 42', 'MEMO_TEXT'],
  ])('sends %s', (_case, memo, type) => {
    expect(buildPayment({ chain: stellar, address: XLM, memo }).text).toBe(
      pay(`&memo=${encodeURIComponent(memo)}&memo_type=${type}`),
    )
  })

  it('flags a memo that is too long to be sent as text', () => {
    const request = { chain: stellar, address: XLM, amount: '1' }
    expect(buildPayment({ ...request, memo: 'x'.repeat(28) }).warnings).toEqual([
      'uri-support-varies',
    ])
    expect(buildPayment({ ...request, memo: 'é'.repeat(15) })).toMatchObject({
      text: pay('&amount=1'),
      warnings: ['memo-not-encoded', 'uri-support-varies'],
    })
  })

  it('writes a message of 300 characters at most as the note, and flags a label', () => {
    const request = { chain: stellar, address: XLM, label: 'Shop' }
    expect(buildPayment({ ...request, message: 'Order 42' })).toMatchObject({
      text: pay('&msg=Order%2042'),
      warnings: ['label-not-encoded', 'uri-support-varies'],
    })
    expect(buildPayment({ ...request, message: 'x'.repeat(301) })).toMatchObject({
      text: XLM,
      warnings: ['label-not-encoded', 'message-not-encoded'],
    })
  })
})

describe('SEP-7: reading', () => {
  // The two payment requests the specification gives as examples, paid to the test address.
  it('reads the examples of the specification', () => {
    const lumens = pay(
      '&amount=120.1234567&memo=skdjfasf&memo_type=MEMO_TEXT&msg=pay%20me%20with%20lumens',
    )
    expect(parse(lumens)).toEqual({
      standard: 'SEP-7',
      chains: [stellar],
      address: XLM,
      network: 'mainnet',
      amount: '120.1234567',
      atomicAmount: '1201234567',
      message: 'pay me with lumens',
      memo: 'skdjfasf',
    })
    const token = pay(
      `&amount=120.123&asset_code=USD&asset_issuer=${ISSUER}&memo=hasysda987fs` +
        '&memo_type=MEMO_TEXT' +
        '&callback=url%3Ahttps%3A%2F%2FsomeSigningService.com%2Fhasysda987fs%3Fasset%3DUSD',
    )
    expect(parse(token)).toMatchObject({
      token: { address: ISSUER, symbol: 'USD', decimals: 7 },
      amount: '120.123',
      atomicAmount: '1201230000',
      memo: 'hasysda987fs',
    })
  })

  it('names a listed token only under its own ticker', () => {
    expect(parse(pay(`&asset_code=USDC&asset_issuer=${USDC}`))?.token).toEqual({
      address: USDC,
      symbol: 'USDC',
      decimals: 7,
    })
    // The same issuer can issue another asset: the URI says which one it asks for.
    expect(parse(pay(`&asset_code=EURC&asset_issuer=${USDC}`))?.token?.symbol).toBe('EURC')
  })

  it('reads "+" as a space, an id as a memo, and the public network when it is named', () => {
    const uri = pay(
      '&msg=pay+me&memo=42&memo_type=MEMO_ID' +
        '&network_passphrase=Public%20Global%20Stellar%20Network%20%3B%20September%202015',
    )
    expect(parse(uri)).toMatchObject({ message: 'pay me', memo: '42' })
  })

  it.each([
    ['another network', pay('&network_passphrase=Test%20SDF%20Network%20%3B%20September%202015')],
    ['a memo that is a hash', pay(`&memo=${'A'.repeat(43)}%3D&memo_type=MEMO_HASH`)],
    ['a ticker without its issuer', pay('&amount=5&asset_code=USDC')],
    ['an issuer without its ticker', pay(`&amount=5&asset_issuer=${USDC}`)],
    ['an issuer that is not an address', pay('&amount=5&asset_code=USDC&asset_issuer=circle.com')],
    ['two destinations', pay(`&destination=${ISSUER}`)],
    ['more decimals than a stroop', pay('&amount=0.00000001')],
    ['no destination', 'web+stellar:pay?amount=1'],
    ['a transaction to sign, which is another operation', 'web+stellar:tx?xdr=AAAA'],
    ['a mistyped destination', `web+stellar:pay?destination=${XLM.slice(0, -1)}H`],
    ['the scheme without "web+"', `stellar:pay?destination=${XLM}`],
  ])('refuses %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })
})
