/**
 * Automation create/update validation. Ports `AutomationService.applyDefaults` + `validate`.
 *
 * Kept as pure functions with no database access so every rule is testable directly — these are
 * the messages a creator actually sees when a form is rejected, and getting one wrong means either
 * a confusing error or a silently-broken automation.
 */

export type TargetMode = "ANY" | "SPECIFIC";
export type KeywordMatchMode = "ANY_COMMENT" | "CONTAINS" | "EXACT_WORD";
export type AutomationType = "KEYWORD_REPLY" | "KEYWORD_REPLY_FOLLOW_GATED";

export interface DmReplyInput {
  text?: string | null;
  linkUrl?: string | null;
  followPromptText?: string | null;
  unlockText?: string | null;
}

export interface AutomationInput {
  name?: string | null;
  type?: AutomationType | null;
  enabled?: boolean | null;
  targetMode?: TargetMode | null;
  includeFuturePosts?: boolean | null;
  keywordMatchMode?: KeywordMatchMode | null;
  keywords?: (string | null)[] | null;
  targets?: { mediaId?: string | null }[] | null;
  publicReplies?: (string | null)[] | null;
  dmReplies?: DmReplyInput[] | null;
}

/** Same shape after defaults, so callers downstream never handle nulls. */
export interface NormalizedAutomation {
  name: string;
  type: AutomationType;
  enabled: boolean;
  targetMode: TargetMode;
  includeFuturePosts: boolean;
  keywordMatchMode: KeywordMatchMode;
  keywords: string[];
  targets: { mediaId: string }[];
  publicReplies: string[];
  dmReplies: DmReplyInput[];
}

const notBlank = (s: string | null | undefined): s is string =>
  typeof s === "string" && s.trim().length > 0;

/**
 * Matches `http(s)://` links, `www.` hosts, and bare domains like "mysite.com/path".
 * Carried over verbatim, TLD list included — narrowing it would let links through, and widening
 * it would reject ordinary sentences.
 */
const URL_PATTERN =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|me|ly|link|shop|store|app|xyz|info|biz|in|us|uk)\b)/i;

export function containsUrl(value: string | null | undefined): boolean {
  return notBlank(value) && URL_PATTERN.test(value);
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Defaults applied before validation, matching `applyDefaults`. */
export function applyDefaults(input: AutomationInput): AutomationInput {
  return {
    ...input,
    targetMode: input.targetMode ?? "SPECIFIC",
    keywordMatchMode: input.keywordMatchMode ?? "CONTAINS",
    enabled: input.enabled ?? true,
    includeFuturePosts: input.includeFuturePosts ?? true,
    keywords: input.keywords ?? [],
    targets: input.targets ?? [],
    publicReplies: input.publicReplies ?? [],
    dmReplies: input.dmReplies ?? [],
  };
}

/**
 * Validate and normalize. Throws `ValidationError` with the creator-facing message.
 *
 * Rule order matters: the most specific, most actionable failure should win, so someone missing a
 * post target is told that rather than the generic "add a reply".
 */
export function validateAutomation(raw: AutomationInput): NormalizedAutomation {
  const r = applyDefaults(raw);

  if (!notBlank(r.name)) throw new ValidationError("Automation name is required");
  if (!r.type) throw new ValidationError("Automation type is required");

  const targets = (r.targets ?? [])
    .map((t) => t.mediaId)
    .filter(notBlank)
    .map((mediaId) => ({ mediaId: mediaId.trim() }));

  if (r.targetMode === "SPECIFIC" && targets.length === 0) {
    throw new ValidationError("Select at least one post, or choose 'Any post'");
  }

  const keywords = (r.keywords ?? []).filter(notBlank).map((k) => k.trim());
  if (r.keywordMatchMode !== "ANY_COMMENT" && keywords.length === 0) {
    throw new ValidationError("Add at least one keyword, or choose 'Any comment'");
  }

  const publicReplies = (r.publicReplies ?? []).filter(notBlank).map((p) => p.trim());
  const dmReplies = (r.dmReplies ?? []).filter(
    (d) =>
      notBlank(d.text) ||
      notBlank(d.linkUrl) ||
      notBlank(d.followPromptText) ||
      notBlank(d.unlockText),
  );

  if (publicReplies.length === 0 && dmReplies.length === 0) {
    throw new ValidationError("Add at least one reply (public or DM)");
  }

  /**
   * A link in a public comment reply gets the comment hidden by Instagram's spam filter, which
   * silently costs the post reach. Rejecting it with a clear fix is better than letting the
   * creator configure something that quietly degrades their account.
   */
  if (publicReplies.some(containsUrl)) {
    throw new ValidationError(
      "Remove the link from your public reply — Instagram hides comments that contain links. " +
        "Put the link in the DM instead.",
    );
  }

  if (r.type === "KEYWORD_REPLY_FOLLOW_GATED") {
    // The unlock may be a link OR just a message — require only that there is something to
    // deliver once the follow is verified.
    const hasUnlock = dmReplies.some(
      (d) => notBlank(d.unlockText) || notBlank(d.linkUrl),
    );
    if (!hasUnlock) {
      throw new ValidationError(
        "Add an unlock message or a link to deliver once they follow",
      );
    }
  }

  return {
    name: r.name.trim(),
    type: r.type,
    enabled: r.enabled ?? true,
    targetMode: r.targetMode ?? "SPECIFIC",
    includeFuturePosts: r.includeFuturePosts ?? true,
    keywordMatchMode: r.keywordMatchMode ?? "CONTAINS",
    keywords,
    targets,
    publicReplies,
    dmReplies,
  };
}
