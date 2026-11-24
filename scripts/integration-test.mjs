import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";
import JSZip from "jszip";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = 31_000 + Math.floor(Math.random() * 20_000);
const externalOrigin = process.env.TEST_BASE_URL ? new URL(process.env.TEST_BASE_URL).origin : null;
const origin = externalOrigin || `http://127.0.0.1:${port}`;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for integration tests");

const pool = new Pool({ connectionString: databaseUrl });
const server = externalOrigin ? null : spawn(
    process.execPath,
    [resolve(root, "node_modules/next/dist/bin/next"), "start", "-p", String(port), "-H", "127.0.0.1"],
    {
      cwd: root,
      env: {
        ...process.env,
        APP_URL: origin,
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "",
        ANTHROPIC_API_KEY: "",
        NEXT_TELEMETRY_DISABLED: "1",
        NODE_ENV: "production",
      },
      stdio: ["ignore", "ignore", "pipe"],
    },
  );
let serverError = "";
server?.stderr.setEncoding("utf8").on("data", (chunk) => { serverError = `${serverError}${chunk}`.slice(-4000); });

const ensure = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function waitForServer() {
  if (!server) return;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next.js exited before startup: ${serverError}`);
    try {
      const response = await fetch(`${origin}/api/ai/providers`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Next.js did not become ready: ${serverError}`);
}

