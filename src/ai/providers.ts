import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

/**
 * Provider registry — the swappable seam for "any LLM".
 *
 * Ported from the Python service's `ai/providers/` + `ai/core/router.py`, but the ~730 LOC of
 * hand-written HTTP adapters collapse into this file: the AI SDK already normalises every
 * provider onto one `LanguageModel` interface, so callers (`generateObject`, `streamText`, tool
 * calling, structured output) never learn which vendor answered.
 *
 * Adding a provider is one entry in `FACTORIES` plus its key in `API_KEY_ENV`. Nothing that
 * consumes a model changes.
 */

export const PROVIDER_IDS = [
  "anthropic",
  "openai",
  "google",
  "openrouter",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Which env var holds each provider's credential. */
const API_KEY_ENV: Record<ProviderId, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

type ModelFactory = (modelId: string) => LanguageModel;

/**
 * Factories are built lazily and cached. Lazily matters: a missing OPENAI_API_KEY must not break
 * a deployment that only ever calls Anthropic, so we resolve credentials at first use of *that*
 * provider rather than at import time.
 */
const FACTORIES: Record<ProviderId, () => ModelFactory> = {
  anthropic: () => {
    const provider = createAnthropic({ apiKey: apiKey("anthropic") });
    return (modelId) => provider(modelId);
  },
  openai: () => {
    const provider = createOpenAI({ apiKey: apiKey("openai") });
    return (modelId) => provider(modelId);
  },
  google: () => {
    const provider = createGoogle({ apiKey: apiKey("google") });
    return (modelId) => provider(modelId);
  },
  openrouter: () => {
    const provider = createOpenRouter({ apiKey: apiKey("openrouter") });
    return (modelId) => provider(modelId);
  },
};

const cache = new Map<ProviderId, ModelFactory>();

function apiKey(provider: ProviderId): string {
  const name = API_KEY_ENV[provider];
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env.local to use the "${provider}" provider, ` +
        `or point the task at a different provider.`,
    );
  }
  return value;
}

function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Resolve a `"<provider>:<model-id>"` reference into a ready-to-use model.
 *
 * The colon form is what makes model choice configuration rather than code — every call site
 * takes a string that ultimately comes from env, so switching a task from Claude to Gemini is a
 * deploy-time change with no rebuild of the calling code.
 *
 * @example resolveModel("anthropic:claude-opus-5")
 * @example resolveModel("openrouter:google/gemini-2.5-pro")
 */
export function resolveModel(ref: string): LanguageModel {
  const separator = ref.indexOf(":");
  if (separator === -1) {
    throw new Error(
      `Malformed model reference "${ref}". Expected "<provider>:<model-id>", ` +
        `e.g. "anthropic:claude-opus-5".`,
    );
  }

  const provider = ref.slice(0, separator);
  const modelId = ref.slice(separator + 1);

  if (!isProviderId(provider)) {
    throw new Error(
      `Unknown provider "${provider}" in "${ref}". Known providers: ${PROVIDER_IDS.join(", ")}.`,
    );
  }
  if (!modelId) {
    throw new Error(`Model reference "${ref}" is missing a model id after the colon.`);
  }

  let factory = cache.get(provider);
  if (!factory) {
    factory = FACTORIES[provider]();
    cache.set(provider, factory);
  }
  return factory(modelId);
}

/** Which providers currently have a usable credential. Drives the /api/ai/status probe. */
export function configuredProviders(): ProviderId[] {
  return PROVIDER_IDS.filter((id) => Boolean(process.env[API_KEY_ENV[id]]));
}
