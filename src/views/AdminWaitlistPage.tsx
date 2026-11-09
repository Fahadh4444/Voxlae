"use client";

/**
 * AdminWaitlistPage (/admin/waitlist) — the waitlist and existing accounts.
 *
 * Approving a waitlist entry lets that email in and emails them — an invite link to create their
 * account, or "you're back in" if they already have one. Existing accounts (from before the
 * waitlist) can be let in directly. Guarded by AdminGuard in the UI and `requireAdmin` on every API.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  approveWaitlistEntry,
  getAdminAccounts,
  getAdminWaitlist,
  reissueInvite,
  revokeWaitlistEntry,
  setAccountAccess,
} from '../api/services';
import type { AdminAccount, AdminWaitlistResponse, InviteOutcome, WaitlistEntry } from '../api/types';
import { useUI } from '../context/UIContext';
import { Link } from '@/lib/router';
import '../styles/pages/AdminPage.css';

const ROLE_LABEL: Record<WaitlistEntry['role'], string> = {
  CREATOR: 'Creator',
  BRAND: 'Brand',
  FREELANCER: 'Freelancer',
};

type EntryState = 'pending' | 'invited' | 'joined';
const entryState = (e: WaitlistEntry): EntryState =>
  e.status === 'PENDING' ? 'pending' : e.hasAccount ? 'joined' : 'invited';

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

const AdminWaitlistPage: React.FC = () => {
  const { showToast } = useUI();
  const [waitlist, setWaitlist] = useState<AdminWaitlistResponse | null>(null);
  const [accounts, setAccounts] = useState<AdminAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** The last invite link shown, for when the clipboard is unavailable or the email failed. */
  const [lastLink, setLastLink] = useState<{ email: string; url: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [w, a] = await Promise.all([getAdminWaitlist(), getAdminAccounts()]);
      setWaitlist(w);
      setAccounts(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load admin data.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setBusy(null);
    }
  };

  /** Tell the admin what happened, and never leave a failed email as a dead end. */
  const report = async (email: string, outcome: InviteOutcome, emailed: boolean) => {
    if (outcome.kind === 'welcome_back') {
      showToast(
        outcome.emailSent
          ? `${email} can log in — "you're back in" email sent`
          : `${email} can log in — but the email failed to send; let them know yourself`,
        outcome.emailSent ? 'success' : 'error',
      );
      return;
    }
    if (!outcome.inviteUrl) return;
    setLastLink({ email, url: outcome.inviteUrl });
    if (emailed && outcome.emailSent) {
      showToast(`Invite emailed to ${email}`, 'success');
    } else {
      const copied = await copy(outcome.inviteUrl);
      showToast(
        emailed
          ? `Email to ${email} failed — ${copied ? 'invite link copied, send it yourself' : 'copy the link below'}`
          : copied ? `Invite link for ${email} copied` : 'Copy the invite link below',
        emailed ? 'error' : 'success',
      );
    }
  };

  const approve = (e: WaitlistEntry) =>
    run(`w${e.id}`, async () => report(e.email, await approveWaitlistEntry(e.id), true));
  const resend = (e: WaitlistEntry) =>
    run(`w${e.id}`, async () => report(e.email, await reissueInvite(e.id, true), true));
  const copyLink = (e: WaitlistEntry) =>
    run(`w${e.id}`, async () => report(e.email, await reissueInvite(e.id, false), false));
  const revoke = (e: WaitlistEntry) =>
    run(`w${e.id}`, async () => {
      await revokeWaitlistEntry(e.id);
      showToast(`${e.email} moved back to pending`, 'success');
    });
  const setAccess = (a: AdminAccount, allow: boolean) =>
    run(`a${a.userId}`, async () => {
      const outcome = await setAccountAccess(a.userId, allow);
      if (outcome.kind === 'blocked') showToast(`${a.email} blocked`, 'success');
      else await report(a.email, outcome, true);
    });

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <Link to="/admin" className="admin-page__crumb">← Admin</Link>
        <h1>Waitlist</h1>
        <p>
          Only visible to admins. Approving someone emails them an invite link (or &ldquo;you&apos;re back in&rdquo;
          if they already have an account).
        </p>
      </header>

      {error && <p className="admin-page__error">{error}</p>}

      {lastLink && (
        <div className="admin-page__link">
          <span>Invite link for <b>{lastLink.email}</b> (works once, 14 days):</span>
          <input readOnly value={lastLink.url} onFocus={(ev) => ev.currentTarget.select()} />
          <button onClick={() => setLastLink(null)} aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── Waitlist ── */}
      <section className="admin-page__section">
        <div className="admin-page__section-head">
          <h2>Waitlist</h2>
          <button className="admin-page__refresh" onClick={load}>Refresh</button>
        </div>

        {!waitlist && !error && <p className="admin-page__muted">Loading…</p>}

        {waitlist && (
          <>
            <div className="admin-page__stats">
              <div><span>{waitlist.counts.total}</span>Total</div>
              <div><span>{waitlist.counts.pending}</span>Pending</div>
              <div><span>{waitlist.counts.approved}</span>Approved</div>
              <div><span>{waitlist.counts.joined}</span>Joined</div>
              <div><span>{waitlist.counts.byRole.CREATOR}</span>Creators</div>
              <div><span>{waitlist.counts.byRole.BRAND}</span>Brands</div>
              <div><span>{waitlist.counts.byRole.FREELANCER}</span>Freelancers</div>
            </div>

            {waitlist.entries.length === 0 ? (
              <p className="admin-page__muted">No one has joined yet.</p>
            ) : (
              <div className="admin-page__table-wrap">
                <table className="admin-page__table">
                  <thead>
                    <tr><th>Email</th><th>Who</th><th>Joined list</th><th>Status</th><th /></tr>
                  </thead>
                  <tbody>
                    {waitlist.entries.map((e) => {
                      const state = entryState(e);
                      const isBusy = busy === `w${e.id}`;
                      return (
                        <tr key={e.id}>
                          <td className="admin-page__email">{e.email}</td>
                          <td>{ROLE_LABEL[e.role]}</td>
                          <td>{fmtDate(e.createdAt)}</td>
                          <td>
                            <span className={`admin-page__status admin-page__status--${state}`}>
                              {state === 'pending' ? 'Pending' : state === 'invited' ? 'Invited' : 'Joined'}
                            </span>
                            {state === 'invited' && e.inviteExpiresAt && new Date(e.inviteExpiresAt) < new Date() && (
                              <span className="admin-page__expired">link expired</span>
                            )}
                          </td>
                          <td className="admin-page__actions">
                            {state === 'pending' && (
                              <button disabled={isBusy} onClick={() => approve(e)}>Approve</button>
                            )}
                            {state === 'invited' && (
                              <>
                                <button className="admin-page__secondary" disabled={isBusy} onClick={() => resend(e)}>
                                  Resend invite
                                </button>
                                <button className="admin-page__secondary" disabled={isBusy} onClick={() => copyLink(e)}>
                                  Copy link
                                </button>
                              </>
                            )}
                            {state !== 'pending' && (
                              <button className="admin-page__ghost" disabled={isBusy} onClick={() => revoke(e)}>
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Existing accounts ── */}
      <section className="admin-page__section">
        <div className="admin-page__section-head">
          <h2>Existing accounts</h2>
        </div>
        <p className="admin-page__muted admin-page__intro">
          Everyone with an account. While invite-only, only admins and accounts you allow can sign in.
        </p>

        {!accounts && !error && <p className="admin-page__muted">Loading…</p>}

        {accounts && (
          <div className="admin-page__table-wrap">
            <table className="admin-page__table">
              <thead>
                <tr><th>Email</th><th>Roles</th><th>Last login</th><th>Access</th><th /></tr>
              </thead>
              <tbody>
                {accounts.map((a) => {
                  const isBusy = busy === `a${a.userId}`;
                  return (
                    <tr key={a.userId}>
                      <td className="admin-page__email">
                        {a.email}
                        {a.name && <span className="admin-page__name">{a.name}</span>}
                      </td>
                      <td>{a.roles.length ? a.roles.map((r) => r.charAt(0) + r.slice(1).toLowerCase()).join(', ') : '—'}</td>
                      <td>{fmtDate(a.lastLoginAt)}</td>
                      <td>
                        <span className={`admin-page__status admin-page__status--${a.access}`}>
                          {a.access === 'admin' ? 'Admin' : a.access === 'allowed' ? 'Allowed' : 'Blocked'}
                        </span>
                      </td>
                      <td className="admin-page__actions">
                        {a.access === 'blocked' && (
                          <button disabled={isBusy} onClick={() => setAccess(a, true)}>Allow</button>
                        )}
                        {a.access === 'allowed' && (
                          <button className="admin-page__ghost" disabled={isBusy} onClick={() => setAccess(a, false)}>
                            Block
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminWaitlistPage;
