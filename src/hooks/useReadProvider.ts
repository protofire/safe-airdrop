import { SafeAppProvider } from "@safe-global/safe-apps-provider";
import { useSafeAppsSDK } from "@safe-global/safe-apps-react-sdk";
import { ethers } from "ethers";
import { useMemo } from "react";
import { isTronNetworkPrefix } from "src/utils/tronAddress";

import { useCurrentChain } from "./useCurrentChain";

/**
 * Provider used for all contract reads.
 *
 * On Tron the reads go directly to the chain's JSON-RPC endpoint instead of through the Safe Apps bridge.
 * Writes are unaffected everywhere - they always go through sdk.txs.send.
 */
export const useReadProvider = (): ethers.providers.JsonRpcProvider => {
  const { safe, sdk } = useSafeAppsSDK();
  const chainConfig = useCurrentChain();

  const rpcUri = isTronNetworkPrefix(chainConfig?.shortName) ? chainConfig?.rpcUri : undefined;

  return useMemo(
    () =>
      rpcUri
        ? new ethers.providers.JsonRpcProvider(rpcUri)
        : new ethers.providers.Web3Provider(new SafeAppProvider(safe, sdk)),
    [rpcUri, safe, sdk],
  );
};
