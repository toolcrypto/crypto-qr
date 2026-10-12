// Every chain without the check of its addresses: what it is called, its coin,
// its listed tokens and its payment URI. The unchecked entry exports these as
// they are; the files next to this one add to each the check of its addresses.
import type { Chain, Token } from '../chain.js'
import { bip321 } from '../uri/bip321.js'
import { cip13 } from '../uri/cip13.js'
import { eip681 } from '../uri/eip681.js'
import { moneroUri } from '../uri/monero.js'
import { sep7 } from '../uri/sep7.js'
import { solanaPay } from '../uri/solana-pay.js'
import { tonTransfer } from '../uri/ton-transfer.js'
import { zip321 } from '../uri/zip321.js'

export const bitcoin: Chain<never> = {
  id: 'bitcoin',
  name: 'Bitcoin',
  symbol: 'BTC',
  decimals: 8,
  tokens: {},
  uri: /* @__PURE__ */ bip321('bitcoin'),
}

export const litecoin: Chain<never> = {
  id: 'litecoin',
  name: 'Litecoin',
  symbol: 'LTC',
  decimals: 8,
  tokens: {},
  uri: /* @__PURE__ */ bip321('litecoin'),
}

export const dogecoin: Chain<never> = {
  id: 'dogecoin',
  name: 'Dogecoin',
  symbol: 'DOGE',
  decimals: 8,
  tokens: {},
  uri: /* @__PURE__ */ bip321('dogecoin'),
}

export const zcash: Chain<never> = {
  id: 'zcash',
  name: 'Zcash',
  symbol: 'ZEC',
  decimals: 8,
  tokens: {},
  uri: zip321,
}

/** A CashAddr address starts with its scheme: it is a payment URI as it stands. */
export const bitcoincash: Chain<never> = {
  id: 'bitcoincash',
  name: 'Bitcoin Cash',
  symbol: 'BCH',
  decimals: 8,
  tokens: {},
  uri: /* @__PURE__ */ bip321('bitcoincash', true),
}

/**
 * The XRP Ledger has no payment URI that wallets agree on: a request is a bare
 * address. The destination tag an exchange asks for has to be given apart.
 */
export const xrp: Chain<never> = {
  id: 'xrp',
  name: 'XRP Ledger',
  symbol: 'XRP',
  decimals: 6,
  tokens: {},
}

export const monero: Chain<never> = {
  id: 'monero',
  name: 'Monero',
  symbol: 'XMR',
  decimals: 12,
  tokens: {},
  uri: moneroUri,
}

/** Every asset on Stellar has 7 decimals. A token's address is the account of its issuer. */
export const stellar: Chain<'USDC'> = {
  id: 'stellar',
  name: 'Stellar',
  symbol: 'XLM',
  decimals: 7,
  tokens: {
    USDC: { address: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN', decimals: 7 },
  },
  uri: sep7,
}

export interface EvmSpec<Ticker extends string> {
  id: string
  name: string
  /** EIP-155 chain id. */
  chainId: number
  /** Ticker of the native coin. Default ETH. */
  symbol?: string | undefined
  tokens?: Record<Ticker, Token> | undefined
}

/**
 * Defines an EVM chain. Every one of them shares the address format and the
 * payment URIs, so a chain that is not listed here takes one line:
 * `evm({ id: 'linea', name: 'Linea', chainId: 59144 })`.
 */
/* @__NO_SIDE_EFFECTS__ */
export function evm<Ticker extends string = never>(spec: EvmSpec<Ticker>): Chain<Ticker> {
  return {
    id: spec.id,
    name: spec.name,
    symbol: spec.symbol ?? 'ETH',
    // The EVM counts value in wei, 18 decimals, whatever the native coin.
    decimals: 18,
    tokens: spec.tokens ?? ({} as Record<Ticker, Token>),
    evmChainId: spec.chainId,
    uri: eip681(spec.chainId),
  }
}

type Stablecoins = 'USDT' | 'USDC'

export const ethereum: Chain<Stablecoins> = /* @__PURE__ */ evm({
  id: 'ethereum',
  name: 'Ethereum',
  chainId: 1,
  tokens: {
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  },
})

/** Its USDT is the bridged one, which holds most of the supply; USDT0 is a separate contract. */
export const optimism: Chain<Stablecoins> = /* @__PURE__ */ evm({
  id: 'optimism',
  name: 'OP Mainnet',
  chainId: 10,
  tokens: {
    USDT: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
    USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
  },
})

/** Its stablecoins are pegged by Binance, not issued by Tether or Circle, and have 18 decimals. */
export const bsc: Chain<Stablecoins> = /* @__PURE__ */ evm({
  id: 'bsc',
  name: 'BNB Smart Chain',
  chainId: 56,
  symbol: 'BNB',
  tokens: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  },
})

/** Its USDT is USDT0, the omnichain form that took over the contract. */
export const polygon: Chain<Stablecoins> = /* @__PURE__ */ evm({
  id: 'polygon',
  name: 'Polygon',
  chainId: 137,
  symbol: 'POL',
  tokens: {
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  },
})

export const base: Chain<'USDC'> = /* @__PURE__ */ evm({
  id: 'base',
  name: 'Base',
  chainId: 8453,
  tokens: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  },
})

/** Its USDT is USDT0, the omnichain form that took over the contract. */
export const arbitrum: Chain<Stablecoins> = /* @__PURE__ */ evm({
  id: 'arbitrum',
  name: 'Arbitrum One',
  chainId: 42161,
  tokens: {
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  },
})

export const avalanche: Chain<Stablecoins> = /* @__PURE__ */ evm({
  id: 'avalanche',
  name: 'Avalanche C-Chain',
  chainId: 43114,
  symbol: 'AVAX',
  tokens: {
    USDT: { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6 },
    USDC: { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
  },
})

export const cardano: Chain<never> = {
  id: 'cardano',
  name: 'Cardano',
  symbol: 'ADA',
  decimals: 6,
  tokens: {},
  uri: cip13,
}

/** Tron has no payment URI that wallets agree on: a request is always a bare address. */
export const tron: Chain<'USDT'> = {
  id: 'tron',
  name: 'Tron',
  symbol: 'TRX',
  decimals: 6,
  tokens: {
    USDT: { address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6 },
  },
}

export const solana: Chain<'USDT' | 'USDC'> = {
  id: 'solana',
  name: 'Solana',
  symbol: 'SOL',
  decimals: 9,
  tokens: {
    USDT: { address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6 },
    USDC: { address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6 },
  },
  uri: solanaPay,
}

/** The network kept its name; its coin, Toncoin, was renamed Gram in June 2026. */
export const ton: Chain<'USDT'> = {
  id: 'ton',
  name: 'TON',
  symbol: 'GRAM',
  decimals: 9,
  tokens: {
    USDT: { address: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', decimals: 6 },
  },
  uri: tonTransfer,
}

/**
 * Every chain defined here, in a fixed order. Chains that share an address
 * format sit together, behind the one they descend from: Bitcoin and its
 * family, and further down Ethereum and the other EVM chains by chain id.
 */
export const chains: readonly Chain[] = [
  bitcoin,
  litecoin,
  dogecoin,
  zcash,
  bitcoincash,
  xrp,
  monero,
  stellar,
  ethereum,
  optimism,
  bsc,
  polygon,
  base,
  arbitrum,
  avalanche,
  cardano,
  tron,
  solana,
  ton,
]
