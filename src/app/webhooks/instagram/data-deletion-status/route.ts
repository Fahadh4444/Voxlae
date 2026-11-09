import { NextResponse } from "next/server";

/**
 * Confirmation page Meta links the user to after a data-deletion request.
 *
 * Deletion in the callback is synchronous, so by the time this is ever visited the data is already
 * gone — there is no status to look up, which is why the `id` is not read. Meta only requires that
 * the URL it was handed resolves.
 */
export async function GET() {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<title>Data deleted — Voxlae</title></head><body>` +
      `<p>Your Instagram data on Voxlae has been deleted.</p>` +
      `</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
