# PromptForge Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PromptForge genuinely rewrite any-language prompts into clean, English, agent-ready instructions, and rebuild the UI around that single transform.

**Architecture:** `shared/promptForge.ts` becomes an async pluggable engine — it calls the Claude API when `ANTHROPIC_API_KEY` is set and falls back to a deterministic offline scaffold otherwise. The `node:http` server (`server/server.ts`) exposes one `POST /api/optimize` route returning `{ optimizedPrompt, mode }`. The React SPA (`src/main.tsx`) is a single translator-split screen in a developer-dark theme.

**Tech Stack:** TypeScript, React 19, Vite, `node:http`, vitest, `@anthropic-ai/sdk`.

## Global Constraints

- Two TS build targets with different import-extension rules: server (`server/tsconfig.json`, `NodeNext`) requires explicit `.js` extensions on relative imports even from `.ts`; app (`tsconfig.json`, `Bundler`) uses extensionless imports. Match the importing side.
- The frontend imports from `shared/promptForge` **type-only** (`import type`) — it must never import a runtime value from that module (keeps the Anthropic SDK out of the browser bundle).
- Default optimization model: `claude-haiku-4-5`, overridable via `ANTHROPIC_MODEL`. No `thinking` config, no sampling params.
- Output is always English; the result payload carries only `optimizedPrompt` and `mode` (`"ai" | "heuristic"`).
- App still runs with no API key (heuristic mode). The LLM path must never let an API failure 500 the request — catch and fall back.
- `npm test` (vitest) and `npm run typecheck` (both targets) must stay green. Tests must not make network calls.
- Keep the 3-character minimum prompt validation.
- While a request is in flight (`loading`), all action buttons (Optimize, Clear, Copy) must be disabled to prevent re-submitting or mutating state mid-request.

---

### Task 1: Add the Anthropic SDK dependency

**Files:**
- Modify: `package.json` (dependencies block)

**Interfaces:**
- Produces: `@anthropic-ai/sdk` available as a runtime dependency for `shared/promptForge.ts`.

- [ ] **Step 1: Add the dependency**

Edit `package.json` so the `dependencies` block reads:

```json
  "dependencies": {
    "@anthropic-ai/sdk": "^0.69.0",
    "lucide-react": "^0.468.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes without error; `node_modules/@anthropic-ai/sdk` exists.

- [ ] **Step 3: Verify the package resolves**

Run: `node -e "console.log(require('@anthropic-ai/sdk/package.json').version)"`
Expected: prints a version string (e.g. `0.69.x`).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add @anthropic-ai/sdk dependency"
```

---

### Task 2: Rewrite the optimization engine

**Files:**
- Modify (full rewrite): `shared/promptForge.ts`
- Modify (full rewrite): `shared/promptForge.test.ts`

**Interfaces:**
- Produces:
  - `type Agent = "codex" | "claude" | "general"`
  - `type Purpose = "coder" | "tester" | "code-review" | "general"`
  - `interface OptimizeRequest { prompt: string; agent: Agent; purpose: Purpose }`
  - `interface OptimizeResponse { optimizedPrompt: string; mode: "ai" | "heuristic" }`
  - `function buildSystemPrompt(agent: Agent, purpose: Purpose): string`
  - `function heuristicOptimize(input: OptimizeRequest): string`
  - `async function optimizePrompt(input: OptimizeRequest): Promise<OptimizeResponse>`
- Consumes: `@anthropic-ai/sdk` (Task 1).

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `shared/promptForge.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { buildSystemPrompt, heuristicOptimize, optimizePrompt } from "./promptForge";

describe("heuristicOptimize", () => {
  it("wraps the prompt in an English Codex scaffold", () => {
    const text = heuristicOptimize({
      prompt: "Add login with GitHub",
      agent: "codex",
      purpose: "coder",
    });
    expect(text).toContain("You are Codex");
    expect(text).toContain("Add login with GitHub");
    expect(text).toContain("Output format:");
  });
});

describe("buildSystemPrompt", () => {
  it("instructs translation to English for the chosen agent and purpose", () => {
    const sys = buildSystemPrompt("claude", "code-review");
    expect(sys).toContain("Translate");
    expect(sys).toContain("English");
    expect(sys).toContain("Claude");
    expect(sys).toContain("review the work for defects");
  });
});

describe("optimizePrompt", () => {
  it("falls back to heuristic mode when no API key is set", async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      const result = await optimizePrompt({
        prompt: "Add login with GitHub",
        agent: "codex",
        purpose: "coder",
      });
      expect(result.mode).toBe("heuristic");
      expect(result.optimizedPrompt).toContain("You are Codex");
    } finally {
      if (original !== undefined) process.env.ANTHROPIC_API_KEY = original;
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run shared/promptForge.test.ts`
Expected: FAIL — `buildSystemPrompt` / `heuristicOptimize` are not exported yet (the old module exported `optimizePrompt` with a different signature plus `detectLanguage`/`buildRecommendations`).

