import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  /**
   * Migration debt, scoped to the code carried over from the Vite SPA.
   *
   * These are pre-existing patterns, not regressions — Vite's looser ESLint setup never flagged
   * them, and Next's config does. They are demoted to warnings rather than fixed in bulk for two
   * reasons: touching ~160 sites across code that was just moved would bury any real problem in
   * the diff, and a red `pnpm lint` is worthless as a gate on NEW code.
   *
   * They stay visible as warnings. New code under src/app, src/ai, src/lib and src/domains is
   * held to the full rule set.
   *
   * Counts when the port landed (2026-09-22):
   *   react/no-unescaped-entities     96  — cosmetic; mostly apostrophes in Privacy/Terms copy
   *   @typescript-eslint/no-explicit-any 31
   *   react-hooks/set-state-in-effect 29  — real perf smell; worth fixing per-file over time
   */
  {
    files: [
      "src/views/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/context/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/api/**/*.{ts,tsx}",
      "src/utils/**/*.{ts,tsx}",
    ],
    rules: {
      "react/no-unescaped-entities": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
