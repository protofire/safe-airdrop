type NetworkInfo = {
  shortName: string;
  chainID: number;
  name: string;
  currencySymbol: string;
  baseAPI?: string;
  stagingBaseAPI?: string;
};

export const NETWORKS_WITH_DONATIONS_DEPLOYED = [1, 5, 56, 100, 137];

export const networkInfo = new Map<number, NetworkInfo>([
  [
    1,
    {
      chainID: 1,
      name: "Ethereum",
      shortName: "eth",
      currencySymbol: "ETH",
      baseAPI: "https://safe-transaction-mainnet.safe.global/api/v1",
    },
  ],
  [
    5,
    {
      chainID: 5,
      name: "Goerli",
      shortName: "gor",
      currencySymbol: "GOR",
      baseAPI: "https://safe-transaction-goerli.safe.global/api/v1",
    },
  ],
  [
    10,
    {
      chainID: 10,
      name: "Optimism",
      shortName: "oeth",
      currencySymbol: "OETH",
      baseAPI: "https://safe-transaction-optimism.safe.global/api/v1",
    },
  ],
  [
    56,
    {
      chainID: 56,
      name: "Binance Smart Chain",
      shortName: "bnb",
      currencySymbol: "BNB",
      baseAPI: "https://safe-transaction-bsc.safe.global/api/v1",
    },
  ],
  [
    100,
    {
      chainID: 100,
      name: "Gnosis Chain",
      shortName: "gno",
      currencySymbol: "xDAI",
      baseAPI: "https://safe-transaction-gnosis-chain.safe.global/api/v1",
    },
  ],
  [
    137,
    {
      chainID: 137,
      name: "Polygon",
      shortName: "matic",
      currencySymbol: "MATIC",
      baseAPI: "https://safe-transaction-polygon.safe.global/api/v1",
    },
  ],
  [
    324,
    {
      chainID: 324,
      name: "Zk Sync Era",
      shortName: "zksync",
      currencySymbol: "ETH",
      baseAPI: "https://safe-transaction-zksync.safe.global/api/v1",
    },
  ],
  [
    1101,
    {
      chainID: 1101,
      name: "Polygon zkEVM",
      shortName: "zkevm",
      currencySymbol: "ETH",
      baseAPI: "https://safe-transaction-zkevm.safe.global/api/v1",
    },
  ],
  [
    8453,
    {
      chainID: 8453,
      name: "Base",
      shortName: "base",
      currencySymbol: "ETH",
      baseAPI: "https://safe-transaction-base.safe.global/api/v1",
    },
  ],
  [
    42161,
    {
      chainID: 42161,
      name: "Arbitrum One",
      shortName: "arb1",
      currencySymbol: "AETH",
      baseAPI: "https://safe-transaction-arbitrum.safe.global/api/v1",
    },
  ],
  [
    42220,
    {
      chainID: 42220,
      name: "Celo",
      shortName: "celo",
      currencySymbol: "Celo",
      baseAPI: "https://safe-transaction-celo.safe.global/api/v1",
    },
  ],
  [
    43114,
    {
      chainID: 43114,
      name: "Avalanche",
      shortName: "avax",
      currencySymbol: "AVAX",
      baseAPI: "https://safe-transaction-avalanche.safe.global/api/v1",
    },
  ],
  [
    73799,
    {
      chainID: 73799,
      name: "Volta",
      shortName: "vt",
      currencySymbol: "VT",
      baseAPI: "https://safe-transaction-volta.safe.global/api/v1",
    },
  ],
  [
    9001,
    {
      chainID: 9001,
      name: "Evmos",
      shortName: "evmos",
      currencySymbol: "EVMOS",
      baseAPI: "https://transaction.safe.evmos.org/api/v1",
      stagingBaseAPI: "https://transaction.safe.evmos.dev/api/v1",
    },
  ],
  [
    9000,
    {
      chainID: 9000,
      name: "Evmos Testnet",
      shortName: "evmos-testnet",
      currencySymbol: "tEVMOS",
      baseAPI: "https://transaction-testnet.safe.evmos.org/api/v1",
      stagingBaseAPI: "https://transaction-testnet.safe.evmos.dev/api/v1",
    },
  ],
  [
    23294,
    {
      chainID: 23294,
      name: "Oasis Sapphire",
      shortName: "sapphire",
      currencySymbol: "ROSE",
      baseAPI: "https://transaction.safe.oasis.io/api/v1",
      stagingBaseAPI: "https://transaction.safe.stg.oasis.io/api/v1",
    },
  ],
  [
    23295,
    {
      chainID: 23295,
      name: "Oasis Sapphire Testnet",
      shortName: "sapphire-testnet",
      currencySymbol: "TEST",
      baseAPI: "https://transaction-testnet.safe.oasis.io/api/v1",
      stagingBaseAPI: "https://transaction-testnet.safe.stg.oasis.io/api/v1",
    },
  ],
  [
    534352,
    {
      chainID: 534352,
      name: "Scroll",
      shortName: "scr",
      currencySymbol: "ETH",
      baseAPI: "https://transaction.safe.scroll.xyz/api/v1",
      stagingBaseAPI: "https://transaction.staging.safe.scroll.xyz/api/v1",
    },
  ],
  [
    534351,
    {
      chainID: 534351,
      name: "Scroll Sepolia",
      shortName: "scr-sepolia",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-sepolia.safe.scroll.xyz/api/v1",
      stagingBaseAPI: "https://transaction-sepolia.staging.safe.scroll.xyz/api/v1",
    },
  ],
]);
