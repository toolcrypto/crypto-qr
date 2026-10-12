import { bech32 } from '@scure/base'
import {
  arbitrum,
  bitcoin,
  bitcoincash,
  bsc,
  type Chain,
  cardano,
  chains,
  dogecoin,
  litecoin,
  monero,
  type PaymentRequest,
  solana,
  stellar,
  ton,
  zcash,
} from '../../src/index.js'
import { ADA, BCH, BTC, DOGE, dead, EVM, LTC, SOL, TON, XLM, XMR, ZEC } from '../addresses.js'

export const EVM_CHAINS: Chain[] = chains.filter((chain) => chain.evmChainId !== undefined)
export const SHIELDED: string = bech32.encode('zs', bech32.toWords(dead(43)))

/** A request in a few words, for the title of a test: "Solana, USDT: amount, memo". */
export function summary(request: PaymentRequest): string {
  const { chain, token } = request
  const asked = (['amount', 'label', 'message', 'memo'] as const).filter((field) => request[field])
  const asset = typeof token === 'string' ? `${chain.name}, ${token}` : chain.name
  return `${asset}: ${asked.join(', ') || 'an address alone'}`
}

/**
 * Requests that ask for nothing their chain's payment URI has no place for:
 * what is built from one says all of it, and can be read back whole.
 */
export const REQUESTS: PaymentRequest[] = [
  {
    chain: bitcoin,
    address: BTC,
    amount: '0.00012345',
    label: 'Café & Co',
    message: '100% réel',
  },
  { chain: litecoin, address: LTC, amount: '2', label: 'Shop' },
  { chain: dogecoin, address: DOGE, amount: '420.69' },
  { chain: zcash, address: ZEC, amount: '1.5', label: 'Shop', message: 'a=b&c' },
  { chain: zcash, address: SHIELDED, amount: '0.00000001', memo: 'ça ✨ + 1' },
  { chain: bitcoincash, address: BCH },
  { chain: bitcoincash, address: BCH, amount: '0.5', label: 'Shop', message: '1+1' },
  { chain: monero, address: XMR, amount: '0.000000000001', label: 'Shop', message: '1+1' },
  { chain: stellar, address: XLM, amount: '0.0000001', memo: '42', message: 'pay me' },
  { chain: stellar, address: XLM, token: 'USDC', amount: '19.99', memo: 'Order 42 + tip' },
  ...EVM_CHAINS.map((chain) => ({ chain, address: EVM, amount: '0.000000000000000001' })),
  { chain: arbitrum, address: EVM, token: 'USDC', amount: '19.99' },
  { chain: bsc, address: EVM, token: 'USDT', amount: '0.000000000000000001' },
  { chain: cardano, address: ADA, amount: '0.000001' },
  { chain: solana, address: SOL, token: 'USDT', amount: '5', memo: 'inv #9 + tip' },
  { chain: solana, address: SOL, label: 'Shop', message: 'a=b&c' },
  { chain: ton, address: TON, amount: '0.000000001', memo: 'ça marche' },
  { chain: ton, address: TON, token: 'USDT', amount: '12.5', memo: '1+1' },
]
