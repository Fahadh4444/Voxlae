"use client";

/**
 * BrandSetupDialog — the static 2-step wizard for brands.
 *
 * Reuses the existing brand profile save endpoint, which flips the BRAND role
 * to ACTIVE once company name + description are present.
 */

import React, { useMemo, useState } from 'react';
import { saveBrandProfile } from '../../api/services';
import { useUser } from '../../context/UserContext';
import { useUI } from '../../context/UIContext';
import { COMPANY_SIZES, INDUSTRY_SUGGESTIONS } from '../../data/profileOptions';
import Autocomplete from '../common/Autocomplete';
import SetupWizard, { WizardStep } from './SetupWizard';
import '../../styles/components/SetupWizard.css';

interface Props {
  onDone: () => void;
}

const BrandSetupDialog: React.FC<Props> = ({ onDone }) => {
  const { refreshUserProfile } = useUser();
  const { showToast } = useUI();

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [description, setDescription] = useState('');
  const [lookingFor, setLookingFor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      await saveBrandProfile({
        companyName: companyName.trim(),
        industry: industry.trim(),
        website: website.trim(),
        companySize: companySize.trim() || undefined,
        description: description.trim(),
        lookingFor: lookingFor.trim() || undefined,
      });
      await refreshUserProfile(); // BRAND -> ACTIVE unlocks the app
      showToast("You're all set — welcome to Voxlae!", 'success');
      onDone();
    } catch (err) {
      console.error('[BrandSetup] failed:', err);
      showToast('Could not save your setup. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const steps: WizardStep[] = useMemo(() => [
    {
      title: 'Your company',
      subtitle: 'The essentials creators will see.',
      canProceed: !!companyName.trim(),
      content: (
        <div className="setup-field-stack">
          <div className="setup-field">
            <label className="setup-field__label" htmlFor="brand-name">Company name</label>
            <input
              id="brand-name"
              className="setup-field__input"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Voxlae"
              maxLength={255}
              autoFocus
            />
          </div>

          <Autocomplete
            label="Industry"
            value={industry}
            onChange={setIndustry}
            suggestions={INDUSTRY_SUGGESTIONS}
            placeholder="e.g. Technology, Fashion…"
          />

          <div className="setup-field">
            <label className="setup-field__label">
              Company size <span className="setup-field__opt">optional</span>
            </label>
            <div className="setup-pill-row setup-pill-row--wrap">
              {COMPANY_SIZES.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`setup-pill ${companySize === s ? 'is-selected' : ''}`}
                  onClick={() => setCompanySize(companySize === s ? '' : s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="setup-field">
            <label className="setup-field__label" htmlFor="brand-website">
              Website <span className="setup-field__opt">optional</span>
            </label>
            <input
              id="brand-website"
              className="setup-field__input"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://…"
              maxLength={500}
            />
          </div>
        </div>
      ),
    },
    {
      title: 'About & goals',
      subtitle: 'Help creators understand who you are and what you need.',
      canProceed: !!description.trim(),
      content: (
        <div className="setup-field-stack">
          <div className="setup-field">
            <label className="setup-field__label" htmlFor="brand-desc">About your brand</label>
            <textarea
              id="brand-desc"
              className="setup-field__input setup-field__textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What your brand does and what you stand for."
            />
          </div>

          <div className="setup-field">
            <label className="setup-field__label" htmlFor="brand-looking">
              What are you looking for? <span className="setup-field__opt">optional</span>
            </label>
            <textarea
              id="brand-looking"
              className="setup-field__input setup-field__textarea"
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="e.g. Fitness creators for a product launch, short-form video editors…"
            />
          </div>
        </div>
      ),
    },
  ], [companyName, industry, website, companySize, description, lookingFor]);

  return (
    <SetupWizard
      title="Set up your brand"
      description="Takes a minute. You can refine everything later."
      steps={steps}
      submitting={submitting}
      onFinish={handleFinish}
      finishLabel="Enter Voxlae"
    />
  );
};

export default BrandSetupDialog;
