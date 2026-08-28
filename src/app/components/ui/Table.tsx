"use client";

import React from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/designTokens";

export function Table({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-3xl border border-border bg-surface-1 shadow-sm",
        className,
      )}
    >
      <table className="w-full text-left border-collapse text-xs">
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-surface-2/70 border-b border-border sticky top-0 z-10 backdrop-blur-md">
      {children}
    </thead>
  );
}

export function TableRow({
  children,
  className = "",
  onClick,
  highlighted = false,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  highlighted?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-border/50 last:border-0 transition-colors duration-150",
        onClick ? "cursor-pointer hover:bg-surface-2" : "hover:bg-surface-2/40",
        highlighted && "bg-accent/10",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  children,
  className = "",
  numeric = false,
  onSort,
  sortDirection,
}: {
  children: React.ReactNode;
  className?: string;
  numeric?: boolean;
  onSort?: () => void;
  sortDirection?: "asc" | "desc" | null;
}) {
  return (
    <th
      onClick={onSort}
      className={cn(
        "px-4 py-3 font-bold text-text-3 text-[11px] uppercase tracking-wider font-mono select-none",
        numeric && "text-right tabular-nums",
        onSort && "cursor-pointer hover:text-text-1 group",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1.5",
          numeric && "justify-end",
        )}
      >
        <span>{children}</span>
        {onSort && (
          <span className="text-text-3 group-hover:text-accent transition-colors">
            {sortDirection === "asc" ? (
              <ArrowUp className="w-3.5 h-3.5 text-accent" />
            ) : sortDirection === "desc" ? (
              <ArrowDown className="w-3.5 h-3.5 text-accent" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
            )}
          </span>
        )}
      </div>
    </th>
  );
}

export function TableCell({
  children,
  className = "",
  numeric = false,
}: {
  children: React.ReactNode;
  className?: string;
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3.5 text-text-2 text-xs",
        numeric && "text-right tabular-nums font-mono",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border/40">{children}</tbody>;
}
