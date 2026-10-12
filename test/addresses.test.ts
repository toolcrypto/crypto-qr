import { ed25519 } from '@noble/curves/ed25519.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import { base58, bech32 } from '@scure/base'
import { describe, expect, it } from 'vitest'
import { chains, detectChains } from '../src/index.js'
import {
  ADA,
  BTC,
  BTC_LEGACY,
  BTC_TESTNET,
  DOGE,
  dead,
  EVM,
  KEY,
  LTC,
  PAYEE,
  SOL,
  TON,
  TRX,
  XLM,
  XMR,
  XRP,
  ZEC,
} from './addresses.js'
import {
  base58check,
  crc16,
  eip55,
  moneroAddress,
  shelley,
  strkey,
  tonAddress,
  xrpEncode,
} from './encoders.js'
import { valid } from './helpers.js'

const segwit = (prefix: string) => bech32.encode(prefix, [0, ...bech32.toWords(dead(20))])

describe('the encoders of the tests', () => {
  it('compute CRC-16/XMODEM, whose check value is 0x31C3', () => {
    expect(crc16(utf8ToBytes('123456789'))).toBe(0x31c3)
  })
})

describe('the addresses the tests pay to', () => {
  // Bitcoin Cash is not in this list: no encoder here writes CashAddr. Its
  // address is taken apart, by other means than the library's, in its own tests.
  it.each([
    [BTC, segwit('bc')],
    [BTC_LEGACY, base58check.encode(Uint8Array.of(0, ...dead(20)))],
    [BTC_TESTNET, segwit('tb')],
    [LTC, segwit('ltc')],
    [DOGE, base58check.encode(Uint8Array.of(30, ...dead(20)))],
    [ZEC, base58check.encode(Uint8Array.of(0x1c, 0xb8, ...dead(20)))],
    [XRP, xrpEncode(Uint8Array.of(0, ...dead(20)))],
    [XMR, moneroAddress(18, KEY, KEY)],
    [XLM, strkey(6 << 3, KEY)],
    [EVM, eip55(bytesToHex(dead(20)))],
    [ADA, shelley('addr', 0x01, dead(56))],
    [TRX, base58check.encode(Uint8Array.of(0x41, ...dead(20)))],
    [SOL, base58.encode(KEY)],
    [TON, tonAddress(0x51, dead(32))],
  ])('%s encodes the bytes it is said to', (address, built) => {
    expect(address).toBe(built)
  })

  it('use a key that is a point of its curve, as a real one is', () => {
    expect(() => ed25519.Point.fromBytes(KEY)).not.toThrow()
    expect(() => ed25519.Point.fromBytes(dead(32))).toThrow()
  })

  it.each(chains)('pay $name at a current mainnet address that no other chain reads', (chain) => {
    const address = PAYEE[chain.id] ?? ''
    expect(valid(address, chain)).toMatchObject({ address, network: 'mainnet', warnings: [] })
    const evm = chains.filter((other) => other.evmChainId !== undefined)
    expect(detectChains(address, chains)).toEqual(chain.evmChainId === undefined ? [chain] : evm)
  })
})
