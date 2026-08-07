# CSV Airdrop on Tron — implementation plan

Making this app work on Safe{Wallet} Tron. Written before implementation; it is a
plan and is allowed to be wrong. The record of what actually happened goes in a
separate verification document written after the Shasta run — see
[`README.md`](./README.md).

|                     |                                                                              |
| ------------------- | ---------------------------------------------------------------------------- |
| **App**             | `safe-airdrop` 2.6.0 (CSV Airdrop)                                           |
| **Target chain**    | Tron Shasta Testnet, `2494104990` (`trx-shasta`)                             |
| **Also configured** | Tron Mainnet, `728126428` (`trx`) — entry ships now, no UI serves it yet     |
| **Safe UI**         | `https://tron-app.stage.safe.protofire.io`                                   |
| **Gateway**         | `https://gateway-tron.stage.safe.protofire.io` (serves Shasta only)          |
| **Deploy target**   | `https://dev-tron-apps.safe.protofire.io/safe-airdrop/` (not yet registered) |
| **Build changes**   | **None.** One stock bundle, same as every other chain                        |

---

## 1. Goal and shape of the change

CSV Airdrop must work on Tron Shasta today and on any future Tron chain without a
code release. Everything Tron-specific is driven by chain configuration and one
runtime predicate; there is no Tron build target, no Tron environment file, and no
new tooling in this repo.

The change is deliberately **not** a port of the Tron work in `safe-react-apps`.
Two things come across from there: the base58check codec, and the protocol facts
it encodes. The architecture does not — drain-safe's base58-in-state model and
tx-builder's environment/runbook/verifier machinery both solve problems this app
does not have, and one of them (base58 in state) would actively hurt here. See
§4.1 and §9.

---

## 2. Deployment state, probed 2026-08-07

Re-probe before acting on this document.

| Probe                                                               | Result                                                                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET gateway-tron.stage…/v1/chains`                                 | `count: 1` — Shasta only. `nativeCurrency.decimals: 6`, `shortName: trx-shasta`, `ensRegistryAddress: null`, `safeAppsRpcUri: https://api.shasta.trongrid.io/jsonrpc` |
| `GET gateway-tron.stage…/v1/chains/728126428`                       | **404** — no mainnet chain config                                                                                                                                     |
| `gateway-tron.safe.protofire.io`, `tron-app.safe.protofire.io`      | **DNS failure** — no mainnet gateway or UI exists                                                                                                                     |
| `GET transaction-tron.stage…/api/v1/about/ethereum-rpc/`            | **`chain_id: 728126428, TRON_MAINNET`, synced** — a mainnet transaction service _is_ live                                                                             |
| `GET transaction-tron-testnet.stage…/api/v1/safes/{safe}/balances/` | `200`, `[{"tokenAddress":null,"token":null,"balance":"1000000"}]` — 1 TRX, six decimals                                                                               |
| `GET …/api/v2/safes/{safe}/collectibles/`                           | `200`, `count: 0`                                                                                                                                                     |
| `GET gateway-tron.stage…/v1/chains/2494104990/safe-apps`            | tx-builder (`id:1`), drain-safe (`id:2`). **CSV Airdrop is absent**                                                                                                   |
| `POST api.shasta.trongrid.io/jsonrpc` — `eth_call`                  | **Works.** `VERSION()` on the Safe singleton returned `1.4.1`. CORS `Access-Control-Allow-Origin: *`                                                                  |
| `POST api.trongrid.io/jsonrpc` — `eth_chainId`                      | **Works**, `0x2b6653dc` = 728126428. CORS `*`                                                                                                                         |

Safe App batching is unaffected: `sdk.txs.send` hands the host a plain
`{to, value, data}[]` and the host wraps `length > 1` in MultiSendCallOnly. Those
contracts are deployed on Shasta — proven by drain-safe's `TRON_R1_VERIFICATION.md`.

---

## 3. Gap analysis

Five things stop this app working on Tron. Two of them move money incorrectly.

### 3.1 Native decimals are hardcoded to 18 in three places — **money-critical**

