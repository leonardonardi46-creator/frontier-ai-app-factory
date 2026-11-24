"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export function CopilotVisibility() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const findTrigger = () => Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.replace(/\s+/g, " ").trim().includes("Ask AI"),
    );
    const refresh = () => setAvailable(Boolean(findTrigger()));

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  function openCopilot() {
    const trigger = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent?.replace(/\s+/g, " ").trim().includes("Ask AI"),
    );
    trigger?.click();
  }

  if (!available) return null;

  return (
    <button
      type="button"
      onClick={openCopilot}
      aria-label="Apri Copilot"
      className="fixed bottom-5 right-5 z-40 flex min-h-12 items-center gap-2 rounded-full border-0 bg-[#214f40] px-4 text-sm font-bold text-white shadow-xl transition hover:bg-[#183f32] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#214f40]"
    >
      <Sparkles size={17} aria-hidden="true" />
      Copilot
    </button>
  );
}
