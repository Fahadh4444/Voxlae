import type { LanguageModel } from "ai";
import { resolveModel } from "./providers";

/**
 * Task → model binding.
 *
 * Every AI feature names a *task*, never a vendor. The task is bound to a concrete
 * `"<provider>:<model>"` reference here, overridable per environment, so you can run a cheap model
 * in dev and a strong one in prod — or move one task off Claude — without touching feature code.
 */

/** Falls back to Claude Opus 5, Anthropic's current default model. */
export const DEFAULT_MODEL =
  process.env.AI_DEFAULT_MODEL ?? "anthropic:claude-opus-5";

export const TASK_MODELS = {
  /** Tool-using assistant (see `agents.ts`). */
  assistant: process.env.AI_MODEL_ASSISTANT ?? DEFAULT_MODEL,
} as const;

export type TaskName = keyof typeof TASK_MODELS;

/** Resolve the model bound to a task. Throws if that provider has no credential configured. */
export function modelForTask(task: TaskName): LanguageModel {
  return resolveModel(TASK_MODELS[task]);
}
