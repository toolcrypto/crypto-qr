import type { Chain } from '../chain.js'
import { bitcoin, dogecoin, litecoin } from './bitcoin.js'
import { bitcoincash } from './bitcoincash.js'
import { cardano } from './cardano.js'
import { arbitrum, avalanche, base, bsc, ethereum, optimism, polygon } from './evm.js'
import { monero } from './monero.js'
import { solana } from './solana.js'
import { stellar } from './stellar.js'
import { ton } from './ton.js'
import { tron } from './tron.js'
import { xrp } from './xrp.js'
import { zcash } from './zcash.js'

export { bitcoin, dogecoin, litecoin } from './bitcoin.js'
export { bitcoincash } from './bitcoincash.js'
export { cardano } from './cardano.js'
export { arbitrum, avalanche, base, bsc, ethereum, evm, optimism, polygon } from './evm.js'
export { monero } from './monero.js'
export { solana } from './solana.js'
export { stellar } from './stellar.js'
export { ton } from './ton.js'
export { tron } from './tron.js'
export { xrp } from './xrp.js'
export { zcash } from './zcash.js'

/**
 * Every chain defined here, in a fixed order. Chains that share an address
 * format sit together, behind the one they descend from: Bitcoin and its
 * family, and further down Ethereum and the other EVM chains by chain id.
 * Functions that take a list of chains answer in its order.
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
