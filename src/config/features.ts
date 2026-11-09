/**
 * Build-time feature flags, driven by `NEXT_PUBLIC_*` env vars. They are inlined at **build** time, so
 * changing one in the deployment needs a rebuild, not just a restart.
 *
 * A flag is ON only when its var is exactly the string "true". Unset → OFF. This makes
 * production safe-by-default: a feature stays hidden until its var is explicitly enabled.
 */
export const FEATURES = {
  /**
   * Instagram DM Automations (Creator Tools). Gated OFF until the Meta app passes App Review
   * (Advanced Access for instagram_business_manage_comments / _manage_messages) and is set Live —
   * real comment/DM webhooks are not delivered in Development mode. Flip on by setting
   * NEXT_PUBLIC_FEATURE_AUTOMATIONS=true. **Production has it on** (it was VITE_FEATURE_AUTOMATIONS=true
   * in app.env) — if the deployment does not set it, the Automations page disappears at cutover.
   */
  automations: process.env.NEXT_PUBLIC_FEATURE_AUTOMATIONS === 'true',
  /**
   * Invite-only mode: every sign-in / sign-up button opens the waitlist form instead (AuthModal), and
   * only the unlinked /signin page offers a real sign-in. **The exception to "ON only when 'true'"**:
   * this one is ON unless NEXT_PUBLIC_ACCESS_MODE is exactly "open", so a missing setting keeps the
   * site closed. Mirror of the server's ACCESS_MODE, which is what actually enforces it.
   */
  waitlist: process.env.NEXT_PUBLIC_ACCESS_MODE !== 'open',
};
