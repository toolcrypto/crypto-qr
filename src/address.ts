import { type AddressResult, type Chain, noAddress } from './chain.js'

/**
 * Checks an address against a chain: shape, length and, where the format has
 * one, the checksum.
 */
export function validateAddress(address: string, chain: Chain): AddressResult {
  if (typeof chain?.checkAddress !== 'function') {
    throw new TypeError(
      'Pass a chain of the main entry, such as `bitcoin`: ' +
        'not its name, nor a chain of the unchecked entry.',
    )
  }
  const text = address.trim()
  return text ? chain.checkAddress(text) : noAddress()
}

/**
 * Keeps the chains on which the text is a current mainnet address. An EVM
 * address matches every EVM chain. Superseded forms are left out, so that a
 * Bitcoin "3..." address is not also reported as Litecoin.
 */
export function detectChains<C extends Chain>(address: string, chains: readonly C[]): C[] {
  return chains.filter((chain) => {
    const result = validateAddress(address, chain)
    return (
      result.valid && result.network === 'mainnet' && !result.warnings.includes('legacy-format')
    )
  })
}
