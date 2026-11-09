"use client";

/**
 * FreelancerProfileDialog — the single place a freelancer edits their profile.
 *
 * Replaces the old standalone edit page: the profile page shows what clients
 * see, and this dialog edits it in place. Grouped into the same sections the
 * public page renders, so editing feels like editing the page itself.
 *
 * Portfolio links resolve their Open Graph metadata as they're pasted, so the
 * freelancer sees the exact card a client will see — and the resolved metadata
 * is sent with the save (the server never fetches links inside a transaction).
 */

import React, { useEffect, useState } from 'react';
import { saveFreelancerProfile, saveAppearance } from '../../api/services';
import {
  FreelancerProfileResponse,
  FreelancerAvailability,
  PortfolioItem,
  ExperienceEntry,
  RateUnit,
  ProfileTemplateId,
} from '../../api/types';
import { TEMPLATES } from './templates';
import { getLocalAppearance, setLocalAppearance } from './templates/appearanceStore';
import { useUI } from '../../context/UIContext';
import { useUser } from '../../context/UserContext';
import {
  CITY_SUGGESTIONS,
  LANGUAGE_SUGGESTIONS,
  TOOL_SUGGESTIONS,
  CURRENCIES,
  RATE_UNITS,
  RATE_PRESETS,
  currencySymbol,
} from '../../data/profileOptions';
import Dialog from '../common/Dialog';
import Button from '../common/Button';
import TagInput from '../common/TagInput';
import Autocomplete from '../common/Autocomplete';
import SelectWithCustom from '../common/SelectWithCustom';
import LinkPreviewCard from '../common/LinkPreviewCard';
import { useLinkPreview } from '../../hooks/useLinkPreview';
import '../../styles/components/FreelancerProfileDialog.css';

const MAX_PROJECTS = 8;
const MAX_EXPERIENCE = 15;

const emptyProject = (): PortfolioItem => ({ title: '', outcome: '', role: '', projectUrl: '', thumbnailUrl: '' });
const emptyExperience = (): ExperienceEntry => ({ title: '', organization: '', startDate: '', endDate: '', description: '' });

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Blocking setup mode: non-dismissible, no Cancel, "Save & continue" wording. */
  blocking?: boolean;
  profile: FreelancerProfileResponse | null;
  /** Called after a successful save with the fresh profile. */
  onSaved: (profile: FreelancerProfileResponse) => void;
}

/**
 * One portfolio project row. Split out so each row can own its own debounced
 * link-preview request — hooks can't run inside a .map() in the parent.
 */