- [ ] **Step 3: Write the implementation**

Replace the entire contents of `shared/promptForge.ts` with:

```ts
import Anthropic from "@anthropic-ai/sdk";

export type Agent = "codex" | "claude" | "general";
export type Purpose = "coder" | "tester" | "code-review" | "general";

export interface OptimizeRequest {
  prompt: string;
  agent: Agent;
  purpose: Purpose;
}

export interface OptimizeResponse {
  optimizedPrompt: string;
  mode: "ai" | "heuristic";
}

const agentLabels: Record<Agent, string> = {
  codex: "Codex",
  claude: "Claude",
  general: "a general AI agent",
};

const purposeIntent: Record<Purpose, string> = {
  coder: "implement the requested software change",
  tester: "verify behavior, edge cases, and regressions",
  "code-review": "review the work for defects, risks, and missing tests",
  general: "complete the requested task clearly and accurately",
};

export function buildSystemPrompt(agent: Agent, purpose: Purpose): string {
  const label = agentLabels[agent];
  const intent = purposeIntent[purpose];
  return [
    `You are a prompt engineer. Rewrite the user's prompt into a single, clear, well-structured instruction for ${label}, whose goal is to ${intent}.`,
    "",
    "Rules:",
    "- Translate the prompt into English, regardless of its original language.",
    "- Preserve the user's original intent; do not invent requirements.",
    "- Produce a structured prompt with a clear goal, relevant context, explicit instructions, and an expected output format.",
    "- Output ONLY the rewritten prompt. No preamble, explanation, commentary, or surrounding quotes or markdown fences.",
  ].join("\n");
}

export function heuristicOptimize(input: OptimizeRequest): string {
  const label = agentLabels[input.agent];
  const intent = purposeIntent[input.purpose];
  const promptBody = input.prompt.trim() || "Describe the task here.";
  return [
    `You are ${label}. Your goal is to ${intent}.`,
    "",
    "Context:",
    promptBody,
    "",
    "Instructions:",
    "- Preserve the user's intent even if the original prompt is informal or multilingual.",
    "- Prefer concrete actions, explicit assumptions, and verifiable output.",
    "",
    "Output format:",
    "1. Brief understanding of the task.",
    "2. Completed answer or implementation plan.",
    "3. Verification, risks, or recommendations.",
  ].join("\n");
}

async function callClaude(input: OptimizeRequest): Promise<string> {
  const client = new Anthropic();
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: buildSystemPrompt(input.agent, input.purpose),
    messages: [{ role: "user", content: input.prompt }],
  });
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) throw new Error("Empty response from Claude");
  return text;
}

