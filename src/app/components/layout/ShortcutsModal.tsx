"use client";

import { useState, useEffect } from "react";
import {
  Keyboard,
  X,
  Search,
  Home,
  LayoutGrid,
  Cog,
  ClipboardList,
  Brain,
} from "lucide-react";

export default function ShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const shortcutGroups = [
    {
      category: "Global Navigation",
      items: [
        {
          keys: ["Ctrl", "K"],
          desc: "Open Omnibar Search & Command Palette",
          icon: Search,
        },
        {
          keys: ["Ctrl", "Space"],
          desc: "Toggle AURA AI Co-Pilot & Industrial Assistant",
          icon: Brain,
        },
        {
          keys: ["?"],
          desc: "Toggle this Keyboard Shortcuts Cheatsheet",
          icon: Keyboard,
        },
        {
          keys: ["ESC"],
          desc: "Close active modal, search, or dialog",
          icon: X,
        },
      ],
    },
    {
      category: "Quick Jumps",
      items: [
        { keys: ["Gateway"], desc: "Return to 3D Main Gateway", icon: Home },
        {
          keys: ["Departments"],
          desc: "Open 13-Department Industrial Hub",
          icon: LayoutGrid,
        },
        {
          keys: ["Work Orders"],
          desc: "Production Work Order Dispatch",
          icon: ClipboardList,
        },
        { keys: ["Machines"], desc: "Machine Register & Telemetry", icon: Cog },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div
        className="bg-surface-1 rounded-3xl shadow-2xl w-full max-w-lg border border-border overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-2/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent/15 text-accent">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-text-1">
                Keyboard Shortcuts
              </h3>
              <p className="text-[11px] text-text-3 font-mono">
                Press ? anytime to open
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-xl hover:bg-surface-3 text-text-3 hover:text-text-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-3 font-mono">
                {group.category}
              </span>
              <div className="space-y-2">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-2xl bg-surface-2/60 border border-border/70 text-xs"
                  >
                    <div className="flex items-center gap-2.5 text-text-1 font-medium">
                      <item.icon className="w-4 h-4 text-text-3" />
                      <span>{item.desc}</span>
                    </div>
                    <div className="flex items-center gap-1 font-mono shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-lg bg-surface-3 border border-border text-[11px] text-text-2 font-bold shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-border/60 bg-surface-2/40 text-[11px] text-text-3 flex items-center justify-between font-mono">
          <span>Enterprise Smart Factory Ergonomics</span>
          <span>Tip: Press ESC to dismiss</span>
        </div>
      </div>

      {/* Backdrop click to close */}
      <div
        className="absolute inset-0 z-[-1]"
        onClick={() => setIsOpen(false)}
      />
    </div>
  );
}
