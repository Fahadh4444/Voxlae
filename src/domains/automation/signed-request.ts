import crypto from "node:crypto";

/**
 * Meta's `signed_request` parser. Ports `MetaSignedRequestParser`.
 *
 * Format is `base64url(HMAC-SHA256 signature).base64url(JSON payload)`, POSTed as a form field to an
 * app's Deauthorize Callback and Data Deletion Request Callback URLs (App Dashboard → Basic
 * Settings). The mechanism is common to every Meta login product, so nothing here is
 * Instagram-specific beyond which app secret is passed in.
 *
 * These two callbacks are **required for App Review**, and both act destructively on a verified
 * identity's data — so the signature check is the whole security boundary. A forged request that got
 * past it could delete a creator's automation configuration.
 */

export interface SignedRequestPayload {
  userId: string | null;
  algorithm: string | null;
  issuedAt: number;
  raw: Record<string, unknown>;
}

export class InvalidSignedRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidSignedRequestError";
  }
}

/**
 * Node's `base64url` decoder is lenient about missing padding, which is what Meta sends. Decoding as
 * plain `base64` would fail on exactly the inputs that are correct.
 */
function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function decodePayload(encoded: string): SignedRequestPayload {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(base64UrlDecode(encoded).toString("utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new InvalidSignedRequestError(
      `Could not parse signed_request payload: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const algorithm = typeof json.algorithm === "string" ? json.algorithm : null;
  // Refusing an unexpected algorithm rather than ignoring the field: the payload is attacker-supplied
  // and a future Meta change to a weaker scheme should fail loudly, not be accepted silently.
  if (algorithm && algorithm.toUpperCase() !== "HMAC-SHA256") {
    throw new InvalidSignedRequestError(`Unsupported signed_request algorithm: ${algorithm}`);
  }

  return {
    userId: json.user_id != null ? String(json.user_id) : null,
    algorithm,
    issuedAt: typeof json.issued_at === "number" ? json.issued_at : 0,
    raw: json,
  };
}

/** Verify the signature, then decode. Throws on anything malformed or mismatched. */
export function parseSignedRequest(
  signedRequest: string | null | undefined,
  appSecret: string | null | undefined,
): SignedRequestPayload {
  if (!appSecret) {
    // Refuse rather than fall open: an unconfigured secret must never mean "accept everything".
    throw new InvalidSignedRequestError(
      "App secret not configured; cannot verify signed_request",
    );
  }
  if (!signedRequest?.trim()) {
    throw new InvalidSignedRequestError("signed_request is missing");
  }

  const dot = signedRequest.indexOf(".");
  if (dot < 1 || dot === signedRequest.length - 1) {
    throw new InvalidSignedRequestError("signed_request is not in <sig>.<payload> format");
  }
  const [signature, payload] = [signedRequest.slice(0, dot), signedRequest.slice(dot + 1)];

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(payload, "utf8")
    .digest();
  const provided = base64UrlDecode(signature);

  // Length is compared first because `timingSafeEqual` throws on a mismatch rather than returning
  // false, and the length itself is not a secret.
  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    throw new InvalidSignedRequestError("signed_request signature does not match");
  }

  return decodePayload(payload);
}
