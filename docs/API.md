# API reference

All endpoints are same-origin. Except for authentication, provider capability discovery, and the static manifest, endpoints require the `frontier_session` cookie created by login or registration. Mutating browser requests are checked against the configured application origin. JSON errors use `{ "error": "..." }`; validation failures may include Zod issue details.

## Authentication

| Method | Path | Request | Result |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | `{ "email": "user@example.com", "password": "12+ characters" }` | Creates a `USER`, starts a session, returns the safe user fields (`201`). |
| `POST` | `/api/auth/login` | Same credentials shape | Starts a session; invalid credentials return `401`. |
| `POST` | `/api/auth/logout` | No body | Revokes the current database session and clears its cookie. |
| `GET` | `/api/auth/me` | — | Returns the current safe user fields. |

Sessions use random opaque tokens; only a SHA-256 digest is stored in PostgreSQL. The cookie is `HttpOnly`, `SameSite=Lax`, path `/`, and `Secure` in production.

## Projects and requirements

| Method | Path | Request | Result |
| --- | --- | --- | --- |
| `GET` | `/api/projects` | — | Lists the current user's projects and requirement/checkpoint counts. |
| `POST` | `/api/projects` | `{ "name": "...", "description": "..." }` | Creates a project with an editable starter component (`201`). |
| `GET` | `/api/projects/:projectId` | — | Gets a project, its requirements, and checkpoint metadata. |
| `PATCH` | `/api/projects/:projectId` | `{ "name"?: "...", "description"?: "..." }` | Updates project metadata. |
| `DELETE` | `/api/projects/:projectId` | — | Deletes the project and cascading related records. |
| `POST` | `/api/projects/:projectId/requirements` | `{ "title": "...", "details"?: "..." }` | Creates a requirement (`201`). |
| `PATCH` | `/api/requirements/:requirementId` | `{ "title"?: "...", "details"?: "...", "completed"?: boolean }` | Updates a requirement. |
| `DELETE` | `/api/requirements/:requirementId` | — | Deletes a requirement. |

Users can access only their own projects; the `ADMIN` role can access all projects. Resource lookups return `404` when the record is missing or belongs to another user.

## Editor and AI

| Method | Path | Request | Result |
| --- | --- | --- | --- |
| `PATCH` | `/api/projects/:projectId/code` | `{ "code": "...", "label"?: "..." }` | Atomically updates current code and creates a checkpoint. |
| `POST` | `/api/checkpoints/:checkpointId/restore` | — | Restores a checkpoint and creates a new restore checkpoint. |
| `GET` | `/api/ai/providers` | — | Returns provider identifiers and availability booleans, never secrets. Ollama availability checks the local server; cloud providers report whether their server-side key is configured. |
| `POST` | `/api/projects/:projectId/ai` | `{ "instruction": "...", "provider"?: "ollama" \| "openai" \| "anthropic" \| "nvidia", "currentCode"?: "...", "history"?: [...], "attachments"?: [...] }` | Calls the selected provider with the supplied editor source, prior chat, and private attachments, compiles the returned TSX, and creates a checkpoint only after a successful compile. One repair attempt is made for compile errors; an unrepairable result returns `422`. Unavailable/unconfigured provider returns `503`. |
| `POST` | `/api/projects/:projectId/ai/chat` | `{ "messages": [{ "role": "user" \| "assistant", "content": "..." }], "attachments"?: [...] }` | Calls NVIDIA general chat without modifying project code. The latest message must be from the user; private attachments are checked against project access before reading. |
| `POST` | `/api/projects/:projectId/ai/image` | `{ "prompt": "..." }` | Generates a JPEG with the configured NVIDIA NIM image model and returns it as a data URL. Requires the NVIDIA key and access to the selected image model. |
| `POST` | `/api/projects/:projectId/ai/files` | Vercel Blob client-upload protocol | Authenticates project ownership and issues a short-lived private Blob upload URL, including multipart uploads. Blob store access must be configured. |
| `DELETE` | `/api/projects/:projectId/ai/files` | `{ "pathname": "...", "name": "..." }` | Deletes an authenticated project's private chat attachment. |
| `POST` | `/api/projects/:projectId/preview` | `{ "code": "TSX source" }` | Authenticated esbuild compilation for the isolated preview. Rejects non-React package imports. |

The AI call returns code as content; review it before exporting. Cloud provider credentials remain server-side. NVIDIA uses the NVIDIA NIM chat-completions API with `NVIDIA_API_KEY`; text, vision, and image models are configurable with `NVIDIA_MODEL`, `NVIDIA_CHAT_MODEL`, `NVIDIA_VISION_MODEL`, and `NVIDIA_IMAGE_MODEL`. Ollama uses `OLLAMA_BASE_URL` and `OLLAMA_MODEL` and does not require an API key. The editor automatically builds the isolated preview after a successful app generation.

Chat attachments are uploaded to a private Vercel Blob store and automatically expire after 30 days. Blob supports files up to 5 TB, but NVIDIA request/context limits still apply. Text/code, PDFs, and JPEG/PNG/WebP are parsed or sent to the model; images over 4 MiB each or 8 MiB total, and unsupported formats, are stored but not interpreted.

## Exports

| Method | Path | Request | Result |
| --- | --- | --- | --- |
| `GET` | `/api/projects/:projectId/export` | — | Downloads an authenticated ZIP containing `App.tsx` and project/requirements README. |
| `POST` | `/api/projects/:projectId/github` | `{ "token": "...", "repository": "...", "isPrivate": true }` | Creates a GitHub repository and uploads `App.tsx`; returns its URL. The token is not persisted. |

GitHub publishing creates a new repository and requires a token authorized to create repositories and push contents. A source-upload error can include the URL of the repository that was successfully created.
