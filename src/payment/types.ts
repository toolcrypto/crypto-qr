import type { AmountIssue } from '../amount.js'
import type {
  AddressIssue,
  AddressWarning,
  Chain,
  Network,
  PaymentField,
  Token,
  UriCaveat,
} from '../chain.js'

export type PaymentWarning =
  | AddressWarning
  /** The address belongs to a test network. */
  | 'testnet'
  /** The QR code does not carry that part of the request: the payer has to enter it. */
  | `${PaymentField}-not-encoded`
  | UriCaveat

export type PaymentIssue =
  | AddressIssue
  | AmountIssue
  /** A test-network address, without `allowTestnet`. */
  | 'testnet'
  /** The payee is a listed token's own contract, mint, jetton master or issuer. */
  | 'token-contract'
  /** Zero is not a payable amount. */
  | 'zero'
  /** A ticker the chain does not list. */
  | 'unknown-token'
  /** Token decimals that are not a whole number from 0 to 255. */
  | 'decimals'

export interface PaymentRequest {
  chain: Chain
  /** Where the money should go. */
  address: string
  /** Amount in display units as a plain decimal, such as "0.001". */
  amount?: string | undefined
  /** A ticker listed in `chain.tokens`, or any token. Leave out for the native coin. */
  token?: string | Token | undefined
  /** Who is being paid, for the payer's wallet to show. */
  label?: string | undefined
  /** What the payment is for, for the payer's wallet to show. */
  message?: string | undefined
  /**
   * Note sent with the payment itself, as an exchange asks for to credit a
   * deposit: a memo on Solana, Stellar and shielded Zcash, a comment on TON.
   */
  memo?: string | undefined
  /** Accept test-network addresses instead of refusing them. */
  allowTestnet?: boolean | undefined
}

export interface Payment {
  /** Exactly what goes into the QR code: a payment URI, or the bare address. */
  text: string
  /** The standard `text` follows. Absent for a bare address. */
  standard?: string | undefined
  /** Payee, in canonical spelling. */
  address: string
  /** The token requested. Absent for the native coin. */
  token?: Token | undefined
  /** Amount in display units, as a plain decimal without trailing zeros. */
  amount?: string | undefined
  /** The same amount in the asset's smallest unit, as an integer string. */
  atomicAmount?: string | undefined
  warnings: PaymentWarning[]
}

/**
 * A token named by a URI. Its ticker and decimals are those the URI's standard
 * gives, or those of the token a chain lists there once the chain is certain.
 */
interface ParsedToken {
  address: string
  symbol?: string | undefined
  decimals?: number | undefined
}

export interface ParsedPayment {
  /** The standard the text follows. Absent for a bare address. */
  standard?: string | undefined
  /** The chains, among those given, that the text is for. Never empty. */
  chains: Chain[]
  /** Payee, in canonical spelling. */
  address: string
  network: Network
  token?: ParsedToken | undefined
  /** Amount in display units, when it can be worked out. */
  amount?: string | undefined
  /** Amount in the asset's smallest unit, as an integer string, when it can be worked out. */
  atomicAmount?: string | undefined
  label?: string | undefined
  message?: string | undefined
  memo?: string | undefined
}
