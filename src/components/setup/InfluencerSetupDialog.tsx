"use client";

/**
 * InfluencerSetupDialog — the static, blocking wizard that replaces the AI onboarding.
 *
 * Deliberately short: name, niche and an optional focus — exactly what influencer search shows brands.
 * (It used to also collect the Creator Plan questionnaire; that feature was removed, and the fields
 * went with it rather than asking creators for answers nothing reads.) On finish it saves the basics,
 * which flips INFLUENCER → ACTIVE and unlocks the app.
 */

import React, { useMemo, useState } from 'react';
import { completeInfluencerSetup } from '../../api/services';
import { useUser } from '../../context/UserContext';
import { useUI } from '../../context/UIContext';
import { NICHE_SUGGESTIONS } from '../../data/profileOptions';
import Autocomplete from '../common/Autocomplete';
import SetupWizard, { WizardStep } from './SetupWizard';
import '../../styles/components/SetupWizard.css';

interface Props {
  onDone: () => void;
}

const InfluencerSetupDialog: React.FC<Props> = ({ onDone }) => {
  const { user, refreshUserProfile } = useUser();
  const { showToast } = useUI();

  // Name + niche feed influencer search.
  const [name, setName] = useState(user?.name || '');
  const [niche, setNiche] = useState('');
  const [focus, setFocus] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await completeInfluencerSetup({
        name: name.trim(),
        nicheDomain: niche.trim(),
        nicheSubdomain: focus.trim() || undefined,
      });

      await refreshUserProfile(); // picks up INFLUENCER -> ACTIVE, unlocks the app
      showToast("You're all set — welcome to Voxlae!", 'success');
      onDone();
    } catch (err) {
      console.error('[InfluencerSetup] failed:', err);
      showToast('Could not save your setup. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const steps: WizardStep[] = useMemo(() => [
    {
      title: 'About you',
      subtitle: 'The basics so we can tailor Voxlae to your world.',
      canProceed: !!name.trim() && !!niche.trim(),
      requiredHint: 'Add your name and niche to continue.',
      content: (
        <div className="setup-field-stack">
          <div className="setup-field">
            <label className="setup-field__label" htmlFor="setup-name">Your name</label>
            <input
              id="setup-name"
              className="setup-field__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fahad"
              maxLength={120}
              autoFocus
            />
          </div>

          <Autocomplete
            label="Your niche"
            value={niche}
            onChange={setNiche}
            suggestions={NICHE_SUGGESTIONS}
            placeholder="e.g. Tech, Fitness, Comedy…"
            hint="Pick the closest — or type your own. This is how brands and clients find you."
          />

          <div className="setup-field">
            <label className="setup-field__label" htmlFor="setup-focus">
              Your focus <span className="setup-field__opt">optional</span>
            </label>
            <input
              id="setup-focus"
              className="setup-field__input"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="e.g. AI tools, home workouts, street food"
              maxLength={120}
            />
          </div>
        </div>
      ),
    },
  ], [name, niche, focus]);

  return (
    <SetupWizard
      title="Let's get you set up"
      description="One quick step — this is how brands and clients find you."
      steps={steps}
      submitting={submitting}
      onFinish={handleFinish}
      finishLabel="Enter Voxlae"
    />
  );
};

export default InfluencerSetupDialog;
