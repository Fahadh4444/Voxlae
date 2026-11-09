import { redirect } from "next/navigation";

/**
 * Preserves the old catch-all: `<Route path="*" element={<Navigate to="/" replace />} />`.
 *
 * Worth revisiting in P3 — sending every unknown URL to the landing page instead of returning a
 * real 404 is not what you want for SEO. Kept as-is here so the port changes no behaviour.
 */
export default function NotFound() {
  redirect("/");
}
