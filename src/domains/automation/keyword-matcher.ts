/**
 * Case-insensitive matching of a comment against an automation's keywords.
 * Ported from `KeywordMatcher`.
 */

export type KeywordMatchMode = "ANY_COMMENT" | "CONTAINS" | "EXACT_WORD";

/** Escape regex metacharacters — the equivalent of Java's `Pattern.quote`. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word match that behaves with emoji and unicode punctuation.
 *
 * `\b` is defined in terms of `[A-Za-z0-9_]`, so "link" inside "🔗link!" or "café-link" would not
 * match the way a human would expect. Lookarounds on letters-or-numbers (`\p{L}\p{N}`) give the
 * boundary people actually mean. Carried over verbatim from the Java, including the reasoning —
 * the `u` flag is required for `\p{...}` to work in JavaScript.
 */
function containsWholeWord(text: string, keyword: string): boolean {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegex(keyword)}(?![\\p{L}\\p{N}])`,
    "u",
  );
  return pattern.test(text);
}

export function matchesKeywords(
  mode: KeywordMatchMode,
  keywords: string[] | null | undefined,
  commentText: string | null | undefined,
): boolean {
  if (mode === "ANY_COMMENT") return true;
  if (!commentText || !keywords?.length) return false;

  const text = commentText.toLowerCase();
  for (const raw of keywords) {
    if (!raw?.trim()) continue;
    const keyword = raw.trim().toLowerCase();

    if (mode === "CONTAINS") {
      if (text.includes(keyword)) return true;
    } else if (mode === "EXACT_WORD") {
      if (containsWholeWord(text, keyword)) return true;
    }
  }
  return false;
}
