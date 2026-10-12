import { detectChains, validateAddress } from '../address.js'
import { AmountError, formatAmount, MAX_DECIMALS, parseAmount } from '../amount.js'
import type { Chain, Decoded, Token, UriReader } from '../chain.js'
import { readBip321 } from '../uri/bip321.js'
import { readCip13 } from '../uri/cip13.js'
import { readEip681 } from '../uri/eip681.js'
import { readMoneroUri } from '../uri/monero.js'
import { readSep7 } from '../uri/sep7.js'
import { readSolanaPay } from '../uri/solana-pay.js'
import { readTonTransfer } from '../uri/ton-transfer.js'
import { readZip321 } from '../uri/zip321.js'
import type { ParsedPayment } from './types.js'

/**
 * What reads each standard, by its name. Writing a standard is a chain's
 * business, so that a page that only writes loads none of this.
 */
const READERS: ReadonlyMap<string, UriReader> = /* @__PURE__ */ new Map([
  ['BIP-321', readBip321],
  ['BIP-21', readBip321],
  ['ZIP-321', readZip321],
  ['Monero URI', readMoneroUri],
  ['SEP-7', readSep7],
  ['EIP-681', readEip681],
  ['CIP-13', readCip13],
  ['Solana Pay', readSolanaPay],
  ['TON transfer link', readTonTransfer],
])

/**
 * Works out both spellings of the amount, as far as the decimals are known.
 * Undefined when the amount is malformed.
 */
function amounts(
  { amount, atomic }: Decoded,
  decimals: number | undefined,
): Pick<ParsedPayment, 'amount' | 'atomicAmount'> | undefined {
  if (atomic !== undefined) {
    const units = BigInt(atomic)
    return {
      amount: decimals === undefined ? undefined : formatAmount(units, decimals),
      atomicAmount: units.toString(),
    }
  }
  if (amount === undefined) return {}
  // Without the decimals, the amount is tidied to as many places as it is written with.
  const places = decimals ?? Math.min(amount.split('.').at(1)?.length ?? 0, MAX_DECIMALS)
  try {
    const units = parseAmount(amount, places)
    return {
      amount: formatAmount(units, places),
      atomicAmount: decimals === undefined ? undefined : units.toString(),
    }
  } catch (error) {
    if (error instanceof AmountError) return undefined
    throw error
  }
}

/** The token a chain lists at an address, under the ticker the URI gives it when it gives one. */
function listedAt(chain: Chain, address: string, symbol?: string): Token | undefined {
  for (const [ticker, token] of Object.entries(chain.tokens)) {
    if (token.address === address && (symbol === undefined || symbol === ticker)) {
      return { ...token, symbol: ticker }
    }
  }
  return undefined
}

/** Validates the fields a reader extracted and puts them in their public form. */
function finish(standard: string, raw: Decoded): ParsedPayment | undefined {
  // Chains that share a scheme share an address format: the first one speaks for all.
  const [chain] = raw.chains
  if (!chain) return undefined
  const payee = validateAddress(raw.address, chain)
  const contract = raw.token === undefined ? undefined : validateAddress(raw.token, chain)
  if (!payee.valid || contract?.valid === false) return undefined

  // An address only names a listed token once the chain it lives on is certain.
  const listed =
    contract && raw.chains.length === 1 ? listedAt(chain, contract.address, raw.symbol) : undefined
  const token = contract && {
    address: contract.address,
    symbol: raw.symbol ?? listed?.symbol,
    decimals: listed?.decimals ?? raw.decimals,
  }
  const amount = amounts(raw, token ? token.decimals : chain.decimals)
  if (!amount) return undefined

  return {
    standard,
    chains: [...raw.chains],
    address: payee.address,
    network: payee.network,
    token,
    ...amount,
    label: raw.label,
    message: raw.message,
    memo: raw.memo,
  }
}

function bareAddress(text: string, chains: readonly Chain[]): ParsedPayment | undefined {
  const matches = detectChains(text, chains)
  const [first] = matches
  const result = first && validateAddress(text, first)
  return result?.valid
    ? { chains: matches, address: result.address, network: result.network }
    : undefined
}

/**
 * Reads back what a QR code's text asks for, on the chains given: a payment URI
 * of one of their standards, or a bare mainnet address. Returns undefined for
 * anything else, including a URI that a careful wallet would refuse.
 */
export function parsePayment(text: string, chains: readonly Chain[]): ParsedPayment | undefined {
  const trimmed = text.trim()
  const [, scheme, rest = ''] = /^([a-z][a-z\d+.-]*):(.*)$/i.exec(trimmed) ?? []
  if (scheme === undefined) return bareAddress(trimmed, chains)

  // Every EVM chain shares one scheme; elsewhere a scheme belongs to one chain.
  const name = scheme.toLowerCase()
  const candidates = chains.filter((chain) => chain.uri?.scheme === name)
  const standard = candidates.at(0)?.uri?.standard
  if (standard === undefined) return undefined
  const raw = READERS.get(standard)?.(rest, candidates)
  return raw && finish(standard, raw)
}
