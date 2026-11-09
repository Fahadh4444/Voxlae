"use client";

/**
 * AutomationBuilder — create/edit form for a comment automation, with a live DM/comment preview.
 * Single scrollable form (mobile-first); on wide screens the preview sticks beside it.
 */
import React, { useState } from 'react';
import {
  AutomationDTO,
  AutomationRequest,
  AutomationTarget,
  AutomationType,
  DmReply,
  KeywordMatchMode,
  TargetMode,
} from '../../api/types';
import { createAutomation, updateAutomation } from '../../api/services';
import PostPicker from './PostPicker';

interface Props {
  editing: AutomationDTO | null;
  onSaved: () => void;
  onCancel: () => void;
}

const FOLLOW_GATED: AutomationType = 'KEYWORD_REPLY_FOLLOW_GATED';

// Start creators with a few distinct variants — rotating genuinely different wording keeps replies
// well under Instagram's spam-similarity threshold and protects the post's reach.
const MAX_VARIANTS = 5;
const DEFAULT_PUBLIC_REPLIES = ['Just sent you a DM 📩', 'Check your inbox 👀', 'Sent it your way 🙌'];
const DEFAULT_DM_VARIANTS = [
  "Here's the link you asked for 👇",
  'Here you go 🙌',
  "As promised — here's your link 👇",
];

// Mirrors the backend guard: http(s)://, www., or a bare domain like "mysite.com/path".
const URL_IN_TEXT = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|me|ly|link|shop|store|app|xyz|info|biz|in|us|uk)\b)/i;

