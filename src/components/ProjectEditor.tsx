"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AIChatPanel } from "@/components/AIChatPanel";
import { PROJECT_STARTER_CODE } from "@/lib/project-template";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  CircleHelp,
  Clock3,
  Code2,
  ExternalLink,
  Eye,
  FileCode2,
  GitBranch,
  History,
  LoaderCircle,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type Requirement = { id: string; title: string; details: string; completed: boolean };
type Checkpoint = { id: string; label: string; createdAt: string };
type Project = {
  id: string;
  name: string;
  description: string;
  currentCode: string;
  requirements: Requirement[];
  checkpoints: Checkpoint[];
};
type Provider = { id: "openai" | "anthropic" | "ollama" | "nvidia"; configured: boolean };
type ResponseData<T> = T & { error?: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await response.json().catch(() => ({}))) as ResponseData<T>;
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function LogoMark() {
  return <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#214f40] text-white"><span className="text-sm font-bold">F</span></span>;
}

function Alert({ children, onClose }: { children: string; onClose?: () => void }) {
  return <div role="alert" className="flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700"><span>{children}</span>{onClose && <button onClick={onClose} aria-label="Dismiss error"><X size={14} /></button>}</div>;
}

function GitHubDialog({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const [token, setToken] = useState("");
  const [repository, setRepository] = useState(projectName.toLowerCase().replace(/[^a-z0-9._-]+/g, "-"));
  const [isPrivate, setIsPrivate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [repositoryUrl, setRepositoryUrl] = useState("");

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ repositoryUrl: string }>(`/api/projects/${projectId}/github`, {
        method: "POST",
        body: JSON.stringify({ token, repository, isPrivate }),
      });
      setRepositoryUrl(result.repositoryUrl);
      setToken("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to publish repository");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#15211d]/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={publish} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-start justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0f2ef]"><GitBranch size={18} /></span><div><h2 className="text-base font-semibold">Publish to GitHub</h2><p className="mt-0.5 text-xs text-[#87918b]">Create a new repository and push your app.</p></div></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-[#89938e] hover:bg-[#f3f5f2]"><X size={16} /></button></div>
        {repositoryUrl ? <div className="rounded-xl border border-[#dce9df] bg-[#f4f8f4] p-4"><p className="text-sm font-semibold text-[#28543d]">Repository created</p><a className="mt-2 inline-flex items-center gap-1 text-xs text-[#587463] underline" href={repositoryUrl} target="_blank" rel="noreferrer">{repositoryUrl}<ExternalLink size={12} /></a><button type="button" onClick={onClose} className="mt-4 block rounded-lg bg-[#214f40] px-3 py-2 text-xs font-medium text-white">Done</button></div> : <>
          <label className="block text-xs font-medium">GitHub personal access token<input required type="password" autoComplete="new-password" value={token} onChange={(event) => setToken(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe5df] px-3 text-sm focus:border-[#527a68] focus:ring-[#527a68]/10" placeholder="github_pat_..." /></label>
          <p className="mt-1.5 text-[11px] leading-4 text-[#89938e]">Used for this request only; never saved in Frontier. Grant repository creation and contents access.</p>
          <label className="mt-4 block text-xs font-medium">Repository name<input required maxLength={100} pattern="[A-Za-z0-9._-]+" value={repository} onChange={(event) => setRepository(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#dfe5df] px-3 text-sm focus:border-[#527a68] focus:ring-[#527a68]/10" /></label>
          <label className="mt-4 flex items-center gap-2 text-xs text-[#58645d]"><input type="checkbox" checked={isPrivate} onChange={(event) => setIsPrivate(event.target.checked)} className="rounded border-[#cbd4cd] text-[#214f40] focus:ring-[#214f40]" /> Keep this repository private</label>
          {error && <div className="mt-4"><Alert>{error}</Alert></div>}
          <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-medium text-[#68746d] hover:bg-[#f4f6f3]">Cancel</button><button disabled={busy || !token.trim()} className="flex items-center gap-2 rounded-lg bg-[#214f40] px-3 py-2 text-xs font-medium text-white">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <GitBranch size={14} />}{busy ? "Publishing..." : "Create repository"}</button></div>
        </>}
      </form>
    </div>
  );
}

function PreviewFrame({ javascript, error }: { javascript: string; error: string }) {
  const srcDoc = useMemo(() => {
    if (!javascript) return "";
    const encoded = btoa(encodeURIComponent(javascript));
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;min-height:100%;font-family:system-ui,sans-serif}</style></head><body><div id="root"></div><script>const payload="${encoded}";const source=decodeURIComponent(atob(payload));const app=document.createElement("script");app.textContent=source;document.body.appendChild(app);</script></body></html>`;
  }, [javascript]);
  return (
    <div className="relative h-full min-h-[360px] bg-white">
      {error && <div className="absolute inset-x-3 top-3 z-10"><Alert>{error}</Alert></div>}
      {!javascript && !error ? <div className="grid h-full min-h-[360px] place-items-center p-8 text-center"><div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#edf2ee] text-[#52715e]"><Eye size={19} /></div><p className="mt-3 text-sm font-medium">Preview your app</p><p className="mt-1 text-xs text-[#89938e]">Save your code to build a live preview.</p></div></div> :
        javascript && !error ? <iframe title="Isolated application preview" sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={srcDoc} className="h-full min-h-[360px] w-full border-0 bg-white" /> : null}
    </div>
  );
}

export default function ProjectEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [code, setCode] = useState("");
  const [savedCode, setSavedCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview">("editor");
  const [rightPanel, setRightPanel] = useState<"requirements" | "history">("requirements");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerError, setProviderError] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic" | "ollama" | "nvidia">("nvidia");
  const [previewCode, setPreviewCode] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [newRequirement, setNewRequirement] = useState("");
  const [showGitHub, setShowGitHub] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const loadProject = useCallback(async () => {
    const result = await api<{ project: Project }>(`/api/projects/${projectId}`);
    setProject(result.project);
    const content = result.project.currentCode || PROJECT_STARTER_CODE;
    setCode(content);
    setSavedCode(result.project.currentCode);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    api<{ project: Project }>(`/api/projects/${projectId}`)
      .then(({ project: loaded }) => {
        if (!active) return;
        setProject(loaded);
        const content = loaded.currentCode || PROJECT_STARTER_CODE;
        setCode(content);
        setSavedCode(loaded.currentCode);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load project");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    api<{ providers: Provider[]; defaultProvider: string }>("/api/ai/providers")
      .then(({ providers: available, defaultProvider }) => {
        setProviders(available);
        if (defaultProvider === "openai" || defaultProvider === "anthropic" || defaultProvider === "ollama" || defaultProvider === "nvidia") setProvider(defaultProvider);
      })
      .catch((reason: unknown) => {
        if (active) setProviderError(reason instanceof Error ? reason.message : "Unable to load AI provider configuration");
      });
    return () => { active = false; };
  }, [projectId]);

  async function saveCode(label = "Manual checkpoint") {
    if (!project || saving) return;
    setSaving(true);
    setError("");
    try {
      const result = await api<{ project: Project }>(`/api/projects/${projectId}/code`, {
        method: "PATCH",
        body: JSON.stringify({ code, label }),
      });
      setSavedCode(result.project.currentCode);
      await loadProject();
      setNotice("Checkpoint saved");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save code");
    } finally {
      setSaving(false);
    }
  }

  async function buildPreview(source = code) {
    if (!source.trim()) {
      setPreviewCode("");
      setPreviewError("Add a React component to preview.");
      setTab("preview");
      return false;
    }
    setBusy(true);
    setPreviewError("");
    try {
      const result = await api<{ javascript: string }>(`/api/projects/${projectId}/preview`, {
        method: "POST",
        body: JSON.stringify({ code: source }),
      });
      setPreviewCode(result.javascript);
      setTab("preview");
      return true;
    } catch (reason) {
      setPreviewCode("");
      setPreviewError(reason instanceof Error ? reason.message : "Unable to compile preview");
      setTab("preview");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAppGenerated(generatedCode: string) {
    setCode(generatedCode);
    await loadProject();
    const previewReady = await buildPreview(generatedCode);
    setNotice(previewReady ? "App aggiornata e anteprima pronta" : "App salvata; controlla l'errore dell'anteprima");
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function addRequirement(event: React.FormEvent) {
    event.preventDefault();
    if (!newRequirement.trim()) return;
    setError("");
    try {
      await api(`/api/projects/${projectId}/requirements`, {
        method: "POST",
        body: JSON.stringify({ title: newRequirement }),
      });
      setNewRequirement("");
      await loadProject();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to add requirement");
    }
  }

  async function toggleRequirement(item: Requirement) {
    try {
      await api(`/api/requirements/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !item.completed }),
      });
      await loadProject();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update requirement");
    }
  }

  async function deleteRequirement(id: string) {
    try {
      await api(`/api/requirements/${id}`, { method: "DELETE" });
      await loadProject();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete requirement");
    }
  }

  async function restore(checkpoint: Checkpoint) {
    const unsavedWarning = code !== savedCode
      ? " Your unsaved editor changes will be discarded; the latest saved version will be checkpointed."
      : " The latest saved version will be checkpointed.";
    if (!window.confirm(`Restore "${checkpoint.label}"?${unsavedWarning}`)) return;
    try {
      const result = await api<{ code: string }>(`/api/checkpoints/${checkpoint.id}/restore`, { method: "POST" });
      setCode(result.code);
      setSavedCode(result.code);
      await loadProject();
      setNotice("Checkpoint restored");
      window.setTimeout(() => setNotice(""), 2400);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to restore checkpoint");
    }
  }

  async function renameProject() {
    if (!project) return;
    const name = window.prompt("Project name", project.name)?.trim();
    if (!name || name === project.name) return;
    try {
      const result = await api<{ project: Project }>(`/api/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      setProject((current) => current ? { ...current, name: result.project.name } : current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to rename project");
    }
  }

  async function deleteProject() {
    if (!project || !window.confirm(`Delete "${project.name}" and all its data? This cannot be undone.`)) return;
    try {
      await api(`/api/projects/${projectId}`, { method: "DELETE" });
      router.push("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete project");
    }
  }

  async function downloadZip() {
    try {
      const response = await fetch(`/api/projects/${projectId}/export`);
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(result.error || `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project?.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "project"}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Export failed");
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><LoaderCircle className="animate-spin text-[#214f40]" /></div>;
  if (!project) return <main className="mx-auto max-w-lg p-8 text-center"><LogoMark /><h1 className="mt-4 text-xl font-semibold">Project unavailable</h1><p className="mt-2 text-sm text-[#78827e]">{error || "This project could not be found."}</p><Link className="mt-5 inline-flex items-center gap-2 text-sm text-[#315844]" href="/"><ArrowLeft size={15} /> Back to projects</Link></main>;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f6f7f5]">
      <header className="z-20 flex h-[58px] shrink-0 items-center justify-between border-b border-[#e4e8e4] bg-[#fbfcfa] px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" aria-label="Back to projects" className="rounded-lg p-2 text-[#77827b] hover:bg-[#eff2ef]"><ArrowLeft size={17} /></Link>
          <span className="hidden sm:block"><LogoMark /></span>
          <div className="h-5 w-px bg-[#e1e6e1]" />
          <button onClick={renameProject} className="max-w-[150px] truncate text-sm font-semibold tracking-[-.02em] hover:text-[#456957] sm:max-w-[260px]">{project.name}</button>
          <span className="hidden rounded-md bg-[#edf2ee] px-2 py-1 text-[10px] font-medium text-[#547464] sm:inline-flex">Draft</span>
          <button onClick={() => setMobileMenu(!mobileMenu)} className="ml-1 rounded-lg p-2 text-[#77827b] hover:bg-[#eff2ef] md:hidden"><Menu size={17} /></button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="hidden items-center gap-1 text-[10px] text-[#89938e] lg:flex">{code === savedCode ? <><Check size={12} /> Saved</> : "Unsaved changes"}</span>
          <button onClick={() => void saveCode()} disabled={saving || code === savedCode} className="flex h-8 items-center gap-1.5 rounded-lg border border-[#dfe5df] bg-white px-2.5 text-xs font-medium text-[#45554c] hover:bg-[#f6f8f5] disabled:opacity-50 sm:px-3"><Save size={13} /> <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span></button>
          <button onClick={() => setShowGitHub(true)} className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#dfe5df] bg-white px-3 text-xs font-medium text-[#45554c] hover:bg-[#f6f8f5] sm:flex"><GitBranch size={13} /> GitHub</button>
          <button onClick={downloadZip} className="flex h-8 items-center gap-1.5 rounded-lg bg-[#214f40] px-2.5 text-xs font-medium text-white hover:bg-[#183f32] sm:px-3"><ArrowDownToLine size={14} /><span className="hidden sm:inline">Export</span></button>
          <button onClick={deleteProject} title="Delete project" className="hidden rounded-lg p-2 text-[#a2aaa5] hover:bg-red-50 hover:text-red-600 md:block"><MoreHorizontal size={17} /></button>
        </div>
      </header>

      {mobileMenu && <div className="absolute right-3 top-[54px] z-30 w-48 rounded-xl border border-[#e5e9e5] bg-white p-2 shadow-xl md:hidden"><button onClick={renameProject} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f4f6f3]">Rename project</button><button onClick={deleteProject} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50">Delete project</button><button onClick={() => setShowGitHub(true)} className="block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-[#f4f6f3]">Publish to GitHub</button></div>}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#e5e9e5] bg-[#fbfcfa] px-3 sm:px-5">
            <div className="flex items-center gap-1 rounded-lg bg-[#f0f2ef] p-1">
              <button onClick={() => setTab("editor")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${tab === "editor" ? "bg-white text-[#34463c] shadow-sm" : "text-[#89938e]"}`}><Code2 size={13} /> Editor</button>
              <button onClick={() => setTab("preview")} className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${tab === "preview" ? "bg-white text-[#34463c] shadow-sm" : "text-[#89938e]"}`}><Eye size={13} /> Preview</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1 text-[10px] text-[#a0a9a3] sm:flex"><FileCode2 size={12} /> App.tsx</span>
              <button onClick={() => void buildPreview()} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-[#dfe5df] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#45554c] hover:bg-[#f6f8f5]"><RefreshCcw size={12} className={busy && tab === "preview" ? "animate-spin" : ""} /> Run preview</button>
              <button onClick={() => setShowAI(!showAI)} className="flex items-center gap-1.5 rounded-lg bg-[#e7efe8] px-2.5 py-1.5 text-[11px] font-medium text-[#315844] hover:bg-[#dce9de]"><Sparkles size={12} /> <span className="hidden sm:inline">Ask AI</span></button>
            </div>
          </div>

          {error && <div className="px-3 pt-2 sm:px-5"><Alert onClose={() => setError("")}>{error}</Alert></div>}
          {notice && <div role="status" className="absolute left-1/2 top-[70px] z-30 -translate-x-1/2 rounded-full bg-[#214f40] px-4 py-2 text-xs text-white shadow-lg">{notice}</div>}

          <div className={showAI ? "" : "hidden"}>
            <AIChatPanel
              projectId={projectId}
              currentCode={code}
              provider={provider}
              onProviderChange={setProvider}
              providers={providers}
              providerError={providerError}
              onAppGenerated={handleAppGenerated}
              onClose={() => setShowAI(false)}
            />
          </div>

          <div className="min-h-0 flex-1 bg-white">
            <div className={`${tab === "editor" ? "block" : "hidden"} h-full`}>
              <MonacoEditor height="100%" language="typescript" theme="vs-dark" value={code} onChange={(value) => setCode(value ?? "")} options={{ minimap: { enabled: false }, fontSize: 13, lineHeight: 21, wordWrap: "on", scrollBeyondLastLine: false, padding: { top: 16, bottom: 20 }, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", tabSize: 2, automaticLayout: true, renderLineHighlight: "gutter", scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 } }} />
            </div>
            <div className={`${tab === "preview" ? "block" : "hidden"} h-full`}>
              <PreviewFrame javascript={previewCode} error={previewError} />
            </div>
          </div>

          <footer className="flex h-7 shrink-0 items-center justify-between border-t border-[#e5e9e5] bg-[#fbfcfa] px-3 text-[10px] text-[#99a29d] sm:px-5"><div className="flex items-center gap-3"><span>TypeScript JSX</span><span className="hidden sm:inline">UTF-8</span><span className="hidden sm:inline">Spaces: 2</span></div><div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-[#79a286]" /> Isolated preview</div></footer>
        </main>

        <aside className={`${mobileMenu ? "absolute inset-x-0 bottom-0 top-[58px] z-10 flex" : "hidden"} w-full shrink-0 flex-col border-l border-[#e5e9e5] bg-[#fbfcfa] md:relative md:flex md:w-[290px] xl:w-[320px]`}>
          <div className="flex h-11 shrink-0 items-center border-b border-[#e5e9e5] px-3">
            <button onClick={() => setRightPanel("requirements")} className={`flex h-full items-center gap-1.5 border-b-2 px-2 text-[11px] font-medium ${rightPanel === "requirements" ? "border-[#527a68] text-[#34463c]" : "border-transparent text-[#89938e]"}`}><CheckCheck size={13} /> Requirements</button>
            <button onClick={() => setRightPanel("history")} className={`flex h-full items-center gap-1.5 border-b-2 px-2 text-[11px] font-medium ${rightPanel === "history" ? "border-[#527a68] text-[#34463c]" : "border-transparent text-[#89938e]"}`}><History size={13} /> History <span className="rounded-full bg-[#edf1ed] px-1.5 py-0.5 text-[9px]">{project.checkpoints.length}</span></button>
            <button onClick={() => setMobileMenu(false)} className="ml-auto rounded-lg p-1.5 text-[#89938e] md:hidden"><X size={15} /></button>
          </div>
          {rightPanel === "requirements" ? <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-[#edf0ed] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Project brief</p><Settings2 size={14} className="text-[#99a29d]" /></div><p className="mt-2 whitespace-pre-wrap text-[11px] leading-[1.65] text-[#7d8981]">{project.description || "Add a short project description to keep this build focused."}</p></div>
            <div className="flex items-center justify-between px-4 pb-2 pt-4"><div><p className="text-xs font-semibold">Requirements</p><p className="mt-0.5 text-[10px] text-[#939d97]">{project.requirements.filter((item) => item.completed).length} of {project.requirements.length} complete</p></div><span className="rounded-md bg-[#edf2ee] px-2 py-1 text-[10px] font-medium text-[#547464]">{project.requirements.length}</span></div>
            <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
              {project.requirements.length === 0 ? <div className="px-2 py-5 text-center"><div className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-[#f0f3f0] text-[#8b978e]"><MessageSquareText size={16} /></div><p className="mt-2 text-[11px] font-medium text-[#67746c]">No requirements yet</p><p className="mt-1 text-[10px] text-[#9aa39d]">Add a detail to guide your build.</p></div> :
                <div className="space-y-1.5">{project.requirements.map((item) => <div key={item.id} className="group flex items-start gap-2.5 rounded-xl border border-transparent p-2.5 transition hover:border-[#e8ece8] hover:bg-white"><button aria-label={item.completed ? "Mark incomplete" : "Mark complete"} onClick={() => void toggleRequirement(item)} className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${item.completed ? "border-[#527a68] bg-[#527a68] text-white" : "border-[#cbd4cd] bg-white text-transparent hover:border-[#789481]"}`}>{item.completed && <Check size={11} />}</button><div className="min-w-0 flex-1"><p className={`text-[11px] font-medium leading-4 ${item.completed ? "text-[#99a39c] line-through" : "text-[#3f4d45]"}`}>{item.title}</p>{item.details && <p className="mt-1 text-[10px] leading-4 text-[#919c95]">{item.details}</p>}</div><button aria-label="Delete requirement" onClick={() => void deleteRequirement(item.id)} className="rounded p-1 text-[#bac2bc] opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"><Trash2 size={12} /></button></div>)}</div>}
            </div>
            <form onSubmit={addRequirement} className="flex gap-2 border-t border-[#e9ede9] p-3"><input value={newRequirement} onChange={(event) => setNewRequirement(event.target.value)} maxLength={200} className="h-9 min-w-0 flex-1 rounded-lg border border-[#e0e6e0] bg-white px-2.5 text-[11px] focus:border-[#7c9b83] focus:ring-[#7c9b83]/10" placeholder="Add a requirement..." /><button disabled={!newRequirement.trim()} aria-label="Add requirement" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e8efe9] text-[#476653] hover:bg-[#dce9de] disabled:opacity-50"><Plus size={16} /></button></form>
          </div> : <div className="editor-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3 rounded-xl bg-[#f0f3f0] p-3"><p className="text-[11px] font-medium">Version history</p><p className="mt-1 text-[10px] leading-4 text-[#89938e]">Every save creates a named checkpoint you can restore at any time.</p></div>
            {project.checkpoints.length === 0 ? <div className="py-8 text-center"><Clock3 size={18} className="mx-auto text-[#9ba49e]" /><p className="mt-2 text-[11px] text-[#89938e]">No checkpoints saved yet.</p></div> :
              <div className="space-y-2">{project.checkpoints.map((checkpoint) => <div key={checkpoint.id} className="rounded-xl border border-[#e6ebe6] bg-white p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-[11px] font-medium">{checkpoint.label}</p><p className="mt-1 text-[10px] text-[#97a19a]">{new Date(checkpoint.createdAt).toLocaleString()}</p></div><button onClick={() => void restore(checkpoint)} title="Restore checkpoint" className="rounded-md p-1.5 text-[#688573] hover:bg-[#eef4ee]"><RefreshCcw size={13} /></button></div></div>)}</div>}
            <button onClick={() => void saveCode("Manual checkpoint")} disabled={saving || code === savedCode} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#dfe5df] bg-white px-3 py-2 text-[11px] font-medium text-[#53645a] hover:bg-[#f7f9f6] disabled:opacity-50"><Plus size={12} /> Save checkpoint</button>
          </div>}
          <div className="flex items-center gap-2 border-t border-[#e8ece8] px-3 py-2.5"><CircleHelp size={13} className="text-[#99a39d]" /><p className="text-[10px] text-[#929d95]">Your edits are private to your account.</p><ChevronDown size={13} className="ml-auto text-[#acb4ae]" /></div>
        </aside>
      </div>
      {showGitHub && <GitHubDialog projectId={projectId} projectName={project.name} onClose={() => setShowGitHub(false)} />}
    </div>
  );
}
