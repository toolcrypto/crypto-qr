// Builds the self-contained files, after `tsc` has built the package: the
// library and its dependencies in one minified ES module each, for a page
// without a build step or a CDN that serves npm packages.
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'

const root = new URL('..', import.meta.url)
const { version, homepage } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const { origin, pathname } = new URL(homepage)

const NOBLE = '@noble/hashes, MIT License, Copyright (c) 2022 Paul Miller (paulmillr.com)'
const QR = 'qr, MIT License, Copyright (c) 2023 Paul Miller (paulmillr.com)'

/**
 * The files to build. `includes` names the code of others a file holds whose
 * notice esbuild does not find in the code itself and keep on its own.
 */
const BUNDLES = [
  { name: 'crypto-qr.min', entry: 'dist/index.js', includes: [NOBLE, QR] },
  // Nothing is hashed where no address is checked.
  { name: 'crypto-qr-unchecked.min', entry: 'dist/unchecked.js', includes: [QR] },
  { name: 'crypto-qr-logos.min', entry: 'dist/logos/index.js', includes: [] },
]

for (const { name, entry, includes } of BUNDLES) {
  const notices = [`crypto-qr ${version}, MIT License: ${origin}${pathname}`, ...includes]
  await build({
    absWorkingDir: root.pathname,
    entryPoints: { [name]: entry },
    outdir: 'dist',
    bundle: true,
    format: 'esm',
    target: 'es2022',
    minify: true,
    banner: { js: `/*!\n${notices.map((notice) => ` * ${notice}`).join('\n')}\n */` },
  })
}
