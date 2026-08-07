// Copied from safe-react-apps apps/drain-safe/src/utils/sha256.test.ts (byte-identical
// there and in apps/tx-builder) and reformatted to this repo's prettier style.
// A frozen specification -- fix bugs in every copy. See tron/PRD_CSV_AIRDROP_TRON.md par.5.3.
import { sha256 } from "./sha256";

const hex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const digestOf = (text: string): string => hex(sha256(new TextEncoder().encode(text)));

describe("sha256", () => {
  // FIPS 180-4 / NIST test vectors.
  it("hashes the empty message", () => {
    expect(digestOf("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it('hashes "abc"', () => {
    expect(digestOf("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes a message that pads into a second block (56 bytes)", () => {
    expect(digestOf("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("hashes a message exactly one block long (64 bytes)", () => {
    expect(digestOf("a".repeat(64))).toBe("ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb");
  });

  it("hashes a message longer than one block", () => {
    expect(
      digestOf(
        "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu",
      ),
    ).toBe("cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1");
  });

  it("hashes the bytes of a Tron address payload", () => {
    // The base58check checksum of TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t is the
    // first 4 bytes of the double hash of its 21-byte payload.
    const payload = Uint8Array.from(
      "41a614f803b6fd780986a42c78ec9c7f77e6ded13c".match(/../g)!.map((b) => parseInt(b, 16)),
    );

    expect(hex(sha256(sha256(payload))).slice(0, 8)).toBe("710277f5");
  });
});
