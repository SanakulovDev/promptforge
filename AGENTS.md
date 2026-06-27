# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a minimal starter with `README.md`, `LICENSE`, and `.gitignore` at the root. Keep top-level files limited to project metadata and configuration. As implementation begins, place application code under `src/`, tests under `tests/` or beside modules as `*.test.*`, and static assets under `assets/` or `public/` depending on the runtime. Update this guide when new tooling or directories are added.

## Build, Test, and Development Commands

No package manager, build system, or test runner is configured yet. Before adding commands, introduce the relevant manifest first, such as `package.json`, `pyproject.toml`, `Cargo.toml`, or `Makefile`.

Common examples once tooling exists:

```sh
npm install      # install JavaScript dependencies
npm run dev      # start the local development server
npm test         # run the test suite
npm run lint     # run static checks
```

Prefer documenting every new contributor-facing command in `README.md` and mirroring the most important ones here.

## Coding Style & Naming Conventions

Follow the conventions of the language and framework introduced for the project. Use descriptive names, small modules, and consistent formatting. When adding formatters or linters, commit their configuration files and make them runnable from a single command such as `npm run lint` or `make lint`. Use lowercase, hyphenated names for general documentation files when appropriate, and conventional names such as `README.md` and `AGENTS.md` for repository-level guides.

## Testing Guidelines

Add tests with the first meaningful implementation. Keep tests close to the behavior they verify, either in `tests/` or adjacent to source files. Use clear names that describe expected behavior, for example `prompt-parser.test.ts` or `test_prompt_parser.py`. Include regression tests for bug fixes and document any required manual verification steps in the pull request.

## Commit & Pull Request Guidelines

The current Git history contains only `Initial commit`, so no detailed local convention has emerged. Use short, imperative commit messages such as `Add prompt parser scaffold` or `Document setup commands`. Pull requests should include a brief summary, linked issue when applicable, test results or a note that tests are not yet configured, and screenshots for user-facing UI changes.

## Security & Configuration Tips

Do not commit secrets, API keys, local environment files, or generated credentials. Add example configuration files such as `.env.example` when environment variables become required, and document each variable's purpose.
