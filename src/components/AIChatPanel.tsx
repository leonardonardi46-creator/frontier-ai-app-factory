"use client";

import Image from "next/image";
import { uploadPresigned } from "@vercel/blob/client";
import { useState } from "react";
import {
  Bot,
  ImagePlus,
  LoaderCircle,
  Paperclip,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type ProviderId = "openai" | "anthropic" | "ollama" | "nvidia";
type ChatMode = "build" | "chat";
type Attachment = { pathname: string; name: string; size: number; contentType: string };
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
  image?: string;
};
type Provider = { id: ProviderId; configured: boolean };
type ResponseData<T> = T & { error?: string };

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await response.json().catch(() => ({}))) as ResponseData<T>;
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-180) || "attachment";
}

export function AIChatPanel({
  projectId,
  currentCode,
  provider,
  onProviderChange,
  providers,
  providerError,
  onAppGenerated,
  onClose,
}: {
  projectId: string;
  currentCode: string;
  provider: ProviderId;
  onProviderChange: (provider: ProviderId) => void;
  providers: Provider[];
  providerError: string;
  onAppGenerated: (code: string) => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<ChatMode>("build");
  const [inputs, setInputs] = useState<Record<ChatMode, string>>({ build: "", chat: "" });
  const [buildMessages, setBuildMessages] = useState<Message[]>([
    { id: "build-welcome", role: "assistant", content: "Descrivi l'app da creare o la modifica da fare. La chat aggiorna il codice e apre l'anteprima." },
  ]);
  const [chatMessages, setChatMessages] = useState<Message[]>([
    { id: "chat-welcome", role: "assistant", content: "Ciao! Puoi farmi domande, allegare file o chiedermi di generare un'immagine." },
  ]);
  const [pendingFiles, setPendingFiles] = useState<Record<ChatMode, Attachment[]>>({ build: [], chat: [] });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const nvidiaConfigured = providers.find((item) => item.id === "nvidia")?.configured ?? false;
  const configuredProvider = providers.find((item) => item.id === provider)?.configured ?? false;
  const messages = mode === "build" ? buildMessages : chatMessages;
  const attachments = pendingFiles[mode];

  function updateMessages(target: ChatMode, update: (previous: Message[]) => Message[]) {
    if (target === "build") setBuildMessages(update);
    else setChatMessages(update);
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    const target = mode;
    if (pendingFiles[target].length + selected.length > 10) {
      setError("Puoi allegare al massimo 10 file per messaggio.");
      return;
    }
    setError("");
    for (const file of selected) {
      setUploading(file.name);
      setUploadProgress(0);
      try {
        const pathname = `chat/${projectId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
        const blob = await uploadPresigned(pathname, file, {
          access: "private",
          handleUploadUrl: `/api/projects/${projectId}/ai/files`,
          clientPayload: JSON.stringify({ projectId }),
          multipart: file.size > 5 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setUploadProgress(Math.round(percentage)),
        });
        const uploaded: Attachment = {
          pathname: blob.pathname,
          name: file.name,
          size: file.size,
          contentType: file.type || blob.contentType,
        };
        setPendingFiles((previous) => ({
          ...previous,
          [target]: [...previous[target], uploaded],
        }));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : `Impossibile caricare ${file.name}`);
      } finally {
        setUploading("");
      }
    }
  }

  async function removeAttachment(attachment: Attachment) {
    const target = mode;
    setError("");
    try {
      await requestJson(`/api/projects/${projectId}/ai/files`, {
        method: "DELETE",
        body: JSON.stringify({ pathname: attachment.pathname, name: attachment.name }),
      });
      setPendingFiles((previous) => ({
        ...previous,
        [target]: previous[target].filter((item) => item.pathname !== attachment.pathname),
      }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossibile rimuovere il file");
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const content = inputs[mode].trim();
    if (!content || busy || uploading) return;
    const target = mode;
    const files = pendingFiles[target];
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      attachments: files,
    };
    const previousMessages = target === "build" ? buildMessages : chatMessages;
    updateMessages(target, (previous) => [...previous, userMessage]);
    setInputs((previous) => ({ ...previous, [target]: "" }));
    setPendingFiles((previous) => ({ ...previous, [target]: [] }));
    setBusy(true);
    setError("");
    try {
      if (target === "build") {
        const result = await requestJson<{ code: string }>(`/api/projects/${projectId}/ai`, {
          method: "POST",
          body: JSON.stringify({
            instruction: content,
            provider,
            currentCode,
            history: previousMessages
              .filter((message) => message.id !== "build-welcome")
              .slice(-20)
              .map(({ role, content: text }) => ({ role, content: text })),
            attachments: files.map(({ pathname, name }) => ({ pathname, name })),
          }),
        });
        await onAppGenerated(result.code);
        updateMessages(target, (previous) => [...previous, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "App aggiornata e anteprima generata. Puoi chiedermi altre modifiche.",
        }]);
      } else {
        const history = [...previousMessages, userMessage]
          .filter((message) => message.id !== "chat-welcome")
          .slice(-20)
          .map(({ role, content: text }) => ({ role, content: text }));
        const result = await requestJson<{ message: string }>(`/api/projects/${projectId}/ai/chat`, {
          method: "POST",
          body: JSON.stringify({
            messages: history,
            attachments: files.map(({ pathname, name }) => ({ pathname, name })),
          }),
        });
        updateMessages(target, (previous) => [...previous, {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.message,
        }]);
      }
    } catch (reason) {
      if (files.length) {
        setPendingFiles((previous) => ({
          ...previous,
          [target]: [...files, ...previous[target]],
        }));
      }
      setError(reason instanceof Error ? reason.message : "La richiesta AI non è riuscita");
    } finally {
      setBusy(false);
    }
  }

  async function generateImage() {
    const prompt = inputs[mode].trim();
    if (!prompt || busy || uploading || !nvidiaConfigured) return;
    const target = mode;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: `Genera un'immagine: ${prompt}` };
    updateMessages(target, (previous) => [...previous, userMessage]);
    setInputs((previous) => ({ ...previous, [target]: "" }));
    setBusy(true);
    setError("");
    try {
      const result = await requestJson<{ image: string }>(`/api/projects/${projectId}/ai/image`, {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      updateMessages(target, (previous) => [...previous, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Ecco l'immagine generata da NVIDIA.",
        image: result.image,
      }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Generazione immagine non riuscita");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex max-h-[48vh] min-h-[310px] shrink-0 flex-col border-b border-[#dfe7df] bg-[#f7f9f6]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#e2e8e1] px-3 py-2 sm:px-5">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-[#e9eee8] p-1" role="tablist" aria-label="Modalità chat AI">
            <button type="button" role="tab" aria-selected={mode === "build"} onClick={() => { setMode("build"); setError(""); }} className={`rounded-md px-3 py-1.5 text-[11px] font-medium ${mode === "build" ? "bg-white text-[#315844] shadow-sm" : "text-[#89938e]"}`}>Costruisci app</button>
            <button type="button" role="tab" aria-selected={mode === "chat"} onClick={() => { setMode("chat"); setError(""); }} className={`rounded-md px-3 py-1.5 text-[11px] font-medium ${mode === "chat" ? "bg-white text-[#315844] shadow-sm" : "text-[#89938e]"}`}>Chat AI</button>
          </div>
          {mode === "build" && <select aria-label="Provider AI per costruire l'app" value={provider} onChange={(event) => onProviderChange(event.target.value as ProviderId)} className="h-8 rounded-lg border border-[#dce5dc] bg-white px-2 text-[10px]">
            <option value="nvidia">NVIDIA NIM</option>
            <option value="ollama">Ollama</option>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>}
        </div>
        <button type="button" onClick={onClose} aria-label="Chiudi chat AI" className="rounded p-1 text-[#88938c] hover:bg-white"><X size={15} /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-5" role="log" aria-live="polite">
        <div className="mx-auto flex max-w-4xl flex-col gap-2">
          {messages.map((message) => (
            <article key={message.id} className={`flex gap-2 ${message.role === "user" ? "flex-row-reverse" : ""}`}>
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${message.role === "user" ? "bg-[#dce7dd] text-[#315844]" : "bg-[#214f40] text-white"}`}>
                {message.role === "user" ? <UserRound size={13} /> : <Bot size={13} />}
              </span>
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-5 ${message.role === "user" ? "bg-[#e6efe7] text-[#34483b]" : "border border-[#e5eae4] bg-white text-[#3d4941]"}`}>
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                {message.attachments?.map((attachment) => (
                  <p key={attachment.pathname} className="mt-1 flex items-center gap-1 text-[10px] text-[#65766a]">
                    <Paperclip size={11} /> {attachment.name} · {formatSize(attachment.size)}
                  </p>
                ))}
                {message.image && <Image src={message.image} alt="Immagine generata da NVIDIA" width={512} height={512} unoptimized className="mt-2 h-auto max-h-64 w-auto rounded-lg" />}
              </div>
            </article>
          ))}
          {busy && <div className="flex items-center gap-2 pl-8 text-[11px] text-[#7c8980]"><LoaderCircle size={13} className="animate-spin" /> NVIDIA sta preparando una risposta…</div>}
        </div>
      </div>

      {error && <p role="alert" className="mx-3 mb-1 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 sm:mx-5">{error}</p>}
      {providerError && <p role="alert" className="mx-3 mb-1 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700 sm:mx-5">{providerError}</p>}
      {!providerError && mode === "build" && !configuredProvider && <p className="mx-3 mb-1 text-[10px] text-[#87918b] sm:mx-5">Configura la chiave API del provider selezionato sul server per costruire l&apos;app.</p>}
      {!providerError && mode === "chat" && !nvidiaConfigured && <p className="mx-3 mb-1 text-[10px] text-[#87918b] sm:mx-5">Configura NVIDIA_API_KEY sul server per usare la chat.</p>}
      {attachments.length > 0 && <div className="mx-auto flex w-full max-w-4xl flex-wrap gap-1 px-3 pb-1 sm:px-5">
        {attachments.map((attachment) => <span key={attachment.pathname} className="inline-flex max-w-full items-center gap-1 rounded-md border border-[#dce5dc] bg-white px-2 py-1 text-[10px] text-[#56665b]">
          <Paperclip size={10} /><span className="max-w-40 truncate">{attachment.name}</span><span className="text-[#909a93]">{formatSize(attachment.size)}</span>
          <button type="button" aria-label={`Rimuovi ${attachment.name}`} onClick={() => void removeAttachment(attachment)} className="ml-1 rounded text-[#89938e] hover:text-red-600"><X size={11} /></button>
        </span>)}
      </div>}
      {uploading && <p className="mx-auto w-full max-w-4xl px-3 pb-1 text-[10px] text-[#6d7f72] sm:px-5">Caricamento di {uploading}: {uploadProgress}%</p>}

      <form onSubmit={(event) => void sendMessage(event)} className="mx-auto flex w-full max-w-4xl items-end gap-2 px-3 pb-3 pt-1 sm:px-5">
        <input
          type="file"
          multiple
          className="hidden"
          id={`ai-file-input-${mode}`}
          onChange={(event) => { void addFiles(event.currentTarget.files); event.currentTarget.value = ""; }}
        />
        <label htmlFor={`ai-file-input-${mode}`} title="Allega file di qualsiasi tipo" className={`grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-[#dce5dc] bg-white text-[#62766a] hover:bg-[#f0f5f0] ${(busy || uploading) ? "pointer-events-none opacity-50" : ""}`}><Paperclip size={15} /></label>
        <textarea
          value={inputs[mode]}
          onChange={(event) => setInputs((previous) => ({ ...previous, [mode]: event.target.value }))}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
          rows={2}
          maxLength={8000}
          disabled={busy || Boolean(uploading)}
          className="min-h-9 min-w-0 flex-1 resize-y rounded-xl border border-[#dce5dc] bg-white px-3 py-2 text-xs leading-5 focus:border-[#7c9b83] focus:ring-[#7c9b83]/10 disabled:bg-[#f0f2ef]"
          placeholder={mode === "build" ? "Descrivi l'app o la modifica da realizzare…" : "Scrivi una domanda…"}
        />
        <button type="button" disabled={!inputs[mode].trim() || busy || Boolean(uploading) || !nvidiaConfigured} onClick={() => void generateImage()} title={!nvidiaConfigured ? "Configura NVIDIA_API_KEY sul server" : "Genera un'immagine con NVIDIA"} className="flex h-9 shrink-0 items-center gap-1 rounded-lg border border-[#dce5dc] bg-white px-2 text-[10px] font-medium text-[#52685a] disabled:opacity-50"><ImagePlus size={14} /><span className="hidden sm:inline">Immagine</span></button>
        <button type="submit" disabled={!inputs[mode].trim() || busy || Boolean(uploading) || (mode === "build" ? !configuredProvider : !nvidiaConfigured)} title={mode === "build" && !configuredProvider ? `Configura la chiave API per ${provider}` : ""} className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[#214f40] px-3 text-xs font-medium text-white disabled:bg-[#9aada0]">
          {busy ? <LoaderCircle size={13} className="animate-spin" /> : mode === "build" ? <Sparkles size={13} /> : <Send size={13} />}
          <span className="hidden sm:inline">{mode === "build" ? "Crea" : "Invia"}</span>
        </button>
      </form>
      <p className="px-3 pb-2 text-center text-[9px] text-[#89938e] sm:px-5">
        File privati su Vercel Blob (max 5 TB per file, eliminati dopo 30 giorni); testo/PDF e immagini supportate possono essere letti entro i limiti NVIDIA.
      </p>
    </section>
  );
}
