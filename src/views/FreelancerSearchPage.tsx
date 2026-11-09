"use client";

/**
 * FreelancerSearchPage — the freelancer directory (/influencer/freelancers).
 *
 * Never opens empty: with no filters applied the API returns *suggestions*,
 * ranked by profile strength. An empty marketplace looks dead, and a client who
 * lands on a blank search box has no idea what's even available here.
 *
 * Filter options are derived from the unfiltered result set we already fetch, so
 * they can only offer values somebody actually has — and cost no extra request.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from '@/lib/router';
import { searchFreelancers, getFreelancerStats } from '../api/services';
import {
  FreelancerSearchResult,
  FreelancerSearchFilters,
  FreelancerStats,
  FreelancerAvailability,
} from '../api/types';
import { useRoleStatus } from '../hooks/useRoleStatus';
import { formatRate, CURRENCIES } from '../data/profileOptions';
import Button from '../components/common/Button';
import VoxlaeLoader from '../components/common/VoxlaeLoader';
import Avatar from '../components/common/Avatar';
import TagInput from '../components/common/TagInput';
import Autocomplete from '../components/common/Autocomplete';
import '../styles/pages/Search.css';

const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: 'Available now',
  OPEN_TO_OFFERS: 'Open to offers',
  BOOKED: 'Fully booked',
};

const EMPTY: FreelancerSearchFilters = {
  keyword: '',
  skills: [],
  tools: [],
  languages: [],
  location: '',
  availability: '',
  maxRate: null,
  rateCurrency: '',
};

const countActive = (f: FreelancerSearchFilters): number =>
  (f.keyword?.trim() ? 1 : 0) +
  (f.skills?.length || 0) +
  (f.tools?.length || 0) +
  (f.languages?.length || 0) +
  (f.location?.trim() ? 1 : 0) +
  (f.availability ? 1 : 0) +
  (f.maxRate != null ? 1 : 0);

const FreelancerSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { isIncomplete, profileRoute, restrictionMessage } = useRoleStatus();

  const [filters, setFilters] = useState<FreelancerSearchFilters>(EMPTY);
  const [results, setResults] = useState<FreelancerSearchResult[]>([]);
  // Filter options come from the unfiltered result set we already fetched —
  // a separate facets endpoint meant re-running the whole search on every load.
  const [options, setOptions] = useState<{ skills: string[]; tools: string[]; languages: string[]; locations: string[]; currencies: string[] }>({
    skills: [], tools: [], languages: [], locations: [], currencies: [],
  });
  const [stats, setStats] = useState<FreelancerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const activeCount = countActive(filters);
  const isSuggesting = activeCount === 0;

  const runSearch = useCallback(async (next: FreelancerSearchFilters, captureOptions = false) => {
    try {
      setIsLoading(true);
      setFailed(false);
      const found = await searchFreelancers(next);
      setResults(found);

      // The first, unfiltered response contains every listed freelancer — that's
      // exactly the set the filter dropdowns should offer.
      if (captureOptions) {
        const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
        setOptions({
          skills: uniq(found.flatMap(f => f.skills || [])),
          tools: uniq(found.flatMap(f => f.tools || [])),
          languages: uniq(found.flatMap(f => f.languages || [])),
          locations: uniq(found.map(f => f.location || '')),
          currencies: uniq(found.map(f => f.rateCurrency || '')),
        });
      }
    } catch (error) {
      // A failed request must NOT look like "there are no freelancers" — that
      // tells the user the marketplace is empty when it's really just broken.
      console.error('[FreelancerSearch] failed:', error);
      setResults([]);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Land on suggestions, not a blank page
  useEffect(() => {
    if (isIncomplete) return;
    runSearch(EMPTY, true);
    getFreelancerStats().then(setStats).catch(() => setStats(null));
  }, [isIncomplete, runSearch]);

  const apply = (patch: Partial<FreelancerSearchFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    runSearch(next);
  };

  const clearAll = () => {
    setFilters(EMPTY);
    runSearch(EMPTY);
  };

  if (isIncomplete) {
    return (
      <div className="search-page">
        <div className="search-page__restricted">
          <div className="search-page__restricted-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="48" height="48">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2>Complete Your Profile</h2>
          <p>{restrictionMessage}</p>
          <Button onClick={() => navigate(profileRoute)}>Go to Profile</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="search-page">
      <header className="search-page__header">
        <h1>Freelancers</h1>
        <p className="search-page__subtitle">
          Editors, designers and creators for hire.
          {stats && (
            <> <b>{stats.listed}</b> listed
              {stats.total > stats.listed && <> of {stats.total} on Voxlae</>}.
            </>
          )}
        </p>
      </header>

      {/* ── Search bar: one row — input, filters, search ── */}
      <div className="search-bar">
        <div className="search-bar__field">
          <svg className="search-bar__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="search-bar__input"
            placeholder="Search by name, headline or bio…"
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && runSearch(filters)}
          />
          {filters.keyword && (
            <button
              type="button"
              className="search-bar__clear"
              onClick={() => apply({ keyword: '' })}
              aria-label="Clear search"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="button"
          className={`search-bar__filters ${showFilters ? 'is-open' : ''}`}
          onClick={() => setShowFilters(v => !v)}
          aria-expanded={showFilters}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
            <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          <span>Filters</span>
          {activeCount > 0 && <span className="search-bar__badge">{activeCount}</span>}
        </button>

        <button
          type="button"
          className="search-bar__submit"
          onClick={() => runSearch(filters)}
          disabled={isLoading}
        >
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </div>

      {/* Applied filters, visible and individually removable — otherwise people
          forget what's narrowing their results and think the list is broken. */}
      {activeCount > 0 && (
        <div className="search-chips">
          {filters.keyword?.trim() && (
            <button className="search-chips__chip" onClick={() => apply({ keyword: '' })}>
              “{filters.keyword.trim()}” <span aria-hidden="true">×</span>
            </button>
          )}
          {filters.skills?.map(s => (
            <button key={`sk-${s}`} className="search-chips__chip" onClick={() => apply({ skills: filters.skills!.filter(x => x !== s) })}>
              {s} <span aria-hidden="true">×</span>
            </button>
          ))}
          {filters.tools?.map(t => (
            <button key={`tl-${t}`} className="search-chips__chip" onClick={() => apply({ tools: filters.tools!.filter(x => x !== t) })}>
              {t} <span aria-hidden="true">×</span>
            </button>
          ))}
          {filters.languages?.map(l => (
            <button key={`lg-${l}`} className="search-chips__chip" onClick={() => apply({ languages: filters.languages!.filter(x => x !== l) })}>
              {l} <span aria-hidden="true">×</span>
            </button>
          ))}
          {filters.location?.trim() && (
            <button className="search-chips__chip" onClick={() => apply({ location: '' })}>
              {filters.location.trim()} <span aria-hidden="true">×</span>
            </button>
          )}
          {filters.availability && (
            <button className="search-chips__chip" onClick={() => apply({ availability: '' })}>
              {AVAILABILITY_LABEL[filters.availability]} <span aria-hidden="true">×</span>
            </button>
          )}
          {filters.maxRate != null && (
            <button className="search-chips__chip" onClick={() => apply({ maxRate: null })}>
              ≤ {filters.rateCurrency} {filters.maxRate} <span aria-hidden="true">×</span>
            </button>
          )}
          <button className="search-chips__clear" onClick={clearAll}>Clear all</button>
        </div>
      )}

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="search-filters">
          <div className="search-filters__grid">
            <TagInput
              label="Skills"
              value={filters.skills || []}
              onChange={(skills) => apply({ skills })}
              suggestions={options.skills}
              max={10}
              placeholder="e.g. Video editing"
            />
            <TagInput
              label="Tools"
              value={filters.tools || []}
              onChange={(tools) => apply({ tools })}
              suggestions={options.tools}
              max={10}
              placeholder="e.g. Premiere Pro"
            />
            <TagInput
              label="Languages"
              value={filters.languages || []}
              onChange={(languages) => apply({ languages })}
              suggestions={options.languages}
              max={10}
              placeholder="e.g. English"
            />

            <Autocomplete
              label="Location"
              value={filters.location || ''}
              onChange={(location) => setFilters({ ...filters, location })}
              suggestions={options.locations}
              placeholder="Any location"
            />

            <div className="search-filters__field">
              <label className="search-filters__label" htmlFor="flt-availability">Availability</label>
              <select
                id="flt-availability"
                className="search-filters__select"
                value={filters.availability || ''}
                onChange={(e) => apply({ availability: e.target.value as FreelancerAvailability | '' })}
              >
                <option value="">Any</option>
                <option value="AVAILABLE">Available now</option>
                <option value="OPEN_TO_OFFERS">Open to offers</option>
                <option value="BOOKED">Fully booked</option>
              </select>
            </div>

            {/* Rate needs a currency: ₹2,000/hr isn't "cheaper" than $50/hr */}
            <div className="search-filters__field">
              <label className="search-filters__label" htmlFor="flt-rate">Max rate</label>
              <div className="search-filters__rate">
                <select
                  className="search-filters__select"
                  value={filters.rateCurrency || ''}
                  onChange={(e) => apply({ rateCurrency: e.target.value, maxRate: e.target.value ? filters.maxRate : null })}
                >
                  <option value="">Currency</option>
                  {(options.currencies.length ? options.currencies : CURRENCIES.map(c => c.code)).map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <input
                  id="flt-rate"
                  type="number"
                  min={0}
                  className="search-filters__select"
                  placeholder="Any"
                  disabled={!filters.rateCurrency}
                  value={filters.maxRate ?? ''}
                  onChange={(e) => setFilters({ ...filters, maxRate: e.target.value ? Number(e.target.value) : null })}
                  onBlur={() => runSearch(filters)}
                />
              </div>
            </div>
          </div>

          {activeCount > 0 && (
            <button type="button" className="search-filters__clear" onClick={clearAll}>
              Clear all filters ({activeCount})
            </button>
          )}
        </div>
      )}

      {/* ── Results ── */}
      <div className="search-page__results">
        {isLoading ? (
          <VoxlaeLoader variant="section" label="Finding freelancers…" />
        ) : results.length > 0 ? (
          <>
            <p className="search-page__count">
              {isSuggesting ? (
                <>
                  <b>Suggested for you</b> · showing {results.length}
                  {stats && stats.listed > results.length && <> of {stats.listed}</>}
                  {' '}freelancer{results.length !== 1 ? 's' : ''}, strongest profiles first
                </>
              ) : (
                <>{results.length} freelancer{results.length !== 1 ? 's' : ''} match your filters</>
              )}
            </p>

            <div className="search-page__grid">
              {results.map((f) => (
                <article
                  key={f.userId}
                  className="fcard"
                  onClick={() => f.profileSlug && navigate(`/f/${f.profileSlug}`)}
                  role={f.profileSlug ? 'link' : undefined}
                  tabIndex={f.profileSlug ? 0 : undefined}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && f.profileSlug) {
                      e.preventDefault();
                      navigate(`/f/${f.profileSlug}`);
                    }
                  }}
                >
                  <div className="fcard__body">
                    <div className="fcard__head">
                      <Avatar src={f.avatarUrl} name={f.name} size={40} />
                      <div className="fcard__id">
                        <h3 className="fcard__name">{f.name}</h3>
                        {f.headline && <p className="fcard__headline">{f.headline}</p>}
                      </div>
                    </div>

                    <div className="fcard__chips">
                      {f.availability && (
                        <span className={`fcard__chip fcard__chip--${f.availability.toLowerCase()}`}>
                          {AVAILABILITY_LABEL[f.availability]}
                        </span>
                      )}
                      {f.location && <span className="fcard__chip">{f.location}</span>}
                      {formatRate(f.rateAmount, f.rateCurrency, f.rateUnit) && (
                        <span className="fcard__chip">
                          {formatRate(f.rateAmount, f.rateCurrency, f.rateUnit)}
                        </span>
                      )}
                    </div>

                    {f.skills?.length > 0 && (
                      <div className="fcard__tags">
                        {f.skills.slice(0, 4).map(s => (
                          <span key={s} className="fcard__tag">{s}</span>
                        ))}
                        {f.skills.length > 4 && (
                          <span className="fcard__tag fcard__tag--more">+{f.skills.length - 4}</span>
                        )}
                      </div>
                    )}

                    <div className="fcard__footer">
                      <span className="fcard__meta">
                        {f.projectCount} {f.projectCount === 1 ? 'project' : 'projects'}
                      </span>
                      <span className="fcard__view">View profile →</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : failed ? (
          <div className="search-page__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3>Couldn't load freelancers</h3>
            <p>Something went wrong reaching the server. This isn't an empty marketplace — try again.</p>
            <Button variant="secondary" onClick={() => runSearch(filters)}>Retry</Button>
          </div>
        ) : (
          <div className="search-page__empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <h3>{activeCount > 0 ? 'No freelancers match those filters' : 'No freelancers yet'}</h3>
            <p>
              {activeCount > 0
                ? 'Try removing a filter — you may have narrowed it too far.'
                : 'Nobody has published a complete profile yet. Check back soon.'}
            </p>
            {activeCount > 0 && (
              <Button variant="secondary" onClick={clearAll}>Clear filters</Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FreelancerSearchPage;
