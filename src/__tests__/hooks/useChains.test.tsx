import { renderHook } from "@testing-library/react-hooks";

import { ChainConfig, mergeChainConfigs, useChains } from "../../hooks/useChains";

const shastaFromGateway: ChainConfig = {
  chainId: "2494104990",
  chainName: "Shasta",
  shortName: "trx-shasta",
  nativeCurrency: {
    name: "TRX",
    symbol: "TRX",
    decimals: 6,
    logoUri: "https://example.invalid/trx.png",
  },
  transactionService: "https://gateway-served-transaction-service.invalid",
  safeAppsRpcUri: {
    authentication: "API_KEY_PATH",
    value: "https://gateway-served-rpc.invalid/jsonrpc",
  },
};

describe("useChains without a config service", () => {
  it("serves the static Tron Shasta entry", () => {
    const { result } = renderHook(() => useChains());

    const shasta = result.current.get(2494104990);

    expect(shasta?.name).toEqual("Tron Shasta Testnet");
    expect(shasta?.shortName).toEqual("trx-shasta");
    expect(shasta?.currencySymbol).toEqual("TRX");
    expect(shasta?.decimals).toEqual(6);
    expect(shasta?.rpcUri).toEqual("https://api.shasta.trongrid.io/jsonrpc");
    expect(shasta?.maxTransfers).toEqual(200);
    expect(shasta?.baseAPI).toEqual("https://transaction-tron-testnet.stage.safe.protofire.io");
    expect(shasta?.stagingBaseAPI).toEqual("https://transaction-tron-testnet.stage.safe.protofire.io");
  });

  it("serves the static Tron Mainnet entry", () => {
    const { result } = renderHook(() => useChains());

    const mainnet = result.current.get(728126428);

    expect(mainnet?.name).toEqual("Tron Mainnet");
    expect(mainnet?.shortName).toEqual("trx");
    expect(mainnet?.currencySymbol).toEqual("TRX");
    expect(mainnet?.decimals).toEqual(6);
    expect(mainnet?.rpcUri).toEqual("https://api.trongrid.io/jsonrpc");
    expect(mainnet?.maxTransfers).toEqual(200);
    expect(mainnet?.baseAPI).toEqual("https://transaction-tron.stage.safe.protofire.io");
    expect(mainnet?.stagingBaseAPI).toEqual("https://transaction-tron.stage.safe.protofire.io");
  });
});

const page = (results: ChainConfig[], next: string | null = null) => ({
  ok: true,
  json: () => Promise.resolve({ next, previous: null, count: results.length, results }),
});

/**
 * `CONFIG_SERVICE_URL` is read at module load, so the hook has to be re-required after the
 * environment is set. The renderer is required from the same fresh registry: a re-required
 * hook otherwise holds a second React copy and its effects never run.
 */
const renderUseChainsIsolated = () => {
  let freshUseChains: typeof useChains;
  let freshRenderHook: typeof renderHook;
  jest.isolateModules(() => {
    /* eslint-disable @typescript-eslint/no-var-requires */
    freshRenderHook = require("@testing-library/react-hooks/dom/pure").renderHook;
    freshUseChains = require("../../hooks/useChains").useChains;
    /* eslint-enable @typescript-eslint/no-var-requires */
  });
  return freshRenderHook!(() => freshUseChains!());
};

