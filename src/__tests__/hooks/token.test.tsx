import { renderHook } from "@testing-library/react-hooks";
import React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { NetworkInfo } from "src/networks";
import { makeStore } from "src/stores/store";

import { useTokenInfoProvider } from "../../hooks/token";
import { testData } from "../../test/util";

jest.mock("@safe-global/safe-apps-react-sdk", () => ({
  useSafeAppsSDK: () => ({
    safe: jest.requireActual("../../test/util").testData.dummySafeInfo,
    sdk: {
      safe: { experimental_getBalances: () => Promise.resolve({ fiatTotal: "0", items: [] }) },
      txs: { send: jest.fn() },
    },
    connected: true,
  }),
}));

const tronChain: NetworkInfo = {
  chainID: testData.dummySafeInfo.chainId,
  name: "Tron Shasta Testnet",
  shortName: "trx-shasta",
  currencySymbol: "TRX",
  decimals: 6,
  rpcUri: "https://tron-rpc.test.invalid/jsonrpc",
};

const ethChain: NetworkInfo = {
  chainID: testData.dummySafeInfo.chainId,
  name: "Ethereum",
  shortName: "eth",
  currencySymbol: "ETH",
};

const renderTokenInfoProvider = (chain: NetworkInfo) => {
  const store = makeStore({ networks: { networks: [chain] } });
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <ReduxProvider store={store}>{children}</ReduxProvider>
  );

  return renderHook(() => useTokenInfoProvider(), { wrapper }).result.current;
};

test("native token decimals come from the chain config", () => {
  expect(renderTokenInfoProvider(tronChain).getNativeTokenDecimals()).toBe(6);
});

test("native token decimals default to 18 when the chain config omits them", () => {
  expect(renderTokenInfoProvider(ethChain).getNativeTokenDecimals()).toBe(18);
});
