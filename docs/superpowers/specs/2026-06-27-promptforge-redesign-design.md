# PromptForge Redesign — Design

**Date:** 2026-06-27
**Status:** Approved (pending spec review)

## Problem

PromptForge's job is to take a prompt written in any language and produce a clear,
agent-ready instruction. Today it does not actually do this: `shared/promptForge.ts`
wraps the user's raw text in a fixed template string. It never rewrites the wording,
never translates, and pads the result with static "recommendations" and a "structure"
list that add noise. The UI is a busy faux-dashboard (sidebar, history table, usage
ring, coming-soon card) that distracts from the one action that matters.

## Goals

1. Genuinely rewrite a prompt into a clearer, agent-optimized instruction.
2. Always output **English**, regardless of the input language.
3. Strip the output down to just the optimized prompt.
4. Radically simplify the UI around that single transform.

Non-goals: real authentication, prompt history, usage enforcement, paid subscription.
These remain demo-only or are removed.

## Approach

### Engine — pluggable (LLM with heuristic fallback)

`shared/promptForge.ts` becomes the single source of truth for the transform, exposing
an async `optimizePrompt(input)` that returns `{ optimizedPrompt: string }`.

- **LLM path (when `ANTHROPIC_API_KEY` is set):** call the Claude API with a single
  non-streaming message. A system prompt instructs the model to (a) translate the input
  to English, (b) rewrite it as a clear, well-structured instruction for the chosen
  agent and purpose, and (c) return **only** the optimized prompt with no preamble or
  commentary. The user's raw prompt, the agent, and the purpose are passed in the user
  message.
  - SDK: `@anthropic-ai/sdk` (`npm install @anthropic-ai/sdk`), `client.messages.create`.
  - Model: `claude-haiku-4-5` by default (fast and cost-effective for a high-frequency
    rewrite), overridable via `ANTHROPIC_MODEL` env var.
  - `max_tokens: 2000`. No `thinking` config, to keep the interactive round-trip fast.
    On Haiku 4.5 a single `temperature` is allowed, but we omit sampling params and steer
    purely via the system prompt.
  - On API error (network, 4xx, 5xx): catch, log server-side, and fall back to the
    heuristic path so the endpoint always returns a usable result.
- **Heuristic path (no API key, or LLM failure):** a self-contained, dependency-free
  rewrite. It cannot truly translate arbitrary languages, but it produces a cleaned,
  structured English scaffold from the input (trim, collapse whitespace, wrap in a
  role/goal/instruction frame keyed off agent + purpose). This is the current template
  logic, trimmed to emit only the prompt string.

The agent (`codex` | `claude` | `general`) and purpose (`coder` | `tester` |
`code-review` | `general`) continue to shape the framing in both paths, as they do today.

The endpoint reports which path ran via a `mode: "ai" | "heuristic"` field so the UI can
show a small status hint. No other metadata is returned.

### Server

`server/server.ts` keeps its dependency-free `node:http` shape. The `POST /api/optimize`
handler becomes `async`, calls the new async `optimizePrompt`, and returns
`{ optimizedPrompt, mode }`. The in-memory `usedPrompts` counter and the `usage` field
are **removed** — usage limiting was always fake and the UI no longer shows it. The demo
auth endpoints (`/api/auth/*`) are removed since the UI drops sign-in. `/api/health`
stays.

### Response contract

```ts
// OptimizeRequest is unchanged except `language` is dropped (output is always English;
// input language is auto-detected by the model).
interface OptimizeRequest {
  prompt: string;
  agent: "codex" | "claude" | "general";
  purpose: "coder" | "tester" | "code-review" | "general";
}

interface OptimizeResponse {
  optimizedPrompt: string;
  mode: "ai" | "heuristic";
}
```

The 3-character minimum validation stays.

### UI — translator split, developer-dark

`src/main.tsx` is rewritten as a single focused screen (no router, still one file):

- **Top bar:** brand mark + name; UI-language switch (Uz/En/Ru, Uzbek default — only
  changes interface labels). No sign-in.
- **Control row:** Agent segmented chips + Purpose segmented chips, above the panes.
- **Two panes, side by side:**
  - Left = source: textarea (any language), a small char counter, Clear, and an
    Optimize button (disabled while loading or under 3 chars).
  - Right = result: the optimized English prompt, read-only, with a Copy button. Empty
    until the first optimize — no sample, no placeholder text beyond a faint hint.
- **Footer hint:** a subtle line reflecting `mode` — e.g. "AI rewriting" vs
  "Heuristic mode · set ANTHROPIC_API_KEY for full AI rewriting".

Removed entirely: sidebar nav, recent-history table/strip, usage ring, coming-soon card,
recommendations panel, structure list, detected-language badge, sign-in buttons.

**Visual style — developer dark:** near-black background (~`#0b0f17`), GitHub-style
panels (`#0d1117` surfaces, `#30363d` borders), blue (`#1f6feb`) primary accent with a
green (`#7ee787`) success accent, monospace for the prompt panes. `src/styles.css` is
rewritten to match; the old dashboard CSS is replaced, not extended.

The UI-language `copy` map shrinks to the labels the new screen actually uses.

## Components and boundaries

- `shared/promptForge.ts` — pure transform module. Exports `optimizePrompt(input):
  Promise<OptimizeResponse>` plus the shared types. Internally split into `callClaude()`
  (LLM path) and `heuristicOptimize()` (offline path); the public function tries the
  former when a key exists and falls back to the latter. Knows nothing about HTTP.
- `server/server.ts` — HTTP layer only. Validates, calls `optimizePrompt`, serializes.
- `src/main.tsx` — view layer only. One `fetch("/api/optimize")` call; renders the two
  panes and controls.

Import-extension rules still differ by build target (server `NodeNext` needs `.js`,
app `Bundler` is extensionless) — see CLAUDE.md.

## Error handling

- Missing/short prompt → 400 `{ error }` (unchanged).
- LLM call fails → server logs and falls back to heuristic; the user still gets a result
  with `mode: "heuristic"`. The request never 500s on an LLM failure.
- Other unexpected server errors → 500 `{ error }` (unchanged catch-all).
- Frontend: if `fetch` fails, show a brief inline error in the result pane and re-enable
  the Optimize button.

## Testing

- `shared/promptForge.test.ts` is updated: the heuristic path is synchronous-ish and
  deterministic, so test that `optimizePrompt` (with no API key in env) returns
  `mode: "heuristic"` and an English scaffold containing the agent framing and the user's
  intent. The LLM path is not unit-tested against the live API (no network in tests); if
  worth it, factor the prompt-building (system/user message construction) into a pure
  helper and assert on that.
- Keep `npm test` (vitest) green; keep `npm run typecheck` green for both build targets.

## Dependencies

Add `@anthropic-ai/sdk` to `dependencies`. The Dockerfile already runs `npm ci` +
`npm run build`, so no Dockerfile change is needed beyond the new package being present.
Document `ANTHROPIC_API_KEY` (and optional `ANTHROPIC_MODEL`) in the README alongside the
existing env vars; without the key the app still runs in heuristic mode.

## Out of scope

Real OAuth, persistence, per-user usage limits, streaming the result token-by-token,
and multi-prompt history. These can be revisited later; the spec deliberately removes the
fake versions rather than building them out.
