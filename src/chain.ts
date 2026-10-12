/** The form of an address. */
export type AddressKind =
  /** Bitcoin and its descendants, from here to `p2tr`. */
  | 'p2pkh'
  | 'p2sh'
  | 'p2wpkh'
  | 'p2wsh'
  | 'p2tr'
  /** Zcash, besides its transparent addresses: this one, `unified` and `tex`. */
  | 'sapling'
  | 'unified'
  | 'tex'
  /** The XRP Ledger, EVM chains, Tron, Solana, Stellar. */
  | 'account'
  /** Stellar: an account with an id attached, which stands in for a memo. */
  | 'muxed'
  /** Monero: this one, `subaddress` and `integrated`. */
  | 'standard'
  | 'subaddress'
  | 'integrated'
  /** Cardano: with a stake part, then with a `pointer` to one, then with none. */
  | 'base'
  | 'pointer'
  | 'enterprise'
  /** TON: whether a transfer that cannot be delivered is sent back, or not. */
  | 'bounceable'
  | 'non-bounceable'

export type AddressIssue =
  /** Nothing was entered. */
  | 'empty'
  /** Not shaped like an address of this chain. */
  | 'format'
  /** Right shape, wrong length once decoded. */
  | 'length'
  /** Right shape, but the built-in checksum does not match: almost always a typo. */
  | 'checksum'
  /** A valid address of another chain. */
  | 'wrong-chain'
  /** A real address form that this library does not handle. */
  | 'unsupported'

export type AddressWarning =
  /** EVM address in a single case: it carries no checksum, so a typo goes undetected. */
  | 'no-checksum'
  /**
   * Old form that still works but that wallets no longer produce. Bitcoin
   * Cash's, which is Bitcoin's own, comes back rewritten in the current one.
   */
  | 'legacy-format'
  /**
   * Solana address that is not an ed25519 public key. Wallet addresses always
   * are, so this is a program-owned account or a typo: Solana addresses have no
   * checksum, and about half of all typos land off the curve.
   */
  | 'off-curve'

export type Network = 'mainnet' | 'testnet'

export interface ValidAddress {
  valid: true
  /**
   * Canonical spelling: checksummed on EVM, lowercase for bech32, with its
   * prefix for CashAddr, URL-safe on TON.
   */
  address: string
  kind: AddressKind
  network: Network
  warnings: AddressWarning[]
}

export interface InvalidAddress {
  valid: false
  code: AddressIssue
  /** Short explanation in English. */
  message: string
}

export type AddressResult = ValidAddress | InvalidAddress

/** @internal */
export function accept(
  address: string,
  kind: AddressKind,
  network: Network = 'mainnet',
  warnings: readonly AddressWarning[] = [],
): ValidAddress {
  return { valid: true, address, kind, network, warnings: [...warnings] }
}

/** @internal */
export function reject(code: AddressIssue, message: string): InvalidAddress {
  return { valid: false, code, message }
}

/** @internal */
export const badChecksum = (): InvalidAddress =>
  reject('checksum', 'The checksum does not match: at least one character is wrong.')

/** @internal */
export const noAddress = (): InvalidAddress => reject('empty', 'Enter an address.')

export interface Token {
  /**
   * Contract (EVM, Tron), mint (Solana), jetton master (TON) or issuer
   * (Stellar), in canonical spelling.
   */
  address: string
  decimals: number
  /** Ticker. On Stellar it is half of what names a token, the issuer being the other. */
  symbol?: string | undefined
}

/** What a payment request can hold besides the payee. */
export type PaymentField = 'amount' | 'token' | 'label' | 'message' | 'memo'

/**
 * A payment request once every input has been validated.
 *
 * @internal
 */
export interface Draft {
  /** Payee, in canonical spelling. */
  address: string
  token?: Token | undefined
  /** Amount in display units, as a plain decimal. */
  amount?: string | undefined
  /** The same amount in the asset's smallest unit. */
  atomic?: bigint | undefined
  label?: string | undefined
  message?: string | undefined
  memo?: string | undefined
}

/**
 * The fields of a URI as written, before any of them is validated.
 *
 * @internal
 */
export interface Decoded {
  /** The chains, among those that share the scheme, that the URI can be for. */
  chains: readonly Chain[]
  address: string
  token?: string | undefined
  /** The ticker the URI gives the token, where its standard has one. */
  symbol?: string | undefined
  /** The decimals of the token, where the chain gives every token the same. */
  decimals?: number | undefined
  /** Amount in display units. */
  amount?: string | undefined
  /** Amount in the smallest unit, as a string of digits. */
  atomic?: string | undefined
  label?: string | undefined
  message?: string | undefined
  memo?: string | undefined
}

export type UriCaveat =
  /** Wallets on this chain do not all read payment URIs; some only accept a bare address. */
  | 'uri-support-varies'
  /**
   * An EIP-681 token request starts with the token contract, not the payee. A
   * scanner that does not understand it may take the contract for the payee.
   */
  | 'erc20-uri-risk'

/**
 * How one payment-URI standard is written.
 *
 * @internal
 */
export interface UriWriter {
  /** Name of the standard. */
  readonly standard: string
  /** URI scheme, in lowercase. */
  readonly scheme: string
  /** The parts of a request that a URI of this standard holds for it. */
  carries(draft: Draft): readonly PaymentField[]
  /** The URI for a request, or undefined when the bare address says as much. */
  encode(draft: Draft): string | undefined
  /** A caution about the URI this standard writes for a request. */
  caveat?(draft: Draft): UriCaveat
}

/**
 * How one payment-URI standard is read: splits what follows `scheme:` into
 * fields, and keeps the chains the URI can be for. Returns undefined when the
 * URI is malformed.
 *
 * @internal
 */
export type UriReader = (rest: string, chains: readonly Chain[]) => Decoded | undefined

/**
 * A chain: what it is called, and behind that how it writes a payment request
 * and, unless it comes from the unchecked entry, how it checks an address.
 * Import the ones you need; a bundler leaves the others out.
 */
export interface Chain<Ticker extends string = string> {
  /** Stable identifier, in lowercase. */
  readonly id: string
  readonly name: string
  /** Ticker of the native coin. */
  readonly symbol: string
  /** Decimals of the native coin. */
  readonly decimals: number
  /** Listed tokens by ticker. */
  readonly tokens: Readonly<Record<Ticker, Token>>
  /** EIP-155 chain id. EVM chains only. */
  readonly evmChainId?: number | undefined
  /**
   * The chain's payment-URI standard. Absent when wallets agree on none.
   *
   * @internal
   */
  readonly uri?: UriWriter | undefined
  /**
   * Checks an address that is trimmed and not empty. Absent on a chain that
   * takes addresses on trust.
   *
   * @internal
   */
  readonly checkAddress?: ((address: string) => AddressResult) | undefined
}

/**
 * A chain with the check of its addresses.
 *
 * @internal
 */
export function checked<C extends Chain>(
  chain: C,
  checkAddress: (address: string) => AddressResult,
): C {
  return { ...chain, checkAddress }
}
