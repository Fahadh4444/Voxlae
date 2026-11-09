import { ToolLoopAgent, stepCountIs } from "ai";
import { modelForTask } from "./models";
import { assistantTools } from "./tools";

/**
 * Agent layer — the step past single LLM calls.
 *
 * An agent is a task-bound model plus a tool set and instructions. The model still comes from
 * `models.ts`, so agents stay as provider-agnostic as everything else: moving the assistant from
 * Claude to Gemini is an env change and the tools are untouched.
 *
 * Each agent is its own small factory rather than instances of a generic `defineAgent<TOOLS>`
 * helper. That is deliberate — the SDK infers whether a tool set needs a runtime context, and
 * that inference can't resolve through an unbound generic, so a generic wrapper forces a cast
 * that throws the tool-context type-safety away. Eight concrete lines per agent keeps it.
 *
 * Factories, not module-level instances: `modelForTask` throws when the chosen provider has no
 * credential, and that has to surface on the request that needs it rather than at import time,
 * or one unconfigured provider takes down the whole app at boot.
 */

/** Hard ceiling on tool-call rounds — the cheapest guard against a runaway bill. */
const MAX_STEPS = 8;

export function createAssistant() {
  return new ToolLoopAgent({
    id: "voxlae-assistant",
    model: modelForTask("assistant"),
    instructions: [
      "You are Voxlae's assistant, helping creators, brands and freelancers.",
      "Prefer calling a tool over guessing when a question is about real platform data.",
      "If a tool fails, say what failed plainly — never invent numbers or trends.",
      "Be concise and concrete.",
    ].join(" "),
    tools: assistantTools,
    stopWhen: stepCountIs(MAX_STEPS),
  });
}
