# AGENTS.md

Project-specific guidance for AI coding agents working in Jellyfin Web.

## Project Context

Jellyfin Web is the web client for Jellyfin. The codebase mixes legacy JavaScript with newer TypeScript and React code, so prefer the existing local style instead of broad rewrites.

The main app areas are:

- `src/apps/stable` for the classic user app
- `src/apps/experimental` for the MUI-based rewrite
- `src/apps/dashboard` for admin and metadata tools
- `src/apps/wizard` for first-run setup
- `src/components`, `src/hooks`, `src/lib`, and `src/utils` for shared code

## Working Rules

- Read `CONTRIBUTING.md` before making changes.
- Use `npm`, not `yarn`.
- Keep changes focused and minimal. Avoid unrelated refactors and whitespace-only edits.
- New files must be written in TypeScript.
- API work must use the Jellyfin TypeScript SDK.
- Prefer direct imports over browser globals.
- Avoid overusing dynamic imports; keep them mostly at page boundaries.
- Preserve compatibility with the browsers listed in `package.json`.
- Follow the repository ESLint and stylistic rules; do not reformat files broadly unless needed.
- Add or update tests when the change is reasonably testable.

## Server Backend

- The ticket backend lives in `server/` and has its own `package.json`.
- Install or refresh backend dependencies with `npm install` from inside `server/`.
- Run the backend with `npm start` or `npm run dev` from inside `server/`.
- From the repo root, `npm run server:install`, `npm run server:start`, and `npm run server:dev` are the convenience wrappers for the same workflow.
- The backend reads `../.env` for Jellyfin, CORS, SQLite, SMTP, and Discord settings.
- When backend dependencies change, verify `server/index.js` still starts cleanly before touching frontend code.

## Localization

- Translation changes must go through Weblate, except for source-language text.
- Do not rename translation keys unless there is a strong reason.

## AI and LLM Policy

- Follow the Jellyfin LLM development policy referenced in `CONTRIBUTING.md`.
- If AI assistance was used, disclose it in the pull request template.
- Treat generated code as a draft and verify behavior manually before considering the work complete.
- Do not invent APIs, data shapes, or project patterns. Inspect the codebase and docs first.
- Prefer incremental, reviewable changes over large generated rewrites.

## Validation

- `npm run build:check` for TypeScript validation
- `npm run lint` for linting
- `npm run test` for unit tests
- `npm run build:development` when you need a local bundle check
- `npm start` for local development

## Reimagined Changelog

- The changelog lives in `REIMAGINED_CHANGELOG.md` at the repo root (read the file after any change).
- When completing a feature or fix, append a one-line entry under the current version block.
- Use only three tags: `[ADDED]`, `[CHANGED]`, or `[REMOVED]`.
- One entry per user-visible change. Do not log internal details (routes, services, helpers) separately — group them into the feature they belong to.
- Keep entries short: `[TAG] - What changed and why it matters to the user.`

## Useful References

- `CONTRIBUTING.md` for contribution, release, and LLM policy guidance
- `REIMAGINED_CHANGELOG.md` for the current changelog format and recent entries
- `package.json` for scripts, dependencies, and browser support
- `eslint.config.mjs` for linting rules
