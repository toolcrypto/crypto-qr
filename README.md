# crypto-qr

Payment QR codes for crypto. Give it a chain, an address and optionally an
amount: it checks the address, writes the payment link in the chain's own
standard and units, and draws the code as SVG or PNG.

```ts
import { bitcoin, paymentQr } from '@toolcrypto/crypto-qr'

const { svg, payment } = paymentQr({
  chain: bitcoin,
  address: 'bc1qm6kmam774klwlh4dhmhaatd7al02m0h0hg3van',
  amount: '0.001',
})

payment.text // 'bitcoin:bc1qm6kmam774klwlh4dhmhaatd7al02m0h0hg3van?amount=0.001'
svg // '<svg xmlns="http://www.w3.org/2000/svg" ...'
```

It is an ES module with types, for browsers, Node, Deno, Bun and Workers. A
chain is something you import: a bundler leaves out the ones you do not use,
and with them the hashing and decoding only they need.

To make a code without writing any, use
[the generator](https://toolcrypto.github.io/crypto-qr/): it runs this library
in your browser.

The addresses on this page are placeholders, which nobody holds the keys of.

## Install

```sh
npm install @toolcrypto/crypto-qr
```

On Node it needs version 22.12 or later. Without a build step, a CDN that
serves npm packages has it as single files, dependencies included:

```html
<script type="module">
  import { paymentQr, tron } from 'https://cdn.jsdelivr.net/npm/@toolcrypto/crypto-qr@0.1.0/dist/crypto-qr.min.js'

  const address = 'TWGd9idELBV3is6rrtC5PQUhudiJYeCr7E'
  document.body.innerHTML = paymentQr({ chain: tron, address }).svg
</script>
```

### Two builds

Checking addresses is close to half of the library. Addresses that need no
checking, because your own software derived them or because they went through
`validateAddress` on your server or when your site was built, do not have to
pay for it: a second build has the same chains and functions and draws the
same codes, without that code.

| | Checks addresses | Takes them as given |
| --- | --- | --- |
| From npm | `@toolcrypto/crypto-qr` | `@toolcrypto/crypto-qr/unchecked` |
| From a CDN | `dist/crypto-qr.min.js` | `dist/crypto-qr-unchecked.min.js` |
| Whole library, compressed | 20.7 kB | 11.7 kB |
| Bundled for a Bitcoin payment code | 12.4 kB | 9.1 kB |

When in doubt, take the first: a typo in an address is money lost.
[Without the address check](#without-the-address-check) says what the second
leaves out. The logos are apart from both: `@toolcrypto/crypto-qr/logos`, or
`dist/crypto-qr-logos.min.js`.

## Why not a QR library and a template string

- **Units differ per chain.** Bitcoin's links want whole coins, Ethereum's want
  wei, Solana's want whole SOL or tokens, TON's want the smallest unit. Amounts
  go in as decimal strings and are converted with integers only, so
  `0.00000001` never becomes `1e-8`.
- **Wallets do not all read the same thing.** The result carries `warnings`
  when part of the request could not be encoded, or when a format is known to
  be read unevenly.

## Chains

| Export | Address check | Payment link | Amount in the link |
| --- | --- | --- | --- |
| `bitcoin` | base58check, bech32, bech32m | BIP-321, formerly BIP-21 | whole coins |
| `litecoin` | base58check, bech32, bech32m | BIP-21 | whole coins |
| `dogecoin` | base58check | BIP-21 | whole coins |
| `zcash` | base58check, bech32, bech32m | ZIP-321 | whole coins |
| `bitcoincash` | CashAddr, base58check | BIP-21 | whole coins |
| `xrp` | base58check | none: the address alone | |
| `monero` | base58, Keccak-256 | Monero URI | whole coins |
| `stellar` | base32, CRC-16 | SEP-7 | whole coins or tokens |
| `ethereum`, `optimism`, `bsc`, `polygon`, `base`, `arbitrum`, `avalanche` | EIP-55 | EIP-681 | smallest unit |
| `cardano` | bech32 | CIP-13 | whole coins |
| `tron` | base58check | none: the address alone | |
| `solana` | base58, curve test | Solana Pay | whole coins or tokens |
| `ton` | base64, CRC-16 | `ton://transfer` | smallest unit |

`chains` is the list of them all, in this order: chains that share an address
format together, the EVM ones by chain id. Any other EVM chain takes one line:

```ts
import { evm } from '@toolcrypto/crypto-qr'

const linea = evm({ id: 'linea', name: 'Linea', chainId: 59144 })
```

### Tokens

`chain.tokens` lists USDT and USDC where the chain has them, by ticker. A
request names one of those tickers, or any token as `{ address, decimals }`.

Not every one is its issuer's own deployment. USDT on Arbitrum and Polygon is
USDT0, on OP Mainnet it is the bridged token, and on BNB Smart Chain both
stablecoins are pegged by Binance and have 18 decimals, not 6. Base lists no
USDT, Stellar lists USDC, Tron and TON list USDT.

## API

```ts
paymentQr(request, options?)       // { payment, svg }
buildPayment(request)              // Payment: the text for the QR, and what it holds
parsePayment(text, chains)         // what a QR's text asks for, or undefined
validateAddress(address, chain)    // { valid: true, address, kind, network, warnings }
                                   // | { valid: false, code, message }
detectChains(address, chains)      // the chains an address is valid on
qrSvg(text, options?)              // string
qrPng(text, options?)              // Promise<Uint8Array>
qrMatrix(text, ecc?)               // boolean[][], for your own renderer
parseAmount('0.001', 8)            // 100000n
formatAmount(100000n, 8)           // '0.001'
```

### Request

| Field | |
| --- | --- |
| `chain` | A chain: `bitcoin`, `ethereum`, one made with `evm()`. |
| `address` | The payee. Returned in canonical spelling. |
| `amount` | Decimal string in whole coins or tokens, such as `'0.001'`. |
| `token` | A ticker of `chain.tokens`, or `{ address, decimals, symbol? }`. |
| `label`, `message` | Who is paid and what for, shown by the payer's wallet. |
| `memo` | Sent with the payment, as an exchange asks for: a memo on Solana, Stellar and shielded Zcash, a comment on TON. |
| `allowTestnet` | Accept test-network addresses. |

A request with nothing but an address yields the address alone, which every
wallet and exchange scans. What the chain's standard has no place for is left
out of the link and named in `warnings`.

`buildPayment` throws a `PaymentError` with a `field` (`address`, `amount` or
`token`), a `code` such as `checksum`, `wrong-chain`, `too-many-decimals` or
`unknown-token`, and a readable `message`.

### Warnings

| Warning | Meaning |
| --- | --- |
| `amount-not-encoded`, `token-not-encoded`, `label-not-encoded`, `message-not-encoded`, `memo-not-encoded` | The QR does not carry that part of the request. The payer enters it. |
| `uri-support-varies` | Wallets of this chain do not all read its links: EIP-681, TON, CIP-13, SEP-7. An address alone always works. |
| `erc20-uri-risk` | An EIP-681 token link starts with the token contract. A scanner that does not understand it may take the contract for the payee. |
| `no-checksum` | Single-case EVM address: a typo cannot be detected. |
| `off-curve` | Solana address that cannot be a wallet key: a program account, or a typo. |
| `legacy-format` | Superseded address form. |
| `testnet` | Test-network address, accepted with `allowTestnet`. |

### Chain by chain

- **Bitcoin Cash.** An address is returned as CashAddr with its prefix,
  `bitcoincash:q…`, which is also its payment link. One in Bitcoin's old format
  is rewritten that way, so that no Bitcoin wallet takes it for its own.
- **XRP Ledger, Tron.** Their wallets agree on no payment link. The code holds
  the address alone: a destination tag, a token or an amount is given apart.
- **Stellar.** A memo that is a whole number is sent as an id, anything else as
  text. A token is its ticker and its issuer: one of your own needs `symbol`.
- **Zcash.** A memo is for shielded addresses only. A unified address is
  checked for its checksum and its length; its receivers are not decoded.
- **Monero.** A payment id is part of an integrated address, not of the link.
- **TON.** The network kept its name when its coin, Toncoin, was renamed Gram
  in June 2026: `ton.symbol` is `GRAM`.

### Reading

`parsePayment` reads a payment link of the chains it is given, or an address
alone, and returns undefined for anything a careful wallet would refuse: a
wrong checksum, an amount given twice, a required parameter it does not know.

```ts
import { chains, parsePayment } from '@toolcrypto/crypto-qr'

parsePayment('ethereum:0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF@8453?value=1e15', chains)
// { standard: 'EIP-681', chains: [base], address: '0xDeaD…', amount: '0.001', … }
```

An EIP-681 link that names no chain id is for whichever network the payer's
wallet is on: `chains` then holds every EVM chain given. This is why
`buildPayment` always writes the chain id.

### Drawing

```ts
qrSvg(payment.text, {
  size: 512,              // pixels
  margin: 4,              // quiet zone, in modules
  shape: 'rounded',       // 'square' | 'rounded' | 'dots'
  foreground: '#111827',  // keep it much darker than the background
  background: null,       // transparent
  ecc: 'Q',               // lowest level accepted: 'L' | 'M' | 'Q' | 'H'
  alt: 'Pay 0.001 BTC',   // text alternative
})

await qrPng(payment.text, { scale: 8 }) // square modules, 1-bit palette PNG
```

The level is raised whenever a stronger one fits the same symbol: that
correction costs no size. Every option is validated or escaped, so the SVG is
safe to put in a page even when the options come from someone else. The PNG
has square modules and no logo: for another look, draw the SVG on a canvas.

### Logos

`@toolcrypto/crypto-qr/logos` has the logo of every chain and listed token.
It is a separate entry: a logo you do not import costs nothing.

```ts
import { bitcoinLogo, usdtLogo } from '@toolcrypto/crypto-qr/logos' // these two alone
import { logoFor } from '@toolcrypto/crypto-qr/logos' // all 21 of them, 6 kB

paymentQr(request, { logo: logoFor(request) })
qrSvg(text, { logo: 'https://example.com/logo.png' }) // or any image of yours
```

The bundled logos are path data, not images. They are drawn in the code
itself, so the SVG is complete on its own: as an `<img>`, on a canvas, in a
saved file. An image is drawn by reference instead, and one given by URL only
shows where the SVG is inline in a page.

A code with a logo is encoded at level Q or higher, and the logo takes about a
fifth of its width. It hides data, which that level restores, and never an
alignment pattern, which readers find their bearings by. Codes of 45 to 69
modules a side have one in their very centre: a text of more than 74 bytes
goes in a code of 73 modules or more instead.

A logo given as paths can be allowed over that pattern, for a smaller code:
`{ ...usdtLogo, overPattern: true }`. A reader that looks for the pattern can
then take artwork for it, as one of the three decoders this library is tested
with does for a few logos: read your codes back before relying on it.

## Without the address check

`@toolcrypto/crypto-qr/unchecked`, which is `dist/crypto-qr-unchecked.min.js`
on a CDN, has the same chains, `buildPayment`, `paymentQr` and drawing
functions, and none of the code that checks an address.

```ts
import { bitcoin, paymentQr } from '@toolcrypto/crypto-qr/unchecked'
```

An address goes into the code as it is given: a typo is not caught, a test
network is not refused, nothing is rewritten. It has to be in the spelling
`validateAddress` returns, with its prefix for Bitcoin Cash. Amounts and
tokens are checked as usual.

This build has no `validateAddress`, `detectChains` or `parsePayment`, and
those of the main entry refuse its chains.

## Size

Bundled and minified by esbuild, compressed with Brotli, dependencies included:

| Import | Main entry | `/unchecked` |
| --- | --- | --- |
| `validateAddress`, `bitcoin` | 3.9 kB | |
| `validateAddress`, every chain | 10.0 kB | |
| `qrSvg` | 7.9 kB | 7.9 kB |
| `paymentQr`, `bitcoin` | 12.4 kB | 9.1 kB |
| `paymentQr`, every chain | 18.4 kB | 10.9 kB |
| everything, as the self-contained file | 20.7 kB | 11.7 kB |

A logo from the `/logos` entry adds 0.5 kB, all of them with `logoFor` 6.1 kB.

There are two dependencies, [@noble/hashes](https://github.com/paulmillr/noble-hashes)
and [qr](https://github.com/paulmillr/qr), pinned to exact versions. Neither
has any of its own.

## How it is tested

- **Addresses** against the test vectors of BIP-350, Bitcoin Core, EIP-55,
  CashAddr, CashTokens, CIP-19, SEP-23 and ZIP-316, and against thousands of
  addresses written by other encoders, those of
  [@scure/base](https://github.com/paulmillr/scure-base), each one then
  damaged by a single character. The Solana curve test is compared with
  [@noble/curves](https://github.com/paulmillr/noble-curves).
- **Payment links** against the examples their specifications give, valid and
  invalid, and by reading back every kind of link that is written.
- **Codes** by drawing them, turning the SVG into pixels with a real renderer
  and reading them with three decoders that share no code: ZXing-C++, jsQR and
  paulmillr/qr. Every bundled logo goes through it in every shape, at ten and
  at three pixels per module.

## Limits

- An address is checked as far as its encoding goes: characters, length,
  version and checksum. Whether the keys inside a Monero, Stellar or shielded
  Zcash address are points of their curve is left to the wallet.
- Not accepted: ENS names, raw TON addresses (`0:…`), XRP Ledger X-addresses,
  Cardano's Byron and stake addresses, Zcash's Sprout addresses, Litecoin's
  MWEB addresses.
- `parsePayment` reads a request for one payment to one address. It does not
  read a BIP-321 link whose address is only in a parameter
  (`bitcoin:?lightning=…`), a ZIP-321 request for several payees, a Solana Pay
  transaction request, or a link of one of Bitcoin Cash's test networks.
- A wallet's support for payment links cannot be checked from here. Where it
  is known to vary, the warnings say so; an address alone always works.

## Development

```sh
npm run check   # lint, types, tests
npm run build   # dist/
npm run logos   # regenerate the logos from @web3icons/core
```

## License

[MIT](LICENSE). The logos come from [web3icons](https://github.com/0xa3k5/web3icons),
MIT License, Copyright (c) 2024 0xa3k5; the self-contained files hold the two
dependencies, both MIT License, Copyright (c) Paul Miller. The names and logos
of chains and tokens are trademarks of their projects, shown here to identify
what a payment is made in.
