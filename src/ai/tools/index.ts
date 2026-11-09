/**
 * Tool registry.
 *
 * Empty since the trends lookup was removed with the Trends feature. Each domain contributes read-only
 * lookups here, and any
 * state-changing tool should stay behind an explicit approval step rather than being handed to
 * an agent by default.
 */
export const assistantTools = {} as const;
