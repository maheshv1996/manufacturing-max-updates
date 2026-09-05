"use client";
/* eslint-disable @next/next/no-img-element -- dynamic branding logoUrl (external/upload) must use <img> */

import { can } from "@/lib/permissions";
import { DEPARTMENTS } from "@/lib/departments";
import { cn } from "@/lib/designTokens";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { Factory } from "lucide-react";
import SidebarUpdateButton from "@/app/components/shared/SidebarUpdateButton";

function itemActive(pathname: string, href: string) {
  const clean = href.split("?")[0];
  return pathname === clean || pathname.startsWith(clean + "/");
}

/**
 * TILE-FIRST NAVIGATION — the sidebar is a permanent 64px icon rail of the 13
 * department squircles (gradients from src/lib/departments.ts). No expanding
 * text lists anywhere: click a tile to land on that department's hub, where
 * sub-function tiles take you the rest of the way. Hidden on /terminal and
 * prints (no-print).
 */
export default function Sidebar({
  user,
  branding,
  activeDepartments = null,
}: {
  user: any;
  branding?: any;
  activeDepartments?: string[] | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // RBAC first, then the onboarding department toggle (key absent = all ON).
  const allowed = useMemo(
    () =>
      DEPARTMENTS.filter(
        (d) => user?.isOwner || can(user, d.permissionKey),
      ).filter(
        (d) =>
          !activeDepartments ||
          activeDepartments.length === 0 ||
          activeDepartments.includes(d.id),
      ),
    [user, activeDepartments],
  );

  if (
    pathname === "/login" ||
    pathname === "/terminal" ||
    pathname === "/landing" ||
    pathname === "/" ||
    pathname?.startsWith("/track/")
  ) {
    return null;
  }

  const activeId = allowed.find(
    (d) =>
      itemActive(pathname, d.hub) ||
      d.functions.some((f) => itemActive(pathname, f.href)),
  )?.id;

  return (
    <aside className="w-[64px] fixed inset-y-0 left-0 bg-surface-2 border-r border-border hidden md:flex flex-col z-30 no-print">
      {/* Brand mark */}
      <Link
        href="/"
        title="Return to Gateway"
        className="h-14 shrink-0 flex items-center justify-center border-b border-border hover:bg-surface-3 transition-colors cursor-pointer"
      >
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt="Logo"
            title={branding?.appName || "MfgMax"}
            className="h-8 w-8 object-contain rounded-lg"
          />
        ) : (
          <div
            title={branding?.appName || "MfgMax"}
            className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 text-white shadow-md hover:scale-105 transition-transform"
          >
            <Factory className="h-5 w-5" />
          </div>
        )}
      </Link>

      {/* Department tiles */}
      <nav aria-label="Department Navigation" className="flex-1 py-3 px-2 flex flex-col gap-1.5 overflow-y-auto">
        {allowed.map((d) => {
          const Icon = d.icon;
          const active = d.id === activeId;
          return (
            <motion.button
              key={d.id}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => router.push(d.hub)}
              title={d.title}
              aria-label={d.title}
              className="relative mx-auto block h-11 w-11 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
              style={
                active
                  ? { boxShadow: `0 0 16px ${d.glow}, 0 0 32px ${d.glow}` }
                  : undefined
              }
            >
              <span
                className={cn(
                  "flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br text-white transition-all duration-200",
                  d.gradient,
                  active
                    ? "ring-2 ring-white/40"
                    : "opacity-75 hover:opacity-100 hover:shadow-lg",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {active && (
                <motion.span
                  layoutId="rail-accent"
                  className="absolute -left-2 top-1/2 -translate-y-1/2 h-6 w-1 rounded-full bg-[var(--color-accent)]"
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Bottom of the rail: check for updates (opens release-notes dialog) */}
      <div className="shrink-0 py-2 border-t border-border">
        <SidebarUpdateButton />
      </div>
    </aside>
  );
}
