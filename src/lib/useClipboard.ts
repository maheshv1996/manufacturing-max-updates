"use client";

import { useState } from "react";
import { toast } from "./toastStore";
import { soundFx } from "./soundFx";

export function useClipboard() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = async (text: string, label = "Copied to clipboard") => {
    let success = false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      } else if (typeof document !== "undefined") {
        // Fallback for non-secure contexts or legacy webviews
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textArea);
      }
    } catch (err) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textArea);
      } catch (fallbackErr) {
        console.error("Clipboard copy error:", err, fallbackErr);
      }
    }

    if (success) {
      setCopiedText(text);
      soundFx.playClick();
      toast.info(label);
      setTimeout(() => setCopiedText(null), 2000);
      return true;
    }

    return false;
  };

  return { copy, copiedText };
}
