import { renderHook } from "@testing-library/react-hooks";
import BigNumber from "bignumber.js";
import { ethers } from "ethers";
import React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { NetworkInfo } from "src/networks";
import { makeStore } from "src/stores/store";

import { useCollectibleTokenInfoProvider } from "../../hooks/collectibleTokenInfoProvider";
import { testData } from "../../test/util";

const mockBridgeCall = jest.fn(() => Promise.reject(new Error("read went through the safe apps bridge")));

jest.mock("@safe-global/safe-apps-react-sdk", () => ({
  useSafeAppsSDK: () => ({
    safe: jest.requireActual("../../test/util").testData.dummySafeInfo,
    sdk: {
      eth: { call: (...args: unknown[]) => mockBridgeCall.apply(null, args as []) },
      txs: { send: jest.fn() },
    },
    connected: true,
  }),
}));

const TRON_RPC_URI = "https://tron-rpc.test.invalid/jsonrpc";

const ERC1155_INTERFACE_ID = "0xd9b67a26";
const TRUE_WORD = "0x0000000000000000000000000000000000000000000000000000000000000001";
const FALSE_WORD = "0x0000000000000000000000000000000000000000000000000000000000000000";

const tronChain: NetworkInfo = {
  chainID: testData.dummySafeInfo.chainId,
  name: "Tron Shasta Testnet",
  shortName: "trx-shasta",
  currencySymbol: "TRX",
  decimals: 6,
  rpcUri: TRON_RPC_URI,
};

const renderCollectibleTokenInfoProvider = () => {
  const store = makeStore({
    networks: { networks: [tronChain] },
    collectibles: { collectibles: [], isLoading: false },
  });
  const wrapper = ({ children }: { children?: React.ReactNode }) => (
    <ReduxProvider store={store}>{children}</ReduxProvider>
  );

  return renderHook(() => useCollectibleTokenInfoProvider(), { wrapper }).result.current;
};

let sendSpy: jest.SpyInstance;

beforeEach(() => {
  sendSpy = jest
    .spyOn(ethers.providers.JsonRpcProvider.prototype, "send")
    .mockImplementation(async (method: string, params: Array<any>) => {
      if (method === "eth_chainId") {
        return "0x2b6653dc";
      }
      if (method === "eth_call") {
        return params[0].data.endsWith(ERC1155_INTERFACE_ID.slice(2).padEnd(64, "0")) ? TRUE_WORD : FALSE_WORD;
      }
      throw new Error(`unexpected rpc method ${method}`);
    });
});

afterEach(() => {
  jest.restoreAllMocks();
  mockBridgeCall.mockClear();
});

test("collectible interface detection reads from the tron rpc endpoint instead of the bridge", async () => {
  const provider = renderCollectibleTokenInfoProvider();

  const tokenInfo = await provider.getTokenInfo(testData.addresses.dummyErc1155Address, new BigNumber(1));

  expect(tokenInfo).toEqual({ token_type: "erc1155", address: testData.addresses.dummyErc1155Address });
  expect(mockBridgeCall).not.toHaveBeenCalled();
  expect(sendSpy.mock.instances[0].connection.url).toBe(TRON_RPC_URI);
});
