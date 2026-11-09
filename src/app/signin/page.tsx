import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPage from "@/components/auth/AuthPage";
import { PublicOnlyRoute } from "@/components/guards";

/**
 * /signin — the sign-in page, linked as "Log in" from the navbar and landing page.
 *
 * Visible on purpose: who gets in is decided on the server (`identity/access.ts`), so there is
 * nothing to hide here, and approved waitlist users need a normal way back in.
 */
export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false, follow: true },
};

export default function Page() {
  return (
    <PublicOnlyRoute>
      <Suspense>
        <AuthPage mode="signin" />
      </Suspense>
    </PublicOnlyRoute>
  );
}
