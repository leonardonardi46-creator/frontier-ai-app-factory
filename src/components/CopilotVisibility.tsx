"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

export function CopilotVisibility() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const findTrigger = () => Array.from(document.queryuments || document.querySelectorAll("button")).find(
      (button) => button.textContent?.replace(/\s+/g, " ").trim().includes("Ask AI"),
    );

    const refresh = () => setAvailable(Boolean(findTrigger()));
    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("popstate", refresh);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", refresh);
    };
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
      style={{
        position: "fixed",
        right: "20px",
        bottom: "20px",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        minHeight: "48px",
        border: 0,
        borderRadius: "999px",
        background: "#214f40",
        color: "white",
        padding: "0 18px",
        boxShadow: "0 10px 28px rgba(21, 33, 29, 0.28)",
        fontSize: "14px",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      <Sparkles size={17} />
      Copilot
    </button>
  );
}
