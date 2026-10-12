import { describe, expect, it } from 'vitest'
import { validateAddress, xrp } from '../../src/index.js'
import { BTC_LEGACY, dead, EVM, TRX, XRP } from '../addresses.js'
import { xrpEncode } from '../encoders.js'
import { BASE58, bytes, code, SAMPLES, typo, valid } from '../helpers.js'

describe('xrp', () => {
  // The special addresses come from the ledger's documentation:
  // https://xrpl.org/docs/concepts/accounts/addresses#special-addresses
  it.each([
    ['a wallet', XRP],
    ['ACCOUNT_ZERO', 'rrrrrrrrrrrrrrrrrrrrrhoLvTp'],
    ['ACCOUNT_ONE', 'rrrrrrrrrrrrrrrrrrrrBZbvji'],
    ['the genesis account', 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh'],
    ['the name reservation black hole', 'rrrrrrrrrrrrrrrrrNAMEtxvNvQ'],
    ['the NaN address', 'rrrrrrrrrrrrrrrrrrrn5RM1rHd'],
  ])('accepts %s', (_case, address) => {
    expect(valid(address, xrp)).toEqual({
      valid: true,
      address,
      kind: 'account',
      network: 'mainnet',
      warnings: [],
    })
  })

  it.each([
    ['a wrong character', `${XRP.slice(0, -1)}7`, 'checksum'],
    // An address and a tag in one: two prefix bytes, the account, a flag and the tag.
    [
      'an X-address',
      xrpEncode(Uint8Array.of(0x05, 0x44, ...dead(20), 0, ...new Uint8Array(8))),
      'unsupported',
    ],
    ['a Bitcoin address', BTC_LEGACY, 'format'],
    ['a Tron address', TRX, 'format'],
    ['an EVM address', EVM, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, xrp)).toBe(expected)
  })
})

describe('XRP Ledger addresses', () => {
  it('every one is accepted, every typo refused', () => {
    for (let i = 0; i < SAMPLES; i++) {
      const address = xrpEncode(Uint8Array.of(0, ...bytes(`xrp ${i}`, 20)))
      expect(validateAddress(address, xrp), address).toMatchObject({ address, kind: 'account' })
      // A typo in the first character would no longer start with "r".
      expect(code(typo(address, BASE58, `xrp ${i}`, 1), xrp), address).toBe('checksum')
    }
  })
})
