import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'
import * as main from '../src/index.js'
import * as logos from '../src/logos/index.js'
import * as unchecked from '../src/unchecked.js'

// The public surface, spelled out: adding to it or taking from it is a decision.

describe('crypto-qr', () => {
  it('exports these values', () => {
    expect(Object.keys(main).sort()).toEqual([
      'AmountError',
      'PaymentError',
      'arbitrum',
      'avalanche',
      'base',
      'bitcoin',
      'bitcoincash',
      'bsc',
      'buildPayment',
      'cardano',
      'chains',
      'detectChains',
      'dogecoin',
      'ethereum',
      'evm',
      'formatAmount',
      'litecoin',
      'monero',
      'optimism',
      'parseAmount',
      'parsePayment',
      'paymentQr',
      'polygon',
      'qrMatrix',
      'qrPng',
      'qrSvg',
      'solana',
      'stellar',
      'ton',
      'tron',
      'validateAddress',
      'xrp',
      'zcash',
    ])
  })

  it('exports every chain it lists', () => {
    const exported: unknown[] = Object.values(main)
    for (const chain of main.chains) expect(exported, chain.id).toContain(chain)
  })
})

describe('crypto-qr/unchecked', () => {
  it('exports what crypto-qr does, short of what checks an address', () => {
    const checking = ['detectChains', 'parsePayment', 'validateAddress']
    expect(Object.keys(unchecked).sort()).toEqual(
      Object.keys(main)
        .filter((name) => !checking.includes(name))
        .sort(),
    )
  })

  it('exports every chain it lists', () => {
    const exported: unknown[] = Object.values(unchecked)
    for (const chain of unchecked.chains) expect(exported, chain.id).toContain(chain)
  })

  it('is made of no code that checks or reads an address', async () => {
    const bundle = async (entry: string) => {
      const { metafile, outputFiles } = await build({
        absWorkingDir: fileURLToPath(new URL('..', import.meta.url)),
        entryPoints: [entry],
        bundle: true,
        format: 'esm',
        write: false,
        metafile: true,
      })
      return { modules: Object.keys(metafile.inputs), code: outputFiles.at(0)?.text ?? '' }
    }
    // The modules it is made of: nothing that checks an address, and no hashing.
    const own =
      /^src\/(?:unchecked|amount|chain|chains\/unchecked|payment\/(?:build|unchecked)|(?:qr|uri)\/[\w-]+)\.ts$/
    const { modules, code } = await bundle('src/unchecked.ts')
    expect(modules.filter((file) => !own.test(file))).toEqual(['node_modules/qr/index.js'])
    // Of the modules it shares with crypto-qr, what accepts or reads an address is left out.
    const checking =
      /\b(?:function|const|var|let) (?:accept|badChecksum|checked|read[A-Z]\w*|fromQuery|splitQuery|take)\d*\b/
    expect(code).not.toMatch(checking)
    expect((await bundle('src/index.ts')).code).toMatch(checking)
  })

  it('shares with crypto-qr what does not check an address', () => {
    const own = ['buildPayment', 'paymentQr', 'evm', 'chains', ...main.chains.map(({ id }) => id)]
    const checked = new Map<string, unknown>(Object.entries(main))
    for (const [name, value] of Object.entries(unchecked)) {
      if (own.includes(name)) expect(value, name).not.toBe(checked.get(name))
      else expect(value, name).toBe(checked.get(name))
    }
  })
})

describe('crypto-qr/logos', () => {
  it('exports these values', () => {
    expect(Object.keys(logos).sort()).toEqual([
      'arbitrumLogo',
      'avalancheLogo',
      'baseLogo',
      'bitcoinLogo',
      'bitcoincashLogo',
      'bscLogo',
      'cardanoLogo',
      'dogecoinLogo',
      'ethereumLogo',
      'litecoinLogo',
      'logoFor',
      'moneroLogo',
      'optimismLogo',
      'polygonLogo',
      'solanaLogo',
      'stellarLogo',
      'tonLogo',
      'tronLogo',
      'usdcLogo',
      'usdtLogo',
      'xrpLogo',
      'zcashLogo',
    ])
  })
})
