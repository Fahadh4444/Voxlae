"use client";

/**
 * PlatformDetailPage — Individual platform analytics (YouTube / Instagram).
 *
 * Route: /influencer/platforms/:id
 * Both platforms render their live analytics dashboards, which fetch their own data:
 * YouTube → YouTubeDashboard (GET /api/youtube/dashboard), Instagram → InstagramDashboard.
 */

import React from 'react';
import { useParams, useNavigate } from '@/lib/router';
import { useUser } from '../context/UserContext';
import { buildRoleRoute } from '../utils/roleRoutes';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Container from '../components/common/Container';
import InstagramDashboard from '../components/instagram/InstagramDashboard';
import YouTubeDashboard from '../components/youtube/YouTubeDashboard';
import '../styles/pages/PlatformDetail.css';

const PlatformDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeRole } = useUser();

  const platformsRoute = buildRoleRoute(activeRole, 'platforms');

  if (id !== 'youtube' && id !== 'instagram') {
    return (
      <Container>
        <Card variant="outlined" padding="xl">
          <div style={{ textAlign: 'center' }}>
            <h2>Platform not found</h2>
            <p>The platform "{id}" is not available yet.</p>
            <Button variant="primary" onClick={() => navigate(platformsRoute)}>Back to Platforms</Button>
          </div>
        </Card>
      </Container>
    );
  }

  // Instagram — live insights dashboard
  if (id === 'instagram') {
    return (
      <Container className="platform-detail">
        <Button variant="ghost" size="sm" onClick={() => navigate(platformsRoute)} className="platform-detail__back">
          ← Back to Platforms
        </Button>
        <InstagramDashboard />
      </Container>
    );
  }

  // YouTube — live composed analytics dashboard (loads its own data)
  return (
    <Container className="platform-detail">
      <Button variant="ghost" size="sm" onClick={() => navigate(platformsRoute)} className="platform-detail__back">
        ← Back to Platforms
      </Button>
      <YouTubeDashboard />
    </Container>
  );
};

export default PlatformDetailPage;
