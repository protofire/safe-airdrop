// Row-cap energy probe for CSV Airdrop on Tron Shasta (PRD §7).
//
// Builds an N-row MultiSend wrapped in Safe execTransaction and asks the
// Shasta node for the energy it would consume (eth_estimateGas over TronGrid
// JSON-RPC returns energy). Read-only: nothing is signed or broadcast; the
// signature is the pre-approved-hash form, valid because `from` is the owner.
//
// Technique and fixture addresses come from drain-safe's tron/scripts/sim3.py
// and its TRON_R1_VERIFICATION.md (same Safe, owner, MultiSendCallOnly and
// TRC-20 on Shasta).
//
// Two per-row shapes are measured:
//  - trc20-0:      transfer(owner, 0)  — warm receiver, no SSTORE; lower bound
//  - native-fresh: 1 sun to a distinct never-activated address — includes the
//    ~25k account-activation energy; a realistic upper bound per row
//
// Usage: node rowcap_probe.mjs
//
// Results, 2026-08-07 (keyless TronGrid, Shasta):
//   trc20-0:      base ~27.5k, ~14.7k energy/row. PASS through 325 rows
//                 (4.82M energy); 350 rows fails simulation with
//                 "CPU timeout for 'SWAP2' operation" — the TVM per-tx CPU
//                 ceiling, independent of fee_limit.
//   native-fresh: ~32.8k energy/row incl. account activation; PASS at 500
//                 rows (16.4M energy ≈ 1641 TRX) — activation is energy-heavy
//                 but CPU-cheap, so it never hits the CPU ceiling.
//   Binding constraint: TVM CPU time on all-TRC-20 batches, between 325 and
//   350 amount-0 legs. Real airdrop legs (nonzero amount, cold receiver
//   SSTORE) execute more work per row, so the shipped cap is 200 rows —
//   margin under the observed ceiling, ≈600 TRX fee at ~30k energy/row.

const RPC = "https://api.shasta.trongrid.io/jsonrpc";

const SAFE = "0xD72c8d27d0F45173d3178E35B2d496F56a407fF7";
const OWNER = "0x61ca933fd67b9c0eb3a678fb8cda50d4c95bf63d";
const MSCO = "0xf1dd46Af04774C999e213FA6dF2b4278BBa8A757";
const TOKEN = "0x42a1e39aefA49290F2B3F9ed688D7cecf86CD6E0";

const w = (x) => BigInt(x).toString(16).padStart(64, "0");
const a32 = (a) => a.toLowerCase().replace("0x", "").padStart(64, "0");
const pad = (h) => h + "0".repeat((64 - (h.length % 64)) % 64);

async function rpc(method, params) {
  const resp = await fetch(RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  return resp.json();
}

// Safe v1.4.1 execTransaction(to=MSCO, operation=DELEGATECALL, data=multiSend(txs))
function build(txs) {
  const packed = txs
    .map((t) => "00" + t.to.toLowerCase().slice(2) + w(t.value) + w(t.data.length / 2) + t.data)
    .join("");
  const ms = "8d80ff0a" + w(32) + w(packed.length / 2) + pad(packed);
  const sig = a32(OWNER) + w(0) + "01";
  const D = 320;
  const S = D + 32 + pad(ms).length / 2;
  const head = a32(MSCO) + w(0) + w(D) + w(1) + w(0) + w(0) + w(0) + a32("0x0") + a32("0x0") + w(S);
  return "0x6a761202" + head + w(ms.length / 2) + pad(ms) + w(sig.length / 2) + pad(sig);
}

const trc20Zero = () => ({ to: TOKEN, value: 0, data: "a9059cbb" + a32(OWNER) + w(0) });
// Distinct never-activated receivers: deterministic fake addresses.
const nativeFresh = (i) => ({
  to: "0x" + (0x1111111111111111111111111111111111110000n + BigInt(i)).toString(16).padStart(40, "0"),
  value: 1,
  data: "",
});

async function measure(label, txs) {
  const data = build(txs);
  const call = await rpc("eth_call", [{ from: OWNER, to: SAFE, data }, "latest"]);
  const ok = call.result && BigInt(call.result) === 1n;
  const est = await rpc("eth_estimateGas", [{ from: OWNER, to: SAFE, data }]);
  const energy = est.result ? Number(BigInt(est.result)) : null;
  const err = (call.error || est.error || {}).message || "";
  console.log(
    `${label.padEnd(28)} rows=${String(txs.length).padStart(4)} ` +
      `${ok ? "PASS  " : "REVERT"} energy=${energy ?? "-"} bytes=${data.length / 2} ${err}`,
  );
  return { rows: txs.length, ok, energy };
}

const ENERGY_PRICE_SUN = 100; // Shasta and mainnet, per TRON_R1_VERIFICATION.md

const results = { trc20: [], native: [] };
for (const n of [1, 5, 20, 100, 200, 250, 300, 325, 350, 500]) {
  results.trc20.push(await measure("trc20-0 (warm, lower bound)", Array.from({ length: n }, trc20Zero)));
  await new Promise((r) => setTimeout(r, 1500)); // be gentle with keyless TronGrid
}
for (const n of [1, 5, 20, 100, 200, 350, 500]) {
  results.native.push(
    await measure(
      "native-fresh (upper bound)",
      Array.from({ length: n }, (_, i) => nativeFresh(i)),
    ),
  );
  await new Promise((r) => setTimeout(r, 1500));
}

for (const [name, series] of Object.entries(results)) {
  const oks = series.filter((r) => r.ok && r.energy);
  if (oks.length >= 2) {
    const a = oks[0];
    const b = oks[oks.length - 1];
    const perRow = (b.energy - a.energy) / (b.rows - a.rows);
    const base = a.energy - perRow * a.rows;
    console.log(
      `\n${name}: base=${Math.round(base)} energy, per-row=${Math.round(perRow)} energy ` +
        `(${(perRow * ENERGY_PRICE_SUN) / 1e6} TRX/row at ${ENERGY_PRICE_SUN} sun/energy)`,
    );
    for (const feeTrx of [100, 500, 1000, 15000]) {
      const maxRows = Math.floor(((feeTrx * 1e6) / ENERGY_PRICE_SUN - base) / perRow);
      console.log(`  fee_limit ${String(feeTrx).padStart(5)} TRX -> ${maxRows} rows`);
    }
  }
}
