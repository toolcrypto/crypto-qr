import { bech32 } from '@scure/base'
import { describe, expect, it } from 'vitest'
import { buildPayment, chains, parsePayment, zcash } from '../../src/index.js'
import { dead, ZEC } from '../addresses.js'

const SHIELDED = bech32.encode('zs', bech32.toWords(dead(43)))
// The two addresses of the specification's examples, both of the test network.
const SPEC_TRANSPARENT = 'tmEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU'
const SPEC_SAPLING =
  'ztestsapling10yy2ex5dcqkclhc7z7yrnjq2z6feyjad56ptwlfgmy77dmaqqrl9gyhprdx59qgmsnyfska2kez'

const parse = (text: string) => parsePayment(text, chains)

describe('ZIP-321: writing', () => {
  it('writes the amount in whole zcash, with a label and a message', () => {
    const notes = { label: 'Corner shop', message: 'Order 42' }
    expect(buildPayment({ chain: zcash, address: ZEC, amount: '1.5', ...notes })).toEqual({
      text: `zcash:${ZEC}?amount=1.5&label=Corner%20shop&message=Order%2042`,
      standard: 'ZIP-321',
      address: ZEC,
      amount: '1.5',
      atomicAmount: '150000000',
      warnings: [],
    })
  })

  it('writes the memo of a shielded address in base64url, as the specification does', () => {
    const request = { chain: zcash, address: SHIELDED, amount: '1', memo: 'This is a simple memo.' }
    expect(buildPayment(request)).toMatchObject({
      text: `zcash:${SHIELDED}?amount=1&memo=VGhpcyBpcyBhIHNpbXBsZSBtZW1vLg`,
      warnings: [],
    })
    expect(buildPayment({ ...request, memo: 'ça ✨ >?' }).text).toBe(
      `zcash:${SHIELDED}?amount=1&memo=w6dhIOKcqCA-Pw`,
    )
  })

  it('flags a memo for a transparent address, which takes none', () => {
    expect(buildPayment({ chain: zcash, address: ZEC, amount: '1', memo: 'ref' })).toMatchObject({
      text: `zcash:${ZEC}?amount=1`,
      warnings: ['memo-not-encoded'],
    })
  })

  it('flags a memo of more than 512 bytes', () => {
    const request = { chain: zcash, address: SHIELDED, amount: '1' }
    expect(buildPayment({ ...request, memo: 'x'.repeat(512) }).warnings).toEqual([])
    expect(buildPayment({ ...request, memo: 'x'.repeat(513) })).toMatchObject({
      text: `zcash:${SHIELDED}?amount=1`,
      warnings: ['memo-not-encoded'],
    })
  })
})

describe('ZIP-321: reading', () => {
  it('reads the valid example of the specification that asks for one payment', () => {
    const uri =
      `zcash:${SPEC_SAPLING}?amount=1&memo=VGhpcyBpcyBhIHNpbXBsZSBtZW1vLg` +
      '&message=Thank%20you%20for%20your%20purchase'
    expect(parse(uri)).toEqual({
      standard: 'ZIP-321',
      chains: [zcash],
      address: SPEC_SAPLING,
      network: 'testnet',
      amount: '1',
      atomicAmount: '100000000',
      message: 'Thank you for your purchase',
      memo: 'This is a simple memo.',
    })
  })

  it('reads a transparent payment and keeps "+" as it is written', () => {
    expect(parse(`zcash:${ZEC}?amount=21000000&label=C++`)).toMatchObject({
      address: ZEC,
      atomicAmount: '2100000000000000',
      label: 'C++',
    })
  })

  // Each of these is given as invalid by the specification.
  it.each([
    [
      'no address for the first payment',
      `zcash:?amount=3491405.05201255&address.1=${SPEC_SAPLING}&amount.1=5740296.87793245`,
    ],
    [
      'no address for the second payment',
      `zcash:?address=${SPEC_TRANSPARENT}&amount=1&amount.1=2&address.2=${SPEC_SAPLING}`,
    ],
    ['an index of zero', `zcash:?address.0=${SPEC_SAPLING}&amount.0=2`],
    ['two amounts', `zcash:?amount=1.234&amount=2.345&address=${SPEC_TRANSPARENT}`],
    [
      'two amounts for one index',
      `zcash:?amount.1=1.234&amount.1=2.345&address.1=${SPEC_TRANSPARENT}`,
    ],
    ['a percent-encoded amount', `zcash:${SPEC_TRANSPARENT}?amount=1%30`],
    ['a percent-encoded name', `zcash:${SPEC_TRANSPARENT}?%61mount=1`],
    ['a percent-encoded address', `zcash:%74mEZhbWHTpdKMw5it8YDspUXSMGQyFwovpU?amount=1`],
    ['an authority', `zcash://${SPEC_TRANSPARENT}?amount=1`],
    [
      'an asset with an amount',
      `zcash:?address=${SPEC_SAPLING}&amount=5&req-asset=not@valid!chars`,
    ],
  ])('refuses the invalid example with %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })

  it.each([
    [
      'a second payment, which one request cannot hold',
      `zcash:${ZEC}?amount=1&address.1=${SHIELDED}&amount.1=2`,
    ],
    ['a required parameter it does not know', `zcash:${ZEC}?amount=1&req-future=1`],
    ['a memo for a transparent address', `zcash:${ZEC}?amount=1&memo=cmVm`],
    ['a memo in the usual base64', `zcash:${SHIELDED}?memo=w6dhIOKcqCA+Pw`],
    ['a memo that is not base64', `zcash:${SHIELDED}?memo=A`],
    ['a memo that is not text', `zcash:${SHIELDED}?memo=_w`],
    ['a memo of more than 512 bytes', `zcash:${SHIELDED}?memo=${'QUFB'.repeat(171)}`],
    ['an amount without a leading zero', `zcash:${ZEC}?amount=.5`],
    ['more than eight decimals, even zeros', `zcash:${ZEC}?amount=1.000000000`],
    ['more zcash than can exist', `zcash:${ZEC}?amount=21000000.00000001`],
    ['a mistyped address', `zcash:${ZEC.slice(0, -1)}d?amount=1`],
  ])('refuses %s', (_case, uri) => {
    expect(parse(uri)).toBeUndefined()
  })
})
