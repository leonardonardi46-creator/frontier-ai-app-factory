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

See [`.env.example`](./.env.example). `DATABASE_URL` is required. The default AI provider is NVIDIA NIM; configure its API key on the server:

```dotenv
AI_PROVIDER="nvidia"
NVIDIA_API_KEY="..."
NVIDIA_MODEL="google/gemma-4-31b-it"
NVIDIA_CHAT_MODEL="google/gemma-4-31b-it"
NVIDIA_VISION_MODEL="moonshotai/kimi-k3.1-pro"
NVIDIA_IMAGE_MODEL="stabilityai/stable-diffusion-3-medium"
```

The NVIDIA provider uses the OpenAI-compatible NVIDIA NIM chat-completions API. `NVIDIA_MODEL` selects the app-builder model; `NVIDIA_CHAT_MODEL` and `NVIDIA_VISION_MODEL` optionally select general chat models with text and image input. `NVIDIA_IMAGE_MODEL` selects the text-to-image NIM. Use model IDs enabled for your NVIDIA account. Image generation and model access may have separate quotas or terms.

```dotenv
OPENAI_API_KEY="..."      # or
ANTHROPIC_API_KEY="..."
```

Cloud provider keys are read only by server modules and are never returned to the browser. The app-builder provider can be selected in the editor; model names can be overridden with `OPENAI_MODEL`, `ANTHROPIC_MODEL`, and `OLLAMA_MODEL`. Cloud AI usage is subject to each provider's current quotas and pricing; check NVIDIA's limits for your account.

The editor's AI panel has separate **Build app** and **AI chat** tabs. The builder creates or updates the project and compiles the result before opening the preview; the general chat answers questions without changing project code. Both tabs can upload files and generate images using NVIDIA.

### Private chat attachments

Create a **private Vercel Blob store** and connect it to this Vercel project. Vercel supplies the Blob environment credentials, including `BLOB_WEBHOOK_PUBLIC_KEY`; local development can use `vercel env pull` after enabling the Development environment on the store. Uploads go directly from the browser to Blob, are private, and expire after 30 days. Vercel Blob has a 5 TB per-file maximum, not unlimited storage; usage is subject to the store's quota and pricing.

The app extracts text from text/code files and PDFs, and can send JPEG, PNG, or WebP images to the NVIDIA vision model. File uploads of other types are accepted but their contents are not interpreted. Scanned PDFs need OCR; images larger than 4 MiB each or 8 MiB total are stored but omitted from AI requests. NVIDIA also imposes its own context and request limits.

To use Ollama instead, set `AI_PROVIDER="ollama"`, configure `OLLAMA_BASE_URL` and `OLLAMA_MODEL`, and make sure Ollama is running and reachable from the application server.

GitHub publishing asks the user for a personal access token for that one request. The token is sent to the server over HTTPS, used to create a repository and upload `App.tsx`, and is neither stored nor logged by this application. Use a short-lived token with only the required repository permissions.

## What is implemented

- Responsive Next.js App Router UI and installable PWA manifest/service worker.
- Email/password authentication, bcrypt password hashes, opaque random sessions stored as SHA-256 digests, `HttpOnly` cookies, 14-day expiry, same-origin checks, and `USER`/`ADMIN` authorization.
- PostgreSQL/Prisma schema and committed initial SQL migration.
- Authenticated project and requirement CRUD with per-owner access checks (admins can access all projects).
- Monaco TypeScript/TSX editor, server-persisted code, transactional checkpoints, and checkpoint restore.
- Explicit local Ollama, OpenAI Chat Completions, Anthropic Messages, and NVIDIA NIM providers, with app-building and general-chat experiences plus NVIDIA image generation.
- Authenticated private Vercel Blob uploads for chat attachments, with format-aware text/PDF/image handling and expiring storage.
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

This deployment makes the app and PostgreSQL data reachable online. Add `NVIDIA_API_KEY` to the Vercel project's environment variables to enable NVIDIA chat and image generation. Create and connect a **private Vercel Blob store** to enable chat uploads. Do not put the key in client-side code or commit it to the repository.

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
