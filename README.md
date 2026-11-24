# Frontier AI App Factory

A mobile-first workspace for planning, editing, previewing, and exporting small React applications. This MVP includes real PostgreSQL persistence, database-backed sessions, project and requirement CRUD, version checkpoints, isolated previews, and server-side OpenAI/Anthropic adapters.

## Requirements

- Node.js 20.19 or newer
- npm
- Docker Compose (or a reachable PostgreSQL 16 database)

## Run locally

```bash
cp .env.example .env
docker compose up -d db
npm ci
npm run db:generate
npm run db:deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account. Passwords must contain at least 12 characters and fit within bcrypt's 72-byte input limit. The database user in the local Compose file is for development only; replace it in deployed environments.

For iterative schema changes, use `npm run db:migrate -- --name describe_change`. Apply committed migrations in deployments with `npm run db:deploy`. Prisma 7 connects through the PostgreSQL driver adapter.

## Configuration

See [`.env.example`](./.env.example). `DATABASE_URL` is required. The default AI provider is local Ollama; install Ollama and pull the configured model to enable it:

```dotenv
AI_PROVIDER="ollama"
OLLAMA_BASE_URL="http://127.0.0.1:11434"
OLLAMA_MODEL="qwen2.5-coder:0.5b"
```

```bash
ollama pull qwen2.5-coder:0.5b
```

If Ollama is not already running as a service, start it in a separate terminal with `ollama serve`. Ollama runs on the application server and requires no API key. Alternatively, configure a server-side cloud provider:

```dotenv
AI_PROVIDER="openai"
OPENAI_API_KEY="..."
# or:
ANTHROPIC_API_KEY="..."
```

Cloud provider keys are read only by server modules and are never returned to the browser. The provider and model can be selected per request; model names can be overridden with `OPENAI_MODEL`, `ANTHROPIC_MODEL`, and `OLLAMA_MODEL`. Cloud AI calls incur charges with the selected provider. Local Ollama has no provider token quota but is limited by the server's hardware.

The project editor's Copilot can create an app from a description or update the current app from a follow-up request. Generated TSX is compiled before it is saved; if compilation fails, the provider gets one chance to repair it. A successful build automatically opens the isolated preview. The default 0.5B Ollama model uses a 4K context and works on CPU without a GPU, but is less capable than larger models. Choose a larger model with `OLLAMA_MODEL` only when the server has enough memory.

GitHub publishing asks the user for a personal access token for that one request. The token is sent to the server over HTTPS, used to create a repository and upload `App.tsx`, and is neither stored nor logged by this application. Use a short-lived token with only the required repository permissions.

## What is implemented

- Responsive Next.js App Router UI and installable PWA manifest/service worker.
- Email/password authentication, bcrypt password hashes, opaque random sessions stored as SHA-256 digests, `HttpOnly` cookies, 14-day expiry, same-origin checks, and `USER`/`ADMIN` authorization.
- PostgreSQL/Prisma schema and committed initial SQL migration.
- Authenticated project and requirement CRUD with per-owner access checks (admins can access all projects).
- Monaco TypeScript/TSX editor, server-persisted code, transactional checkpoints, and checkpoint restore.
- Explicit local Ollama, OpenAI Chat Completions, and Anthropic Messages provider adapters. An unavailable or unconfigured provider returns `503`; no fake generation response is supplied.
- Preview compilation with esbuild in a server route, rendered inside an iframe using `sandbox="allow-scripts"` without same-origin access. Its Content Security Policy blocks network connections, forms, external assets, and other resource types.
- Authenticated ZIP export and GitHub repository creation/source upload.
- Focused unit tests plus GitHub Actions checks for migrations, lint, type-check, tests, and production build.
- Standalone Docker image and a tag-triggered GitHub Actions release to GHCR.

## Verification commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

The integration test expects the Compose database to be running with migrations applied and a production build available. Start the Compose database and apply migrations before local use or production deployment.

## Free hosted demo (Vercel + Neon)

For a small personal demo, the app can run on Vercel Hobby with a Neon Free PostgreSQL database. Both plans are $0 but have usage limits; Neon Free is not a trial, and includes 1 GB of storage per project, 100 compute-unit hours per month, and scale-to-zero after inactivity. Vercel Hobby also has monthly usage quotas. Check the current [Neon plan details](https://neon.com/pricing) and [Vercel Hobby limits](https://vercel.com/docs/plans/hobby) before deploying.

1. Push the project to a GitHub repository and import it into Vercel.
2. Create a Neon Free project and add its pooled PostgreSQL connection string as `DATABASE_URL` in the Vercel project's environment variables.
3. Set the Vercel build command to `npm run db:deploy && npm run build` so committed migrations are applied before each deployment.
4. After the first deployment, set `APP_URL` to the app's canonical HTTPS URL and redeploy.

This deployment makes the app and PostgreSQL data reachable online, but it does not host Ollama. For AI generation, `OLLAMA_BASE_URL` must point to an Ollama server that is reachable from Vercel; `http://127.0.0.1:11434` would refer to the Vercel instance, not a personal computer. Do not expose an Ollama server publicly without appropriate access controls.

## Release and other deployments

Pushing a version tag (`v*`) publishes a standalone image to GitHub Container Registry using the workflow in [`.github/workflows/release.yml`](./.github/workflows/release.yml). The image contains no database URL or AI/GitHub credentials. Configure `DATABASE_URL`, `APP_URL`, and any desired provider keys as runtime secrets in your hosting platform, and apply committed Prisma migrations with `npm run db:deploy` before switching application traffic to a release. The repo does not select a hosting vendor or store deployment credentials.

## Security and production notes

- Never commit `.env` files, API keys, GitHub tokens, or production database credentials.
- Use HTTPS, a managed PostgreSQL service, backups, and a least-privilege database account in production. Set `APP_URL` to the canonical HTTPS origin.
- Set AI provider spend limits and add deployment-level rate limiting/monitoring before exposing generation to a large or public audience.
- The preview intentionally supports self-contained TSX and React imports only; arbitrary external package imports are rejected during bundling.
- GitHub publishing creates a new repository; it does not push to an existing repository.
- This is an MVP, not a hosted multi-tenant SaaS deployment template: configure operational controls and review provider terms before production use.

## API

See [the API reference](./docs/API.md) for routes, request bodies, authentication, and response behavior.
