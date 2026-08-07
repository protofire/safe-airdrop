import styled from "@emotion/styled";
import { EthHashInfo } from "@safe-global/safe-react-components";
import React from "react";
import { useCurrentChain } from "src/hooks/useCurrentChain";
import { DONATION_ADDRESS } from "src/utils";
import { toDisplayAddress } from "src/utils/tronAddress";

type ReceiverProps = {
  receiverEnsName: string | null;
  receiverAddress: string;
};

const Container = styled.div`
  flex: 1;
  flex-direction: row;
  display: flex;
  justify-content: start;
  align-items: center;
  gap: 8px;
  padding: 16px;
  min-width: 144px;
`;

export const Receiver = (props: ReceiverProps) => {
  const { receiverEnsName, receiverAddress } = props;
  const chainConfig = useCurrentChain();
  // The address in state is always hex (par.4.1); base58 is only how it is shown.
  const isDonation = receiverAddress.toLowerCase() === DONATION_ADDRESS.toLowerCase();
  const displayName = isDonation ? "Donation Safe ❤️" : receiverEnsName;
  return (
    <Container>
      <EthHashInfo
        address={toDisplayAddress(receiverAddress, chainConfig?.shortName)}
        name={displayName}
        showAvatar={false}
        showCopyButton={false}
      />
    </Container>
  );
};
