// Copied from safe-react-apps apps/drain-safe/src/utils/tronAddress.ts (byte-identical
// there and in apps/tx-builder) and reformatted to this repo's prettier style.
// A frozen specification -- fix bugs in every copy. See tron/PRD_CSV_AIRDROP_TRON.md par.5.3.
// Tron address handling.
//
// Tron shows addresses in base58check form (`TSqF5pn9…`), while everything in
// this app -- the Solidity ABI encoder, the Safe transaction service and the
// Tron deployment's bridge -- speaks the 20-byte hex form (`0x…`). The two are
// the same address: base58check decodes to 21 bytes, a `0x41` network prefix
// followed by the 20 bytes the hex form shows.
//
// So base58 is accepted as an *input* format and converted at the boundary
// (address inputs, ABI lookup, field parsing/validation); nothing downstream
// ever sees a `T…` string.

import { sha256 } from "./sha256";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

// Every Tron address on the main and test networks carries this prefix, which
// is what makes the base58 form start with `T`.
const TRON_ADDRESS_PREFIX = 0x41;
const ADDRESS_BYTE_LENGTH = 21; // 1 prefix byte + 20 address bytes
const CHECKSUM_BYTE_LENGTH = 4;

// A base58 Tron address is always 34 characters. Checking the shape first keeps
// the (comparatively expensive) decode off every keystroke of a hex address.
const BASE58_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

const base58Decode = (value: string): Uint8Array | undefined => {
  const bytes: number[] = [];

  for (const character of value) {
    let carry = BASE58_ALPHABET.indexOf(character);
    if (carry < 0) {
      return undefined;
    }

    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  // Leading `1`s encode leading zero bytes.
  for (let i = 0; i < value.length && value[i] === BASE58_ALPHABET[0]; i++) {
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
};

const base58Encode = (bytes: Uint8Array): string => {
  const digits: number[] = [];

  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex++) {
    let carry = bytes[byteIndex];
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  let encoded = "";
  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
    encoded += BASE58_ALPHABET[0];
  }
  for (let i = digits.length - 1; i >= 0; i--) {
    encoded += BASE58_ALPHABET[digits[i]];
  }

  return encoded;
};

const toHexString = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const HEX_ADDRESS_REGEX = /^(0x|0X)?([0-9a-fA-F]{40})$/;

// `0x…`, bare 40-hex and Tron's `41…` raw hex all denote the same 20 bytes.
const getAddressBytesFromHex = (value: string): string | undefined => {
  const match = HEX_ADDRESS_REGEX.exec(value.trim());
  if (match) {
    return match[2].toLowerCase();
  }

  const rawTronHex = /^(41)([0-9a-fA-F]{40})$/.exec(value.trim());
  return rawTronHex ? rawTronHex[2].toLowerCase() : undefined;
};

/**
 * True only for a complete, checksum-valid Tron base58 address.
 */
export const isTronBase58Address = (value?: string): boolean => tronBase58ToHex(value) !== undefined;

/**
 * `TSqF5pn9…` -> `0xb8f88c79…` (the 20-byte hex form, `0x41` prefix dropped).
 * `undefined` for anything that is not a checksum-valid base58 Tron address --
 * including a half-typed one, so callers can keep reporting their own errors.
 */
export const tronBase58ToHex = (value?: string): string | undefined => {
  if (!value || !BASE58_ADDRESS_REGEX.test(value)) {
    return undefined;
  }

  const decoded = base58Decode(value);
  if (!decoded || decoded.length !== ADDRESS_BYTE_LENGTH + CHECKSUM_BYTE_LENGTH) {
    return undefined;
  }

  const payload = decoded.subarray(0, ADDRESS_BYTE_LENGTH);
  if (payload[0] !== TRON_ADDRESS_PREFIX) {
    return undefined;
  }

  const checksum = decoded.subarray(ADDRESS_BYTE_LENGTH);
  const expectedChecksum = sha256(sha256(payload)).subarray(0, CHECKSUM_BYTE_LENGTH);
  const isChecksumValid = checksum.every((byte, index) => byte === expectedChecksum[index]);

  return isChecksumValid ? `0x${toHexString(payload.subarray(1))}` : undefined;
};

/**
 * `0xb8f88c79…` -> `TSqF5pn9…`. Used for display and for Tron-native APIs.
 * `undefined` if the input is not address-shaped hex.
 */
export const hexToTronBase58 = (value?: string): string | undefined => {
  const addressBytes = value && getAddressBytesFromHex(value);
  if (!addressBytes) {
    return undefined;
  }

  const payload = new Uint8Array(ADDRESS_BYTE_LENGTH);
  payload[0] = TRON_ADDRESS_PREFIX;
  for (let i = 0; i < 20; i++) {
    payload[i + 1] = parseInt(addressBytes.slice(i * 2, i * 2 + 2), 16);
  }

  const checksum = sha256(sha256(payload)).subarray(0, CHECKSUM_BYTE_LENGTH);
  const withChecksum = new Uint8Array(ADDRESS_BYTE_LENGTH + CHECKSUM_BYTE_LENGTH);
  withChecksum.set(payload);
  withChecksum.set(checksum, ADDRESS_BYTE_LENGTH);

  return base58Encode(withChecksum);
};

/**
 * The raw `41…` hex form Tron's own node API (`wallet/*`) expects.
 * `undefined` if the input is not address-shaped hex.
 */
export const hexToTronRawHex = (value?: string): string | undefined => {
  const addressBytes = value && getAddressBytesFromHex(value);

  return addressBytes ? `41${addressBytes}` : undefined;
};

/**
 * Converts a Tron base58 address to its hex form and leaves everything else
 * untouched. This is the boundary conversion: call it wherever a user-supplied
 * address enters the app, then carry on with the existing hex handling.
 */
export const normalizeTronAddress = (value: string): string => tronBase58ToHex(value.trim()) ?? value;

/**
 * Tron chains, by their EIP-3770 short name: `trx` (mainnet), `trx-shasta` and
 * `trx-nile` (testnets). Used to decide whether addresses should be *shown* in
 * base58 -- the app stores and submits hex on every chain.
 */
export const isTronNetworkPrefix = (networkPrefix?: string): boolean =>
  networkPrefix === "trx" || !!networkPrefix?.startsWith("trx-");

/**
 * The form to show a human: base58 on Tron -- the only form Tronscan, TronLink
 * and Tron's own docs use -- and the address unchanged everywhere else.
 */
export const toDisplayAddress = (address: string, networkPrefix?: string): string => {
  if (!isTronNetworkPrefix(networkPrefix)) {
    return address;
  }

  return hexToTronBase58(address) ?? address;
};

/**
 * Same, for a rendered field value that may hold several addresses (an
 * `address[]` or `address[][]` argument arrives here as the text the user
 * typed, e.g. `[0x…,0x…]`).
 */
export const toDisplayAddressList = (value: string, networkPrefix?: string): string =>
  isTronNetworkPrefix(networkPrefix)
    ? value.replace(/0x[0-9a-fA-F]{40}/g, (match) => toDisplayAddress(match, networkPrefix))
    : value;
