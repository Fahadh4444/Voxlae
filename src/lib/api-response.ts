import { NextResponse } from "next/server";

/**
 * Spring's `ApiResponse` envelope, reproduced so migrated endpoints are indistinguishable to the
 * frontend. `status` mirrors the `ResponseStatus` enum (SUCCESS / ERROR / TOKEN_EXPIRED /
 * RECONNECT_REQUIRED); `message` and `error` are omitted on success exactly as Lombok's builder
 * leaves them null.
 */
export function ok<T>(data: T, message?: string): NextResponse {
  return NextResponse.json({
    status: "SUCCESS",
    data,
    ...(message ? { message } : {}),
  });
}

export function fail(error: string, message: string, status = 400): NextResponse {
  return NextResponse.json({ status: "ERROR", data: null, error, message }, { status });
}