export async function optimizePrompt(input: OptimizeRequest): Promise<OptimizeResponse> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const optimizedPrompt = await callClaude(input);
      return { optimizedPrompt, mode: "ai" };
    } catch (error) {
      console.error("Claude optimize failed, using heuristic fallback:", error);
    }
  }
  return { optimizedPrompt: heuristicOptimize(input), mode: "heuristic" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run shared/promptForge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck both targets**

Run: `npm run typecheck`
Expected: app target FAILS — `src/main.tsx` still imports the removed `Language` type and uses the old response shape. That is fixed in Task 4. Confirm the **server** target (`tsc -p server/tsconfig.json --noEmit`) reports no errors about `shared/promptForge.ts` itself. (To check the shared module in isolation: `npx tsc -p server/tsconfig.json --noEmit` — server.ts will error until Task 3, but there must be no error originating in `shared/promptForge.ts`.)

- [ ] **Step 6: Commit**

```bash
git add shared/promptForge.ts shared/promptForge.test.ts
git commit -m "feat: rewrite engine as async pluggable optimizer (Claude + heuristic)"
```

---

### Task 3: Update the server route

**Files:**
- Modify (full rewrite): `server/server.ts`

**Interfaces:**
- Consumes: `optimizePrompt`, `OptimizeRequest` from `../shared/promptForge.js` (Task 2).
- Produces: `POST /api/optimize` → `{ optimizedPrompt, mode }`; `GET /api/health`; SPA static serving.

- [ ] **Step 1: Rewrite the server**

Replace the entire contents of `server/server.ts` with:

```ts
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { optimizePrompt, type OptimizeRequest } from "../shared/promptForge.js";

const port = Number(process.env.PORT || 4174);

const mimeTypes: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(process.cwd(), "dist", safePath);

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    const index = await readFile(join(process.cwd(), "dist", "index.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(index);
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, { ok: true, service: "promptforge-api" });
    }

    if (req.method === "POST" && url.pathname === "/api/optimize") {
      const body = (await readJson(req)) as OptimizeRequest;
      if (!body.prompt || body.prompt.trim().length < 3) {
        return sendJson(res, 400, { error: "Prompt must contain at least 3 characters." });
      }
      const result = await optimizePrompt(body);
      return sendJson(res, 200, result);
    }

    if (url.pathname.startsWith("/api/")) {
      return sendJson(res, 404, { error: "Not found" });
    }

    return serveStatic(req, res);
  } catch (error) {
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unexpected server error",
    });
  }
});

server.listen(port, () => {
  console.log(`PromptForge API listening on http://localhost:${port}`);
});
```

- [ ] **Step 2: Typecheck the server target**

Run: `npx tsc -p server/tsconfig.json --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add server/server.ts
git commit -m "feat: slim /api/optimize to async engine; drop demo auth and usage"
```

---

### Task 4: Rebuild the UI (translator split, developer-dark)

**Files:**
- Modify (full rewrite): `src/main.tsx`
- Modify (full rewrite): `src/styles.css`

**Interfaces:**
- Consumes (type-only): `Agent`, `Purpose`, `OptimizeResponse` from `../shared/promptForge` (Task 2).
- Produces: the single-screen UI; calls `POST /api/optimize` with `{ prompt, agent, purpose }`.

- [ ] **Step 1: Rewrite `src/main.tsx`**

Replace the entire contents of `src/main.tsx` with:

```tsx
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  CheckCircle2,
  Clipboard,
  Code2,
  FileCode2,
  Languages,
  MonitorCog,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Agent, OptimizeResponse, Purpose } from "../shared/promptForge";
import "./styles.css";

type Language = "uz" | "en" | "ru";

type Copy = {
  tagline: string;
  agent: string;
  purpose: string;
  promptLabel: string;
  placeholder: string;
  clear: string;
  optimize: string;
  optimizing: string;
  output: string;
  outputEmpty: string;
  copy: string;
  copied: string;
  error: string;
  aiMode: string;
  heuristicMode: string;
};

const copy: Record<Language, Copy> = {
  uz: {
    tagline: "Promptni agent tushunadigan inglizcha topshiriqqa aylantiring",
    agent: "Agent",
    purpose: "Maqsad",
    promptLabel: "Sizning promptingiz · istalgan til",
    placeholder: "Masalan: React ilovamga GitHub orqali login qo'shib ber...",
    clear: "Tozalash",
    optimize: "Optimallashtirish",
    optimizing: "...",
    output: "Optimallashtirilgan prompt · English",
    outputEmpty: "Optimallashtirilgan prompt shu yerda chiqadi.",
    copy: "Nusxalash",
    copied: "Nusxalandi",
    error: "Xatolik yuz berdi. Qayta urinib ko'ring.",
    aiMode: "AI rewriting",
    heuristicMode: "Heuristik rejim · to'liq AI uchun ANTHROPIC_API_KEY o'rnating",
  },
  en: {
    tagline: "Turn any prompt into an English, agent-ready instruction",
    agent: "Agent",
    purpose: "Purpose",
    promptLabel: "Your prompt · any language",
    placeholder: "Example: Add GitHub login to my React app...",
    clear: "Clear",
    optimize: "Optimize",
    optimizing: "...",
    output: "Optimized prompt · English",
    outputEmpty: "Your optimized prompt will appear here.",
    copy: "Copy",
    copied: "Copied",
    error: "Something went wrong. Try again.",
    aiMode: "AI rewriting",
    heuristicMode: "Heuristic mode · set ANTHROPIC_API_KEY for full AI rewriting",
  },
  ru: {
    tagline: "Преобразуйте любой промпт в понятную англоязычную инструкцию",
    agent: "Агент",
    purpose: "Назначение",
    promptLabel: "Ваш промпт · любой язык",
    placeholder: "Например: Добавь вход через GitHub в моё React-приложение...",
    clear: "Очистить",
    optimize: "Оптимизировать",
    optimizing: "...",
    output: "Оптимизированный промпт · English",
    outputEmpty: "Оптимизированный промпт появится здесь.",
    copy: "Скопировать",
    copied: "Скопировано",
    error: "Произошла ошибка. Попробуйте снова.",
    aiMode: "AI rewriting",
    heuristicMode: "Эвристический режим · установите ANTHROPIC_API_KEY для полного AI",
  },
};

