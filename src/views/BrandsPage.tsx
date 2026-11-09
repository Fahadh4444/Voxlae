"use client";

/**
 * BrandsPage — Brand partnerships (coming soon).
 */

import React from 'react';
import Card from '../components/common/Card';
import Container from '../components/common/Container';
import '../styles/pages/LockedPage.css';

const BrandsPageContent: React.FC = () => {
  return (
    <Container className="locked-page locked-page--unlocked">
      <div className="locked-page__content">
        <div className="locked-page__icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" className="locked-page__icon">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
        </div>

        <h1 className="locked-page__title">Brand Partnerships</h1>
        <p className="locked-page__desc">
          Connect with brands looking for creators in your niche. Receive partnership inquiries,
          manage campaigns, and grow your monetization as a creator.
        </p>

        <div className="locked-page__preview">
          <h3 className="locked-page__preview-title">Your Partnership Tools</h3>
          <div className="locked-page__features">
            {[
              { icon: '🤝', title: 'Brand Matching', desc: 'AI-powered brand-creator matching' },
              { icon: '📋', title: 'Campaign Management', desc: 'Track deliverables and deadlines' },
              { icon: '💰', title: 'Revenue Tracking', desc: 'Monitor your creator earnings' },
              { icon: '📧', title: 'Partnership Inbox', desc: 'Receive and respond to brand offers' },
            ].map((f, i) => (
              <div key={i} className="locked-page__feature">
                <span className="locked-page__feature-icon">{f.icon}</span>
                <div>
                  <h4>{f.title}</h4>
                  <p>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card variant="default" padding="lg" className="locked-page__coming-soon">
          <h3>Coming Soon</h3>
          <p>Full brand partnerships dashboard is being developed. Check back soon!</p>
        </Card>
      </div>
    </Container>
  );
};

const BrandsPage: React.FC = () => <BrandsPageContent />;

export default BrandsPage;
