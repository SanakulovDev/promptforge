# PromptForge

PromptForge converts prompts in any language into structured instructions that AI agents can understand quickly and clearly.

## Features

- TypeScript React web app with Uzbek as the default UI language.
- Node.js backend API for prompt optimization and future auth/subscription hooks.
- Google and GitHub sign-in entry points with demo fallback when OAuth credentials are not configured.
- Agent targeting for Codex, Claude, or a general assistant.
- Purpose modes for coder, tester, code review, and general tasks.
- 10 prompts/month usage model prepared for a later paid subscription.

## Run Locally

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

## Run With Docker

```sh
docker compose up --build
```

Open `http://localhost:4174`.

Optional OAuth environment variables:

```sh
GOOGLE_CLIENT_ID=
GOOGLE_REDIRECT_URI=
GITHUB_CLIENT_ID=
GITHUB_REDIRECT_URI=
```

Without these values, the sign-in buttons use a local demo response so the interface remains testable.
