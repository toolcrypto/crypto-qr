// The addresses the tests pay to. None of them is anyone's: each one encodes
// the bytes de ad be ef, repeated, or de ad c0 de where a chain wants the key
// itself, which has to be a point of its curve. test/addresses.test.ts builds
// every one of them again with an encoder the library does not have.

/** The bytes de ad be ef, repeated: what a hash is made of here. */
export const dead = (length: number): Uint8Array =>
  Uint8Array.from({ length }, (_, at) => [0xde, 0xad, 0xbe, 0xef][at % 4] ?? 0)

/** The bytes de ad c0 de, eight times: a public key, since they happen to be an ed25519 point. */
export const KEY: Uint8Array = Uint8Array.from(
  { length: 32 },
  (_, at) => [0xde, 0xad, 0xc0, 0xde][at % 4] ?? 0,
)

export const BTC = 'bc1qm6kmam774klwlh4dhmhaatd7al02m0h0hg3van'
/** The same hash in the form Bitcoin started with, which other chains read as theirs. */
export const BTC_LEGACY = '1MJR9fFWBTN6Zh3EGcYMsFnZzqxzKN6rXh'
export const BTC_TESTNET = 'tb1qm6kmam774klwlh4dhmhaatd7al02m0h0aw2lxq'
export const LTC = 'ltc1qm6kmam774klwlh4dhmhaatd7al02m0h0n5tg9r'
export const DOGE = 'DRSWgvC9UsGP6hDq1CXvR1xAsyhHdyeMHN'
export const ZEC = 't1eB29zfe9n9hAL68D3MV14tVFWA55iwymc'
export const BCH = 'bitcoincash:qr02m0h0m6kmam774klwlh4dhmhaatd7auhdnchckx'
export const XRP = 'rMJR9CEWBT4aZ6sNGcYM1E8ZzqxzK4aiX6'
export const XMR =
  '4A4YT9P9uHqeH7mHpRmwsMeH7mHpRmwsMeH7mHpRmwsMeH7mHpRmwsMeH7mHpRmwsMeH7mHpRmwsMeH7mHpRmwsMS9c4mUb'
export const XLM = 'GDPK3QG632W4BXW6VXAN5XVNYDPN5LOA33PK3QG632W4BXW6VXAN5W3G'
export const EVM = '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF'
export const ADA =
  'addr1q802m0h0m6kmam774klwlh4dhmhaatd7al02m0h0m6kmam774klwlh4dhmhaatd7al02m0h0m6kmam774klwlh4dhmhsxu0w5y'
export const TRX = 'TWGd9idELBV3is6rrtC5PQUhudiJYeCr7E'
export const SOL = 'FzFBHQgdxJF6af6zQhtufnGePjMS5eB2M97HAGNqcFJu'
export const TON = 'UQDerb7v3q2-796tvu_erb7v3q2-796tvu_erb7v3q2-793g'

/** The address the tests pay to on each chain, by chain id. */
export const PAYEE: Readonly<Record<string, string>> = {
  bitcoin: BTC,
  litecoin: LTC,
  dogecoin: DOGE,
  zcash: ZEC,
  bitcoincash: BCH,
  xrp: XRP,
  monero: XMR,
  stellar: XLM,
  ethereum: EVM,
  optimism: EVM,
  bsc: EVM,
  polygon: EVM,
  base: EVM,
  arbitrum: EVM,
  avalanche: EVM,
  cardano: ADA,
  tron: TRX,
  solana: SOL,
  ton: TON,
}