TRX has **six** decimals. The app assumes eighteen at every point where a native
amount is converted:

| Site                              | Code                                         | Effect on Tron                                             |
| --------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| `src/parser/transformation.ts:94` | `decimals: 18` on the native `AssetTransfer` | Every downstream consumer inherits the wrong scale         |
| `src/transfers/transfers.ts:17`   | `toWei(transfer.amount, 18)`                 | A row asking for `1` TRX encodes `10¹⁸` SUN — **10¹² TRX** |
| `src/parser/balanceCheck.ts:92`   | `isSufficientBalance(balance, amount, 18)`   | Compares a 6-decimal balance against an 18-decimal amount  |

Today these three errors partially mask each other: the balance check rejects the
inflated amount, so the user sees "insufficient funds" rather than a catastrophic
transfer. That is luck, not safety — it depends on the Safe's TRX balance being
below 10¹² TRX, and it makes every legitimate native row unsendable. Both halves
are wrong and both are fixed by the same change.

`src/parser/balanceCheck.ts:95` compounds it cosmetically: the native symbol
falls back to the literal `"ETH"` when the transaction service returns
`"token": null`, which on Tron it always does.

### 3.2 Neither Tron chain is known to the app

`src/networks.ts` carries a static list of ~90 chains; neither Tron chain is in
it. Worse, `src/hooks/useChains.ts:71-81` **replaces** that list wholesale when
`REACT_APP_CONFIG_SERVICE_URL` resolves — so pointing a build at the Tron gateway
(which serves exactly one chain) would leave the app knowing about one chain and
nothing else. The mapping at `:61-67` also discards `nativeCurrency.decimals`
entirely; `NetworkInfo` has no field for it.

This matters more here than in the sibling apps because **CSV Airdrop talks to the
transaction service directly** (`useBalances.ts:15-26`, `:37`, `:68`), not through
the client gateway. Chain config is not a nicety; it is how the app finds its data.

### 3.3 A base58 address fails every stage of the CSV pipeline

Tron shows addresses as `T…` base58check. Every Tron wallet, explorer and document
uses that form, so it is what an operator will paste into a CSV. The parser rejects
it three times over:

- `src/parser/transformation.ts:223` — `normalizeAddress` checksums via
  `utils.getAddress` only when `utils.isAddress` passes; a `T…` string falls
  through unchanged
- `src/parser/transformation.ts:81` — `toPayment` treats any non-`isAddress`
  receiver as an ENS name and tries to resolve it
- `src/parser/validation.ts:41,47` — `utils.isAddress` fails, producing
  _"Invalid Receiver Address"_

Nothing crashes — unlike tx-builder, this app never calls `toChecksumAddress`
unguarded — but every Tron-format row is silently unusable.

### 3.4 ENS is queried once per row on a chain that has none

`src/hooks/useEnsResolver.ts:81-84` asks the provider for `network.ensAddress`.
Shasta's chain config reports `ensRegistryAddress: null`. On a 500-row CSV,
`toPayment` calls `isEnsEnabled()` per row (twice, for receiver and token), each
round-tripping through the provider to answer "no".

### 3.5 Token metadata resolution depends on an unverified bridge path

A CSV row names an arbitrary token address, and the app must find its `decimals`
before it can encode an amount. The resolution chain is: `fetchTokenList`
(`token.ts:26-48`, no Tron list → empty) → transaction-service balance items
(only tokens the Safe already holds, at non-zero balance) → **`eth_call` through
`SafeAppProvider`** (`token.ts:131-133`).

The same bridge dependency governs collectible type detection —
`collectibleTokenInfoProvider.ts:59-67` calls ERC-165 `supportsInterface` the same
way.

Whether the Tron host answers `eth_call` over the bridge cannot be determined
without the live UI. Making a must-ship path depend on that is not acceptable, and
falling back to "only tokens the Safe already holds" is not an option either: a
Safe that holds zero of a token is a legitimate state right up until the airdrop
executes, and the balance endpoint only lists non-zero holdings.

---

## 4. Design decisions

### 4.1 Hex is canonical; base58 is a rendering