const ProjectRow: React.FC<{
  item: PortfolioItem;
  index: number;
  onChange: (patch: Partial<PortfolioItem>) => void;
  onRemove: () => void;
}> = ({ item, index, onChange, onRemove }) => {
  // Don't re-fetch a link we already have cached metadata for
  const alreadyResolved = !!(item.previewTitle || item.previewSite);
  const { preview, loading } = useLinkPreview(item.projectUrl, !alreadyResolved);

  // Fold resolved metadata into the item so it's saved with the profile
  useEffect(() => {
    if (!preview) return;
    onChange({
      previewTitle: preview.title ?? null,
      previewDescription: preview.description ?? null,
      previewSite: preview.siteName ?? null,
      // Never overwrite a thumbnail the freelancer chose themselves
      thumbnailUrl: item.thumbnailUrl?.trim() ? item.thumbnailUrl : (preview.image ?? undefined),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  const previewData = alreadyResolved
    ? { url: item.projectUrl, title: item.previewTitle, description: item.previewDescription, image: item.thumbnailUrl, siteName: item.previewSite }
    : preview;

  return (
    <div className="fpd__card">
      <div className="fpd__card-head">
        <span className="fpd__card-index">Project {index + 1}</span>
        <button type="button" className="fpd__icon-btn" onClick={onRemove} aria-label={`Remove project ${index + 1}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="fpd__field">
        <label className="fpd__label">Title — lead with the result</label>
        <input
          className="fpd__input"
          value={item.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder='e.g. "Grew a channel to 100k subscribers"'
          maxLength={150}
        />
      </div>

      <div className="fpd__field">
        <label className="fpd__label">What happened <span className="fpd__optional">optional</span></label>
        <input
          className="fpd__input"
          value={item.outcome || ''}
          onChange={(e) => onChange({ outcome: e.target.value })}
          placeholder="A number, a percentage, a before/after"
          maxLength={300}
        />
      </div>

      <div className="fpd__grid-2">
        <div className="fpd__field">
          <label className="fpd__label">Your role <span className="fpd__optional">optional</span></label>
          <input
            className="fpd__input"
            value={item.role || ''}
            onChange={(e) => onChange({ role: e.target.value })}
            placeholder="e.g. Editor"
            maxLength={100}
          />
        </div>
        <div className="fpd__field">
          <label className="fpd__label">Project link</label>
          <input
            className="fpd__input"
            type="url"
            value={item.projectUrl || ''}
            onChange={(e) => onChange({
              projectUrl: e.target.value,
              // A new URL invalidates the old metadata
              previewTitle: null,
              previewDescription: null,
              previewSite: null,
            })}
            placeholder="https://…"
          />
        </div>
      </div>

      {(loading || previewData) && (
        <div className="fpd__preview">
          <span className="fpd__preview-label">Preview clients will see</span>
          <LinkPreviewCard data={previewData || {}} loading={loading} compact />
        </div>
      )}
    </div>
  );
};

const FreelancerProfileDialog: React.FC<Props> = ({ isOpen, onClose, profile, onSaved, blocking = false }) => {
  const { showToast } = useUI();
  const { refreshUserProfile } = useUser();

  const [headline, setHeadline] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [location, setLocation] = useState('');
  const [availability, setAvailability] = useState<FreelancerAvailability>('OPEN_TO_OFFERS');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [tools, setTools] = useState<string[]>([]);
  const [rateAmount, setRateAmount] = useState('');
  const [rateCurrency, setRateCurrency] = useState('INR');
  const [rateUnit, setRateUnit] = useState<RateUnit>('HOUR');
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [experienceEntries, setExperienceEntries] = useState<ExperienceEntry[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverShown, setCoverShown] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Hydrate from the loaded profile each time the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setHeadline(profile?.headline || '');
    setAvatarUrl(profile?.avatarUrl || '');
    setLocation(profile?.location || '');
    setAvailability(profile?.availability || 'OPEN_TO_OFFERS');
    setBio(profile?.bio || '');
    setSkills(profile?.skills || []);
    setLanguages(profile?.languages || []);
    setTools(profile?.tools || []);
    setRateAmount(profile?.rateAmount != null ? String(profile.rateAmount) : '');
    setRateCurrency(profile?.rateCurrency || 'INR');
    setRateUnit(profile?.rateUnit || 'HOUR');
    setPortfolioItems(profile?.portfolioItems || []);
    setExperienceEntries(profile?.experienceEntries || []);

    // Appearance: prefer the local pick, else what the saved profile carries
    // (so it hydrates correctly on a fresh device too).
    const appr = getLocalAppearance(profile?.profileSlug);
    const hidden = appr.coverHiddenOn ?? profile?.coverHiddenOn ?? [];
    setCoverImageUrl(appr.coverImageUrl ?? profile?.coverImageUrl ?? '');
    // Cover visibility is global: the checkbox is ON only when nothing is hidden. A
    // non-empty list (incl. legacy per-template picks) reads as "cover off".
    setCoverShown(hidden.length === 0);
  }, [isOpen, profile]);

  const updateProject = (index: number, patch: Partial<PortfolioItem>) =>
    setPortfolioItems(items => items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const updateExperience = (index: number, patch: Partial<ExperienceEntry>) =>
    setExperienceEntries(entries => entries.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  const ratePresets = (RATE_PRESETS[rateCurrency] || RATE_PRESETS.USD).map(amount => ({
    value: String(amount),
    label: `${currencySymbol(rateCurrency)}${amount.toLocaleString()}`,
  }));

  const handleSave = async () => {
    if (!bio.trim()) {
      showToast('Add a short bio — clients read it first', 'error');
      return;
    }
    if (!skills.length) {
      showToast('Add at least one skill', 'error');
      return;
    }
    const namedProjects = portfolioItems.filter(p => p.title.trim());
    if (!namedProjects.length) {
      showToast('Add at least one portfolio project', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveFreelancerProfile({
        bio: bio.trim(),
        skills,
        languages,
        tools,
        headline: headline.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
        location: location.trim() || undefined,
        availability,
        rateAmount: rateAmount.trim() ? Number(rateAmount) : null,
        rateCurrency: rateAmount.trim() ? rateCurrency : null,
        rateUnit: rateAmount.trim() ? rateUnit : null,
        experience: '',
        portfolioItems: namedProjects.map(p => ({
          title: p.title.trim(),
          outcome: p.outcome?.trim() || undefined,
          role: p.role?.trim() || undefined,
          projectUrl: p.projectUrl?.trim() || undefined,
          thumbnailUrl: p.thumbnailUrl?.trim() || undefined,
          previewTitle: p.previewTitle || undefined,
          previewDescription: p.previewDescription || undefined,
          previewSite: p.previewSite || undefined,
        })),
        experienceEntries: experienceEntries
          .filter(x => x.title.trim())
          .map(x => ({
            title: x.title.trim(),
            organization: x.organization?.trim() || undefined,
            startDate: x.startDate || undefined,
            endDate: x.endDate || undefined,
            description: x.description?.trim() || undefined,
          })),
      });

      // Persist appearance (cover + per-template cover visibility). saved.profileSlug
      // is the id minted on first save, so this works even for a brand-new profile.
      const apprSlug = saved.profileSlug || profile?.profileSlug;
      if (apprSlug) {
        // Global cover visibility: shown → hidden on no templates; hidden → hidden on
        // every template. One toggle, consistent across the profile page and previews.
        const nextHidden: ProfileTemplateId[] = coverShown ? [] : TEMPLATES.map((t) => t.id);
        setLocalAppearance(apprSlug, {
          coverImageUrl: coverImageUrl.trim() || undefined,
          coverHiddenOn: nextHidden,
        });
        // Publish to the backend so the cover shows (or hides) on every device.
        try {
          await saveAppearance({ coverImageUrl: coverImageUrl.trim(), coverHiddenOn: nextHidden });
        } catch (e) {
          console.warn('[FreelancerProfileDialog] appearance publish failed (saved locally):', e);
        }
      }

      await refreshUserProfile(); // picks up the public id minted on first save
      onSaved(saved);
      showToast('Profile updated', 'success');
      onClose();
    } catch (err) {
      console.error('[FreelancerProfileDialog] save failed:', err);
      showToast('Could not save your profile. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      dismissible={!blocking}
      title={blocking ? 'Build your freelancer profile' : 'Edit profile'}
      description={blocking
        ? 'Fill this in to appear in client search and start getting hired.'
        : 'This is exactly what clients see on your public profile.'}
      footer={
        <>
          {!blocking && <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>}
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : blocking ? 'Save & enter Voxlae' : 'Save profile'}
          </Button>
        </>
      }
    >
      {/* ── Identity ── */}
      <section className="fpd__section">
        <h3 className="fpd__section-title">Identity</h3>

        <div className="fpd__field">
          <label className="fpd__label" htmlFor="fpd-headline">Headline</label>
          <input
            id="fpd-headline"
            className="fpd__input"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder='What you do, for whom — e.g. "Short-form video editor for fitness creators"'
            maxLength={120}
          />
          <p className="fpd__hint">The most-read line on your profile. Say who you help, not just your job title.</p>
        </div>

        <div className="fpd__grid-2">
          <Autocomplete
            label="Location"
            value={location}
            onChange={setLocation}
            suggestions={CITY_SUGGESTIONS}
            placeholder="Start typing a city…"
            hint="Type anything — the list is only a shortcut."
          />
          <div className="fpd__field">
            <label className="fpd__label" htmlFor="fpd-availability">Availability</label>
            <select
              id="fpd-availability"
              className="fpd__input"
              value={availability}
              onChange={(e) => setAvailability(e.target.value as FreelancerAvailability)}
            >
              <option value="AVAILABLE">Available now</option>
              <option value="OPEN_TO_OFFERS">Open to offers</option>
              <option value="BOOKED">Fully booked</option>
            </select>
          </div>
        </div>

        <div className="fpd__field">
          <label className="fpd__label" htmlFor="fpd-avatar">Profile photo URL <span className="fpd__optional">optional</span></label>
          <input
            id="fpd-avatar"
            className="fpd__input"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…/your-photo.jpg"
          />
          <p className="fpd__hint">If the link breaks we'll show a generated avatar instead — nothing looks broken.</p>
        </div>
      </section>

      {/* ── Appearance (cover image + per-template cover visibility) ── */}
      <section className="fpd__section">
        <h3 className="fpd__section-title">Appearance</h3>

        <div className="fpd__field">
          <label className="fpd__label" htmlFor="fpd-cover">Cover image URL <span className="fpd__optional">optional</span></label>
          <input
            id="fpd-cover"
            className="fpd__input"
            type="url"
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="https://…/your-cover.jpg"
          />
          <p className="fpd__hint">The hero background behind your name on most templates. Leave blank for a brand gradient.</p>
        </div>

        {coverImageUrl.trim() && (
          <label className="fpd__check">
            <input type="checkbox" checked={coverShown} onChange={(e) => setCoverShown(e.target.checked)} />
            <span>Show the cover image on your profile. Turn it off to hide it on every template until you turn it back on.</span>
          </label>
        )}
        <p className="fpd__hint">Change your layout any time on the <strong>Profile Templates</strong> page.</p>
      </section>

      {/* ── About ── */}
      <section className="fpd__section">
        <h3 className="fpd__section-title">About</h3>
        <div className="fpd__field">
          <label className="fpd__label" htmlFor="fpd-bio">Bio</label>
          <textarea
            id="fpd-bio"
            className="fpd__input fpd__textarea"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Write for the client: the problem you solve and who you solve it for."
          />
          <span className="fpd__count">{bio.length}/2000</span>
        </div>
      </section>

      {/* ── Rate ── */}
      <section className="fpd__section">
        <h3 className="fpd__section-title">Rate</h3>
        <div className="fpd__grid-3">
          <div className="fpd__field">
            <label className="fpd__label" htmlFor="fpd-currency">Currency</label>
            <select
              id="fpd-currency"
              className="fpd__input"
              value={rateCurrency}
              onChange={(e) => setRateCurrency(e.target.value)}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          <SelectWithCustom
            label="Starting rate"
            value={rateAmount}
            onChange={setRateAmount}
            options={ratePresets}
            placeholder="Not shown"
            customType="number"
            customPlaceholder="Your rate"
          />

          <div className="fpd__field">
            <label className="fpd__label" htmlFor="fpd-rate-unit">Per</label>
            <select
              id="fpd-rate-unit"
              className="fpd__input"
              value={rateUnit}
              onChange={(e) => setRateUnit(e.target.value as RateUnit)}
            >
              {RATE_UNITS.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="fpd__hint">Only signed-in clients see your rate. Leave it blank to hide it entirely.</p>
      </section>

      {/* ── Skills, tools, languages ── */}
      <section className="fpd__section">
        <h3 className="fpd__section-title">Skills &amp; expertise</h3>
        <div className="fpd__stack">
          <TagInput
            label="Skills"
            value={skills}
            onChange={setSkills}
            max={20}
            placeholder="e.g. Short-form editing"
            hint="What you're hired to do. These also power client search."
          />
          <TagInput
            label="Tools"
            value={tools}
            onChange={setTools}
            suggestions={TOOL_SUGGESTIONS}
            max={30}
            placeholder="e.g. Premiere Pro"
            hint="Software you work in — clients often filter on this."
          />
          <TagInput
            label="Languages"
            value={languages}
            onChange={setLanguages}
            suggestions={LANGUAGE_SUGGESTIONS}
            max={15}
            placeholder="e.g. English"
            hint="Languages you're comfortable working and communicating in."
          />
        </div>
      </section>

      {/* ── Portfolio ── */}
      <section className="fpd__section">
        <h3 className="fpd__section-title">
          Portfolio
          <span className="fpd__section-count">{portfolioItems.length}/{MAX_PROJECTS}</span>
        </h3>
        <p className="fpd__hint fpd__hint--lead">
          Clients scan this first and decide in seconds. Lead each title with the
          <strong> result</strong>, not the task. A handful of strong projects beats twenty weak ones.
        </p>

        {portfolioItems.map((item, index) => (
          <ProjectRow
            key={index}
            item={item}
            index={index}
            onChange={(patch) => updateProject(index, patch)}
            onRemove={() => setPortfolioItems(items => items.filter((_, i) => i !== index))}
          />
        ))}

        <Button
          variant="secondary"
          onClick={() => setPortfolioItems([...portfolioItems, emptyProject()])}
          disabled={portfolioItems.length >= MAX_PROJECTS}
        >
          + Add project
        </Button>
      </section>

      {/* ── Experience ── */}
      <section className="fpd__section">
        <h3 className="fpd__section-title">
          Experience
          <span className="fpd__section-count">{experienceEntries.length}/{MAX_EXPERIENCE}</span>
        </h3>

        {experienceEntries.map((entry, index) => (
          <div key={index} className="fpd__card">
            <div className="fpd__card-head">
              <span className="fpd__card-index">Role {index + 1}</span>
              <button
                type="button"
                className="fpd__icon-btn"
                onClick={() => setExperienceEntries(entries => entries.filter((_, i) => i !== index))}
                aria-label={`Remove role ${index + 1}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="fpd__grid-2">
              <div className="fpd__field">
                <label className="fpd__label">Role title</label>
                <input
                  className="fpd__input"
                  value={entry.title}
                  onChange={(e) => updateExperience(index, { title: e.target.value })}
                  placeholder="e.g. Video Editor"
                  maxLength={150}
                />
              </div>
              <div className="fpd__field">
                <label className="fpd__label">Company / client</label>
                <input
                  className="fpd__input"
                  value={entry.organization || ''}
                  onChange={(e) => updateExperience(index, { organization: e.target.value })}
                  placeholder="e.g. Freelance"
                  maxLength={150}
                />
              </div>
            </div>

            <div className="fpd__grid-2">
              <div className="fpd__field">
                <label className="fpd__label">Start</label>
                <input
                  className="fpd__input"
                  type="date"
                  value={entry.startDate || ''}
                  onChange={(e) => updateExperience(index, { startDate: e.target.value })}
                />
              </div>
              <div className="fpd__field">
                <label className="fpd__label">End <span className="fpd__optional">blank = current</span></label>
                <input
                  className="fpd__input"
                  type="date"
                  value={entry.endDate || ''}
                  onChange={(e) => updateExperience(index, { endDate: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        <Button
          variant="secondary"
          onClick={() => setExperienceEntries([...experienceEntries, emptyExperience()])}
          disabled={experienceEntries.length >= MAX_EXPERIENCE}
        >
          + Add role
        </Button>
      </section>
    </Dialog>
  );
};

export default FreelancerProfileDialog;
