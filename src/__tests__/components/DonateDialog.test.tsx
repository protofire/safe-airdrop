import { buildDonationCsvRow } from "src/components/DonateDialog";
import { DONATION_ADDRESS } from "src/utils";

const USDT_HEX = "0xa614f803b6fd780986a42c78ec9c7f77e6ded13c";
// base58check of DONATION_ADDRESS, computed independently of src/utils/tronAddress.ts.
const DONATION_BASE58 = "TUwNhhq68T1KGfxcdTvbGyUJ6KCJxoziUd";

const headerRow = "token_type,token_address,receiver,amount,id";

describe("buildDonationCsvRow", () => {
  it("writes the donation receiver in hex on a non tron chain", () => {
    expect(buildDonationCsvRow({ headerRow, tokenAddress: USDT_HEX, amount: "1.5", shortName: "eth" })).toBe(
      `erc20,${USDT_HEX},${DONATION_ADDRESS},1.5,`,
    );
  });

  it("writes the donation receiver in base58 on a tron chain", () => {
    expect(buildDonationCsvRow({ headerRow, tokenAddress: USDT_HEX, amount: "1.5", shortName: "trx-shasta" })).toBe(
      `erc20,${USDT_HEX},${DONATION_BASE58},1.5,`,
    );
  });

  it("leaves the token address empty for the native token", () => {
    expect(buildDonationCsvRow({ headerRow, tokenAddress: "0x0", amount: "2", shortName: "eth" })).toBe(
      `erc20,,${DONATION_ADDRESS},2,`,
    );
  });

  it("fills a value column when the header uses one", () => {
    expect(
      buildDonationCsvRow({
        headerRow: "token_type,token_address,receiver,value,id",
        tokenAddress: USDT_HEX,
        amount: "3",
        shortName: "eth",
      }),
    ).toBe(`erc20,${USDT_HEX},${DONATION_ADDRESS},3,`);
  });
});
