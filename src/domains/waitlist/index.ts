import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { sendMail } from "@/lib/mailer";
import { addRole } from "@/domains/identity/roles";
import type { Role } from "@/domains/identity/jwt";

/**
 * The waitlist, approvals, and invite links (see `identity/access.ts`, which reads
 * `status = 'APPROVED'` to decide who may sign up or sign in while Voxlae is invite-only).
 *
 * Approving someone emails them:
 *  - **no account yet** → a one-time invite link, `/signup?invite=<token>`, valid 14 days, that
 *    opens "Create your account" with their email locked. Only the token's SHA-256 is stored.
 *  - **an existing account** (one of the pre-waitlist users) → "you're back in", linking to /signin.
 *
 * Creating the account — by the link, or by Google sign-in with the approved email — "claims" the
 * entry: it is stamped `accepted_at` (which is what makes the link "used"), and the role they picked
 * on the waitlist is added so they land straight in that role's setup.
 */

export const WAITLIST_ROLES = ["CREATOR", "BRAND", "FREELANCER"] as const;
export type WaitlistRole = (typeof WAITLIST_ROLES)[number];
export type WaitlistStatus = "PENDING" | "APPROVED";

const INVITE_TTL_DAYS = 14;

/** Waitlist "who are you" → the Voxlae role it becomes. */
const APP_ROLE: Record<WaitlistRole, Role> = {
  CREATOR: "INFLUENCER",
  BRAND: "BRAND",
  FREELANCER: "FREELANCER",
};
const WAITLIST_ROLE: Partial<Record<string, WaitlistRole>> = {
  INFLUENCER: "CREATOR",
  BRAND: "BRAND",
  FREELANCER: "FREELANCER",
};

export class InviteError extends Error {
  constructor(
    public readonly reason: "invalid" | "expired" | "used" | "account_exists",
    message: string,
  ) {
    super(message);
    this.name = "InviteError";
  }
}

export interface WaitlistEntry {
  id: number;
  email: string;
  role: WaitlistRole;
  status: WaitlistStatus;
  source: string | null;
  createdAt: string;
  approvedAt: string | null;
  invitedAt: string | null;
  inviteExpiresAt: string | null;
  acceptedAt: string | null;
  /** A Voxlae account already exists for this email. */
  hasAccount: boolean;
}

