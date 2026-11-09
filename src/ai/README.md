# AI layer

Provider-agnostic. Feature code names a **task**; a task is bound to a
`"<provider>:<model-id>"` string that comes from env. No feature file imports a vendor SDK.

```
providers.ts   registry: "<provider>:<model>" -> LanguageModel
models.ts      task -> model reference (env-overridable)
modules/       one folder per AI feature (none today — the Creator Plan, the only one, was removed)
```

## Swapping a model

Env only, no code change:

```bash
AI_MODEL_ASSISTANT="openrouter:google/gemini-2.5-pro"
```

## Adding a provider

1. `pnpm add @ai-sdk/<provider>`
2. Add its id to `PROVIDER_IDS`, its key to `API_KEY_ENV`, and a factory to `FACTORIES`.

That is the whole change — nothing that consumes a model is touched. Any provider with an AI SDK
package (or an OpenAI-compatible endpoint, including self-hosted/local models via `createOpenAI`
with a custom `baseURL`) drops in the same way.

## Why not the vendor SDKs directly

The Python service hand-wrote ~730 LOC of HTTP adapters to normalise four vendors. The AI SDK
already does that, and gives streaming, tool calling and structured output on the same interface —
so the adapters delete rather than port.

## Agents

Beyond one-shot calls, `agents.ts` builds tool-using agents on the same registry — so an agent is
as provider-swappable as a plain call.

```
agents.ts      task-bound model + tools + instructions -> ToolLoopAgent
tools/         one file per capability; registry in tools/index.ts
```

Each agent is its own small factory rather than instances of a generic `defineAgent<TOOLS>`.
The SDK infers whether a tool set needs a runtime context, and that inference can't resolve
through an unbound generic — a generic wrapper forces a cast that discards the tool-context type
safety. Eight concrete lines per agent keeps it.

Two standing rules for tools:

- **No generic "call any endpoint" tool.** An agent holding one can reach mutating endpoints.
  Each tool exposes exactly one operation with an explicit input schema.
- **`stopWhen` is mandatory.** Every agent caps its tool-call rounds; an agent that can't finish
  inside the cap stops rather than looping up a bill.
