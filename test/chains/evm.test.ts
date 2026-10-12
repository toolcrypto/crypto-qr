import { bytesToHex } from '@noble/hashes/utils.js'
import { describe, expect, it } from 'vitest'
import { chains, ethereum, evm, validateAddress } from '../../src/index.js'
import { BTC, EVM } from '../addresses.js'
import { eip55 } from '../encoders.js'
import { bytes, code, HEX, SAMPLES, typo, valid } from '../helpers.js'

const EVM_CHAINS = chains.filter((chain) => chain.evmChainId !== undefined)

// Test vectors of EIP-55: all capitals, all lowercase, then mixed.
const SINGLE_CASE = [
  '0x52908400098527886E0F7030069857D2E4169EE7',
  '0x8617E340B3D01FA5F11F306F4090FD50E238070D',
  '0xde709f2102306220921060314715629080e2fb77',
  '0x27b1fdb04752bbc536007a920d24acb045561c26',
]
const MIXED_CASE = [
  '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
  '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
  '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
  '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
]

describe('evm', () => {
  it.each(MIXED_CASE)('accepts %s on every EVM chain', (address) => {
    for (const chain of EVM_CHAINS) {
      expect(valid(address, chain)).toEqual({
        valid: true,
        address,
        kind: 'account',
        network: 'mainnet',
        warnings: [],
      })
    }
  })

  it.each(SINGLE_CASE)('accepts %s, whose checksum happens to be a single case', (address) => {
    // With no mixed case to verify, it cannot be told from an address without a checksum.
    expect(valid(address, ethereum)).toMatchObject({ address, warnings: ['no-checksum'] })
  })

  it.each(MIXED_CASE)('checksums %s written in a single case, with a warning', (address) => {
    for (const plain of [address.toLowerCase(), `0x${address.slice(2).toUpperCase()}`]) {
      expect(valid(plain, ethereum)).toMatchObject({ address, warnings: ['no-checksum'] })
    }
  })

  it.each([
    ['a wrong capital', EVM.replace('0xD', '0xd'), 'checksum'],
    ['another wrong capital', EVM.replace(/F$/, 'f'), 'checksum'],
    ['a missing digit', EVM.slice(0, -1), 'length'],
    ['extra digits', `${EVM}00`, 'length'],
    ['no prefix', EVM.slice(2), 'format'],
    ['a capital X', `0X${EVM.slice(2).toLowerCase()}`, 'format'],
    ['a letter that is not hexadecimal', `${EVM.slice(0, -1)}g`, 'format'],
    ['an ENS name', 'example.eth', 'format'],
    ['a Bitcoin address', BTC, 'format'],
  ])('refuses %s', (_case, address, expected) => {
    expect(code(address, ethereum)).toBe(expected)
  })

  it('checks addresses the same way on a chain defined by the caller', () => {
    const linea = evm({ id: 'linea', name: 'Linea', chainId: 59144 })
    expect(linea).toMatchObject({ symbol: 'ETH', decimals: 18, evmChainId: 59144, tokens: {} })
    expect(valid(EVM, linea).kind).toBe('account')
  })
})

describe('EVM addresses', () => {
  it('are checksummed as EIP-55 says, and nearly every typo is caught', () => {
    let missed = 0
    for (let i = 0; i < SAMPLES; i++) {
      const digits = bytesToHex(bytes(`evm ${i}`, 20))
      const address = eip55(digits)
      expect(validateAddress(`0x${digits}`, ethereum)).toMatchObject({
        address,
        warnings: ['no-checksum'],
      })
      expect(validateAddress(address, ethereum)).toMatchObject({ address, warnings: [] })
      const wrong = `0x${typo(address.slice(2), HEX, `evm ${i}`)}`
      // A typo in a single-case address would go unseen: the samples all have both cases.
      expect(address).not.toBe(address.toLowerCase())
      if (code(wrong, ethereum) === 'valid' && wrong !== wrong.toLowerCase()) missed++
    }
    // EIP-55 puts the odds of a typo passing at 0.0247 %.
    expect(missed).toBe(0)
  })
})
