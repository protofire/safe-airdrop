// Copied from safe-react-apps apps/drain-safe/src/utils/tronAddress.test.ts (byte-identical
// there and in apps/tx-builder) and reformatted to this repo's prettier style.
// A frozen specification -- fix bugs in every copy. See tron/PRD_CSV_AIRDROP_TRON.md par.5.3.
import {
  hexToTronBase58,
  hexToTronRawHex,
  isTronBase58Address,
  isTronNetworkPrefix,
  normalizeTronAddress,
  toDisplayAddress,
  toDisplayAddressList,
  tronBase58ToHex,
} from "./tronAddress";

// USDT on Tron mainnet, and the counter test contract on Shasta.
const USDT_BASE58 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_HEX = "0xa614f803b6fd780986a42c78ec9c7f77e6ded13c";
const COUNTER_BASE58 = "TSqF5pn9FxP77jfQCy46NoFa5HXdQaYiwZ";
const COUNTER_HEX = "0xb8f88c79d2d655a0acaf5982a13028ddf7628ebe";

describe("tronBase58ToHex", () => {
  it("converts a base58 address to its 20-byte hex form", () => {
    expect(tronBase58ToHex(USDT_BASE58)).toBe(USDT_HEX);
    expect(tronBase58ToHex(COUNTER_BASE58)).toBe(COUNTER_HEX);
  });

  it("trims surrounding whitespace from a pasted address", () => {
    expect(tronBase58ToHex(`  ${COUNTER_BASE58}\n`.trim())).toBe(COUNTER_HEX);
  });

  it("rejects an address whose checksum does not match (a typo)", () => {
    // Same shape, one character changed -- exactly what a mistyped address looks like.
    expect(tronBase58ToHex("TSqF5pn9FxP77jfQCy46NoFa5HXdQaYiwY")).toBeUndefined();
  });

  it("rejects a half-typed address", () => {
    expect(tronBase58ToHex("TSqF5pn9FxP77jfQ")).toBeUndefined();
  });

  it("rejects strings that are not base58 addresses", () => {
    expect(tronBase58ToHex("")).toBeUndefined();
    expect(tronBase58ToHex(undefined)).toBeUndefined();
    expect(tronBase58ToHex("INVALID ADDRESS VALUE")).toBeUndefined();
    expect(tronBase58ToHex(USDT_HEX)).toBeUndefined();
    // Correct length and prefix, but contains characters outside the base58 alphabet.
    expect(tronBase58ToHex("T0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl0")).toBeUndefined();
  });
});

describe("isTronBase58Address", () => {
  it("accepts a valid base58 address and nothing else", () => {
    expect(isTronBase58Address(USDT_BASE58)).toBe(true);
    expect(isTronBase58Address(USDT_HEX)).toBe(false);
    expect(isTronBase58Address("TSqF5pn9FxP77jfQCy46NoFa5HXdQaYiwY")).toBe(false);
    expect(isTronBase58Address()).toBe(false);
  });
});

describe("hexToTronBase58", () => {
  it("converts hex back to base58", () => {
    expect(hexToTronBase58(USDT_HEX)).toBe(USDT_BASE58);
    expect(hexToTronBase58(COUNTER_HEX)).toBe(COUNTER_BASE58);
  });

  it("accepts checksummed, bare and raw Tron hex", () => {
    expect(hexToTronBase58("0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe")).toBe(COUNTER_BASE58);
    expect(hexToTronBase58("b8f88c79d2d655a0acaf5982a13028ddf7628ebe")).toBe(COUNTER_BASE58);
    expect(hexToTronBase58("41b8f88c79d2d655a0acaf5982a13028ddf7628ebe")).toBe(COUNTER_BASE58);
  });

  it("round-trips through hex and back", () => {
    expect(hexToTronBase58(tronBase58ToHex(COUNTER_BASE58))).toBe(COUNTER_BASE58);
  });

  it("returns undefined for values that are not address-shaped hex", () => {
    expect(hexToTronBase58("0x1234")).toBeUndefined();
    expect(hexToTronBase58(COUNTER_BASE58)).toBeUndefined();
    expect(hexToTronBase58("")).toBeUndefined();
  });
});

