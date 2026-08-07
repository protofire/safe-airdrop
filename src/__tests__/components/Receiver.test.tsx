import { render, screen } from "@testing-library/react";
import React from "react";
import { Provider as ReduxProvider } from "react-redux";
import { Receiver } from "src/components/Receiver";
import { NetworkInfo } from "src/networks";
import { makeStore } from "src/stores/store";
import { DONATION_ADDRESS } from "src/utils";

jest.mock("@safe-global/safe-apps-react-sdk", () => ({
  useSafeAppsSDK: () => ({
    safe: jest.requireActual("../../test/util").testData.dummySafeInfo,
    sdk: { txs: { send: jest.fn() } },
    connected: true,
  }),
}));

// Known pair, taken as literals from src/utils/tronAddress.test.ts (USDT on Tron mainnet).
const USDT_BASE58 = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const USDT_HEX = "0xa614f803b6fd780986a42c78ec9c7f77e6ded13c";

// EthHashInfo shortens to `${address.slice(0, 6)}...${address.slice(-4)}`.
const shortened = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

const chainWithShortName = (shortName: string): NetworkInfo => ({
  chainID: 4,
  name: `Chain ${shortName}`,
  shortName,
  currencySymbol: "TRX",
});

const renderReceiver = (shortName: string, address: string) =>
  render(
    <ReduxProvider store={makeStore({ networks: { networks: [chainWithShortName(shortName)] } })}>
      <Receiver receiverAddress={address} receiverEnsName={null} />
    </ReduxProvider>,
  );

describe("Receiver", () => {
  it("renders the receiver in base58 on a tron chain", () => {
    renderReceiver("trx-shasta", USDT_HEX);

    expect(screen.getByText(shortened(USDT_BASE58))).toBeTruthy();
  });

  it("renders the receiver unchanged on a non-tron chain", () => {
    renderReceiver("eth", USDT_HEX);

    expect(screen.getByText(shortened(USDT_HEX))).toBeTruthy();
  });

  it("still recognizes the donation safe on a tron chain", () => {
    renderReceiver("trx-shasta", DONATION_ADDRESS);

    expect(screen.getByText("Donation Safe ❤️")).toBeTruthy();
  });
});
