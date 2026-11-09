"use client";

/**
 * RoleSetupGate — blocks the app behind a role-specific setup wizard until the
 * active role's setup is complete.
 *
 * A role is INCOMPLETE from the moment it's added until its setup is saved
 * (RoleStatus). While INCOMPLETE, this renders ONLY the setup dialog over the
 * app — "till they fill it, nothing else is shown." Completing setup flips the
 * role to ACTIVE (each dialog refreshes the user), the gate sees ACTIVE and
 * unmounts, revealing the app.
 *
 * Mounted once in DashboardLayout, so it covers every authenticated page.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { useUser } from '../../context/UserContext';
import { getFreelancerProfile } from '../../api/services';
import { Role, RoleStatus, FreelancerProfileResponse } from '../../api/types';
import InfluencerSetupDialog from './InfluencerSetupDialog';
import BrandSetupDialog from './BrandSetupDialog';
import FreelancerProfileDialog from '../freelancer/FreelancerProfileDialog';

const RoleSetupGate: React.FC = () => {
  const { isAuthenticated, activeRole, activeRoleStatus } = useUser();
  const navigate = useNavigate();
  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfileResponse | null>(null);

  const needsSetup = isAuthenticated && !!activeRole && activeRoleStatus === RoleStatus.INCOMPLETE;

  // The freelancer wizard reuses the profile editor, which needs the current
  // (possibly empty) profile to hydrate its fields.
  useEffect(() => {
    if (needsSetup && activeRole === Role.FREELANCER) {
      getFreelancerProfile().then(setFreelancerProfile).catch(() => setFreelancerProfile(null));
    }
  }, [needsSetup, activeRole]);

  if (!needsSetup) return null;

  switch (activeRole) {
    case Role.INFLUENCER:
      return <InfluencerSetupDialog onDone={() => { /* role flips ACTIVE → gate unmounts */ }} />;
    case Role.BRAND:
      return <BrandSetupDialog onDone={() => { /* role flips ACTIVE → gate unmounts */ }} />;
    case Role.FREELANCER:
      return (
        <FreelancerProfileDialog
          isOpen
          blocking
          profile={freelancerProfile}
          onClose={() => { /* non-dismissible in blocking mode */ }}
          onSaved={(saved) => {
            // Land on their freshly-minted public profile instead of the setup
            // route (which would otherwise show "Profile not found").
            if (saved.profileSlug) navigate(`/f/${saved.profileSlug}`, { replace: true });
          }}
        />
      );
    default:
      return null;
  }
};

export default RoleSetupGate;
