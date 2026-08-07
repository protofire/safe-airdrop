# CSV Airdrop on Tron — documentation

Everything in this folder is **documentation and throwaway probe scripts**.
Nothing here is imported by the app or run by CI.

| File                                                   | What it is                                                                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [`PRD_CSV_AIRDROP_TRON.md`](./PRD_CSV_AIRDROP_TRON.md) | The implementation plan: gap analysis, decisions, file-by-file changes, acceptance, risks. **Start here.** |
| `TRON_VERIFICATION.md`                                 | _Not written yet._ Evidence from the Shasta run — what actually happened, dated, per acceptance step       |
| `scripts/`                                             | _Not written yet._ Read-only probes, chiefly the row-cap energy measurement (PRD §7)                       |

The PRD is written **before** implementation and is allowed to be wrong. The
verification document is written **after** and records what happened. Keeping them
apart is deliberate: a single document that quietly edits its own predictions into
agreement with reality is worth nothing as a record.

## The shape of the change, in one paragraph

Tron support is **source and runtime configuration only** — two entries in
`src/networks.ts`, one `isTronChain` predicate keyed on `shortName` (`trx`,
`trx-*`), and a base58check codec. There is no Tron build target, no Tron
environment file, and no new tooling. Hex stays canonical in state and on every
wire; base58 is accepted when a CSV is parsed and rendered wherever a human reads
an address. Native decimals come from chain configuration rather than the three
hardcoded `18`s the app carried, which on a six-decimal chain is the difference
between sending 1 TRX and encoding a trillion of them.

## Facts worth remembering

1. **TRX has six decimals.** Every hardcoded `18` in an amount path is a
   trillion-fold error. The golden SUN vectors in the test suite are the fence
   around this; do not relax them.
2. **TRC-20 calldata is byte-identical to ERC-20** — selector `a9059cbb`, address
   left-padded to 32 bytes with **no** `0x41` prefix. `src/transfers/erc20.ts`
   needs no change and its encoding vectors must stay as they are.
3. **This app talks to the transaction service directly**, not through the client
   gateway — so chain configuration is how it finds its data, not a nicety.
4. **Tronscan resolves base58 only.** Neither `0x…` nor Tron's raw `41…` hex
   works against it.
5. **Canonical Safe contract addresses are not deployed on Tron.** The host
   resolves them itself; the gateway's `contractAddresses` are all `null`. Do not
   wire up `@safe-global/safe-deployments`.

## Related work

The Tron ports of `drain-safe` and `tx-builder` live in the `safe-react-apps`
repository, each with its own `tron/` folder or `TRON_DEPLOYMENT.md`. The base58
codec and the protocol facts above come from there. **The architecture does not** —
see PRD §9 for each divergence and why.
