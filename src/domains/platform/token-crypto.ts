import crypto from "node:crypto";

/**
 * OAuth token encryption, byte-compatible with Spring's `TokenEncryptionService`.
 *
 * Compatibility is mandatory, not nice-to-have: refresh tokens already in `connected_accounts`
 * were written by the Java service. If this disagrees about key derivation or layout by a single
 * byte, every stored token becomes undecryptable and every connected account has to be
 * re-authorised by its user.
 *
 * Three details carried over exactly:
 *
 *  1. **Key derivation is truncation, not hashing.** `normalizeKey` copies the first 32 UTF-8
 *     bytes of the configured key (zero-padding if shorter). The live key is 62 bytes, so 30 of
 *     them are discarded. Hashing it — the obvious "better" choice — produces a different key and
 *     silently fails to decrypt everything.
 *  2. **Layout is `Base64(IV ‖ ciphertext ‖ tag)`**, 12-byte IV, 128-bit tag. Java's
 *     `Cipher.doFinal` appends the GCM tag to the ciphertext; Node returns it separately from
 *     `getAuthTag()`, so it has to be concatenated back on explicitly.
 *  3. **Null/blank in, null out** — matching the Java guards, since plenty of rows have no
 *     refresh token.
 */

const IV_LENGTH = 12; // 96 bits
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // AES-256

function secretKey(): Buffer {
  const configured = process.env.TOKEN_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set. Stored OAuth tokens cannot be read without it.",
    );
  }
  // Truncate-or-zero-pad to 32 bytes, exactly as normalizeKey does.
  const key = Buffer.alloc(KEY_LENGTH);
  Buffer.from(configured, "utf8").copy(key, 0, 0, KEY_LENGTH);
  return key;
}

export function encryptToken(plainText: string | null | undefined): string | null {
  if (!plainText || !plainText.trim()) return null;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(), iv, {
    authTagLength: TAG_LENGTH,
  });
  const ciphertext = Buffer.concat([
    cipher.update(plainText, "utf8"),
    cipher.final(),
  ]);
  // Java appends the tag to the ciphertext; Node keeps it separate, so rejoin them.
  return Buffer.concat([iv, ciphertext, cipher.getAuthTag()]).toString("base64");
}

export function decryptToken(encrypted: string | null | undefined): string | null {
  if (!encrypted || !encrypted.trim()) return null;

  const combined = Buffer.from(encrypted, "base64");
  if (combined.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Encrypted token is too short to contain IV, ciphertext and tag.");
  }

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(), iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
