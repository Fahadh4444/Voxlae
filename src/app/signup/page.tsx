import type { Metadata } from "next";
import { Suspense } from "react";
import AuthPage from "@/components/auth/AuthPage";
import { PublicOnlyRoute } from "@/components/guards";

/** /signup — the waitlist while Voxlae is invite-only, normal sign-up once it opens. */
export const metadata: Metadata = {
  title: "Join Voxlae",
  description: "Join the Voxlae waitlist — for creators, freelancers and brands.",
};

export default function Page() {
  return (
    <PublicOnlyRoute>
      <Suspense>
        <AuthPage mode="signup" />
      </Suspense>
    </PublicOnlyRoute>
  );
}