describe("useChains with a config service", () => {
  const originalConfigServiceUrl = process.env.REACT_APP_CONFIG_SERVICE_URL;

  beforeEach(() => {
    jest.resetModules();
    process.env.REACT_APP_CONFIG_SERVICE_URL = "https://config.invalid/v1/chains";
  });

  afterEach(() => {
    process.env.REACT_APP_CONFIG_SERVICE_URL = originalConfigServiceUrl;
    jest.restoreAllMocks();
  });

  it("merges a single served chain over the static list", async () => {
    const fetchMock = jest.spyOn(window, "fetch").mockResolvedValue(page([shastaFromGateway]) as any);

    const { result, waitFor, unmount } = renderUseChainsIsolated();

    await waitFor(() => result.current.get(2494104990)?.name === "Shasta");

    expect(fetchMock).toHaveBeenCalledWith("https://config.invalid/v1/chains");
    expect(result.current.size).toBeGreaterThan(50);
    expect(result.current.get(1)?.name).toEqual("Ethereum");
    expect(result.current.get(2494104990)?.rpcUri).toEqual("https://gateway-served-rpc.invalid/jsonrpc");
    expect(result.current.get(2494104990)?.decimals).toEqual(6);

    unmount();
  });

  it("follows the pagination cursor until it is exhausted", async () => {
    const secondPageUrl = "https://config.invalid/v1/chains?cursor=2";
    const ethFromGateway: ChainConfig = {
      ...shastaFromGateway,
      chainId: "1",
      chainName: "Ethereum Mainnet",
      shortName: "eth",
      transactionService: "https://second-page-transaction-service.invalid",
    };
    jest
      .spyOn(window, "fetch")
      .mockResolvedValueOnce(page([shastaFromGateway], secondPageUrl) as any)
      .mockResolvedValueOnce(page([ethFromGateway]) as any);

    const { result, waitFor, unmount } = renderUseChainsIsolated();

    await waitFor(() => result.current.get(1)?.name === "Ethereum Mainnet");

    expect(result.current.get(2494104990)?.name).toEqual("Shasta");
    expect(result.current.get(1)?.baseAPI).toEqual("https://second-page-transaction-service.invalid");

    unmount();
  });
});

describe("mergeChainConfigs", () => {
  it("keeps the static entries when the config service serves a single chain", () => {
    const merged = mergeChainConfigs([shastaFromGateway]);

    expect(merged.size).toBeGreaterThan(50);
    expect(merged.get(1)?.name).toEqual("Ethereum");
    expect(merged.get(1)?.baseAPI).toEqual("https://safe-transaction-mainnet.safe.global");
    expect(merged.get(728126428)?.name).toEqual("Tron Mainnet");
  });

  it("overrides the static values of a served chain", () => {
    const merged = mergeChainConfigs([shastaFromGateway]);

    const shasta = merged.get(2494104990);

    expect(shasta?.name).toEqual("Shasta");
    expect(shasta?.baseAPI).toEqual("https://gateway-served-transaction-service.invalid");
  });

  it("carries nativeCurrency.decimals and safeAppsRpcUri.value onto the network info", () => {
    const merged = mergeChainConfigs([
      {
        ...shastaFromGateway,
        chainId: "1",
        nativeCurrency: { ...shastaFromGateway.nativeCurrency, decimals: 7 },
        safeAppsRpcUri: { authentication: "NO_AUTHENTICATION", value: "https://carried-through.invalid/rpc" },
      },
    ]);

    expect(merged.get(1)?.decimals).toEqual(7);
    expect(merged.get(1)?.rpcUri).toEqual("https://carried-through.invalid/rpc");
  });

  it("preserves the static maxTransfers when the gateway overlays the chain", () => {
    const merged = mergeChainConfigs([shastaFromGateway]);

    expect(merged.get(2494104990)?.maxTransfers).toEqual(200);
  });

  it("keeps the authored rpcUri when the served chain carries no safeAppsRpcUri", () => {
    const merged = mergeChainConfigs([{ ...shastaFromGateway, safeAppsRpcUri: undefined }]);

    expect(merged.get(2494104990)?.rpcUri).toEqual("https://api.shasta.trongrid.io/jsonrpc");
  });

  it("does not let a static stagingBaseAPI shadow the served transaction service", () => {
    const merged = mergeChainConfigs([shastaFromGateway]);

    // getBaseURL picks `stagingBaseAPI || baseAPI` outside production, so an inherited
    // static staging host would silently win over the chain the gateway actually serves.
    expect(merged.get(2494104990)?.stagingBaseAPI).toBeUndefined();
  });
});
