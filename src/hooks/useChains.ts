import { useEffect, useMemo } from "react";
import { NetworkInfo, networkInfo } from "src/networks";
import { setNetworks } from "src/stores/slices/networksSlice";
import { useAppDispatch } from "src/stores/store";
import useSwr from "swr";

const CONFIG_SERVICE_URL = process.env.REACT_APP_CONFIG_SERVICE_URL;

type ChainEndpointResponse = {
  next: string | null;
  previous: string | null;
  count: number;
  results: {
    chainId: string;
    chainName: string;
    shortName: string;
    nativeCurrency: {
      name: string;
      symbol: string;
      decimals: 18;
      logoUri: string;
    };
    transactionService: string;
  }[];
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

const useChains = () => {
  const { data: chainConfigs, isLoading } = useSwr(
    CONFIG_SERVICE_URL ? "chains" : null,
    async (): Promise<NetworkInfo[]> => {
      const allChains: ChainEndpointResponse["results"] = [];
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

      return allChains.map((chainConfig) => ({
        chainID: Number(chainConfig.chainId),
        name: chainConfig.chainName,
        shortName: chainConfig.shortName,
        currencySymbol: chainConfig.nativeCurrency.symbol,
        baseAPI: chainConfig.transactionService,
      }));
    },
  );

  return useMemo(() => {
    if (isLoading || chainConfigs === undefined) {
      return networkInfo;
    } else {
      const mappedNetworks = new Map<number, NetworkInfo>();
      chainConfigs.forEach((chainConfig) => {
        mappedNetworks.set(chainConfig.chainID, chainConfig);
      });
      return mappedNetworks;
    }
  }, [chainConfigs, isLoading]);
};
