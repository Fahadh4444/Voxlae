"use client";

/**
 * TrendsPage — Content trends (coming soon).
 *
 * A placeholder, like Brands. The live feed it replaced aggregated platform-wide trending topics
 * (only the YouTube source was ever enabled), which was generic rather than niche-specific. It was
 * removed until trends can be built properly; the nav slot stays so the roadmap stays visible.
 */

import React from 'react';
import Card from '../components/common/Card';
import Container from '../components/common/Container';
import '../styles/pages/LockedPage.css';

const TrendsPage: React.FC = () => {
  return (
    <Container className="locked-page locked-page--unlocked">
      <div className="locked-page__content">
        <div className="locked-page__icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48" className="locked-page__icon">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        </div>

        <h1 className="locked-page__title">Trends</h1>
        <p className="locked-page__desc">
          Spot what&apos;s rising in your niche before it peaks — topics, formats and hashtags worth
          creating around, with the numbers behind them.
        </p>

        <div className="locked-page__preview">
          <h3 className="locked-page__preview-title">What&apos;s coming</h3>
          <div className="locked-page__features">
            {[
              { icon: '🔥', title: 'Rising Topics', desc: 'What is gaining momentum in your niche' },
              { icon: '#️⃣', title: 'Hashtags', desc: 'Tags ranked by reach, not just volume' },
              { icon: '🎬', title: 'Winning Formats', desc: 'Which content styles are performing' },
              { icon: '🌍', title: 'By Region', desc: 'Trends where your audience actually is' },
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
          <p>Niche-specific trends are being built. Check back soon!</p>
        </Card>
      </div>
    </Container>
  );
};

export default TrendsPage;