const agents: Array<{ value: Agent; label: string; detail: string; icon: typeof Code2 }> = [
  { value: "codex", label: "Codex", detail: "Codebase changes", icon: Code2 },
  { value: "claude", label: "Claude", detail: "Long context", icon: Bot },
  { value: "general", label: "General", detail: "Any assistant", icon: Sparkles },
];

const purposes: Array<{ value: Purpose; label: string; icon: typeof Code2 }> = [
  { value: "coder", label: "Coder", icon: FileCode2 },
  { value: "tester", label: "Tester", icon: MonitorCog },
  { value: "code-review", label: "Code Review", icon: Search },
  { value: "general", label: "General", icon: Sparkles },
];

function App() {
  const [language, setLanguage] = useState<Language>("uz");
  const [agent, setAgent] = useState<Agent>("codex");
  const [purpose, setPurpose] = useState<Purpose>("coder");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const t = copy[language];

  async function optimize() {
    if (prompt.trim().length < 3) return;
    setLoading(true);
    setCopied(false);
    setError(false);
    try {
      const response = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, agent, purpose }),
      });
      if (!response.ok) throw new Error("request failed");
      const data = (await response.json()) as OptimizeResponse;
      setResult(data);
    } catch {
      setError(true);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPrompt("");
    setResult(null);
    setError(false);
    setCopied(false);
  }

  async function copyOutput() {
    if (!result) return;
    await navigator.clipboard.writeText(result.optimizedPrompt);
    setCopied(true);
  }

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={18} />
          </span>
          <div>
            <h1>PromptForge</h1>
            <p>{t.tagline}</p>
          </div>
        </div>
        <label className="language-select">
          <Languages size={16} />
          <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
            <option value="uz">Uz</option>
            <option value="en">En</option>
            <option value="ru">Ru</option>
          </select>
        </label>
      </header>

      <section className="controls">
        <div className="control-group">
          <span className="control-label">{t.agent}</span>
          <div className="segmented">
            {agents.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  className={agent === item.value ? "segment selected" : "segment"}
                  onClick={() => setAgent(item.value)}
                >
                  <Icon size={16} />
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="control-group">
          <span className="control-label">{t.purpose}</span>
          <div className="segmented">
            {purposes.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.value}
                  className={purpose === item.value ? "segment selected" : "segment"}
                  onClick={() => setPurpose(item.value)}
                >
                  <Icon size={16} />
                  <strong>{item.label}</strong>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panes">
        <section className="pane">
          <div className="pane-head">
            <span className="pane-label">{t.promptLabel}</span>
            <span className="counter">{prompt.trim().length} / 4000</span>
          </div>
          <textarea
            className="prompt-input"
            value={prompt}
            maxLength={4000}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t.placeholder}
          />
          <div className="pane-actions">
            <button className="ghost" disabled={loading} onClick={reset}>
              {t.clear}
            </button>
            <button className="primary" disabled={loading || prompt.trim().length < 3} onClick={optimize}>
              <Wand2 size={16} />
              {loading ? t.optimizing : t.optimize}
            </button>
          </div>
        </section>

        <section className="pane result">
          <div className="pane-head">
            <span className="pane-label">{t.output}</span>
            <button className="icon-button" disabled={!result || loading} onClick={copyOutput}>
              {copied ? <CheckCircle2 size={16} /> : <Clipboard size={16} />}
              <span>{copied ? t.copied : t.copy}</span>
            </button>
          </div>
          <pre className={error ? "result-box error-text" : "result-box"}>
            {error ? t.error : result ? result.optimizedPrompt : t.outputEmpty}
          </pre>
        </section>
      </section>

      <footer className="footer">{result?.mode === "ai" ? t.aiMode : t.heuristicMode}</footer>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 2: Rewrite `src/styles.css`**

Replace the entire contents of `src/styles.css` with:

```css
:root {
  --bg: #0b0f17;
  --surface: #0d1117;
  --surface-2: #11161f;
  --border: #30363d;
  --text: #e6edf3;
  --muted: #8b949e;
  --accent: #1f6feb;
  --accent-hover: #388bfd;
  --success: #7ee787;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: 28px 24px 40px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  min-height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), #0a3a8c);
  color: #fff;
}

.brand h1 {
  margin: 0;
  font-size: 18px;
  letter-spacing: -0.01em;
}

.brand p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--muted);
}

.language-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
}

.language-select select {
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.language-select option {
  background: var(--surface);
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 22px;
}

.control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.segmented {
  display: flex;
  gap: 6px;
}

.segment {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 8px 12px;
  min-width: 84px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.segment:hover {
  border-color: #485058;
  color: var(--text);
}

.segment.selected {
  border-color: var(--accent);
  background: rgba(31, 111, 235, 0.12);
  color: var(--text);
}

.segment strong {
  font-size: 13px;
  font-weight: 600;
}

.segment small {
  font-size: 11px;
  color: var(--muted);
}

.panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  flex: 1;
  min-height: 360px;
}

.pane {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  padding: 14px;
  min-height: 0;
}

.pane.result {
  background: var(--surface-2);
}

.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.pane-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.counter {
  font-size: 11px;
  color: var(--muted);
}

.prompt-input {
  flex: 1;
  resize: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  padding: 12px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.5;
  outline: none;
}

.prompt-input:focus {
  border-color: var(--accent);
}

.pane-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
}

.ghost {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.ghost:hover {
  color: var(--text);
  border-color: #485058;
}

.primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: none;
  background: var(--accent);
  color: #fff;
  padding: 9px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted);
  padding: 5px 10px;
  border-radius: 7px;
  font-size: 12px;
  cursor: pointer;
}

.icon-button:hover:not(:disabled) {
  color: var(--success);
  border-color: #2c5a36;
}

.icon-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.result-box {
  flex: 1;
  margin: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  padding: 12px;
  font-family: var(--mono);
  font-size: 13px;
  line-height: 1.5;
  color: var(--success);
  white-space: pre-wrap;
  word-break: break-word;
  overflow: auto;
}

.result-box.error-text {
  color: #ff7b72;
}

.footer {
  text-align: center;
  font-size: 11.5px;
  color: var(--muted);
}

@media (max-width: 760px) {
  .panes {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Typecheck both targets**

Run: `npm run typecheck`
Expected: PASS (both app and server targets, no errors).

- [ ] **Step 4: Build to confirm the bundle is clean**

Run: `npm run build`
Expected: Vite build succeeds and `tsc -p server/tsconfig.json` succeeds; `dist/` and `dist-node/` are produced with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/main.tsx src/styles.css
git commit -m "feat: rebuild UI as developer-dark translator split"
```

---

### Task 5: Update env documentation

**Files:**
- Modify: `README.md` (the "Optional OAuth environment variables" block)

**Interfaces:**
- Produces: documented `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL`.

- [ ] **Step 1: Replace the OAuth env section**

In `README.md`, replace this block:

```
Optional OAuth environment variables:

\`\`\`sh
GOOGLE_CLIENT_ID=
GOOGLE_REDIRECT_URI=
GITHUB_CLIENT_ID=
GITHUB_REDIRECT_URI=
\`\`\`

Without these values, the sign-in buttons use a local demo response so the interface remains testable.
```

with:

```
Optional environment variables:

\`\`\`sh
ANTHROPIC_API_KEY=   # enables real AI rewriting + translation
ANTHROPIC_MODEL=     # optional, defaults to claude-haiku-4-5
\`\`\`

Without `ANTHROPIC_API_KEY`, PromptForge runs in heuristic mode: it still returns a structured English scaffold, but cannot truly translate arbitrary languages or deeply rewrite.
```

(Use literal triple backticks in the file — they are escaped above only to keep this plan's fences intact.)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document ANTHROPIC_API_KEY / ANTHROPIC_MODEL env vars"
```

---

## Self-Review Notes

- **Spec coverage:** Engine pluggable LLM+heuristic (Task 2) ✓; English-only output via system prompt + heuristic scaffold (Task 2) ✓; output trimmed to `{ optimizedPrompt, mode }` (Tasks 2–3) ✓; controls Agent/Purpose/UI-language kept, sign-in/history/usage removed (Tasks 3–4) ✓; translator-split developer-dark UI (Task 4) ✓; `mode` footer hint (Task 4) ✓; tests no-network + typecheck green (Tasks 2, 4) ✓; SDK dependency + README env docs (Tasks 1, 5) ✓.
- **Type consistency:** `OptimizeRequest` (no `language`) and `OptimizeResponse` (`optimizedPrompt`, `mode`) are defined in Task 2 and consumed identically in Tasks 3 (server) and 4 (frontend `fetch` body sends `{ prompt, agent, purpose }`; reads `optimizedPrompt`/`mode`). `buildSystemPrompt`/`heuristicOptimize`/`optimizePrompt` signatures match between Task 2 definition and Task 2 tests.
- **Removed symbols:** old exports `detectLanguage`, `buildRecommendations`, `Language`, and the old `usage`/`recommendations`/`structure` response fields are gone; no task references them. The old demo `/api/auth/*` routes and `usedPrompts` counter are removed in Task 3 and not referenced by the new frontend.