function headers(cookie) {
  return {
    "Content-Type": "application/json",
    Origin: origin,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function json(response) {
  return response.json();
}

const emails = [`integration-${randomUUID()}@example.test`, `integration-${randomUUID()}@example.test`];
const password = "integration-test-password-2026";

try {
  await waitForServer();

  const manifestResponse = await fetch(`${origin}/manifest.webmanifest`);
  const manifest = await json(manifestResponse);
  ensure(manifest.display === "standalone" && manifest.icons.some((icon) => icon.sizes === "192x192"), "PWA manifest is incomplete");
  const iconResponse = await fetch(`${origin}/icon-192.png`);
  ensure(iconResponse.ok && iconResponse.headers.get("content-type")?.includes("image/png"), "PWA icon is unavailable");

  const unauthenticated = await fetch(`${origin}/api/projects`);
  ensure(unauthenticated.status === 401, "projects must require authentication");

  const registered = await fetch(`${origin}/api/auth/register`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: emails[0], password }),
  });
  ensure(registered.status === 201, `registration failed: ${registered.status}`);
  const user = await json(registered);
  ensure(user.user.email === emails[0] && !("passwordHash" in user.user), "registration must return only safe user fields");
  const sessionCookie = registered.headers.getSetCookie()[0];
  const secureCookieExpected = !externalOrigin || new URL(origin).protocol === "https:";
  ensure(
    /httponly/i.test(sessionCookie) &&
      /samesite=lax/i.test(sessionCookie) &&
      (!secureCookieExpected || /secure/i.test(sessionCookie)),
    "session cookie is missing security attributes",
  );
  const cookie = sessionCookie.split(";")[0];
  ensure(Boolean(cookie), "registration must issue a session cookie");

  const created = await fetch(`${origin}/api/projects`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ name: "Integration Project", description: "API smoke test" }),
  });
  ensure(created.status === 201, `project creation failed: ${created.status}`);
  const project = (await json(created)).project;

  const crossOrigin = await fetch(`${origin}/api/projects`, {
    method: "POST",
    headers: { ...headers(cookie), Origin: "https://attacker.invalid" },
    body: JSON.stringify({ name: "Cross-origin project" }),
  });
  ensure(crossOrigin.status === 403, "cross-origin state-changing requests must be rejected");

  const unavailableAI = await fetch(`${origin}/api/projects/${project.id}/ai`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ instruction: "Create a component", provider: "openai" }),
  });
  ensure(unavailableAI.status === 503, "an unconfigured AI provider must fail explicitly");

  if (process.env.TEST_OLLAMA === "1") {
    const localAI = await fetch(`${origin}/api/projects/${project.id}/ai`, {
      method: "POST",
      headers: headers(cookie),
      body: JSON.stringify({
        provider: "ollama",
        instruction: "Create a minimal React component that renders a heading saying Local model works.",
      }),
    });
    ensure(localAI.ok, `local Ollama generation failed: ${localAI.status}`);
    const generated = await json(localAI);
    ensure(generated.provider === "ollama" && generated.code.trim().length > 0, "Ollama did not return generated code");
  }

  const projectRead = await fetch(`${origin}/api/projects/${project.id}`, { headers: headers(cookie) });
  ensure(projectRead.ok && (await json(projectRead)).project.name === "Integration Project", "project read failed");
  const projectUpdate = await fetch(`${origin}/api/projects/${project.id}`, {
    method: "PATCH",
    headers: headers(cookie),
    body: JSON.stringify({ name: "Updated Integration Project" }),
  });
  ensure((await json(projectUpdate)).project.name === "Updated Integration Project", "project update failed");
  const projectList = await fetch(`${origin}/api/projects`, { headers: headers(cookie) });
  ensure((await json(projectList)).projects.some((item) => item.id === project.id), "project list did not include the new project");

  const otherRegistration = await fetch(`${origin}/api/auth/register`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: emails[1], password }),
  });
  ensure(otherRegistration.status === 201, "second user registration failed");
  const otherCookie = otherRegistration.headers.getSetCookie()[0]?.split(";")[0];
  const deniedProject = await fetch(`${origin}/api/projects/${project.id}`, { headers: headers(otherCookie) });
  ensure(deniedProject.status === 404, "users must not read another user's projects");
  await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: headers(otherCookie) });

  const requirementResponse = await fetch(`${origin}/api/projects/${project.id}/requirements`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ title: "Persist a real requirement" }),
  });
  ensure(requirementResponse.status === 201, "requirement creation failed");
  const requirement = (await json(requirementResponse)).requirement;

  const updateRequirement = await fetch(`${origin}/api/requirements/${requirement.id}`, {
    method: "PATCH",
    headers: headers(cookie),
    body: JSON.stringify({ completed: true }),
  });
  ensure((await json(updateRequirement)).requirement.completed, "requirement update was not persisted");

  const code = 'export default function App() { return <main><h1>Integration preview</h1></main>; }';
  const saved = await fetch(`${origin}/api/projects/${project.id}/code`, {
    method: "PATCH",
    headers: headers(cookie),
    body: JSON.stringify({ code, label: "Integration snapshot" }),
  });
  ensure(saved.ok, "code save/checkpoint failed");
  const laterCode = 'export default function App() { return <main>Later version</main>; }';
  const secondSave = await fetch(`${origin}/api/projects/${project.id}/code`, {
    method: "PATCH",
    headers: headers(cookie),
    body: JSON.stringify({ code: laterCode, label: "Later snapshot" }),
  });
  ensure(secondSave.ok, "second code save failed");

  const historyResponse = await fetch(`${origin}/api/projects/${project.id}`, { headers: headers(cookie) });
  const history = (await json(historyResponse)).project.checkpoints;
  const initialCheckpoint = history.find((item) => item.label === "Integration snapshot");
  ensure(Boolean(initialCheckpoint), "saved code checkpoint was not listed");
  const restored = await fetch(`${origin}/api/checkpoints/${initialCheckpoint.id}/restore`, {
    method: "POST",
    headers: headers(cookie),
  });
  ensure(restored.ok && (await json(restored)).code === code, "checkpoint restore failed");
  const restoredHistory = (await json(await fetch(`${origin}/api/projects/${project.id}`, { headers: headers(cookie) }))).project.checkpoints;
  ensure(restoredHistory.some((item) => item.label === "Before restoring: Integration snapshot"), "restore must preserve the replaced version");

  const preview = await fetch(`${origin}/api/projects/${project.id}/preview`, {
    method: "POST",
    headers: headers(cookie),
    body: JSON.stringify({ code }),
  });
  ensure(preview.ok && (await json(preview)).javascript.includes("Integration preview"), "preview compilation failed");

  const archiveResponse = await fetch(`${origin}/api/projects/${project.id}/export`, { headers: headers(cookie) });
  ensure(archiveResponse.ok && archiveResponse.headers.get("content-type")?.includes("application/zip"), "ZIP export failed");
  const archive = await JSZip.loadAsync(await archiveResponse.arrayBuffer());
  ensure(Boolean(archive.file("App.tsx")) && Boolean(archive.file("README.md")), "ZIP is missing project files");
  ensure((await archive.file("App.tsx").async("string")).includes("Integration preview"), "ZIP does not contain the saved code");

  const deletedRequirement = await fetch(`${origin}/api/requirements/${requirement.id}`, {
    method: "DELETE",
    headers: headers(cookie),
  });
  ensure(deletedRequirement.ok, "requirement deletion failed");

  const deletedProject = await fetch(`${origin}/api/projects/${project.id}`, {
    method: "DELETE",
    headers: headers(cookie),
  });
  ensure(deletedProject.ok, "project deletion failed");
  const missingProject = await fetch(`${origin}/api/projects/${project.id}`, { headers: headers(cookie) });
  ensure(missingProject.status === 404, "deleted project should no longer be readable");

  const logout = await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: headers(cookie) });
  ensure(logout.ok, "logout failed");
  const afterLogout = await fetch(`${origin}/api/auth/me`, { headers: headers(cookie) });
  ensure(afterLogout.status === 401, "logout must revoke the database session");

  const login = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ email: emails[0], password }),
  });
  ensure(login.ok && login.headers.getSetCookie().length > 0, "login must issue a new session");

  console.log("Integration smoke test passed: PWA, auth/CSRF/RBAC, CRUD, AI configuration, checkpoints, preview, ZIP, login/logout.");
} finally {
  if (server) {
    server.kill("SIGTERM");
    await new Promise((resolveExit) => {
      if (server.exitCode !== null) return resolveExit();
      server.once("exit", resolveExit);
    });
  }
  await pool.query('DELETE FROM "User" WHERE email = ANY($1)', [emails]).catch((error) => {
    console.error("Integration test cleanup failed", error.message);
  });
  await pool.end();
}
