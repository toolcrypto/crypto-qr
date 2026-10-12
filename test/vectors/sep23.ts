// Test cases of SEP-23, copied from
// https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md

/** Valid strkeys of every kind, each with what it is. Only the first three are addresses to pay. */
export const VALID: readonly (readonly [strkey: string, what: string])[] = [
  ['GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ', 'Valid non-multiplexed account'],
  [
    'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ',
    'Valid multiplexed account',
  ],
  [
    'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLK',
    'Valid multiplexed account in which unsigned id exceeds maximum signed 64-bit integer',
  ],
  [
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAQACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6IBZGM',
    'Valid signed payload with an ed25519 public key and a 32-byte payload',
  ],
  [
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUAAAAFGBU',
    'Valid signed payload with an ed25519 public key and a 29-byte payload which becomes zero padded',
  ],
  ['CA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUWDA', 'Valid contract'],
  ['LA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUPJN', 'Valid liquidity pool address'],
  ['BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TU', 'Valid claimable balance address'],
]

/** Invalid strkeys, each with what is wrong with it. */
export const INVALID: readonly (readonly [strkey: string, reason: string])[] = [
  ['GAAAAAAAACGC6', 'Invalid length (Ed25519 should be 32 bytes, not 5)'],
  [
    'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUR',
    'The unused trailing bit must be zero in the encoding of the last three bytes (24 bits) as five base-32 symbols (25 bits)',
  ],
  [
    'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZA',
    'Invalid length (congruent to 1 mod 8)',
  ],
  [
    'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUACUSI',
    'Invalid length (base-32 decoding should yield 35 bytes, not 36)',
  ],
  [
    'G47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVP2I',
    'Invalid algorithm (low 3 bits of version byte are 7)',
  ],
  [
    'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAJLKA',
    'Invalid length (congruent to 6 mod 8)',
  ],
  [
    'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVAAAAAAAAAAAAAAV75I',
    'Invalid length (base-32 decoding should yield 43 bytes, not 44)',
  ],
  [
    'M47QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUQ',
    'Invalid algorithm (low 3 bits of version byte are 7)',
  ],
  [
    'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUK===',
    'Padding bytes are not allowed',
  ],
  ['MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAACJUO', 'Invalid checksum'],
  [
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAQACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB6IAAAAAAAAPM',
    'Length prefix specifies length that is shorter than payload in signed payload',
  ],
  [
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4Z2PQ',
    'Length prefix specifies length that is longer than payload in signed payload',
  ],
  [
    'PA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAOQCAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DXFH6',
    'No zero padding in signed payload',
  ],
  [
    'BAAD6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGR4TV',
    'The unused trailing 2-bits must be zero in the encoding of the last symbol',
  ],
  [
    'BAAT6DBUX6J22DMZOHIEZTEQ64CVCHEDRKWZONFEUL5Q26QD7R76RGXACA',
    'Invalid claimable balance type (first byte of binary key is not 0)',
  ],
]
