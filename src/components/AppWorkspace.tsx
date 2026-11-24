"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  CircleHelp,
  Command,
  FolderKanban,
  LogOut,
  Plus,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type User = { id: string; email: string; role: "USER" | "ADMIN" };
type Project = {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
  _count: { requirements: number; checkpoints: number };
};
type ApiResult<T> = T & { error?: string };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await response.json().catch(() => ({}))) as ApiResult<T>;
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${small ? "h-8 w-8" : "h-10 w-10"} grid place-items-center rounded-xl bg-[#214f40] text-white`}>
        <Command size={small ? 17 : 20} strokeWidth={2.2} />
      </div>
      {!small && <span className="text-[15px] font-semibold tracking-[-.03em]">frontier<span className="text-[#829189]">/</span></span>}
    </div>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request<{ user: User }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onAuthenticated(result.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.05fr_.95fr]">
      <section className="relative hidden overflow-hidden bg-[#214f40] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-36 -top-20 h-[560px] w-[560px] rounded-full border border-white/10" />
        <div className="absolute -right-8 top-8 h-[300px] w-[300px] rounded-full border border-white/10" />
        <Logo />
        <div className="relative max-w-xl pb-14">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-emerald-50">
            <Sparkles size={14} /> Your idea, in motion
          </div>
          <h1 className="text-5xl font-medium leading-[1.07] tracking-[-.05em] xl:text-6xl">Build what&apos;s next. <span className="text-emerald-100/60">One thought at a time.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/65">A focused workspace to turn product ideas into real, editable software.</p>
        </div>
        <p className="text-xs text-white/45">A calmer way to build with AI.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[390px]">
          <div className="mb-12 lg:hidden"><Logo /></div>
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[.13em] text-[#829189]">{mode === "login" ? "Welcome back" : "Get started"}</p>
            <h2 className="text-[32px] font-semibold tracking-[-.045em]">{mode === "login" ? "Sign in to Frontier" : "Create your account"}</h2>
            <p className="mt-2 text-sm text-[#78827e]">{mode === "login" ? "Pick up right where you left off." : "Your workspace is waiting."}</p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">
              Email address
              <input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#e1e6e1] bg-white px-4 text-sm outline-none transition focus:border-[#527a68] focus:ring-2 focus:ring-[#527a68]/10" placeholder="you@company.com" />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input required minLength={12} maxLength={72} autoComplete={mode === "login" ? "current-password" : "new-password"} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[#e1e6e1] bg-white px-4 text-sm outline-none transition focus:border-[#527a68] focus:ring-2 focus:ring-[#527a68]/10" placeholder="At least 12 characters" />
            </label>
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#214f40] text-sm font-medium text-white transition hover:bg-[#183f32]">
              {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"} <ChevronRight size={16} />
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-[#78827e]">
            {mode === "login" ? "New to Frontier?" : "Already have an account?"}{" "}
            <button className="font-semibold text-[#214f40]" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <p className="mt-8 text-center text-xs leading-5 text-[#99a19d]">By continuing, you agree to keep your account credentials private.</p>
        </div>
      </section>
    </main>
  );
}

function AppSidebar({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-[#e8ebe7] bg-[#fbfcfa] p-5 md:flex md:flex-col">
      <div className="px-1"><Logo /></div>
      <div className="mt-10">
        <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[.15em] text-[#98a29d]">Workspace</p>
        <div className="flex items-center gap-3 rounded-xl bg-[#eaf0eb] px-3 py-2.5 text-sm font-medium text-[#214f40]">
          <FolderKanban size={17} /> My projects
        </div>
      </div>
      <div className="mt-auto">
        <div className="mb-4 rounded-xl border border-[#e8ebe7] bg-white p-3">
          <div className="flex items-start gap-2.5">
            <CircleHelp className="mt-0.5 text-[#829189]" size={17} />
            <div><p className="text-xs font-medium">Need a hand?</p><p className="mt-1 text-[11px] leading-4 text-[#89938e]">Build, preview, and export in one place.</p></div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-[#e8ebe7] pt-4">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e6eee8] text-xs font-semibold text-[#214f40]">{user.email.slice(0, 1).toUpperCase()}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{user.email}</p><p className="mt-0.5 text-[10px] text-[#89938e]">{user.role === "ADMIN" ? "Administrator" : "Personal workspace"}</p></div>
          <button onClick={onSignOut} title="Sign out" className="rounded-lg p-2 text-[#89938e] hover:bg-[#f1f3f0] hover:text-[#31413a]"><LogOut size={15} /></button>
        </div>
      </div>
    </aside>
  );
}

function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (project: Project) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await request<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      });
      onCreated(result.project);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create project");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#15211d]/35 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#87938c]">New workspace</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Create a project</h2></div><button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-[#78827e] hover:bg-[#f3f5f2]">✕</button></div>
        <label className="block text-sm font-medium">Project name<input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-[#e1e6e1] px-3 text-sm focus:border-[#527a68] focus:ring-[#527a68]/10" placeholder="e.g. Studio booking app" /></label>
        <label className="mt-4 block text-sm font-medium">What are you building?<textarea maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-lg border border-[#e1e6e1] px-3 py-2 text-sm focus:border-[#527a68] focus:ring-[#527a68]/10" placeholder="A short brief to keep the idea focused..." /></label>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-[#67736c] hover:bg-[#f3f5f2]">Cancel</button><button disabled={busy || !name.trim()} className="flex items-center gap-2 rounded-lg bg-[#214f40] px-4 py-2 text-sm font-medium text-white hover:bg-[#183f32]">{busy ? "Creating..." : "Create project"}<ArrowUpRight size={14} /></button></div>
      </form>
    </div>
  );
}

function Dashboard({ user, onSignOut, authError }: { user: User; onSignOut: () => void; authError: string }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    request<{ projects: Project[] }>("/api/projects")
      .then(({ projects: items }) => setProjects(items))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load projects"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen">
      <AppSidebar user={user} onSignOut={onSignOut} />
      <main className="min-w-0 flex-1">
        <header className="flex h-[68px] items-center justify-between border-b border-[#e8ebe7] bg-[#fbfcfa] px-5 md:px-10">
          <div className="flex items-center gap-3 md:hidden"><Logo small /><span className="text-sm font-semibold">frontier/</span></div>
          <div className="hidden text-sm text-[#89938e] md:block">Workspace <span className="px-1.5 text-[#c2c9c4]">/</span><span className="font-medium text-[#394741]">My projects</span></div>
          <div className="flex items-center gap-2">
            <button onClick={onSignOut} className="rounded-lg p-2 text-[#78827e] hover:bg-[#f0f3ef] md:hidden" title="Sign out"><LogOut size={17} /></button>
            <div className="hidden h-8 w-8 place-items-center rounded-full bg-[#e6eee8] text-xs font-semibold text-[#214f40] md:grid">{user.email.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1160px] px-5 pb-12 pt-9 md:px-10 md:pt-12">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="mb-2 text-xs font-semibold uppercase tracking-[.14em] text-[#829189]">Your workspace</p><h1 className="text-[32px] font-semibold tracking-[-.045em] md:text-[38px]">Ideas into apps.</h1><p className="mt-2 text-sm text-[#78827e]">A little progress adds up. What are you making today?</p></div>
            <button onClick={() => setShowNew(true)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#214f40] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#183f32]"><Plus size={17} /> New project</button>
          </div>
          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[#e7ebe7] bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs text-[#78827e]">Projects</span><FolderKanban size={16} className="text-[#91a097]" /></div><p className="mt-4 text-2xl font-semibold tracking-tight">{loading ? "—" : projects.length.toString().padStart(2, "0")}</p></div>
            <div className="rounded-xl border border-[#e7ebe7] bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs text-[#78827e]">Requirements tracked</span><Check size={16} className="text-[#91a097]" /></div><p className="mt-4 text-2xl font-semibold tracking-tight">{loading ? "—" : projects.reduce((total, project) => total + project._count.requirements, 0).toString().padStart(2, "0")}</p></div>
            <div className="rounded-xl border border-[#e7ebe7] bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs text-[#78827e]">Saved checkpoints</span><Boxes size={16} className="text-[#91a097]" /></div><p className="mt-4 text-2xl font-semibold tracking-tight">{loading ? "—" : projects.reduce((total, project) => total + project._count.checkpoints, 0).toString().padStart(2, "0")}</p></div>
          </div>
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Recent projects <span className="ml-1.5 font-normal text-[#9ba49f]">{projects.length}</span></h2><button onClick={() => setShowNew(true)} className="flex items-center gap-1 text-xs font-medium text-[#587463] hover:text-[#214f40]">Start fresh <ArrowUpRight size={13} /></button></div>
            {authError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{authError}</p>}
            {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {loading ? <div className="grid gap-3 md:grid-cols-2"><div className="h-40 animate-pulse rounded-2xl bg-[#e9ede9]" /><div className="h-40 animate-pulse rounded-2xl bg-[#e9ede9]" /></div> : projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d6ddd7] bg-white/60 px-5 py-14 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#eaf0eb] text-[#547464]"><WandSparkles size={20} /></div>
                <h3 className="mt-4 text-sm font-semibold">A blank canvas, full of possibility.</h3>
                <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#87918b]">Create your first project to collect requirements, edit code, and see it come to life.</p>
                <button onClick={() => setShowNew(true)} className="mt-5 rounded-lg border border-[#dce4dd] bg-white px-3 py-2 text-xs font-semibold text-[#315844] shadow-sm hover:bg-[#f7faf7]"><Plus size={14} className="mr-1 inline" /> Create your first project</button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {projects.map((project, index) => (
                  <Link key={project.id} href={`/projects/${project.id}`} className="group rounded-2xl border border-[#e7ebe7] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#cbd8cd] hover:shadow-[0_8px_24px_rgba(27,52,39,.06)]">
                    <div className="flex items-start justify-between"><div className={`grid h-10 w-10 place-items-center rounded-xl ${index % 2 ? "bg-[#f3eadc] text-[#936e3b]" : "bg-[#eaf0eb] text-[#547464]"}`}><Boxes size={17} /></div><ArrowUpRight size={16} className="text-[#aab3ad] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#547464]" /></div>
                    <h3 className="mt-5 truncate text-base font-semibold tracking-[-.02em]">{project.name}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-[#87918b]">{project.description || "No project brief yet."}</p>
                    <div className="mt-4 flex items-center gap-3 border-t border-[#f0f2ef] pt-3 text-[11px] text-[#89938e]"><span>{project._count.requirements} requirements</span><span className="h-1 w-1 rounded-full bg-[#c4ccc6]" /><span>{project._count.checkpoints} checkpoints</span><span className="ml-auto">{new Date(project.updatedAt).toLocaleDateString()}</span></div>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <p className="mt-10 flex items-center justify-center gap-1.5 text-[11px] text-[#a2aaa5]"><Sparkles size={12} /> One good idea is all it takes.</p>
        </div>
      </main>
      {showNew && <NewProjectDialog onClose={() => setShowNew(false)} onCreated={(project) => { setProjects((current) => [{ ...project, _count: { requirements: 0, checkpoints: 0 } }, ...current]); setShowNew(false); router.push(`/projects/${project.id}`); }} />}
    </div>
  );
}

export default function AppWorkspace() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("Service worker registration failed", error);
      });
    }
    request<{ user: User }>("/api/auth/me")
      .then(({ user: current }) => setUser(current))
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.message === "Authentication required") {
          setUser(null);
        } else {
          setLoadError(reason instanceof Error ? reason.message : "Unable to connect to the server");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function signOut() {
    setAuthError("");
    try {
      await request("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch (reason) {
      setAuthError(reason instanceof Error ? reason.message : "Unable to sign out");
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d9e3dc] border-t-[#214f40]" /></div>;
  if (loadError) return <main className="grid min-h-screen place-items-center p-6"><div className="max-w-sm text-center"><Logo /><h1 className="mt-5 text-lg font-semibold">Frontier is unavailable</h1><p role="alert" className="mt-2 text-sm text-[#78827e]">{loadError}</p><button onClick={() => window.location.reload()} className="mt-5 rounded-lg bg-[#214f40] px-4 py-2 text-sm text-white">Try again</button></div></main>;
  return user ? <Dashboard user={user} onSignOut={signOut} authError={authError} /> : <AuthScreen onAuthenticated={setUser} />;
}
