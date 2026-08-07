import { useEffect, useMemo } from "react";
import { NetworkInfo, networkInfo } from "src/networks";
import { setNetworks } from "src/stores/slices/networksSlice";
import { useAppDispatch } from "src/stores/store";
import useSwr from "swr";

const CONFIG_SERVICE_URL = process.env.REACT_APP_CONFIG_SERVICE_URL;

export type ChainConfig = {
  chainId: string;
  chainName: string;
  shortName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
    logoUri: string;
  };
  transactionService: string;
  safeAppsRpcUri?: {
    authentication: string;
    value: string;
  };
};

type ChainEndpointResponse = {
  next: string | null;
  previous: string | null;
  count: number;
  results: ChainConfig[];
};

/**
 * Overlays the chains served by the config service onto the static network list.
 *
 * A gateway which only knows about a handful of chains must not erase the rest of
 * the static list, so the static map is the base and served chains override it.
 */
export const mergeChainConfigs = (chainConfigs: ChainConfig[]): Map<number, NetworkInfo> => {
  const mergedNetworks = new Map<number, NetworkInfo>(networkInfo);

  chainConfigs.forEach((chainConfig) => {
    const chainID = Number(chainConfig.chainId);
    const staticEntry = mergedNetworks.get(chainID);
    mergedNetworks.set(chainID, {
      ...staticEntry,
      chainID,
      name: chainConfig.chainName,
      shortName: chainConfig.shortName,
      currencySymbol: chainConfig.nativeCurrency.symbol,
      decimals: chainConfig.nativeCurrency.decimals,
      rpcUri: chainConfig.safeAppsRpcUri?.value ?? staticEntry?.rpcUri,
      baseAPI: chainConfig.transactionService,
      // The served transaction service is authoritative for a served chain. Leaving an
      // inherited staging host in place would shadow it: getBaseURL picks
      // `stagingBaseAPI || baseAPI` whenever REACT_APP_IS_PRODUCTION is not "true".
      stagingBaseAPI: undefined,
    });
  });

  return mergedNetworks;
};

export const useLoadChains = () => {
  const chains = useChains();
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(
      setNetworks({
        networks: [...chains.values()],
      }),
    );
  }, [chains, dispatch]);
};

export const useChains = () => {
  const { data: chainConfigs, isLoading } = useSwr(
    CONFIG_SERVICE_URL ? "chains" : null,
    async (): Promise<ChainConfig[]> => {
      const allChains: ChainConfig[] = [];
      let nextUrl: string | null = CONFIG_SERVICE_URL!;

      while (nextUrl) {
        const result = await fetch(nextUrl).then((resp) => {
          if (resp.ok) {
            return resp.json() as Promise<ChainEndpointResponse>;
          }
          return Promise.reject(
            new Error("Unexpected error while loading chain configs. Falling back to static list."),
          );
        });

        allChains.push(...result.results);
        nextUrl = result.next;
      }

      return allChains;
    },
  );

  return useMemo(() => {
    if (isLoading || chainConfigs === undefined) {
      return networkInfo;
    }
    return mergeChainConfigs(chainConfigs);
  }, [chainConfigs, isLoading]);
};
