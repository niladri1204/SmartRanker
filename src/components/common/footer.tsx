import React from "react";
import { APP_CONFIG } from "@/config/app";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
        <p>
          &copy; {new Date().getFullYear()} {APP_CONFIG.name}. Built with Next.js, React &
          TypeScript.
        </p>
        <div className="flex items-center gap-6">
          <span className="text-slate-600">Phase 1 Foundation</span>
          <span className="inline-block h-3 w-px bg-slate-800" />
          <span className="text-slate-400">Strict TypeScript Engine</span>
          <span className="inline-block h-3 w-px bg-slate-800" />
          <span className="text-slate-400">Modular Architecture</span>
        </div>
      </div>
    </footer>
  );
}
