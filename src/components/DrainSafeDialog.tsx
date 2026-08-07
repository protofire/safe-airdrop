import { isAddress } from "@ethersproject/address";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import WarningIcon from "@mui/icons-material/Warning";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import BigNumber from "bignumber.js";
import { utils } from "ethers";
import { useState } from "react";
import { useCurrentChain } from "src/hooks/useCurrentChain";
import { useEnsResolver } from "src/hooks/useEnsResolver";
import { AssetBalance } from "src/stores/slices/assetBalanceSlice";
import { NFTBalance } from "src/stores/slices/collectiblesSlice";
import { updateCsvContent } from "src/stores/slices/csvEditorSlice";
import { useAppDispatch } from "src/stores/store";
import { fromWei } from "src/utils";
import { isTronNetworkPrefix, normalizeTronAddress, toDisplayAddress } from "src/utils/tronAddress";

/**
 * The CSV that replaces the editor buffer when a Safe is drained. On Tron the
 * addresses are written in base58 -- the file is read by humans on a chain where
 * hex is the foreign format -- and the parser converts them back (par.5.11).
 */
export const buildDrainCsv = ({
  receiver,
  assetBalance,
  nftBalance,
  shortName,
  nativeDecimals = 18,
}: {
  receiver: string;
  assetBalance: AssetBalance;
  nftBalance: NFTBalance["results"];
  shortName?: string;
  // From chain config: the transaction service's native balance entry carries no decimals of
  // its own, and on Tron the balance is denominated in 6-decimal sun.
  nativeDecimals?: number;
}): string => {
  let drainCSV = "token_type,token_address,receiver,amount,id";
  if (!receiver) {
    return drainCSV;
  }

  const displayReceiver = toDisplayAddress(receiver, shortName);

  assetBalance?.forEach((asset) => {
    if (asset.token === null && asset.tokenAddress === null) {
      const decimalBalance = fromWei(new BigNumber(asset.balance), nativeDecimals);
      // The API returns zero balances for the native token.
      if (!decimalBalance.isZero()) {
        drainCSV += `\nnative,,${displayReceiver},${decimalBalance},`;
      }
    } else {
      const tokenDecimals = asset.token?.decimals;
      if (tokenDecimals) {
        const tokenAddress =
          asset.tokenAddress === null ? asset.tokenAddress : toDisplayAddress(asset.tokenAddress, shortName);
        drainCSV += `\nerc20,${tokenAddress},${displayReceiver},${fromWei(
          new BigNumber(asset.balance),
          tokenDecimals,
        )},`;
      }
    }
  });

  nftBalance.forEach((collectible) => {
    drainCSV += `\nnft,${toDisplayAddress(collectible.address, shortName)},${displayReceiver},,${collectible.id}`;
  });

  return drainCSV;
};

export const DrainSafeDialog = ({
  isOpen,
  onClose,
  assetBalance,
  nftBalance,
}: {
  isOpen: boolean;
  onClose: () => void;
  assetBalance: AssetBalance;
  nftBalance: NFTBalance["results"];
}) => {
  const [drainAddress, setDrainAddress] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState("");

  const [resolving, setResolving] = useState(false);

  const dispatch = useAppDispatch();

  const selectedNetworkInfo = useCurrentChain();
  const ensResolver = useEnsResolver();

  const invalidNetworkError = resolvedAddress.includes(":")
    ? `The chain prefix must match the current network: ${selectedNetworkInfo?.shortName}`
    : undefined;

  const invalidAddressError = utils.isAddress(resolvedAddress) ? undefined : "The address is invalid";
  const error = drainAddress ? invalidNetworkError || invalidAddressError : undefined;

  const generateDrainTransfers = () => {
    dispatch(
      updateCsvContent({
        csvContent: buildDrainCsv({
          receiver: drainAddress,
          assetBalance,
          nftBalance,
          shortName: selectedNetworkInfo?.shortName,
          nativeDecimals: selectedNetworkInfo?.decimals ?? 18,
        }),
      }),
    );
  };

  const onAddressChanged: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement> = async (event) => {
    const newAddress = event.target.value;
    setDrainAddress(newAddress);
    const addressWithoutPrefix =
      selectedNetworkInfo && newAddress.startsWith(`${selectedNetworkInfo.shortName}:`)
        ? newAddress.slice(selectedNetworkInfo.shortName.length + 1)
        : newAddress;
    // A pasted base58 address becomes hex here, at the input boundary (par.4.1).
    const candidateAddress = isTronNetworkPrefix(selectedNetworkInfo?.shortName)
      ? normalizeTronAddress(addressWithoutPrefix)
      : addressWithoutPrefix;

    if (isAddress(candidateAddress)) {
      setResolvedAddress(candidateAddress);
    } else {
      setResolving(true);
      const resolvedAddress = await ensResolver.resolveName(candidateAddress).catch(() => null);
      setResolvedAddress(resolvedAddress || candidateAddress);
      setResolving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog onClose={onClose} open sx={{ padding: 3 }}>
      <DialogTitle>Transfer all funds</DialogTitle>
      <DialogContent>
        <Box>
          <Typography style={{ marginBottom: "16px" }}>
            Select an address to transfer all funds to. These funds include all ERC20, ERC721 and native tokens.
          </Typography>
          <Typography mb={2} variant="subtitle1" fontWeight={700} display="flex" alignItems="center">
            <WarningIcon /> This will replace the entire CSV file.
          </Typography>

          <TextField
            fullWidth
            onChange={onAddressChanged}
            value={drainAddress}
            variant="outlined"
            placeholder="Address or ENS"
            InputProps={{
              endAdornment: resolving ? (
                <InputAdornment position="end">
                  <CircularProgress />
                </InputAdornment>
              ) : !error ? (
                <InputAdornment position="end">
                  <CheckCircleRoundedIcon color="primary" />
                </InputAdornment>
              ) : undefined,
            }}
            error={!!error}
            helperText={error}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ padding: "0 24px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
          <Button color="primary" onClick={onClose}>
            Abort
          </Button>
          <Button
            disabled={!!error || drainAddress === ""}
            variant="contained"
            color="primary"
            onClick={() => {
              generateDrainTransfers();
              onClose();
            }}
          >
            Submit
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
};