**Every address in application state, in encoded calldata, and on every wire is
hex.** base58 is accepted as an input format and produced as a display format.

drain-safe made the opposite choice — base58 in state — and its own README says
not to copy it, because its recipient is used in exactly one place. CSV Airdrop is
the harder case by a wide margin: addresses flow through a text buffer, a parser,
an ENS resolver, a balance checker keyed on `toLowerCase()`, two summary reducers
keyed on token address, ABI encoding, and back out through generated CSV. Two
possible spellings of the same address in any of those maps is a silent-mismatch
factory.

### 4.2 Tron is detected from `shortName`, never from a chain-ID list

One predicate, `isTronChain` / `isTronNetworkPrefix`, matching `trx` or `trx-*`.
A chain-ID allowlist is precisely the artifact that would need editing when
mainnet or Nile arrives, which is the thing §1 rules out.

### 4.3 Read calls on Tron go to the Tron node, not through the bridge

Rather than a bridge-first-with-fallback chain threaded through two providers, all
contract **reads** on Tron go through a single `JsonRpcProvider` built from the
chain's RPC URI. The endpoint is verified working with permissive CORS (§2), so
this removes the §3.5 unknown from the critical path entirely instead of hedging
against it.

**Writes are unchanged** — transaction submission still goes through
`sdk.txs.send` over the bridge, exactly as on every other chain.

The acceptance walkthrough still records whether bridge `eth_call` works, because
that is useful information for the next app; nothing in this one depends on the
answer.

> Alternative considered and rejected: keep the bridge call and add the node as a
> fallback. It preserves a code path that may be permanently dead, doubles the
> failure modes to reason about, and its only advantage — working if the RPC URI
> is missing from chain config — is moot, since we author that field ourselves.

### 4.4 Decimals flow from chain config through data already in flight

The native-decimals fix needs exactly one new source of truth and **no new
plumbing**, because the value already travels with the transfer:

- `TokenInfoProvider` gains `getNativeTokenDecimals()`, resolved from chain config
  next to the existing `getNativeTokenSymbol()` (`token.ts:146-147`)
- `toPayment` writes it into the native `AssetTransfer.decimals` instead of `18`
- `buildAssetTransfers` uses `transfer.decimals` — which is already on the object
- `checkAllBalances` uses the `decimals` it already destructures from the summary
  entry, and the `symbol` alongside it

Three hardcoded constants become zero, and the two downstream sites stop
duplicating a value they were already being handed.

### 4.5 The CSV editor's buffer is never rewritten

`CSVEditor` holds the user's own text. Silently rewriting a pasted `T…` into
`0x…` mid-edit is the failure mode tx-builder spent a whole section undoing.
Conversion happens when the text is _parsed_, not while it is being typed.

---

## 5. Changes, file by file

### 5.1 `src/networks.ts`

Extend `NetworkInfo`:

```ts
export type NetworkInfo = {
  shortName: string;
  chainID: number;
  name: string;
  currencySymbol: string;
  decimals?: number; // native currency decimals; defaults to 18
  rpcUri?: string; // read-only JSON-RPC endpoint (Tron: contract reads)
  maxTransfers?: number; // row cap; defaults to 500
  baseAPI?: string;
  stagingBaseAPI?: string;
};
```

Add both chains:

```ts
{
  chainID: 2494104990,
  name: "Tron Shasta Testnet",
  shortName: "trx-shasta",
  currencySymbol: "TRX",
  decimals: 6,
  rpcUri: "https://api.shasta.trongrid.io/jsonrpc",
  maxTransfers: <measured, see §7>,
  baseAPI: "https://transaction-tron-testnet.stage.safe.protofire.io",
  stagingBaseAPI: "https://transaction-tron-testnet.stage.safe.protofire.io",
},
{
  // PROVISIONAL: this is the only live Tron mainnet transaction service as of
  // 2026-08-07 and it is stage-hosted. Replace when ops names a production host.
  // No gateway or Safe UI serves chain 728126428 yet, so this entry is
  // configuration-ahead-of-infrastructure by design: when the UI appears, no
  // code change is needed.
  chainID: 728126428,
  name: "Tron Mainnet",
  shortName: "trx",
  currencySymbol: "TRX",
  decimals: 6,
  rpcUri: "https://api.trongrid.io/jsonrpc",
  maxTransfers: <Shasta's value, as a conservative floor>,
  baseAPI: "https://transaction-tron.stage.safe.protofire.io",
  stagingBaseAPI: "https://transaction-tron.stage.safe.protofire.io",
},
```

