import { renderHook } from "@testing-library/react-hooks";
import { ethers } from "ethers";
import React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { NetworkInfo } from "src/networks";
import { makeStore } from "src/stores/store";

import { useReadProvider } from "../../hooks/useReadProvider";
import { testData } from "../../test/util";

jest.mock("@safe-global/safe-apps-react-sdk", () => ({
  useSafeAppsSDK: () => ({
    safe: jest.requireActual("../../test/util").testData.dummySafeInfo,
    sdk: { txs: { send: jest.fn() } },
    connected: true,
  }),
}));

const TRON_RPC_URI = "https://tron-rpc.test.invalid/jsonrpc";

const tronChain: NetworkInfo = {
  chainID: testData.dummySafeInfo.chainId,
  name: "Tron Shasta Testnet",
  shortName: "trx-shasta",
  currencySymbol: "TRX",
  decimals: 6,
  rpcUri: TRON_RPC_URI,
};

const ethChain: NetworkInfo = {
  chainID: testData.dummySafeInfo.chainId,
  name: "Ethereum",
  shortName: "eth",
  currencySymbol: "ETH",
};

const renderReadProvider = (chain: NetworkInfo) => {
  const store = makeStore({ networks: { networks: [chain] } });
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <ReduxProvider store={store}>{children}</ReduxProvider>
  );

  return renderHook(() => useReadProvider(), { wrapper }).result.current;
};

test("reads through the configured tron rpc endpoint on a tron chain", () => {
  const provider = renderReadProvider(tronChain);

  expect(provider).toBeInstanceOf(ethers.providers.JsonRpcProvider);
  expect(provider).not.toBeInstanceOf(ethers.providers.Web3Provider);
  expect(provider.connection.url).toBe(TRON_RPC_URI);
});

test("reads through the safe apps bridge on a non tron chain", () => {
  const provider = renderReadProvider(ethChain);

  expect(provider).toBeInstanceOf(ethers.providers.Web3Provider);
});