const AutomationBuilder: React.FC<Props> = ({ editing, onSaved, onCancel }) => {
  const [name, setName] = useState(editing?.name || '');
  const [type, setType] = useState<AutomationType>(editing?.type || 'KEYWORD_REPLY');
  const [targetMode, setTargetMode] = useState<TargetMode>(editing?.targetMode || 'SPECIFIC');
  const [includeFuturePosts, setIncludeFuturePosts] = useState(editing?.includeFuturePosts ?? true);
  const [matchMode, setMatchMode] = useState<KeywordMatchMode>(editing?.keywordMatchMode || 'CONTAINS');
  const [keywords, setKeywords] = useState<string[]>(editing?.keywords || []);
  const [keywordInput, setKeywordInput] = useState('');
  const [targets, setTargets] = useState<AutomationTarget[]>(editing?.targets || []);
  const [publicReplies, setPublicReplies] = useState<string[]>(
    editing?.publicReplies?.length ? editing.publicReplies : DEFAULT_PUBLIC_REPLIES,
  );
  const [dmVariants, setDmVariants] = useState<string[]>(
    editing && editing.type === 'KEYWORD_REPLY'
      ? editing.dmReplies.map((d) => d.text || '')
      : DEFAULT_DM_VARIANTS,
  );
  const firstDm: DmReply | undefined = editing?.dmReplies?.[0];
  const [linkUrl, setLinkUrl] = useState(firstDm?.linkUrl || '');
  const [followPrompt, setFollowPrompt] = useState(
    firstDm?.followPromptText || 'Follow me and tap the button below to unlock the link 🔓',
  );
  const [unlockText, setUnlockText] = useState(firstDm?.unlockText || "You're in! Here's your link 👇");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isGated = type === FOLLOW_GATED;
  const publicVariantCount = publicReplies.filter((t) => t.trim()).length;
  const dmVariantCount = dmVariants.filter((t) => t.trim()).length;

  // ---- keyword tag helpers ----
  const addKeyword = () => {
    const k = keywordInput.trim();
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setKeywordInput('');
  };
  const removeKeyword = (k: string) => setKeywords(keywords.filter((x) => x !== k));

  // ---- variant helpers ----
  const updateArr = (arr: string[], i: number, v: string) => arr.map((x, idx) => (idx === i ? v : x));

  const buildRequest = (): AutomationRequest => {
    const dmReplies: DmReply[] = isGated
      ? [{ linkUrl, followPromptText: followPrompt, unlockText }]
      : dmVariants.filter((t) => t.trim() || linkUrl).map((t) => ({ text: t, linkUrl }));
    return {
      name: name.trim(),
      type,
      enabled: editing?.enabled ?? true,
      targetMode,
      includeFuturePosts,
      keywordMatchMode: matchMode,
      keywords: matchMode === 'ANY_COMMENT' ? [] : keywords,
      targets: targetMode === 'SPECIFIC' ? targets : [],
      publicReplies: publicReplies.filter((t) => t.trim()),
      dmReplies,
    };
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Give your automation a name.';
    if (targetMode === 'SPECIFIC' && targets.length === 0) return 'Pick at least one post, or choose "Any post".';
    if (matchMode !== 'ANY_COMMENT' && keywords.length === 0) return 'Add at least one keyword, or choose "Any comment".';
    const hasPublic = publicReplies.some((t) => t.trim());
    const hasDm = isGated ? !!(followPrompt.trim() || unlockText.trim() || linkUrl.trim()) : dmVariants.some((t) => t.trim()) || !!linkUrl.trim();
    if (!hasPublic && !hasDm) return 'Add at least one reply (public or DM).';
    // Links in a public comment get the comment hidden by Instagram — the link belongs in the DM.
    if (publicReplies.some((t) => URL_IN_TEXT.test(t)))
      return 'Remove the link from your public reply — Instagram hides comments with links. Put it in the DM instead.';
    // The unlock can be a message or a link (or both) — just not empty.
    if (isGated && !unlockText.trim() && !linkUrl.trim()) return 'Add an unlock message or a link to deliver once they follow.';
    return null;
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) await updateAutomation(editing.id, buildRequest());
      else await createAutomation(buildRequest());
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Could not save the automation.');
      setSaving(false);
    }
  };

  const previewKeyword = keywords[0] || 'LINK';

  return (
    <div className="autos-builder">
      {/* ---------------- FORM ---------------- */}
      <div>
        {error && <div className="autos-error">{error}</div>}

        <div className="autos-section">
          <div className="autos-field">
            <label>Automation name</label>
            <input className="autos-input" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Free guide DM" />
          </div>
        </div>

        {/* Type */}
        <div className="autos-section">
          <h3>What should happen?</h3>
          <div className="autos-choices">
            <div className={`autos-choice${!isGated ? ' selected' : ''}`} onClick={() => setType('KEYWORD_REPLY')}>
              <strong>Reply + DM the link</strong>
              <span>Public reply and DM the link to anyone who comments.</span>
            </div>
            <div className={`autos-choice${isGated ? ' selected' : ''}`} onClick={() => setType(FOLLOW_GATED)}>
              <strong>Unlock only for followers</strong>
              <span>Ask non-followers to follow first, then deliver the link.</span>
            </div>
          </div>
          {isGated && (
            <div className="autos-note" style={{ marginTop: 12 }}>
              Instagram can't tell us if a commenter follows you until they tap a button in the DM — so we
              send a "Follow &amp; verify" prompt first, then unlock the link once they've followed.
            </div>
          )}
        </div>

        {/* Trigger */}
        <div className="autos-section">
          <h3>Trigger</h3>
          <div className="autos-field">
            <label>When a comment…</label>
            <select className="autos-select" value={matchMode} onChange={(e) => setMatchMode(e.target.value as KeywordMatchMode)}>
              <option value="CONTAINS">contains a keyword</option>
              <option value="EXACT_WORD">is exactly a keyword</option>
              <option value="ANY_COMMENT">is any comment</option>
            </select>
          </div>
          {matchMode !== 'ANY_COMMENT' && (
            <div className="autos-field">
              <label>Keywords</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="autos-input" value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                  placeholder="Type a word and press Enter" />
                <button className="autos-btn autos-btn-ghost" onClick={addKeyword} type="button">Add</button>
              </div>
              <div className="autos-tags">
                {keywords.map((k) => (
                  <span className="autos-tag" key={k}>{k}<button onClick={() => removeKeyword(k)} type="button">×</button></span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Target */}
        <div className="autos-section">
          <h3>Which posts?</h3>
          <div className="autos-choices">
            <div className={`autos-choice${targetMode === 'SPECIFIC' ? ' selected' : ''}`} onClick={() => setTargetMode('SPECIFIC')}>
              <strong>Specific posts</strong>
              <span>Pick the posts/reels this applies to.</span>
            </div>
            <div className={`autos-choice${targetMode === 'ANY' ? ' selected' : ''}`} onClick={() => setTargetMode('ANY')}>
              <strong>Any post / reel</strong>
              <span>Applies across your whole account.</span>
            </div>
          </div>

          {targetMode === 'SPECIFIC' && (
            <div style={{ marginTop: 12 }}>
              <button className="autos-btn autos-btn-ghost" onClick={() => setPickerOpen(true)} type="button">
                {targets.length ? `Edit posts (${targets.length})` : 'Choose posts'}
              </button>
              <div className="autos-posts">
                {targets.map((t) => (
                  <div className="autos-post-chip" key={t.mediaId}>
                    {t.thumbnailUrl && <img src={t.thumbnailUrl} alt="selected post" />}
                    <button type="button" onClick={() => setTargets(targets.filter((x) => x.mediaId !== t.mediaId))}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {targetMode === 'ANY' && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, fontSize: '0.875rem' }}>
              <input type="checkbox" checked={includeFuturePosts} onChange={(e) => setIncludeFuturePosts(e.target.checked)} />
              Also apply to posts I publish in the future
            </label>
          )}
        </div>

        {/* Public reply */}
        <div className="autos-section">
          <h3>Public reply <span style={{ fontWeight: 400, color: 'var(--vx-gray-400)' }}>(optional)</span></h3>
          <p className="hint">Posted under the comment. Add a few variants — we rotate them so replies look natural. 3–5 is best.</p>
          {publicReplies.map((val, i) => (
            <div className="autos-variant" key={i}>
              <textarea className="autos-textarea" value={val} placeholder="e.g. Check your DMs 📩"
                onChange={(e) => setPublicReplies(updateArr(publicReplies, i, e.target.value))} />
              {publicReplies.length > 1 && (
                <button className="autos-x" type="button" onClick={() => setPublicReplies(publicReplies.filter((_, idx) => idx !== i))}>×</button>
              )}
            </div>
          ))}
          {publicVariantCount === 1 && (
            <div className="autos-note">
              Using a single public reply is riskier for your reach — Instagram can hide comments that
              repeat. Add 2–3 more variants so they rotate naturally.
            </div>
          )}
          {publicReplies.length < MAX_VARIANTS && (
            <button className="autos-add" type="button" onClick={() => setPublicReplies([...publicReplies, ''])}>+ Add variant</button>
          )}
        </div>

        {/* DM */}
        <div className="autos-section">
          <h3>Direct message</h3>
          {!isGated ? (
            <>
              <p className="hint">Sent as a DM. Add variants to rotate — 3–5 keeps your messages looking natural.</p>
              {dmVariants.map((val, i) => (
                <div className="autos-variant" key={i}>
                  <textarea className="autos-textarea" value={val} placeholder="e.g. Here's the link you wanted 👇"
                    onChange={(e) => setDmVariants(updateArr(dmVariants, i, e.target.value))} />
                  {dmVariants.length > 1 && (
                    <button className="autos-x" type="button" onClick={() => setDmVariants(dmVariants.filter((_, idx) => idx !== i))}>×</button>
                  )}
                </div>
              ))}
              {dmVariantCount === 1 && (
                <div className="autos-note">
                  A single DM sent to everyone looks automated. Add 2–3 variants so each person gets
                  slightly different wording.
                </div>
              )}
              {dmVariants.length < MAX_VARIANTS && (
                <button className="autos-add" type="button" onClick={() => setDmVariants([...dmVariants, ''])}>+ Add variant</button>
              )}
            </>
          ) : (
            <>
              <div className="autos-field">
                <label>Follow prompt (sent first)</label>
                <textarea className="autos-textarea" value={followPrompt} onChange={(e) => setFollowPrompt(e.target.value)} />
              </div>
              <div className="autos-field">
                <label>Unlock message (after they follow)</label>
                <textarea className="autos-textarea" value={unlockText} onChange={(e) => setUnlockText(e.target.value)} />
              </div>
            </>
          )}
          <div className="autos-field" style={{ marginTop: 12 }}>
            <label>Link to send <span style={{ fontWeight: 400, color: 'var(--vx-gray-400)' }}>(optional)</span></label>
            <input className="autos-input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://… (leave empty to send just a message)" />
          </div>
        </div>

        <div className="autos-actions">
          <button className="autos-btn autos-btn-ghost" onClick={onCancel} type="button">Cancel</button>
          <button className="autos-btn autos-btn-primary" onClick={handleSave} disabled={saving} type="button">
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create automation'}
          </button>
        </div>
      </div>

      {/* ---------------- PREVIEW ---------------- */}
      <div className="autos-preview">
        <div className="autos-section">
          <h3>Preview</h3>
          <div className="autos-preview-label">On your post</div>
          <div className="autos-phone">
            <div className="autos-bubble autos-bubble-them">💬 {previewKeyword}</div>
            {publicReplies[0]?.trim() && (
              <div className="autos-bubble autos-bubble-us">{publicReplies[0]}</div>
            )}
          </div>
          <div className="autos-preview-label">In DMs</div>
          <div className="autos-phone">
            {!isGated ? (
              <div className="autos-bubble autos-bubble-us">
                {dmVariants[0] || 'Your DM message'}
                {linkUrl && <><br />{linkUrl}</>}
              </div>
            ) : (
              <>
                <div className="autos-bubble autos-bubble-us">
                  {followPrompt}
                  <span className="autos-bubble-btn">I'm following ✅</span>
                </div>
                <div className="autos-preview-label">After they follow</div>
                <div className="autos-bubble autos-bubble-us">
                  {unlockText}
                  {linkUrl && <><br />{linkUrl}</>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {pickerOpen && (
        <PostPicker
          initial={targets}
          onClose={() => setPickerOpen(false)}
          onDone={(t) => { setTargets(t); setPickerOpen(false); }}
        />
      )}
    </div>
  );
};

export default AutomationBuilder;