Both `baseAPI` and `stagingBaseAPI` are set because `getBaseURL`
(`useBalances.ts:16-19`) selects `stagingBaseAPI || baseAPI` unless
`REACT_APP_IS_PRODUCTION === "true"`, and there is only one host to point at.
This matches the convention most Protofire entries in the file already follow.

`NETWORKS_WITH_DONATIONS_DEPLOYED` is untouched, so the Donate button stays hidden
on Tron.

### 5.2 `src/hooks/useChains.ts`

Two changes:

- **Merge, don't replace.** Start from the static `networkInfo` map and overlay
  config-service results, rather than returning a map built only from the response.
  A gateway serving one chain must not erase the other eighty-nine.
- **Carry `decimals` and `rpcUri` through** from `nativeCurrency.decimals` and
  `safeAppsRpcUri.value`, which the response already contains and the mapping at
  `:61-67` currently discards. The `decimals: 18` literal in the response type is
  wrong and becomes `number`.

This makes whether a deployer sets `REACT_APP_CONFIG_SERVICE_URL` a safe choice
either way: set, live Shasta config overrides our authored values and mainnet
survives; unset, our authored values are used.

### 5.3 `src/utils/tronAddress.ts`, `src/utils/sha256.ts` (new)

Copied verbatim from `safe-react-apps` (byte-identical in drain-safe and
tx-builder), with their test files. A provenance header names the source. These
are a frozen specification — base58check with a double-SHA-256 checksum — not a
design choice, and reimplementing them would mean the same algorithm with new
bugs. `sha256.ts` exists because no runtime dependency of this app provides it;
`web3-utils` is keccak-only.

Used from this app: `normalizeTronAddress` (input boundary), `toDisplayAddress`
(render), `isTronNetworkPrefix` (the §4.2 predicate), `hexToTronBase58`
(generated CSV).

**Known debt:** this is the third identical copy, now spanning two repositories.
A base58 bug would need fixing in three places. The travelling test file is the
drift detector; a shared package was rejected as org infrastructure disproportionate
to ~300 lines of frozen pure functions.

### 5.4 `src/parser/transformation.ts` — the conversion boundary

This is the **only** place a base58 address becomes hex.

`transform` already receives `tokenInfoProvider` and calls
`getSelectedNetworkShortname()` at `:30`, so the Tron predicate is derivable right
there with no new plumbing. Thread the resulting flag into `transformAsset`,
`transformCollectible` and `normalizeAddress`:

```ts
const normalizeAddress = (address: string, isTron: boolean) => {
  const candidate = isTron ? normalizeTronAddress(address.trim()) : address;
  return utils.isAddress(candidate) ? utils.getAddress(candidate) : candidate;
};
```

`normalizeTronAddress` returns a complete, checksum-valid `T…` address as hex and
**everything else untouched** — so a half-typed or mistyped address stays exactly
as the user wrote it and is reported by the existing validator, in the form they
recognise.

The gate on `isTron` is deliberate: converting unconditionally would mean a Tron
address pasted into an _Ethereum_ airdrop silently resolves to a valid-looking hex
address instead of being rejected.

`trimMatchingNetwork` (`:212`) is unchanged, so `trx-shasta:0x…` continues to work.
There is no base58 equivalent — a base58 address is not an EIP-3770 address.

`toPayment` (`:88-98`) takes native `decimals` from
`tokenInfoProvider.getNativeTokenDecimals()` instead of the literal `18`.

### 5.5 `src/parser/validation.ts`

No structural change. `areAddressesValid` (`:41,47`) receives already-normalized
hex, so `utils.isAddress` remains the right check. Confirm the error message
quotes the value **as the user typed it** rather than a partially-converted form.

