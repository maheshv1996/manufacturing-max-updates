"use client";


import { logClientError } from "@/lib/clientLogger";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last line of defense: a render-phase crash anywhere in the tree must never
 * produce a white screen. Shows a branded glass fallback with a reload button
 * instead. (Event-handler errors are not caught here — they are handled
 * locally — but anything thrown during render is.)
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    logClientError("[ErrorBoundary] page crash caught:", error, "ErrorBoundary");
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen w-full bg-[#030408] text-white flex items-center justify-center p-6">
          <div className="relative z-10 max-w-md w-full text-center space-y-6">
            <div className="inline-flex p-3 bg-gradient-to-br from-blue-500 to-indigo-700 rounded-2xl shadow-lg shadow-blue-500/30">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              Something went wrong
            </h1>
            <p className="text-slate-400 text-sm font-medium">
              This screen hit an unexpected error. Your data is safe — reload to
              continue.
            </p>
            {this.state.error?.message ? (
              <p className="text-slate-500 text-xs font-mono break-all bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                {this.state.error.message}
              </p>
            ) : null}
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ error: null });
                  if (typeof window !== "undefined") window.location.reload();
                }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-700 text-white font-bold text-xs shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 transition-all cursor-pointer"
              >
                Reload Page
              </button>
              <a
                href="/"
                className="px-5 py-2.5 rounded-2xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 font-bold text-xs transition-all cursor-pointer"
              >
                Return to Gateway
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
