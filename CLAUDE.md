# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev        # Vite dev server (5173) + tsx-watched API server (4174), via concurrently
npm run build      # vite build → dist/, then tsc server build → dist-node/
npm start          # run the production server from dist-node/ (serves dist/ + API)
npm test           # run vitest once
npm run typecheck  # type-check both the app (tsconfig.json) and server (server/tsconfig.json)

npx vitest run shared/promptForge.test.ts   # single test file
npx vitest -t "structured Codex prompt"     # single test by name
```

Local dev: open `http://localhost:5173` (Vite proxies `/api/*` to the API on 4174).
Production/Docker (`docker compose up --build`): everything served from port 4174.

## Architecture

Three-part TypeScript project with **two separate TS build targets** sharing one core module.

- **`shared/promptForge.ts`** — the entire prompt-optimization engine and the single source of truth for the `OptimizeRequest`/`OptimizeResponse` types, `Agent`/`Purpose`/`Language` unions, language detection, and recommendation logic. It is pure (no I/O) and is consumed by all three of: the server, the frontend (types only), and the tests. Behavior changes to optimization belong here, not in the server or UI.
- **`server/server.ts`** — a dependency-free `node:http` server (no Express). Handles the `/api/*` routes (`/api/health`, `/api/auth/providers`, `/api/auth/demo`, `/api/optimize`) and falls back to serving the built SPA from `dist/` for everything else, with index.html as the SPA catch-all.
- **`src/main.tsx`** — the entire React 19 SPA in one file: trilingual UI (uz/en/ru via the `copy` map, Uzbek default), agent/purpose selectors, and a `fetch("/api/optimize")` call. Styling is plain CSS in `src/styles.css`; icons from `lucide-react`. There is no router and no component split.

### Critical build-system detail: import extensions differ by target

The app (`src/`, `vite.config.ts`) uses `moduleResolution: Bundler`, so it imports shared code **without** an extension:
```ts
import type { Agent } from "../shared/promptForge";
```
The server (`server/tsconfig.json`) uses `NodeNext`, which requires explicit `.js` extensions on relative imports **even from `.ts` files**:
```ts
import { optimizePrompt } from "../shared/promptForge.js";
```
When adding cross-module imports, match the convention of the importing side or the build will break. The server build compiles `server/` + `shared/` to `dist-node/` (tests excluded); the Vite build emits the frontend to `dist/`.

### Things that look real but are stubs

- **OAuth is demo-only.** Without `GOOGLE_CLIENT_ID` / `GITHUB_CLIENT_ID` env vars, `authUrl()` returns `/api/auth/demo`, and the frontend "sign in" buttons just call the demo endpoint. There is no session, token exchange, or callback handler implemented.
- **Usage limiting is fake.** `usedPrompts` is a single in-memory module-level counter in `server.ts`, shared across all clients and capped at 10. It is not per-user and resets on restart — it exists to demo the "10 prompts/month" product flow, not to enforce anything.