### 5.6 `src/transfers/transfers.ts`

Line 17: `toWei(transfer.amount, 18)` → `toWei(transfer.amount, transfer.decimals)`.
The value is already on the object.

TRC-20 calldata needs **no change** — it is byte-identical to ERC-20, selector
`a9059cbb`, address left-padded to 32 bytes with no `0x41` prefix. The existing
encoding test vectors stay exactly as they are; that is the guarantee.

### 5.7 `src/parser/balanceCheck.ts`

Line 92: hardcoded `18` → the `decimals` already destructured from the summary
entry at `:85`. Line 95: `|| "ETH"` → the `symbol` from the same entry, which
carries the chain's `currencySymbol`.

### 5.8 `src/hooks/token.ts` and `src/hooks/collectibleTokenInfoProvider.ts`

Both construct `new ethers.providers.Web3Provider(new SafeAppProvider(safe, sdk))`
for contract reads (`token.ts:93`, `collectibleTokenInfoProvider.ts:41`). Introduce
a shared hook that returns a `JsonRpcProvider(chainConfig.rpcUri)` when
`isTronChain(chainConfig)` and the existing `Web3Provider` otherwise, and use it in
both. `TokenInfoProvider` additionally gains `getNativeTokenDecimals()` alongside
`getNativeTokenSymbol()` (`:146-147`).

`fetchTokenList` (`:26-48`) gets no Tron entry — there is no curated Tron token
list worth shipping, and the warn-and-continue default is correct.

### 5.9 `src/hooks/useEnsResolver.ts`

`isEnsEnabled()` (`:81-84`) returns `false` immediately on Tron, before touching
the provider. Address-book lookups are unaffected — they compare lowercased hex
(`:44-47`) and work on Tron unchanged.

### 5.10 `src/hooks/useCsvParser.ts`

Line 87's `numLines > 501` reads its limit from `maxTransfers` (default 500), and
the rejection message names the actual limit and the reason. See §7 for how the
Tron number is obtained.

### 5.11 Display surfaces

`toDisplayAddress(address, shortName)` at render time; `shortName` from
`useCurrentChain()`.

