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
  [
    919,
    {
      chainID: 919,
      name: "Mode Testnet",
      shortName: "modesep",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-mode-sepolia.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-mode-sepolia.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    34443,
    {
      chainID: 34443,
      name: "Mode",
      shortName: "mode",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-mode.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-mode.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    11155420,
    {
      chainID: 11155420,
      name: "OP Sepolia Testnet",
      shortName: "opsep",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-optimism-sepolia.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-optimism-sepolia.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    424,
    {
      chainID: 424,
      name: "Public Goods Network",
      shortName: "PGN",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-pgn.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-pgn.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    7777777,
    {
      chainID: 7777777,
      name: "Zora",
      shortName: "zora",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-zora.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-zora.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    999999999,
    {
      chainID: 999999999,
      name: "Zora Sepolia Testnet",
      shortName: "zsep",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-zora-sepolia.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-zora-sepolia.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    4202,
    {
      chainID: 4202,
      name: "Lisk Sepolia",
      shortName: "lisksep",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-lisk-sepolia.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-lisk-sepolia.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    1135,
    {
      chainID: 1135,
      name: "Lisk Mainnet",
      shortName: "lisk",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-lisk.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-lisk.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    252,
    {
      chainID: 252,
      name: "Fraxtal Mainnet",
      shortName: "fraxtal",
      currencySymbol: "frxETH",
      baseAPI: "https://transaction-frax.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-frax.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    2523,
    {
      chainID: 2523,
      name: "Fraxtal Sepolia",
      shortName: "fraxtal-sepolia",
      currencySymbol: "frxETH",
      baseAPI: "https://transaction-frax-sepolia.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-frax-sepolia.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    17069,
    {
      chainID: 17069,
      name: "Redstone Testnet - Garnet",
      shortName: "garnet",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-redstone-testnet.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-redstone-testnet.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    690,
    {
      chainID: 690,
      name: "Redstone Mainnet",
      shortName: "redstone",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-redstone.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-redstone.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    7560,
    {
      chainID: 7560,
      name: "Cyber Mainnet",
      shortName: "cyeth",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-cyber.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-cyber.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    111557560,
    {
      chainID: 111557560,
      name: "Cyber Testnet",
      shortName: "cysep",
      currencySymbol: "ETH",
      baseAPI: "https://transaction-cyber-testnet.safe.optimism.io/api/v1",
      stagingBaseAPI: "https://transaction-cyber-testnet.staging.safe.optimism.io/api/v1",
    },
  ],
  [
    7225878,
    {
      chainID: 7225878,
      name: "Saakuru Mainnet",
      shortName: "saakuru",
      currencySymbol: "OAS",
      baseAPI: "https://transaction-safe.saakuru.com/api/v1",
      stagingBaseAPI: "https://transaction-safe-stage.saakuru.com/api/v1",
    },
  ],
]);
