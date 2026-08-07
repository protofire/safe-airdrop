import { render, screen } from "@testing-library/react";
import React from "react";
import { act } from "react-dom/test-utils";
import { Provider as ReduxProvider } from "react-redux";
import { ERC20Token } from "src/components/assets/ERC20Token";
import { ERC721Token } from "src/components/assets/ERC721Token";
import { NetworkInfo } from "src/networks";
import { makeStore } from "src/stores/store";

jest.mock("@safe-global/safe-apps-react-sdk", () => ({
  useSafeAppsSDK: () => ({
    safe: jest.requireActual("../../test/util").testData.dummySafeInfo,
    sdk: { txs: { send: jest.fn() } },
    connected: true,
  }),
}));

jest.mock("src/hooks/token", () => ({
  useTokenList: () => ({ tokenList: new Map(), isLoading: false }),
}));

jest.mock("src/hooks/collectibleTokenInfoProvider", () => {
  // Stable identity: the component's effect depends on the provider object.
  const provider = {
    fetchMetaInfo: () => Promise.resolve(undefined),
    getTokenInfo: () => Promise.resolve(undefined),
  };

  return { useCollectibleTokenInfoProvider: () => provider };
});

// Known pair, taken as literals from src/utils/tronAddress.test.ts (USDT on Tron mainnet).
const USDT_BASE58 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_HEX = "0xa614f803b6fd780986a42c78ec9c7f77e6ded13c";

// EthHashInfo shortens to `${address.slice(0, 6)}...${address.slice(-4)}`.
const shortened = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const chainWithShortName = (shortName: string): NetworkInfo => ({
  chainID: 4,
  name: `Chain ${shortName}`,
  shortName,
  currencySymbol: "TRX",
});

const renderOnChain = (shortName: string, ui: React.ReactElement) =>
  render(
    <ReduxProvider store={makeStore({ networks: { networks: [chainWithShortName(shortName)] } })}>{ui}</ReduxProvider>,
  );

describe("ERC20Token", () => {
  it("renders the token address in base58 on a tron chain", () => {
    renderOnChain("trx-shasta", <ERC20Token tokenAddress={USDT_HEX} />);

    expect(screen.getByText(shortened(USDT_BASE58))).toBeTruthy();
  });

  it("renders the token address unchanged on a non-tron chain", () => {
    renderOnChain("eth", <ERC20Token tokenAddress={USDT_HEX} />);

    expect(screen.getByText(shortened(USDT_HEX))).toBeTruthy();
  });
});

describe("ERC721Token", () => {
  // The metadata fetch resolves after mount; flushing it keeps the state update inside act().
  const renderCollectible = async (shortName: string) => {
    await act(async () => {
      renderOnChain(shortName, <ERC721Token tokenAddress={USDT_HEX} id="1" token_type="erc721" />);
    });
  };

  it("renders the collectible address in base58 on a tron chain", async () => {
    await renderCollectible("trx-shasta");

    expect(screen.getByText(shortened(USDT_BASE58))).toBeTruthy();
  });

  it("renders the collectible address unchanged on a non-tron chain", async () => {
    await renderCollectible("eth");

    expect(screen.getByText(shortened(USDT_HEX))).toBeTruthy();
  });
});