| Surface                                                                                                                      | Change                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/common/EthHashInfo.tsx`                                                                                          | Renders base58 (`:52`). **`Identicon` (`:46`) stays seeded from hex**, so a Safe's blockie matches everywhere else in Safe{Wallet}                                       |
| `components/Summary.tsx`, `assets/AssetTransferTable.tsx`, `assets/CollectiblesTransferTable.tsx`, `components/Receiver.tsx` | base58                                                                                                                                                                   |
| `components/DrainSafeDialog.tsx`, `components/DonateDialog.tsx`                                                              | Generated CSV rows carry base58 receivers on Tron. These files are read by humans on a chain where hex is the foreign format, and they round-trip correctly through §5.4 |
| `components/CSVEditor.tsx`                                                                                                   | **Unchanged** — §4.5                                                                                                                                                     |

---

## 6. Out of scope

- The in-app MultiSend path. The host wraps multi-transaction batches; do not wire
  up `@safe-global/safe-deployments`, which does not know these chains.
- Any change to TRC-20 calldata encoding (§5.6).
- The donation feature. `NETWORKS_WITH_DONATIONS_DEPLOYED` (`networks.ts:10`)
  excludes Tron, so the button is already hidden; `DONATION_ADDRESS`
  (`utils.ts:9`) stays an Ethereum address.
- `EthHashInfo`'s commented-out `ExplorerLink` (`:55`). Wiring it is _newly
  feasible_ — Shasta's chain config carries `blockExplorerUriTemplate` and
  `toDisplayAddress` produces the base58 form Tronscan resolves — but it changes
  non-Tron behaviour and belongs in its own change.
- Any Tron build target, environment file, or deployment-verification script.
- Deploying testbed contracts (see §8, TRC-721/1155).
- Performing the gateway registration (§10).
- Nile, and any change to the Safe UI, bridge or gateway.

---

## 7. The row cap

`useCsvParser.ts:87` rejects CSVs over 500 rows, justified in-code as "the block
gas limit". Tron has no equivalent — it has a per-transaction `fee_limit` and an
energy cap, and the practical ceiling on a MultiSend is lower and differently
shaped.

**Method.** Build an N-row MultiSend payload and `eth_call` it against Shasta,
reading energy consumption; walk N upward until it exceeds a realistic
`fee_limit`. This is the technique drain-safe's `tron/scripts/sim3.py` already
uses for batch-size energy costs — read-only, no keys, nothing broadcast. Any
probe script written for this lives in `tron/scripts/`.

**Expression.** `maxTransfers` on the chain entry, so the limit sits next to the
chain it describes and survives future Tron chains. The parser warns and blocks;
it never silently truncates a transfer list.

**Mainnet inherits Shasta's number** as a conservative floor. Mainnet energy
pricing differs and the value should be re-measured when a mainnet UI exists.

**Measured 2026-08-07** (`tron/scripts/rowcap_probe.mjs`, keyless TronGrid):
all-TRC-20 batches (amount-0 legs) pass simulation through **325 rows**
(4.82M energy, ~14.7k/row) and fail at **350** with `CPU timeout for 'SWAP2'
operation` — the TVM per-transaction CPU ceiling, which binds before any
realistic `fee_limit` does. Native-to-fresh-account batches pass at 500 rows
(16.4M energy ≈ 1641 TRX; activation is energy-heavy but CPU-cheap). Real
airdrop legs do more work per row than amount-0 legs (nonzero-amount SSTORE,
cold receivers), so the shipped value is **`maxTransfers: 200`** — margin
under the observed ceiling, ≈600 TRX fee at ~30k energy/row.

---

## 8. Asset types

| Type               | Status                                   |
| ------------------ | ---------------------------------------- |
| Native TRX         | Must ship, verified end-to-end on Shasta |
| TRC-20             | Must ship, verified end-to-end on Shasta |
| TRC-721 / TRC-1155 | **Code-complete, unverified**            |

The collectible path is chain-agnostic once §5 lands, so disabling it would be
extra work that removes function. But no TRC-721 or TRC-1155 exists on Shasta for
this work, and deploying testbeds is explicitly not a deliverable — so the app
ships with collectible support that has not been exercised on Tron.

**This is a stated limitation, not a claim of support.** Two things are unknown
and one of them is not ours to fix: whether ERC-165 `supportsInterface` behaves as
expected on TRC-721 implementations, and whether the Tron transaction service
indexes collectibles at all (`/api/v2/…/collectibles/` returns a well-formed
`count: 0`, which is indistinguishable from "indexed, none held").

**Verification trigger:** the first time a Shasta Safe holds a TRC-721 or
TRC-1155, run the collectible half of §11 and record the result. If the transaction
service turns out not to index them, the balance check degrades while transfers
still encode correctly — the fix is then an ops/indexer matter, not an app change.

---

## 9. Why this is not a port of the sibling apps

Deliberate divergences from `safe-react-apps`, each with its reason:

| Sibling pattern                                                    | Here                                | Why                                                                                                                                                                           |
| ------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| drain-safe: base58 in app state                                    | Hex in state (§4.1)                 | drain-safe's recipient is used in one place; ours flows through maps keyed by address. Its own README says not to copy the pattern outward                                    |
| tx-builder: per-call-site `normalizeTronAddress` at six boundaries | One boundary, in the parser (§5.4)  | This app has exactly one address entry point — the CSV. Six call sites would be five more than exist                                                                          |
| tx-builder: `.env.tron.shasta` + `build:tron` + gateway-URL check  | No build config at all              | This app reads no gateway URL. Its Tron behaviour is chain-config-driven, so the entire "misbuilt bundle" failure class that dominates tx-builder's runbook cannot occur here |
| tx-builder: `verify_safe_app_deployment.mjs`                       | Manual checklist (§10)              | The script's unique value was its build-config check. The remaining hosting checks are worth running but do not justify importing tooling                                     |
| tx-builder: `getAbiFromTronNode` as one racer among four           | Tron node as _the_ read path (§4.3) | tx-builder needed a race because it had four possible ABI sources. We have one question — what are this token's decimals — and one endpoint that answers it                   |

What does come across: the base58check codec, and the protocol facts —
TRC-20 calldata is byte-identical to ERC-20; canonical Safe contract addresses are
not deployed on Tron and the host resolves them itself; the gateway's
`contractAddresses` are all `null`; base58 is the only form Tronscan resolves.

---

## 10. Deployment and hand-off

No build changes. `homepage` is `"./"`, so assets are referenced relatively and
the bundle can be served from any path — the "blank page unless served at the
right path" trap that applies to tx-builder does not apply here.

**Pre-deploy checklist** (manual; six checks the host actually enforces):

1. **HTTPS**, single stable origin — the host validates
   `event.origin === new URL(app.url).origin`
2. **`manifest.json` at the app root** with `name`, `description`, and `icons` or
   `iconPath` — `public/manifest.json` already satisfies this
3. **CORS on `manifest.json`** — fetched cross-origin. Without it the
   add-custom-app dialog reports _"The app doesn't support Safe App functionality"_
   even though the manifest is valid.
   ⚠️ **`curl -I` will lie to you here.** S3/CloudFront answers CORS only to
   requests carrying an `Origin` header. Check with
   `curl -sD- -o/dev/null -H 'Origin: https://tron-app.stage.safe.protofire.io' <url>/manifest.json`
   — a HEAD request or a GET without `Origin` shows no header on a bucket that
   serves it correctly
4. **Manifest responds in < 5 s** — the host aborts the fetch at 5000 ms
5. **No `X-Frame-Options`**, and no `frame-ancestors` omitting
   `https://tron-app.stage.safe.protofire.io`. An `https://*.safe.global`
   allowlist does **not** cover this host
