"use client";

import { useState } from "react";
import { toast } from "./toastStore";
import { soundFx } from "./soundFx";

export function useClipboard() {
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copy = async (text: string, label = "Copied to clipboard") => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopiedText(text);
        soundFx.playClick();
        toast.info(label);
        setTimeout(() => setCopiedText(null), 2000);
        return true;
      }
    } catch (err) {
      console.error("Clipboard copy error:", err);
    }
    return false;
  };

  return { copy, copiedText };
}
