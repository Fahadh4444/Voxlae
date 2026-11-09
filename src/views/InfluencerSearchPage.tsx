"use client";

/**
 * InfluencerSearchPage — For brands to discover influencers
 * 
 * Route: /brand/influencers
 * 
 * Features:
 * - Search by keyword (name)
 * - Filter by niche
 * - Card-based results
 * - Empty state
 * - Access control: INCOMPLETE users redirected to profile
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from '@/lib/router';
import { searchInfluencers } from '../api/services';
import { InfluencerSearchResult } from '../api/types';
import { useRoleStatus } from '../hooks/useRoleStatus';
import Button from '../components/common/Button';
import VoxlaeLoader from '../components/common/VoxlaeLoader';
import '../styles/pages/Search.css';

const InfluencerSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { isIncomplete, profileRoute, restrictionMessage } = useRoleStatus();

  const [keyword, setKeyword] = useState('');
  const [niche, setNiche] = useState('');
  const [results, setResults] = useState<InfluencerSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    if (isIncomplete) return;
    try {
      setIsLoading(true);
      setHasSearched(true);
      console.log('[InfluencerSearch] Searching with keyword:', keyword, 'niche:', niche);
      const data = await searchInfluencers(
        keyword.trim() || undefined,
        niche.trim() || undefined
      );
      console.log('[InfluencerSearch] Results received:', data.length, 'influencers');
      console.log('[InfluencerSearch] First result:', data[0]);
      setResults(data);
    } catch (error) {
      console.error('[InfluencerSearch] Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [keyword, niche, isIncomplete]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  // Load initial results on mount (all active influencers)
  useEffect(() => {
    if (!isIncomplete) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIncomplete]);

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
            <Button onClick={() => navigate(profileRoute)}>
              Go to Profile
            </Button>
          </div>
        </div>

    );
  }

  return (

      <div className="search-page">
        <header className="search-page__header">
          <h1>Find Influencers</h1>
          <p className="search-page__subtitle">
            Discover influencers to partner with for your campaigns
          </p>
        </header>

        {/* Search Controls */}
        <div className="search-page__controls">
          <div className="search-page__input-group">
            <div className="search-page__input-wrapper">
              <svg className="search-page__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="search-page__input"
                placeholder="Search by name..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="search-page__input-wrapper">
              <svg className="search-page__input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <input
                type="text"
                className="search-page__input"
                placeholder="Filter by niche..."
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </div>

        {/* Results */}
        <div className="search-page__results">
          {isLoading ? (
            <VoxlaeLoader variant="section" label="Searching…" />
          ) : results.length > 0 ? (
            <>
              <p className="search-page__count">
                {results.length} influencer{results.length !== 1 ? 's' : ''} found
              </p>
              <div className="search-page__grid">
                {results.map((influencer) => (
                  <div key={influencer.userId} className="search-card">
                    <div className="search-card__avatar">
                      {influencer.name?.charAt(0).toUpperCase() || 'I'}
                    </div>
                    <div className="search-card__body">
                      <h3 className="search-card__name">{influencer.name}</h3>
                      {influencer.niche && (
                        <div className="search-card__tags">
                          <span className="search-card__tag">{influencer.niche}</span>
                        </div>
                      )}
                      {influencer.location && (
                        <p className="search-card__meta">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }}>
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          {influencer.location}
                        </p>
                      )}
                    </div>
                    {/* No "View Profile" button: it navigated to /influencer/{userId}, a page that has
                        never existed. The Vite app's catch-all quietly sent that to "/", so the button
                        looked like it did something; under Next it is a 404. Restore it when influencer
                        profiles become public pages. */}
                  </div>
                ))}
              </div>
            </>
          ) : hasSearched ? (
            <div className="search-page__empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="8" x2="14" y2="14" />
                <line x1="14" y1="8" x2="8" y2="14" />
              </svg>
              <h3>No influencers found</h3>
              <p>Try adjusting your search terms or filters</p>
            </div>
          ) : null}
        </div>
      </div>

  );
};

export default InfluencerSearchPage;