6. **Icon reachable** at the manifest's `iconPath`

**Registration entry** (ops action, not part of this work):

| Field           | Value                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| `url`           | `https://dev-tron-apps.safe.protofire.io/safe-airdrop/`                                                    |
| `name`          | `CSV Airdrop`                                                                                              |
| `description`   | `Upload your CSV transfer file to send arbitrarily many tokens of various amounts to a list of recipients` |
| `iconUrl`       | 256×256 PNG                                                                                                |
| `chainIds`      | `["2494104990"]` — mainnet cannot be registered on a gateway that does not serve it                        |
| `tags`          | `["Infrastructure"]`                                                                                       |
| `features`      | `["BATCHED_TRANSACTIONS"]`                                                                                 |
| `accessControl` | `NO_RESTRICTIONS`                                                                                          |

**Blocker:** `public/` ships `logo.svg` only, and the manifest's `iconPath` points
at it. Both registered Tron apps use PNG `iconUrl`s. A 256×256 PNG must be
produced before registration; owner unassigned.

---

## 11. Acceptance

### Baseline first

`node_modules` is absent and no test baseline exists for this repo. **Before
writing any code**, install and run the suite on Node 20 (CI's upper matrix entry;
CI runs 16.x and 20.x), record the result here, and classify every failure as
_pre-existing_ / _in our blast radius_ / _new_.

**A pre-existing failure is documented, not fixed, unless it sits in code we
touch.** The counterpart lesson from tx-builder is the more expensive one: it
assumed a green suite, and 16 of the failures it dismissed as environment drift
were a real defect in the exact user story it claimed was untouched. Classify
honestly; do not reach.

**Baseline recorded 2026-08-07** (Node 20.11.1, yarn 1.22.22, Windows,
`yarn install --frozen-lockfile` clean):

- First run: 3 of 7 suites failed **to load**. `transfers.test.ts` and
  `parser.test.ts` failed with `ERC1155__factory.createInterface` undefined —
  caused by `yarn generate-types` running under Windows `cmd`, which does not
  strip the single-quoted globs, so `src/contracts` held only the ERC20 typings.
  **Environment issue, not a code defect**; regenerating typechain types with
  correct arguments fixed both suites unchanged. CI (Linux) is unaffected.
