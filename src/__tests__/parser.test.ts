import { renderHook } from "@testing-library/react-hooks";

import type { CollectibleTokenInfoProvider } from "../hooks/collectibleTokenInfoProvider";
import * as useCollectibleTokenInfoProvider from "../hooks/collectibleTokenInfoProvider";
import * as useTokenInfoProvider from "../hooks/token";
import { TokenMap, MinimalTokenInfo, fetchTokenList, TokenInfoProvider } from "../hooks/token";
import { AssetTransfer, CollectibleTransfer, useCsvParser } from "../hooks/useCsvParser";
import * as useCurrentChain from "../hooks/useCurrentChain";
import type { EnsResolver } from "../hooks/useEnsResolver";
import * as useEnsResolver from "../hooks/useEnsResolver";
import type { NetworkInfo } from "../networks";
import { testData } from "../test/util";

const HEADER_ERC20 = "token_type,token_address,receiver,amount";

// Known base58/hex pairs, copied from src/utils/tronAddress.test.ts. The expectations below
// are these literals, never a value recomputed through the code under test.
const COUNTER_BASE58 = "TSqF5pn9FxP77jfQCy46NoFa5HXdQaYiwZ";
const COUNTER_HEX = "0xb8f88c79d2d655a0acaf5982a13028ddf7628ebe";
const USDT_BASE58 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_HEX = "0xa614f803b6fd780986a42c78ec9c7f77e6ded13c";

// Chain entries stated as literals here rather than read from networks.ts, so the row-cap
// expectations below do not recompute themselves from the config under test.
const ETHEREUM_CHAIN: NetworkInfo = { chainID: 1, name: "Ethereum", shortName: "eth", currencySymbol: "ETH" };
const SHASTA_CHAIN: NetworkInfo = {
  chainID: 2494104990,
  name: "Tron Shasta Testnet",
  shortName: "trx-shasta",
  currencySymbol: "TRX",
  decimals: 6,
  maxTransfers: 200,
};
// A Tron chain the static list does not know (e.g. served only by a gateway): no maxTransfers.
const NILE_CHAIN: NetworkInfo = {
  chainID: 3448148188,
  name: "Tron Nile Testnet",
  shortName: "trx-nile",
  currencySymbol: "TRX",
  decimals: 6,
};

let tokenList: TokenMap;
let listedToken: MinimalTokenInfo;

const validReceiverAddress = testData.addresses.receiver1;

/**
 * concatenates csv row arrays into one string.
 * @param rows array of row-arrays
 */
const csvStringFromRows = (
  rows: string[][],
  headerRow: string = "token_type,token_address,receiver,amount,id",
): string => {
  return [headerRow, ...rows.map((row) => row.join(","))].join("\n");
};