/** What approving / re-inviting did, so the admin page can say so — or offer the link to copy. */
export interface InviteOutcome {
  kind: "invite" | "welcome_back";
  emailSent: boolean;
  /** Only for `invite`. Shown to the admin so a failed email is never a dead end. */
  inviteUrl: string | null;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

// ==================== Joining ====================

/**
 * Add an email. Joining again is a no-op rather than an error, and the caller answers the same way
 * either way — otherwise the form becomes a way to test which addresses are already on the list.
 */
export async function joinWaitlist(
  email: string,
  role: WaitlistRole,
  source: string | null,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO waitlist (email, role, source)
    VALUES (${email.trim().toLowerCase()}, ${role}, ${source})
    ON CONFLICT (lower(email)) DO NOTHING
  `);
}

// ==================== Admin: list ====================

export async function listWaitlist(): Promise<{
  entries: WaitlistEntry[];
  counts: {
    total: number;
    pending: number;
    approved: number;
    joined: number;
    byRole: Record<WaitlistRole, number>;
  };
}> {
  const rows = await db.execute<{ [key: string]: unknown }>(sql`
    SELECT w.id, w.email, w.role, w.status, w.source, w.created_at, w.approved_at,
           w.invited_at, w.invite_expires_at, w.accepted_at,
           EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email)) AS has_account
    FROM waitlist w
    ORDER BY w.created_at DESC
  `);

  const entries: WaitlistEntry[] = rows.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    role: r.role as WaitlistRole,
    status: r.status as WaitlistStatus,
    source: (r.source as string | null) ?? null,
    createdAt: iso(r.created_at)!,
    approvedAt: iso(r.approved_at),
    invitedAt: iso(r.invited_at),
    inviteExpiresAt: iso(r.invite_expires_at),
    acceptedAt: iso(r.accepted_at),
    hasAccount: r.has_account === true,
  }));
  const byRole = { CREATOR: 0, BRAND: 0, FREELANCER: 0 } as Record<WaitlistRole, number>;
  for (const e of entries) byRole[e.role]++;

  return {
    entries,
    counts: {
      total: entries.length,
      pending: entries.filter((e) => e.status === "PENDING").length,
      approved: entries.filter((e) => e.status === "APPROVED").length,
      joined: entries.filter((e) => e.hasAccount).length,
      byRole,
    },
  };
}

// ==================== Admin: approve / revoke / invite ====================

async function entryById(
  id: number,
): Promise<{ email: string; role: WaitlistRole; status: WaitlistStatus; hasAccount: boolean } | null> {
  const rows = await db.execute<{ [key: string]: unknown }>(sql`
    SELECT w.email, w.role, w.status,
           EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email)) AS has_account
    FROM waitlist w WHERE w.id = ${id}
  `);
  const r = rows[0];
  return r
    ? {
        email: String(r.email),
        role: r.role as WaitlistRole,
        status: r.status as WaitlistStatus,
        hasAccount: r.has_account === true,
      }
    : null;
}

/**
 * Approve: lets the email in, and tells them — an invite link if they have no account, a "you're
 * back in" if they do. Returns null when the id is unknown.
 */
export async function approveEntry(id: number): Promise<InviteOutcome | null> {
  const updated = await db.execute(sql`
    UPDATE waitlist SET status = 'APPROVED', approved_at = COALESCE(approved_at, now())
    WHERE id = ${id} RETURNING id
  `);
  if (updated.length === 0) return null;

  const entry = (await entryById(id))!;
  if (entry.hasAccount) {
    return { kind: "welcome_back", emailSent: await sendWelcomeBack(entry.email), inviteUrl: null };
  }
  return sendNewInvite(id, entry.email, entry.role, true);
}

/** Back to pending: takes access away (at their next token refresh) and kills any live invite link. */
export async function revokeEntry(id: number): Promise<boolean> {
  const rows = await db.execute(sql`
    UPDATE waitlist
    SET status = 'PENDING', approved_at = NULL,
        invite_token_hash = NULL, invite_expires_at = NULL
    WHERE id = ${id} RETURNING id
  `);
  return rows.length > 0;
}

/**
 * A fresh invite link for an approved entry with no account — emailed (`send`) or only returned so
 * the admin can share it themselves. Either way the previous link stops working: only the hash is
 * stored, so an old link cannot be shown again, only replaced.
 */
export async function reissueInvite(id: number, send: boolean): Promise<InviteOutcome> {
  const entry = await entryById(id);
  if (!entry) throw new InviteError("invalid", "No waitlist entry with that id.");
  if (entry.status !== "APPROVED") {
    throw new InviteError("invalid", "Approve this entry before inviting them.");
  }
  if (entry.hasAccount) {
    throw new InviteError("account_exists", "They already have an account — they can just log in.");
  }
  return sendNewInvite(id, entry.email, entry.role, send);
}

async function sendNewInvite(
  id: number,
  email: string,
  role: WaitlistRole,
  send: boolean,
): Promise<InviteOutcome> {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.execute(sql`
    UPDATE waitlist
    SET invite_token_hash = ${hashToken(token)},
        invite_expires_at = now() + interval '${sql.raw(String(INVITE_TTL_DAYS))} days',
        invited_at = now(),
        -- A link consumed by a signup that then failed would otherwise make the new link "used" too.
        accepted_at = NULL
    WHERE id = ${id}
  `);
  const inviteUrl = `${siteUrl()}/signup?invite=${token}`;
  const emailSent = send ? await sendInviteEmail(email, role, inviteUrl) : false;
  return { kind: "invite", emailSent, inviteUrl };
}

// ==================== Invite links ====================

/** The entry behind a live invite link, or an `InviteError` saying why it is not live. */
export async function lookupInvite(token: string): Promise<{ email: string; role: WaitlistRole }> {
  const rows = await db.execute<{ [key: string]: unknown }>(sql`
    SELECT w.email, w.role, w.status, w.accepted_at,
           (w.invite_expires_at < now()) AS expired,
           EXISTS (SELECT 1 FROM users u WHERE lower(u.email) = lower(w.email)) AS has_account
    FROM waitlist w WHERE w.invite_token_hash = ${hashToken(token)}
  `);
  const r = rows[0];
  if (!r || r.status !== "APPROVED") {
    throw new InviteError("invalid", "This invite link isn't valid. It may have been replaced by a newer one.");
  }
  if (r.accepted_at || r.has_account) {
    throw new InviteError("used", "This invite has already been used — log in with your email instead.");
  }
  if (r.expired === true) {
    throw new InviteError("expired", "This invite link has expired. Ask us for a new one.");
  }
  return { email: String(r.email), role: r.role as WaitlistRole };
}

/**
 * Run after a new account is created for `email`. If it was approved off the waitlist, stamp the
 * entry as joined, kill any live link, and give them the role they asked for (so they go straight
 * to that role's setup). Returns the role added, if any. Never throws — a failure here must not
 * undo an account that was just created; they can still pick a role themselves.
 */
export async function claimWaitlistSpot(userId: number, email: string): Promise<Role | null> {
  try {
    // The link's hash is kept, so reopening it says "already used" rather than "invalid".
    const rows = await db.execute<{ [key: string]: unknown; role: WaitlistRole }>(sql`
      UPDATE waitlist
      SET accepted_at = COALESCE(accepted_at, now())
      WHERE lower(email) = lower(${email}) AND status = 'APPROVED'
      RETURNING role
    `);
    const role = rows[0]?.role;
    if (!role) return null;

    const held = await db.execute(sql`SELECT 1 FROM user_roles WHERE user_id = ${userId} LIMIT 1`);
    if (held.length > 0) return null;
    await addRole(userId, APP_ROLE[role]);
    return APP_ROLE[role];
  } catch (error) {
    console.error(`[waitlist] claiming spot for user ${userId} failed:`, error);
    return null;
  }
}

/**
 * Consume an invite atomically: exactly one caller wins a given link, even under a double-submit.
 * Returns the invited email and role, or throws why not.
 */
export async function consumeInvite(token: string): Promise<{ email: string; role: WaitlistRole }> {
  const invite = await lookupInvite(token); // precise error for the common cases
  const rows = await db.execute<{ [key: string]: unknown; email: string; role: WaitlistRole }>(sql`
    UPDATE waitlist
    SET accepted_at = now()
    WHERE invite_token_hash = ${hashToken(token)} AND status = 'APPROVED'
      AND invite_expires_at > now() AND accepted_at IS NULL
    RETURNING email, role
  `);
  if (!rows[0]) throw new InviteError("used", "This invite has already been used — log in instead.");
  return invite;
}

// ==================== Admin: existing accounts ====================

export interface AccountAccess {
  userId: number;
  email: string;
  name: string | null;
  roles: string[];
  createdAt: string | null;
  lastLoginAt: string | null;
  access: "admin" | "allowed" | "blocked";
}

/** Every account, with whether it may get in. Admins are passed in so this stays free of env reads. */
export async function listAccounts(isAdmin: (email: string) => boolean): Promise<AccountAccess[]> {
  const rows = await db.execute<{ [key: string]: unknown }>(sql`
    SELECT u.user_id, u.email, u.name, u.created_at, u.last_login_at,
           COALESCE(array_agg(ur.role ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles,
           EXISTS (SELECT 1 FROM waitlist w
                   WHERE lower(w.email) = lower(u.email) AND w.status = 'APPROVED') AS approved
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.user_id
    GROUP BY u.user_id
    ORDER BY u.last_login_at DESC NULLS LAST, u.user_id
  `);
  return rows.map((r) => {
    const email = String(r.email);
    return {
      userId: Number(r.user_id),
      email,
      name: (r.name as string | null) ?? null,
      roles: (r.roles as string[]) ?? [],
      createdAt: iso(r.created_at),
      lastLoginAt: iso(r.last_login_at),
      access: isAdmin(email) ? "admin" : r.approved === true ? "allowed" : "blocked",
    };
  });
}

/**
 * Let an existing account in (or block it) without them joining the waitlist first. Stored as a
 * waitlist row — the one allowlist — tagged `source = 'existing-account'`. Allowing emails them
 * "you're back in". Returns null when the user id is unknown.
 */
export async function setAccountAccess(
  userId: number,
  allow: boolean,
): Promise<InviteOutcome | { kind: "blocked" } | null> {
  const users = await db.execute<{ [key: string]: unknown; email: string; role: string | null }>(sql`
    SELECT u.email, (SELECT ur.role FROM user_roles ur WHERE ur.user_id = u.user_id
                     ORDER BY ur.role LIMIT 1) AS role
    FROM users u WHERE u.user_id = ${userId}
  `);
  const user = users[0];
  if (!user) return null;

  if (!allow) {
    await db.execute(sql`
      UPDATE waitlist SET status = 'PENDING', approved_at = NULL,
                          invite_token_hash = NULL, invite_expires_at = NULL
      WHERE lower(email) = lower(${user.email})
    `);
    return { kind: "blocked" };
  }

  const role = WAITLIST_ROLE[user.role ?? ""] ?? "CREATOR";
  await db.execute(sql`
    INSERT INTO waitlist (email, role, status, source, approved_at, accepted_at)
    VALUES (lower(${user.email}), ${role}, 'APPROVED', 'existing-account', now(), now())
    ON CONFLICT (lower(email)) DO UPDATE
      SET status = 'APPROVED', approved_at = COALESCE(waitlist.approved_at, now()),
          accepted_at = COALESCE(waitlist.accepted_at, now())
  `);
  return { kind: "welcome_back", emailSent: await sendWelcomeBack(user.email), inviteUrl: null };
}

// ==================== Emails ====================

const ROLE_COPY: Record<WaitlistRole, string> = {
  CREATOR: "see how your content really performs and put your Instagram replies on autopilot",
  BRAND: "find the right creators and freelancers to work with",
  FREELANCER: "build a profile that gets you found and hired",
};

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:14px 26px;border-radius:12px;background:#FF6B2C;color:#ffffff;font-weight:700;text-decoration:none">${label}</a>`;
}

function layout(heading: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f6fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#10182B">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<div style="font-weight:800;font-size:20px;letter-spacing:.02em;margin-bottom:20px">VOXLAE</div>
<div style="background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e6e8ef">
<h1 style="margin:0 0 12px;font-size:22px">${heading}</h1>${body}</div>
<p style="color:#79839B;font-size:12px;margin-top:16px">You're getting this because you joined the Voxlae waitlist.</p>
</div></body></html>`;
}

async function sendInviteEmail(to: string, role: WaitlistRole, url: string): Promise<boolean> {
  const text =
    `You're in!\n\nYour spot on Voxlae is ready — time to ${ROLE_COPY[role]}.\n\n` +
    `Create your account here (link valid for ${INVITE_TTL_DAYS} days, works once):\n${url}\n\n— Voxlae`;
  const html = layout(
    "You're in! 🎉",
    `<p style="line-height:1.6;color:#46506A">Your spot on Voxlae is ready — time to ${ROLE_COPY[role]}.</p>
<p style="margin:24px 0">${button(url, "Create your account")}</p>
<p style="font-size:13px;color:#79839B;line-height:1.5">The link works once and is valid for ${INVITE_TTL_DAYS} days.<br>If the button doesn't work, paste this into your browser:<br><span style="word-break:break-all">${url}</span></p>`,
  );
  return sendMail({ to, subject: "You're in — create your Voxlae account", text, html });
}

async function sendWelcomeBack(to: string): Promise<boolean> {
  const url = `${siteUrl()}/signin`;
  const text = `You're back in!\n\nYour Voxlae account is ready for you. Log in here:\n${url}\n\n— Voxlae`;
  const html = layout(
    "You're back in 👋",
    `<p style="line-height:1.6;color:#46506A">Your Voxlae account is ready for you — everything is where you left it.</p>
<p style="margin:24px 0">${button(url, "Log in")}</p>`,
  );
  return sendMail({ to, subject: "You're back in — Voxlae", text, html });
}