- True baseline after regeneration: **6/7 suites, 34/34 tests pass.**
- One pre-existing failure: `src/__tests__/tokenList.test.ts` imports
  `staticNetworkInfo` from `../networks`, an export that does not exist
  (`networks.ts` exports `_networkInfo` and the `networkInfo` map). The suite
  fails at load. **Classification: pre-existing, in our blast radius** —
  `networks.ts` is a §5.1 file — so it is fixed alongside that change (the test
  wants the static map; the import is repointed at `networkInfo`).

### Unit

- base58 round-trip and typo rejection (last character changed → rejected, **not**
  silently converted to a different valid address) — travels with §5.3
- **Golden SUN vectors** for `toWei` at six decimals: `"1"` → `1000000`,
  `"0.000001"` → `1`, `"0.0000001"` → truncates to `0`. This is the §3.1
  regression fence
- Existing ERC-20 encoding vectors unchanged — the TRC-20 identity guarantee
- Parser: base58 receiver accepted and stored as hex; `trx-shasta:0x…` stripped;
  malformed base58 rejected with the value as typed; plain hex still accepted
- Chain-driven decimals reach `buildAssetTransfers` and `checkAllBalances`
- `useChains` merge: a one-chain config response leaves the static entries intact
- `isTronChain` true for `trx` / `trx-shasta`, false for `eth` / `arb1` — and the
  base58 conversion does **not** run on a non-Tron chain

### Manual, on Shasta

Prerequisites: a Shasta Safe with the tester as owner, TronLink on Shasta with
TRX, and a TRC-20 the Safe holds.

1. Load the app in the Safe UI (Apps → My custom apps) and confirm the handshake —
   the Safe's address and network render
2. Upload a CSV with **base58** receivers: native TRX rows and TRC-20 rows.
   Confirm no validation warnings and that the summary shows base58 addresses
3. Confirm amounts: a `1` TRX row must encode `1000000` SUN, not `10¹⁸`
4. Paste a `0x…` receiver — still accepted; a `trx-shasta:0x…` receiver — still
   accepted; a base58 address with one character changed — rejected, with the
   address shown as typed
5. Submit. Confirm the host wraps a multi-row batch in MultiSendCallOnly
6. Co-sign and execute via TronLink; verify the transfers on Tronscan
7. Confirm the Donate button is absent and Drain safe generates base58 rows
8. Record whether bridge `eth_call` works (informational — §4.3)
9. Collectibles: attempt only if a TRC-721/1155 is available (§8)

Record the outcome of each step with the date and app URL, in the verification
document.

---

## 12. Risks

| Risk                                                                                                                                                                                                                                                | Handling                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **TRC-20 balance indexing unproven.** The test Safe holds only TRX, so only the native balance shape was observable. If the transaction service does not index TRC-20s, every TRC-20 row falsely reports insufficient funds — on the must-ship path | Detected by step 2 of §11. Transfers would still encode correctly; the failure is the balance _check_, and the fix would be an indexer/ops matter                            |
| TRC-721/1155 unverified, and possibly unindexed                                                                                                                                                                                                     | §8, with a named verification trigger                                                                                                                                        |
| Bridge `eth_call` may not work on the Tron host                                                                                                                                                                                                     | Neutralised by §4.3 — nothing depends on it                                                                                                                                  |
| Mainnet `baseAPI` is a provisional stage host                                                                                                                                                                                                       | Commented at the entry; §5.1                                                                                                                                                 |
| Third copy of the base58 codec across two repos                                                                                                                                                                                                     | Accepted debt; §5.3                                                                                                                                                          |
| Shasta-derived row cap inherited by mainnet                                                                                                                                                                                                         | Conservative floor, re-measure when a mainnet UI exists; §7                                                                                                                  |
| **Not registered** — nothing loads until ops acts, and that needs a PNG icon the repo does not have                                                                                                                                                 | §10; the icon is an unowned task                                                                                                                                             |
| TronGrid public JSON-RPC is rate-limited without an API key                                                                                                                                                                                         | Reads are per-token-address and cached in `token.ts`. If a large CSV with many distinct tokens hits limits, the mitigation is an API key in chain config — not an app change |
