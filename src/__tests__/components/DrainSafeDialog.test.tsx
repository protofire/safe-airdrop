import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { act } from "react-dom/test-utils";
import { Provider as ReduxProvider } from "react-redux";
import { buildDrainCsv, DrainSafeDialog } from "src/components/DrainSafeDialog";
import { NetworkInfo } from "src/networks";
import { AssetBalance } from "src/stores/slices/assetBalanceSlice";
import { NFTBalance } from "src/stores/slices/collectiblesSlice";
import { makeStore } from "src/stores/store";

jest.mock("@safe-global/safe-apps-react-sdk", () => ({
  useSafeAppsSDK: () => ({
    safe: jest.requireActual("../../test/util").testData.dummySafeInfo,
    sdk: { txs: { send: jest.fn() } },
    connected: true,
  }),
}));

jest.mock("src/hooks/useEnsResolver", () => {
  // Stable identity: the dialog holds on to the resolver across renders.
  const resolver = {
    isEnsEnabled: () => Promise.resolve(false),
    resolveName: () => Promise.resolve(null),
    lookupAddress: () => Promise.resolve(null),
  };

  return { useEnsResolver: () => resolver };
});

// Known pairs, taken as literals from src/utils/tronAddress.test.ts.
const USDT_BASE58 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_HEX = "0xa614f803b6fd780986a42c78ec9c7f77e6ded13c";
const COUNTER_BASE58 = "TSqF5pn9FxP77jfQCy46NoFa5HXdQaYiwZ";
const COUNTER_HEX = "0xb8f88c79d2d655a0acaf5982a13028ddf7628ebe";

const assetBalance: AssetBalance = [
  { tokenAddress: null, token: null, balance: "1000000000000000000", decimals: 18 },
  {
    tokenAddress: USDT_HEX,
    token: { name: "Tether", symbol: "USDT", decimals: 6 },
    balance: "2500000",
    decimals: 6,
  },
];

// What the Tron transaction service actually returns: the native balance is denominated in
// sun (6 decimals) and carries no entry-level decimals hint (PRD §2 probe).
const tronAssetBalance: AssetBalance = [
  { tokenAddress: null, token: null, balance: "1000000000", decimals: 6 },
  {
    tokenAddress: USDT_HEX,
    token: { name: "Tether", symbol: "USDT", decimals: 6 },
    balance: "2500000",
    decimals: 6,
  },
];

const nftBalance: NFTBalance["results"] = [
  {
    address: USDT_HEX,
    id: "7",
    tokenName: "Collection",
    tokenSymbol: "COL",
    imageUri: "",
    name: "Item",
  },
];

describe("buildDrainCsv", () => {
  it("writes hex addresses on a non tron chain", () => {
    expect(buildDrainCsv({ receiver: COUNTER_HEX, assetBalance, nftBalance, shortName: "eth" })).toBe(
      "token_type,token_address,receiver,amount,id" +
        `\nnative,,${COUNTER_HEX},1,` +
        `\nerc20,${USDT_HEX},${COUNTER_HEX},2.5,` +
        `\nnft,${USDT_HEX},${COUNTER_HEX},,7`,
    );
  });

  it("writes base58 addresses and converts the native balance with the chain's decimals on a tron chain", () => {
    expect(
      buildDrainCsv({
        receiver: COUNTER_HEX,
        assetBalance: tronAssetBalance,
        nftBalance,
        shortName: "trx-shasta",
        nativeDecimals: 6,
      }),
    ).toBe(
      "token_type,token_address,receiver,amount,id" +
        `\nnative,,${COUNTER_BASE58},1000,` +
        `\nerc20,${USDT_BASE58},${COUNTER_BASE58},2.5,` +
        `\nnft,${USDT_BASE58},${COUNTER_BASE58},,7`,
    );
  });

  it("keeps a base58 receiver as pasted on a tron chain", () => {
    expect(buildDrainCsv({ receiver: COUNTER_BASE58, assetBalance: [], nftBalance: [], shortName: "trx" })).toBe(
      "token_type,token_address,receiver,amount,id",
    );
    expect(
      buildDrainCsv({
        receiver: COUNTER_BASE58,
        assetBalance: tronAssetBalance,
        nftBalance: [],
        shortName: "trx",
        nativeDecimals: 6,
      }),
    ).toContain(`\nnative,,${COUNTER_BASE58},1000,`);
  });

  it("emits only the header without a receiver", () => {
    expect(buildDrainCsv({ receiver: "", assetBalance, nftBalance, shortName: "eth" })).toBe(
      "token_type,token_address,receiver,amount,id",
    );
  });
});

const chainWithShortName = (shortName: string): NetworkInfo => ({
  chainID: 4,
  name: `Chain ${shortName}`,
  shortName,
  currencySymbol: "TRX",
});

const renderDialog = (shortName: string) =>
  render(
    <ReduxProvider store={makeStore({ networks: { networks: [chainWithShortName(shortName)] } })}>
      <DrainSafeDialog isOpen onClose={() => undefined} assetBalance={assetBalance} nftBalance={nftBalance} />
    </ReduxProvider>,
  );

const typeAddress = async (value: string) => {
  await act(async () => {
    fireEvent.change(screen.getByPlaceholderText("Address or ENS"), { target: { value } });
  });
};

describe("DrainSafeDialog address input", () => {
  it("accepts a pasted base58 address on a tron chain", async () => {
    renderDialog("trx-shasta");
    await typeAddress(COUNTER_BASE58);

    expect(screen.queryByText("The address is invalid")).toBeNull();
  });

  it("rejects the same base58 address on a non tron chain", async () => {
    renderDialog("eth");
    await typeAddress(COUNTER_BASE58);

    expect(screen.queryByText("The address is invalid")).not.toBeNull();
  });

  it("rejects a mistyped base58 address on a tron chain", async () => {
    renderDialog("trx-shasta");
    // Same shape as COUNTER_BASE58 with the last character changed.
    await typeAddress("TSqF5pn9FxP77jfQCy46NoFa5HXdQaYiwY");

    expect(screen.queryByText("The address is invalid")).not.toBeNull();
  });
});
