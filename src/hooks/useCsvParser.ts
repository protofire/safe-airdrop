import { useCallback } from "react";
import { usePapaParse } from "react-papaparse";
import { transform } from "src/parser/transformation";
import { validateRow } from "src/parser/validation";
import { CodeWarning } from "src/stores/slices/messageSlice";
import { isTronNetworkPrefix } from "src/utils/tronAddress";

import { useCollectibleTokenInfoProvider } from "./collectibleTokenInfoProvider";
import { useTokenInfoProvider } from "./token";
import { useCurrentChain } from "./useCurrentChain";
import { useEnsResolver } from "./useEnsResolver";

export type Transfer = AssetTransfer | CollectibleTransfer;

export type AssetTokenType = "erc20" | "native";
export type CollectibleTokenType = "erc721" | "erc1155";

export interface AssetTransfer {
  token_type: AssetTokenType;
  receiver: string;
  amount: string;
  tokenAddress: string | null;
  decimals: number;
  symbol?: string;
  receiverEnsName: string | null;
  position?: number;
}

export interface CollectibleTransfer {
  token_type: CollectibleTokenType;
  from: string;
  receiver: string;
  tokenAddress: string;
  tokenName?: string;
  tokenId: string;
  amount?: string;
  receiverEnsName: string | null;
}

export interface UnknownTransfer {
  token_type: "unknown";
}

export type CSVRow = {
  token_type?: string;
  token_address: string;
  receiver: string;
  value?: string;
  amount?: string;
  id?: string;
};

enum HEADER_FIELDS {
  TYPE = "token_type",
  TOKEN_ADDRESS = "token_address",
  RECEIVER = "receiver",
  VALUE = "value",
  AMOUNT = "amount",
  ID = "id",
}

const generateWarnings = (
  // We need the row parameter because of the api of fast-csv
  _row: Transfer | UnknownTransfer,
  rowNumber: number,
  warnings: string[],
) => {
  const messages: CodeWarning[] = warnings.map((warning: string) => ({
    message: warning,
    severity: "warning",
    lineNum: rowNumber,
  }));
  return messages;
};

const countLines = (text: string) => text.split(/\r\n|\r|\n/).length;

// A trailing newline is not a transfer row: it must neither count against the row cap nor reach
// the CSV parser, which reports an empty last line as a syntax error.
const stripTrailingNewlines = (text: string) => text.replace(/(\r\n|\r|\n)+$/, "");

const DEFAULT_MAX_TRANSFERS = 500;
// A Tron chain with no configured cap (e.g. served only by a gateway) still gets the measured
// Tron value rather than the EVM default: the TVM per-transaction CPU ceiling applies to every
// Tron network (see tron/PRD_CSV_AIRDROP_TRON.md §7).
const TRON_DEFAULT_MAX_TRANSFERS = 200;

/**
 * The row cap is a property of the chain, not of this app: on Tron a batch runs into the TVM's
 * per-transaction energy/CPU ceiling long before it would hit any gas limit. The parser warns and
 * blocks -- it never silently truncates a transfer list.
 */
const rowCapMessage = (maxTransfers: number, isTron: boolean) => {
  const reason = isTron ? "Tron's per-transaction energy and CPU limit" : "the block gas limit";
  return `Max number of lines exceeded. Due to ${reason}, transactions are limited to ${maxTransfers} lines.`;
};

export const useCsvParser = (): { parseCsv: (csvText: string) => Promise<[Transfer[], CodeWarning[]]> } => {
  const collectibleTokenInfoProvider = useCollectibleTokenInfoProvider();
  const tokenInfoProvider = useTokenInfoProvider();
  const ensResolver = useEnsResolver();
  const chainConfig = useCurrentChain();
  const { readString } = usePapaParse();

  const parseCsv = useCallback(
    async (csvText: string): Promise<[Transfer[], CodeWarning[]]> => {
      return new Promise<[Transfer[], CodeWarning[]]>((resolve, reject) => {
        const isTron = isTronNetworkPrefix(chainConfig?.shortName);
        const maxTransfers = chainConfig?.maxTransfers ?? (isTron ? TRON_DEFAULT_MAX_TRANSFERS : DEFAULT_MAX_TRANSFERS);
        const csv = stripTrailingNewlines(csvText);
        const numLines = countLines(csv);
        // Hard limit at maxTransfers rows of txs, plus the header row.
        if (numLines > maxTransfers + 1) {
          reject(rowCapMessage(maxTransfers, isTron));
          return;
        }

        readString(csv, {
          header: true,
          worker: true,
          complete: async (results) => {
            // Check headers
            const unknownFields = results.meta.fields?.filter(
              (field) => !Object.values<string>(HEADER_FIELDS).includes(field),
            );

            if (unknownFields && unknownFields?.length > 0) {
              resolve([
                [],
                [
                  {
                    lineNum: 0,
                    message: `Unknown header field(s): ${unknownFields.join(", ")}`,
                    severity: "error",
                  },
                ],
              ]);
              return;
            }
            const csvRows = results.data as CSVRow[];
            const numberedRows = csvRows
              .map((row, idx) => ({ content: row, lineNum: idx + 1 }))
              // Empty rows have no receiver
              .filter((row) => row.content.receiver !== undefined && row.content.receiver !== "");
            const transformedRows: ((Transfer | UnknownTransfer) & { lineNum: number })[] = await Promise.all(
              numberedRows.map((row) =>
                transform(row.content, tokenInfoProvider, collectibleTokenInfoProvider, ensResolver).then(
                  (transfer) => ({
                    ...transfer,
                    lineNum: row.lineNum,
                  }),
                ),
              ),
            );

            // validation warnings
            const resultingWarnings = transformedRows.map((row) => {
              const validationWarnings = validateRow(row);
              return generateWarnings(row, row.lineNum, validationWarnings);
            });

            // add syntax errors
            resultingWarnings.push(
              results.errors.map((error) => ({
                lineNum: error.row + 1,
                message: error.message,
                severity: "error",
              })),
            );

            const validRows = transformedRows.filter((_, idx) => resultingWarnings[idx]?.length === 0) as Transfer[];
            resolve([validRows, resultingWarnings.flat()]);
          },
        });
      });
    },
    [chainConfig, collectibleTokenInfoProvider, ensResolver, readString, tokenInfoProvider],
  );

  return {
    parseCsv,
  };
};