describe("hexToTronRawHex", () => {
  it("produces the 41-prefixed form Tron node APIs expect", () => {
    expect(hexToTronRawHex(COUNTER_HEX)).toBe("41b8f88c79d2d655a0acaf5982a13028ddf7628ebe");
    expect(hexToTronRawHex("0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe")).toBe(
      "41b8f88c79d2d655a0acaf5982a13028ddf7628ebe",
    );
  });

  it("returns undefined for values that are not address-shaped hex", () => {
    expect(hexToTronRawHex("not an address")).toBeUndefined();
  });
});

describe("normalizeTronAddress", () => {
  it("converts base58 input to hex", () => {
    expect(normalizeTronAddress(COUNTER_BASE58)).toBe(COUNTER_HEX);
    expect(normalizeTronAddress(`  ${COUNTER_BASE58}  `)).toBe(COUNTER_HEX);
  });

  it("leaves anything else untouched", () => {
    const checksummed = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";

    expect(normalizeTronAddress(checksummed)).toBe(checksummed);
    expect(normalizeTronAddress("INVALID ADDRESS VALUE")).toBe("INVALID ADDRESS VALUE");
    expect(normalizeTronAddress("")).toBe("");
    // A half-typed base58 address must survive as typed, not become garbage.
    expect(normalizeTronAddress("TSqF5pn9FxP77jfQ")).toBe("TSqF5pn9FxP77jfQ");
  });
});

describe("isTronNetworkPrefix", () => {
  it("recognises Tron chains by their EIP-3770 short name", () => {
    expect(isTronNetworkPrefix("trx")).toBe(true);
    expect(isTronNetworkPrefix("trx-shasta")).toBe(true);
    expect(isTronNetworkPrefix("trx-nile")).toBe(true);
  });

  it("does not match other chains or a missing prefix", () => {
    expect(isTronNetworkPrefix("eth")).toBe(false);
    expect(isTronNetworkPrefix("matic")).toBe(false);
    // Guards against a bare `startsWith('trx')` matching an unrelated short name.
    expect(isTronNetworkPrefix("trxsomething")).toBe(false);
    expect(isTronNetworkPrefix("")).toBe(false);
    expect(isTronNetworkPrefix()).toBe(false);
  });
});

describe("toDisplayAddress", () => {
  it("shows base58 on Tron chains", () => {
    expect(toDisplayAddress(COUNTER_HEX, "trx-shasta")).toBe(COUNTER_BASE58);
    expect(toDisplayAddress("0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe", "trx")).toBe(COUNTER_BASE58);
  });

  it("leaves addresses untouched on every other chain", () => {
    const checksummed = "0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe";

    expect(toDisplayAddress(checksummed, "eth")).toBe(checksummed);
    expect(toDisplayAddress(checksummed, "")).toBe(checksummed);
    expect(toDisplayAddress(checksummed)).toBe(checksummed);
  });

  it("falls back to the input when it is not address-shaped hex", () => {
    expect(toDisplayAddress("", "trx-shasta")).toBe("");
    expect(toDisplayAddress("0x", "trx-shasta")).toBe("0x");
    // Already base58 -- must not be mangled into something else.
    expect(toDisplayAddress(COUNTER_BASE58, "trx-shasta")).toBe(COUNTER_BASE58);
  });
});

describe("toDisplayAddressList", () => {
  it("converts every address inside an array value", () => {
    expect(toDisplayAddressList(`[${COUNTER_HEX},${USDT_HEX}]`, "trx-shasta")).toBe(
      `[${COUNTER_BASE58},${USDT_BASE58}]`,
    );
    expect(toDisplayAddressList(`[[${COUNTER_HEX}],[${USDT_HEX}]]`, "trx")).toBe(
      `[[${COUNTER_BASE58}],[${USDT_BASE58}]]`,
    );
  });

  it("leaves the value untouched on other chains", () => {
    expect(toDisplayAddressList(`[${COUNTER_HEX}]`, "eth")).toBe(`[${COUNTER_HEX}]`);
  });
});
