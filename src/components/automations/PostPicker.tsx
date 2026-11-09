"use client";

/**
 * PostPicker — modal for choosing which post(s)/reel(s) an automation applies to.
 * Loads the account's media 25 at a time ("Load more") and supports pasting a permalink.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AutomationTarget, MediaItem } from '../../api/types';
import { fetchAutomationMedia, resolveMediaLink } from '../../api/services';
import VoxlaeLoader from '../common/VoxlaeLoader';

interface Props {
  initial: AutomationTarget[];
  onDone: (targets: AutomationTarget[]) => void;
  onClose: () => void;
}

const toTarget = (m: MediaItem): AutomationTarget => ({
  mediaId: m.id,
  permalink: m.permalink,
  thumbnailUrl: m.thumbnailUrl || m.mediaUrl,
  caption: m.caption,
});

const PostPicker: React.FC<Props> = ({ initial, onDone, onClose }) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, AutomationTarget>>(
    Object.fromEntries(initial.map((t) => [t.mediaId, t])),
  );
  const [pasteUrl, setPasteUrl] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadPage = useCallback(async (after?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchAutomationMedia(after);
      setItems((prev) => (after ? [...prev, ...page.items] : page.items));
      setCursor(page.nextCursor ?? null);
    } catch (e: any) {
      setError(e?.message || 'Could not load your posts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const toggle = (m: MediaItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[m.id]) delete next[m.id];
      else next[m.id] = toTarget(m);
      return next;
    });
  };

  const handlePaste = async () => {
    if (!pasteUrl.trim()) return;
    setResolving(true);
    setError(null);
    try {
      const m = await resolveMediaLink(pasteUrl.trim());
      if (m && m.id) {
        setSelected((prev) => ({ ...prev, [m.id]: toTarget(m) }));
        setPasteUrl('');
      } else {
        setError("Couldn't find that post on your account.");
      }
    } catch (e: any) {
      setError(e?.message || 'Could not resolve that link.');
    } finally {
      setResolving(false);
    }
  };

  const selectedCount = Object.keys(selected).length;

  return (
    <div className="autos-modal-backdrop" onClick={onClose}>
      <div className="autos-modal" onClick={(e) => e.stopPropagation()}>
        <div className="autos-modal-head">
          <h3>Choose posts ({selectedCount})</h3>
          <button className="autos-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="autos-modal-body">
          <div className="autos-paste">
            <input
              className="autos-input"
              placeholder="Paste a post or reel link…"
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
            />
            <button className="autos-btn autos-btn-ghost" onClick={handlePaste} disabled={resolving}>
              {resolving ? 'Adding…' : 'Add'}
            </button>
          </div>

          {error && <div className="autos-error">{error}</div>}

          <div className="autos-grid">
            {items.map((m) => (
              <div
                key={m.id}
                className={`autos-grid-item${selected[m.id] ? ' selected' : ''}`}
                onClick={() => toggle(m)}
              >
                {(m.thumbnailUrl || m.mediaUrl) && (
                  <img src={m.thumbnailUrl || m.mediaUrl} alt={m.caption?.slice(0, 40) || 'post'} />
                )}
                {selected[m.id] && <span className="check">✓</span>}
              </div>
            ))}
          </div>

          {items.length === 0 && !loading && (
            <p style={{ textAlign: 'center', color: 'var(--vx-gray-500)', padding: 24 }}>
              No posts found. Paste a link above.
            </p>
          )}

          {cursor && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <button className="autos-btn autos-btn-ghost" onClick={() => loadPage(cursor)} disabled={loading}>
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
          {loading && items.length === 0 && (
            <VoxlaeLoader variant="section" label="Loading your posts…" />
          )}
        </div>
        <div className="autos-modal-head" style={{ borderTop: '1px solid var(--vx-gray-200)', borderBottom: 'none' }}>
          <button className="autos-btn autos-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="autos-btn autos-btn-primary" onClick={() => onDone(Object.values(selected))}>
            Done ({selectedCount})
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostPicker;
