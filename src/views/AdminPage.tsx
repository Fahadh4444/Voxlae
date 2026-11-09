"use client";

/**
 * AdminPage (/admin) — the admin hub. Each tool is a card linking to its own page; add new admin
 * tools by adding an entry to TOOLS (and a page under src/app/admin/, guarded by AdminGuard, with its
 * API in `requireAdmin`).
 */

import React from 'react';
import { Link } from '@/lib/router';
import '../styles/pages/AdminPage.css';

const TOOLS = [
  {
    to: '/admin/waitlist',
    title: 'Waitlist',
    desc: 'Approve people, send invite links, and let existing accounts back in.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

const AdminPage: React.FC = () => (
  <div className="admin-page">
    <header className="admin-page__header">
      <h1>Admin</h1>
      <p>Only visible to admins. More tools will appear here.</p>
    </header>

    <div className="admin-page__tools">
      {TOOLS.map((t) => (
        <Link key={t.to} to={t.to} className="admin-page__tool">
          <span className="admin-page__tool-icon">{t.icon}</span>
          <span className="admin-page__tool-text">
            <b>{t.title}</b>
            <span>{t.desc}</span>
          </span>
          <span className="admin-page__tool-arrow" aria-hidden="true">→</span>
        </Link>
      ))}
    </div>
  </div>
);

export default AdminPage;