describe("Parsing CSVs ", () => {
  let mockTokenInfoProvider: TokenInfoProvider;
  let mockCollectibleTokenInfoProvider: CollectibleTokenInfoProvider;
  let mockEnsResolver: EnsResolver;

  beforeEach(async () => {
    tokenList = await fetchTokenList(testData.dummySafeInfo.chainId);
    const fetchTokenFromList = async (tokenAddress: string) => tokenList.get(tokenAddress);

    let listedTokens = Array.from(tokenList.keys());
    const firstTokenInfo = tokenList.get(listedTokens[0]);
    if (typeof firstTokenInfo !== "undefined") {
      listedToken = firstTokenInfo;
    }

    mockTokenInfoProvider = {
      getTokenInfo: fetchTokenFromList,
      getNativeTokenSymbol: () => "ETH",
      getNativeTokenDecimals: () => 18,
      getSelectedNetworkShortname: () => "eth",
    };
    jest.spyOn(useTokenInfoProvider, "useTokenInfoProvider").mockReturnValue(mockTokenInfoProvider);

    mockCollectibleTokenInfoProvider = {
      getFromAddress: () => testData.dummySafeInfo.safeAddress,
      getTokenInfo: async (tokenAddress) => {
        switch (tokenAddress.toLowerCase()) {
          case testData.addresses.dummyErc721Address:
            return testData.dummyERC721Token;
          case testData.addresses.dummyErc1155Address:
            return testData.dummyERC1155Token;
          default:
            return undefined;
        }
      },
      fetchMetaInfo: jest.fn(),
    };
    jest
      .spyOn(useCollectibleTokenInfoProvider, "useCollectibleTokenInfoProvider")
      .mockReturnValue(mockCollectibleTokenInfoProvider);

    mockEnsResolver = {
      resolveName: async (ensName: string) => {
        if (ensName.startsWith("0x")) {
          return ensName;
        }
        switch (ensName) {
          case "receiver1.eth":
            return testData.addresses.receiver1;
          case "receiver2.eth":
            return testData.addresses.receiver2;
          case "receiver3.eth":
            return testData.addresses.receiver3;
          case "token.eth":
            return listedToken.address;
          case "error.eth":
            throw new Error("unexpected error!");
          default:
            return null;
        }
      },
      lookupAddress: async (address: string) => {
        switch (address) {
          case testData.addresses.receiver1:
            return "receiver1.eth";
          case testData.addresses.receiver2:
            return "receiver2.eth";
          case testData.addresses.receiver3:
            return "receiver3.eth";
          case listedToken.address:
            return "token.eth";
          default:
            return null;
        }
      },
      isEnsEnabled: async () => true,
    };
    jest.spyOn(useEnsResolver, "useEnsResolver").mockReturnValue(mockEnsResolver);

    jest.spyOn(useCurrentChain, "useCurrentChain").mockReturnValue(ETHEREUM_CHAIN);
  });

  it("should throw errors for invalid CSVs", async () => {
    const { result } = renderHook(() => useCsvParser());
    // this csv contains more values than headers in row1
    const invalidCSV = "head1,header2\nvalue1,value2,value3";
    expect(result.current.parseCsv(invalidCSV)).resolves.toEqual([
      [],
      [{ lineNum: 0, message: "Unknown header field(s): head1, header2", severity: "error" }],
    ]);
  });

  it("should skip files with more transfers than the chain's row cap", async () => {
    const { result } = renderHook(() => useCsvParser());

    let largeCSV = csvStringFromRows(
      Array(501).fill(["erc20", listedToken.address, validReceiverAddress, "1"]),
      "token_type,token_address,receiver,amount",
    );
    await expect(result.current.parseCsv(largeCSV)).rejects.toEqual(
      "Max number of lines exceeded. Due to the block gas limit, transactions are limited to 500 lines.",
    );
  });

  it("parses a CSV that sits exactly on the default row cap", async () => {
    const { result } = renderHook(() => useCsvParser());

    const csv = csvStringFromRows(Array(500).fill(["native", "", validReceiverAddress, "1"]), HEADER_ERC20);

    const [payment, warnings] = await result.current.parseCsv(csv);
    expect(warnings).toHaveLength(0);
    expect(payment).toHaveLength(500);
  });

  it("should transform simple, valid CSVs correctly", async () => {
    const { result } = renderHook(() => useCsvParser());

    const rowWithoutDecimal = ["erc20", listedToken.address, validReceiverAddress, "1"];
    const rowWithDecimalAmount = ["erc20", listedToken.address, validReceiverAddress, "69.420"];
    const rowWithoutTokenAddress = ["native", "", validReceiverAddress, "1"];

    const [payment, warnings] = await result.current.parseCsv(
      csvStringFromRows([rowWithoutDecimal, rowWithDecimalAmount, rowWithoutTokenAddress], HEADER_ERC20),
    );
    expect(warnings).toHaveLength(0);
    expect(payment).toHaveLength(3);
    const [paymentWithoutDecimal, paymentWithDecimal, paymentWithoutTokenAddress] = payment as AssetTransfer[];
    expect(paymentWithoutDecimal.decimals).toEqual(18);
    expect(paymentWithoutDecimal.receiver).toEqual(validReceiverAddress);
    expect(paymentWithoutDecimal.tokenAddress).toEqual(listedToken.address);
    expect(paymentWithoutDecimal.amount).toEqual("1");
    expect(paymentWithoutDecimal.receiverEnsName).toBeNull();

    expect(paymentWithDecimal.receiver).toEqual(validReceiverAddress);
    expect(paymentWithDecimal.tokenAddress?.toLowerCase()).toEqual(listedToken.address.toLowerCase());
    expect(paymentWithDecimal.decimals).toEqual(18);
    expect(paymentWithDecimal.amount).toEqual("69.420");
    expect(paymentWithDecimal.receiverEnsName).toBeNull();

    expect(paymentWithoutTokenAddress.decimals).toEqual(18);
    expect(paymentWithoutTokenAddress.receiver).toEqual(validReceiverAddress);
    expect(paymentWithoutTokenAddress.tokenAddress).toEqual(null);
    expect(paymentWithoutTokenAddress.amount).toEqual("1");
    expect(paymentWithoutTokenAddress.receiverEnsName).toBeNull();
  });

  it("should generate erc20 validation warnings", async () => {
    const { result } = renderHook(() => useCsvParser());

    const rowWithNegativeAmount = ["erc20", listedToken.address, validReceiverAddress, "-1"];

    const unlistedTokenWithoutDecimalInContract = [
      "erc20",
      testData.unlistedERC20Token.address,
      validReceiverAddress,
      "1",
    ];
    const rowWithInvalidTokenAddress = ["erc20", "0x420", validReceiverAddress, "1"];
    const rowWithInvalidReceiverAddress = ["erc20", listedToken.address, "0x420", "1"];

    const [payment, warnings] = await result.current.parseCsv(
      csvStringFromRows(
        [
          rowWithNegativeAmount,
          unlistedTokenWithoutDecimalInContract,
          rowWithInvalidTokenAddress,
          rowWithInvalidReceiverAddress,
        ],
        HEADER_ERC20,
      ),
    );
    expect(warnings).toHaveLength(5);
    const [
      warningNegativeAmount,
      warningTokenNotFound,
      warningInvalidTokenAddress,
      warningInvalidTokenAddressForInvalidAddress,
      warningInvalidReceiverAddress,
    ] = warnings;
    expect(payment).toHaveLength(0);

    expect(warningNegativeAmount.message).toEqual("Only positive amounts/values possible: -1");
    expect(warningNegativeAmount.lineNum).toEqual(1);

    expect(warningTokenNotFound.message.toLowerCase()).toEqual(
      `no token contract was found at ${testData.unlistedERC20Token.address.toLowerCase()}`,
    );
    expect(warningTokenNotFound.lineNum).toEqual(2);

    expect(warningInvalidTokenAddress.message).toEqual("Invalid Token Address: 0x420");
    expect(warningInvalidTokenAddress.lineNum).toEqual(3);
    expect(warningInvalidTokenAddressForInvalidAddress.message).toEqual(`No token contract was found at 0x420`);
    expect(warningInvalidTokenAddressForInvalidAddress.lineNum).toEqual(3);

    expect(warningInvalidReceiverAddress.message).toEqual("Invalid Receiver Address: 0x420");
    expect(warningInvalidReceiverAddress.lineNum).toEqual(4);
  });

  it("tries to resolve ens names", async () => {
    const { result } = renderHook(() => useCsvParser());

    const receiverEnsName = ["erc20", listedToken.address, "receiver1.eth", "1"];
    const tokenEnsName = ["erc20", "token.eth", validReceiverAddress, "69.420"];
    const unknownReceiverEnsName = ["erc20", listedToken.address, "unknown.eth", "1"];
    const unknownTokenEnsName = ["erc20", "unknown.eth", "receiver1.eth", "1"];

    const [payment, warnings] = await result.current.parseCsv(
      csvStringFromRows([receiverEnsName, tokenEnsName, unknownReceiverEnsName, unknownTokenEnsName], HEADER_ERC20),
    );
    expect(warnings).toHaveLength(3);
    expect(payment).toHaveLength(2);
    const [paymentReceiverEnsName, paymentTokenEnsName] = payment as AssetTransfer[];
    const [warningUnknownReceiverEnsName, warningInvalidTokenAddress, warningInvalidContract] = warnings;
    expect(paymentReceiverEnsName.decimals).toEqual(18);
    expect(paymentReceiverEnsName.receiver).toEqual(testData.addresses.receiver1);
    expect(paymentReceiverEnsName.tokenAddress).toEqual(listedToken.address);
    expect(paymentReceiverEnsName.amount).toEqual("1");
    expect(paymentReceiverEnsName.receiverEnsName).toEqual("receiver1.eth");

    expect(paymentTokenEnsName.receiver).toEqual(validReceiverAddress);
    expect(paymentTokenEnsName.tokenAddress?.toLowerCase()).toEqual(listedToken.address.toLowerCase());
    expect(paymentTokenEnsName.decimals).toEqual(18);
    expect(paymentTokenEnsName.amount).toEqual("69.420");
    expect(paymentReceiverEnsName.receiverEnsName).toEqual("receiver1.eth");

    expect(warningUnknownReceiverEnsName.lineNum).toEqual(3);
    expect(warningUnknownReceiverEnsName.message).toEqual("Invalid Receiver Address: unknown.eth");

    expect(warningInvalidTokenAddress.lineNum).toEqual(4);
    expect(warningInvalidTokenAddress.message).toEqual("Invalid Token Address: unknown.eth");

    expect(warningInvalidContract.lineNum).toEqual(4);
    expect(warningInvalidContract.message).toEqual("No token contract was found at unknown.eth");
  });

  it("parses valid collectible transfers", async () => {
    const { result } = renderHook(() => useCsvParser());

    const rowWithErc721AndAddress = ["nft", testData.addresses.dummyErc721Address, validReceiverAddress, "", "1"];
    const rowWithErc721AndENS = ["nft", testData.addresses.dummyErc721Address, "receiver2.eth", "", "69"];
    const rowWithErc721AndIDZero = ["nft", testData.addresses.dummyErc721Address, "receiver1.eth", "", "0"];
    const rowWithErc1155AndAddress = ["nft", testData.addresses.dummyErc1155Address, validReceiverAddress, "69", "420"];
    const rowWithErc1155AndENS = ["nft", testData.addresses.dummyErc1155Address, "receiver3.eth", "9", "99"];

    const [payment, warnings] = await result.current.parseCsv(
      csvStringFromRows([
        rowWithErc721AndAddress,
        rowWithErc721AndENS,
        rowWithErc721AndIDZero,
        rowWithErc1155AndAddress,
        rowWithErc1155AndENS,
      ]),
    );
    expect(warnings).toHaveLength(0);
    expect(payment).toHaveLength(5);
    const [
      transferErc721AndAddress,
      transferErc721AndENS,
      transferErc721AndIDZero,
      transferErc1155AndAddress,
      transferErc1155AndENS,
    ] = payment as CollectibleTransfer[];
    expect(transferErc721AndAddress.receiver).toEqual(validReceiverAddress);
    expect(transferErc721AndAddress.tokenAddress).toEqual(testData.addresses.dummyErc721Address);
    expect(transferErc721AndAddress.amount).toBeUndefined();
    expect(transferErc721AndAddress.tokenId).toEqual("1");
    expect(transferErc721AndAddress.receiverEnsName).toBeNull();

    expect(transferErc721AndENS.receiver).toEqual(testData.addresses.receiver2);
    expect(transferErc721AndENS.tokenAddress).toEqual(testData.addresses.dummyErc721Address);
    expect(transferErc721AndENS.tokenId).toEqual("69");
    expect(transferErc721AndENS.amount).toBeUndefined();
    expect(transferErc721AndENS.receiverEnsName).toEqual("receiver2.eth");

    expect(transferErc721AndIDZero.receiver).toEqual(testData.addresses.receiver1);
    expect(transferErc721AndIDZero.tokenAddress).toEqual(testData.addresses.dummyErc721Address);
    expect(transferErc721AndIDZero.tokenId).toEqual("0");
    expect(transferErc721AndIDZero.amount).toBeUndefined();
    expect(transferErc721AndIDZero.receiverEnsName).toEqual("receiver1.eth");

    expect(transferErc1155AndAddress.receiver).toEqual(validReceiverAddress);
    expect(transferErc1155AndAddress.tokenAddress.toLowerCase()).toEqual(
      testData.addresses.dummyErc1155Address.toLowerCase(),
    );
    expect(transferErc1155AndAddress.amount).not.toBeUndefined();
    expect(transferErc1155AndAddress.amount).toEqual("69");
    expect(transferErc1155AndAddress.tokenId).toEqual("420");
    expect(transferErc1155AndAddress.receiverEnsName).toBeNull();

    expect(transferErc1155AndENS.receiver).toEqual(testData.addresses.receiver3);
    expect(transferErc1155AndENS.tokenAddress.toLowerCase()).toEqual(
      testData.addresses.dummyErc1155Address.toLowerCase(),
    );
    expect(transferErc1155AndENS.amount).not.toBeUndefined();
    expect(transferErc1155AndENS.amount).toEqual("9");
    expect(transferErc1155AndENS.tokenId).toEqual("99");
    expect(transferErc1155AndENS.receiverEnsName).toEqual("receiver3.eth");
  });

  it("should generate erc721/erc1155 validation warnings", async () => {
    const { result } = renderHook(() => useCsvParser());

    const rowErc1155WithNegativeValue = [
      "nft",
      testData.addresses.dummyErc1155Address,
      validReceiverAddress,
      "-1",
      "5",
    ];

    const rowErc1155WithDecimalValue = [
      "nft",
      testData.addresses.dummyErc1155Address,
      validReceiverAddress,
      "1.5",
      "5",
    ];

    const rowErc1155WithMissingId = ["nft", testData.addresses.dummyErc1155Address, validReceiverAddress, "5", ""];

    const rowErc1155WithInvalidTokenAddress = ["nft", "0xwhoopsie", validReceiverAddress, "5", "5"];

    const rowErc1155WithInvalidReceiverAddress = [
      "nft",
      testData.addresses.dummyErc1155Address,
      "0xwhoopsie",
      "5",
      "5",
    ];

    const rowErc721WithNegativeId = ["nft", testData.addresses.dummyErc721Address, validReceiverAddress, "", "-20"];

    const rowErc721WithMissingId = ["nft", testData.addresses.dummyErc721Address, validReceiverAddress, "", ""];

    const rowErc721WithDecimalId = ["nft", testData.addresses.dummyErc721Address, validReceiverAddress, "", "69.420"];

    const rowErc721WithInvalidToken = ["nft", "0xwhoopsie", validReceiverAddress, "", "69"];

    const rowErc721WithInvalidReceiver = ["nft", testData.addresses.dummyErc721Address, "0xwhoopsie", "", "69"];

    const [payment, warnings] = await result.current.parseCsv(
      csvStringFromRows([
        rowErc1155WithNegativeValue,
        rowErc1155WithDecimalValue,
        rowErc1155WithMissingId,
        rowErc1155WithInvalidTokenAddress,
        rowErc1155WithInvalidReceiverAddress,
        rowErc721WithNegativeId,
        rowErc721WithDecimalId,
        rowErc721WithMissingId,
        rowErc721WithInvalidToken,
        rowErc721WithInvalidReceiver,
      ]),
    );
    expect(warnings).toHaveLength(14);
    const [
      warningErc1155WithNegativeValue,
      warningErc1155WithDecimalValue,
      warningErc1155WithMissingId,
      warningErc1155WithMissingId2,
      warningErc1155WithInvalidTokenAddress,
      warningErc1155WithInvalidTokenAddress2,
      warningErc1155WithInvalidReceiverAddress,
      warningErc721WithNegativeId,
      warningErc721WithDecimalId,
      warningErc721WithMissingId,
      warningErc721WithMissingId2,
      warningErc721WithInvalidToken,
      warningErc721WithInvalidToken2,
      warningErc721WithInvalidReceiver,
    ] = warnings;
    expect(payment).toHaveLength(0);

    expect(warningErc1155WithNegativeValue.lineNum).toEqual(1);
    expect(warningErc1155WithNegativeValue.message).toEqual("ERC1155 Tokens need a defined value > 0: -1");

    expect(warningErc1155WithDecimalValue.lineNum).toEqual(2);
    expect(warningErc1155WithDecimalValue.message).toEqual("Value / amount of ERC1155 must be an integer: 1.5");

    expect(warningErc1155WithMissingId.lineNum).toEqual(3);
    expect(warningErc1155WithMissingId.message).toEqual("Only positive Token IDs possible: NaN");

    expect(warningErc1155WithMissingId2.lineNum).toEqual(3);
    expect(warningErc1155WithMissingId2.message).toEqual("Token IDs must be integer numbers: NaN");

    expect(warningErc1155WithInvalidTokenAddress.lineNum).toEqual(4);
    expect(warningErc1155WithInvalidTokenAddress.message).toEqual("Invalid Token Address: 0xwhoopsie");

    expect(warningErc1155WithInvalidTokenAddress2.lineNum).toEqual(4);
    expect(warningErc1155WithInvalidTokenAddress2.message).toEqual("No token contract was found at 0xwhoopsie");

    expect(warningErc1155WithInvalidReceiverAddress.lineNum).toEqual(5);
    expect(warningErc1155WithInvalidReceiverAddress.message).toEqual("Invalid Receiver Address: 0xwhoopsie");

    expect(warningErc721WithNegativeId.lineNum).toEqual(6);
    expect(warningErc721WithNegativeId.message).toEqual("Only positive Token IDs possible: -20");

    expect(warningErc721WithDecimalId.lineNum).toEqual(7);
    expect(warningErc721WithDecimalId.message).toEqual("Token IDs must be integer numbers: 69.42");

    expect(warningErc721WithMissingId.lineNum).toEqual(8);
    expect(warningErc721WithMissingId.message).toEqual("Only positive Token IDs possible: NaN");

    expect(warningErc721WithMissingId2.lineNum).toEqual(8);
    expect(warningErc721WithMissingId2.message).toEqual("Token IDs must be integer numbers: NaN");

    expect(warningErc721WithInvalidToken.lineNum).toEqual(9);
    expect(warningErc721WithInvalidToken.message).toEqual("Invalid Token Address: 0xwhoopsie");

    expect(warningErc721WithInvalidToken2.lineNum).toEqual(9);
    expect(warningErc721WithInvalidToken2.message).toEqual("No token contract was found at 0xwhoopsie");

    expect(warningErc721WithInvalidReceiver.lineNum).toEqual(10);
    expect(warningErc721WithInvalidReceiver.message).toEqual("Invalid Receiver Address: 0xwhoopsie");
  });

  describe("on a Tron chain", () => {
    let requestedTokenAddresses: string[];

    beforeEach(() => {
      requestedTokenAddresses = [];
      jest.spyOn(useTokenInfoProvider, "useTokenInfoProvider").mockReturnValue({
        getTokenInfo: async (tokenAddress: string) => {
          requestedTokenAddresses.push(tokenAddress);
          return tokenAddress.toLowerCase() === USDT_HEX
            ? { address: tokenAddress, decimals: 6, symbol: "USDT" }
            : undefined;
        },
        getNativeTokenSymbol: () => "TRX",
        getNativeTokenDecimals: () => 6,
        getSelectedNetworkShortname: () => "trx-shasta",
      });
      // ENS is disabled on Tron (§5.9); mirror that here so nothing resolves behind our back.
      jest
        .spyOn(useEnsResolver, "useEnsResolver")
        .mockReturnValue({ ...mockEnsResolver, isEnsEnabled: async () => false });
      jest.spyOn(useCurrentChain, "useCurrentChain").mockReturnValue(SHASTA_CHAIN);
    });

    it("blocks a CSV over the chain's lower row cap, naming that limit and its reason", async () => {
      const { result } = renderHook(() => useCsvParser());

      const largeCSV = csvStringFromRows(Array(201).fill(["native", "", COUNTER_BASE58, "1"]), HEADER_ERC20);

      await expect(result.current.parseCsv(largeCSV)).rejects.toEqual(
        "Max number of lines exceeded. Due to Tron's per-transaction energy and CPU limit, transactions are limited to 200 lines.",
      );
    });

    it("parses a CSV that sits exactly on the chain's row cap", async () => {
      const { result } = renderHook(() => useCsvParser());

      const csv = csvStringFromRows(Array(200).fill(["native", "", COUNTER_BASE58, "1"]), HEADER_ERC20);

      const [payment, warnings] = await result.current.parseCsv(csv);
      expect(warnings).toHaveLength(0);
      expect(payment).toHaveLength(200);
    });

    it("caps a Tron chain with no configured maxTransfers at the measured Tron default, not the EVM 500", async () => {
      jest.spyOn(useCurrentChain, "useCurrentChain").mockReturnValue(NILE_CHAIN);
      const { result } = renderHook(() => useCsvParser());

      const largeCSV = csvStringFromRows(Array(201).fill(["native", "", COUNTER_BASE58, "1"]), HEADER_ERC20);

      await expect(result.current.parseCsv(largeCSV)).rejects.toEqual(
        "Max number of lines exceeded. Due to Tron's per-transaction energy and CPU limit, transactions are limited to 200 lines.",
      );
    });

    it("parses a CSV on the row cap even when the file ends with a newline", async () => {
      const { result } = renderHook(() => useCsvParser());

      const csv = csvStringFromRows(Array(200).fill(["native", "", COUNTER_BASE58, "1"]), HEADER_ERC20) + "\n";

      const [payment, warnings] = await result.current.parseCsv(csv);
      expect(warnings).toHaveLength(0);
      expect(payment).toHaveLength(200);
    });

    it("warns when a positive native amount is below the smallest unit instead of sending zero", async () => {
      const { result } = renderHook(() => useCsvParser());

      const [payment, warnings] = await result.current.parseCsv(
        csvStringFromRows([["native", "", COUNTER_BASE58, "0.0000005"]], HEADER_ERC20),
      );

      expect(payment).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toEqual("Amount is below the smallest unit of the token: 0.0000005");
    });

    it("accepts the smallest representable native amount", async () => {
      const { result } = renderHook(() => useCsvParser());

      const [payment, warnings] = await result.current.parseCsv(
        csvStringFromRows([["native", "", COUNTER_BASE58, "0.000001"]], HEADER_ERC20),
      );

      expect(warnings).toHaveLength(0);
      expect(payment).toHaveLength(1);
    });

    it("accepts a base58 receiver and stores it as checksummed hex, with the chain's native decimals", async () => {
      const { result } = renderHook(() => useCsvParser());

      const [payment, warnings] = await result.current.parseCsv(
        csvStringFromRows([["native", "", COUNTER_BASE58, "1"]], HEADER_ERC20),
      );

      expect(warnings).toHaveLength(0);
      expect(payment).toHaveLength(1);
      const [nativeTransfer] = payment as AssetTransfer[];
      expect(nativeTransfer.receiver.toLowerCase()).toEqual(COUNTER_HEX);
      expect(nativeTransfer.receiver).toEqual("0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe");
      expect(nativeTransfer.decimals).toEqual(6);
    });

    it("resolves a base58 token_address through getTokenInfo in its hex form", async () => {
      const { result } = renderHook(() => useCsvParser());

      const [payment, warnings] = await result.current.parseCsv(
        csvStringFromRows([["erc20", USDT_BASE58, COUNTER_BASE58, "1"]], HEADER_ERC20),
      );

      expect(warnings).toHaveLength(0);
      expect(requestedTokenAddresses.map((address) => address.toLowerCase())).toEqual([USDT_HEX]);
      const [erc20Transfer] = payment as AssetTransfer[];
      expect(erc20Transfer.tokenAddress?.toLowerCase()).toEqual(USDT_HEX);
      expect(erc20Transfer.decimals).toEqual(6);
      expect(erc20Transfer.symbol).toEqual("USDT");
    });

    it("strips a matching trx-shasta: prefix from a hex receiver", async () => {
      const { result } = renderHook(() => useCsvParser());

      const [payment, warnings] = await result.current.parseCsv(
        csvStringFromRows([["native", "", "trx-shasta:0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe", "1"]], HEADER_ERC20),
      );

      expect(warnings).toHaveLength(0);
      const [nativeTransfer] = payment as AssetTransfer[];
      expect(nativeTransfer.receiver).toEqual("0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe");
    });

    it("rejects a mistyped base58 receiver, quoting it exactly as typed", async () => {
      const { result } = renderHook(() => useCsvParser());

      // COUNTER_BASE58 with its last character changed -- the checksum no longer matches.
      const [payment, warnings] = await result.current.parseCsv(
        csvStringFromRows([["native", "", "TSqF5pn9FxP77jfQCy46NoFa5HXdQaYiwY", "1"]], HEADER_ERC20),
      );

      expect(payment).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].message).toEqual("Invalid Receiver Address: TSqF5pn9FxP77jfQCy46NoFa5HXdQaYiwY");
    });

    it("still accepts a plain hex receiver", async () => {
      const { result } = renderHook(() => useCsvParser());

      const [payment, warnings] = await result.current.parseCsv(
        csvStringFromRows([["native", "", "0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe", "1"]], HEADER_ERC20),
      );

      expect(warnings).toHaveLength(0);
      const [nativeTransfer] = payment as AssetTransfer[];
      expect(nativeTransfer.receiver).toEqual("0xB8F88C79d2d655A0acAf5982A13028dDf7628EBe");
    });
  });

  it("rejects a base58 receiver on a non-Tron chain instead of converting it", async () => {
    const { result } = renderHook(() => useCsvParser());

    const [payment, warnings] = await result.current.parseCsv(
      csvStringFromRows([["native", "", COUNTER_BASE58, "1"]], HEADER_ERC20),
    );

    expect(payment).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toEqual(`Invalid Receiver Address: ${COUNTER_BASE58}`);
  });

  describe("Support backward compatibility", () => {
    it("fallback to erc20 without token_type", async () => {
      const { result } = renderHook(() => useCsvParser());

      const missingTokenType = ["", listedToken.address, validReceiverAddress, "15"];

      const [payment] = await result.current.parseCsv(csvStringFromRows([missingTokenType], HEADER_ERC20));
      expect(payment).toHaveLength(1);
      const [erc20Transfer] = payment as AssetTransfer[];

      expect(erc20Transfer.token_type).toEqual("erc20");
    });

    it("allow value instead of amount column", async () => {
      const { result } = renderHook(() => useCsvParser());

      const nativeTransfer = ["native", listedToken.address, validReceiverAddress, "15"];
      const headerRow = "token_type,token_address,receiver,value";
      const csvString = [headerRow, nativeTransfer.join(",")].join("\n");

      const [payment, warnings] = await result.current.parseCsv(csvString);
      expect(warnings).toHaveLength(0);
      expect(payment).toHaveLength(1);
      const [nativeTransferData] = payment as AssetTransfer[];

      expect(nativeTransferData.amount).toEqual("15");
    });
  });
});
