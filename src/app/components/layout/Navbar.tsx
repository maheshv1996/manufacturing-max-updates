"use client";


import { logClientError } from "@/lib/clientLogger";
import { offlineFetchWrapper } from "@/lib/offlineSync";
/* eslint-disable @next/next/no-img-element -- dynamic branding logo URL requires <img> (external/uploaded, not statically optimizable) */

import { can } from "@/lib/permissions";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Factory,
  LayoutDashboard,
  ClipboardList,
  Tablet,
  BarChart3,
  LogOut,
  Activity,
  CalendarDays,
  FlaskConical,
  TrendingUp,
  Settings,
  ClipboardEdit,
  UserCircle,
  KeyRound,
  X,
  Loader2,
  FileText,
  Trophy,
  Coffee,
  Sparkles,
  ShieldAlert,
  Wrench,
  Lightbulb,
  FolderKanban,
  User as UserIcon,
} from "lucide-react";

import InstallPrompt from "@/app/components/layout/InstallPrompt";
import OfflineSyncBadge from "@/app/components/layout/OfflineSyncBadge";
import PlantSwitcher from "@/app/components/layout/PlantSwitcher";
import LeaveModal from "../modals/LeaveModal";

export default function Navbar({
  user,
  branding,
}: {
  user: any;
  branding?: any;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [landingPage, setLandingPage] = useState<string>("/");
  const [fetchingPrefs, setFetchingPrefs] = useState(false);

  if (pathname === "/login") {
    return null;
  }

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/analyst", label: "Analyst", icon: Sparkles },
    { href: "/commercial/quotations", label: "Quotations", icon: FileText },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/ops/work-orders", label: "Work Orders", icon: ClipboardList },
    { href: "/terminal", label: "Operator", icon: Tablet },
    { href: "/ops/andon", label: "Andon", icon: Activity },
    { href: "/ops/schedule", label: "Schedule", icon: CalendarDays },
    { href: "/ops/capacity", label: "Capacity", icon: CalendarDays },
    { href: "/ops/spc", label: "SPC", icon: FlaskConical },
    { href: "/system/kaizen", label: "Kaizen", icon: TrendingUp },
    { href: "/people/handover", label: "Handover", icon: ClipboardEdit },
    { href: "/system/lean", label: "Lean Analytics", icon: BarChart3 },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/digest", label: "Digest", icon: Coffee },
    { href: "/people/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/system/fives", label: "5S", icon: Sparkles },
    { href: "/system/ideas", label: "Idea Box", icon: Lightbulb },
    { href: "/system/safety", label: "Safety EHS", icon: ShieldAlert },
  ];

  if (
    user.isOwner ||
    can(user, "system.edit") ||
    user.isOwner ||
    can(user, "ops.edit")
  ) {
    navItems.push({
      href: "/system/maintenance",
      label: "Maintenance",
      icon: Wrench,
    });
    navItems.push({ href: "/supply/tools", label: "Tools", icon: Wrench });
    navItems.push({
      href: "/ops/scrap",
      label: "Scrap MRB",
      icon: ShieldAlert,
    });
    navItems.push({ href: "/ops/rework", label: "Rework", icon: Wrench });
    navItems.push({
      href: "/people/attendance",
      label: "Attendance",
      icon: UserCircle,
    });
    navItems.push({
      href: "/supply/reconcile",
      label: "Reconcile",
      icon: ClipboardEdit,
    });
    navItems.push({ href: "/system/admin", label: "Admin", icon: Settings });
  } else {
    navItems.push({
      href: "/system/maintenance",
      label: "Maintenance",
      icon: Wrench,
    });
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      logClientError("Logout error:", err, "Navbar");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await offlineFetchWrapper("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        setShowPasswordModal(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        router.refresh();
      } else {
        setError(data.error || "Failed to change password");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleAccountMenuToggle = async () => {
    const newState = !showAccountMenu;
    setShowAccountMenu(newState);

    if (newState && !fetchingPrefs) {
      setFetchingPrefs(true);
      try {
        const res = await fetch("/api/user/prefs");
        if (res.ok) {
          const data = await res.json();
          if (data.prefs?.landingPage) {
            setLandingPage(data.prefs.landingPage);
          }
        }
      } catch (err) {
        logClientError("Failed to load prefs in navbar", err, "Navbar");
      }
    }
  };

  const handleLandingPageChange = async (newPath: string) => {
    setLandingPage(newPath);
    try {
      const res = await fetch("/api/user/prefs");
      const data = await res.json();
      const currentPrefs = data.prefs || {};
      currentPrefs.landingPage = newPath;

      await offlineFetchWrapper("/api/user/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentPrefs),
      });
    } catch (err) {
      logClientError("Failed to update landing page", err, "Navbar");
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              {branding?.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="w-8 h-8 object-contain bg-white rounded p-0.5"
                />
              ) : (
                <div className="p-2 bg-accent rounded-lg text-white shadow-md transition-colors var-accent-bg">
                  <Factory className="w-5 h-5" />
                </div>
              )}
              <span className="font-bold tracking-tight text-lg text-white">
                {branding?.appName || "Manufacturing Max"}
              </span>
            </Link>

            <nav className="flex items-center gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-accent/20 text-accent border border-accent/30 var-accent-text var-accent-border"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: `color-mix(in srgb, var(--color-accent) 20%, transparent)`,
                            borderColor: `color-mix(in srgb, var(--color-accent) 30%, transparent)`,
                          }
                        : {}
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
              {showLeaveModal && (
                <LeaveModal onClose={() => setShowLeaveModal(false)} />
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <PlantSwitcher user={user} />
            <OfflineSyncBadge />

            <InstallPrompt />

            <div className="relative">
              <button
                onClick={handleAccountMenuToggle}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <UserCircle className="w-5 h-5" />
              </button>

              {showAccountMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden py-1 z-50">
                  <div className="px-4 py-2 border-b border-slate-800">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      My Landing Page
                    </label>
                    <select
                      value={landingPage}
                      onChange={(e) => handleLandingPageChange(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded px-2 py-1 focus:outline-none focus:border-accent"
                    >
                      <option value="/">Dashboard</option>
                      <option value="/digest">Digest</option>
                      <option value="/people/leaderboard">Leaderboard</option>
                      <option value="/ops/schedule">Schedule</option>
                      <option value="/terminal">Operator</option>
                    </select>
                  </div>
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowPasswordModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                  >
                    <KeyRound className="w-4 h-4 text-blue-400" />
                    Change Password
                  </button>
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowLeaveModal(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2"
                  >
                    <UserIcon className="w-4 h-4" /> Apply Leave / History
                  </button>
                  <div className="h-px bg-slate-800 my-1" />
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => {
                setShowPasswordModal(false);
                setError(null);
              }}
              className="absolute top-4 right-4 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold text-white mb-6">
              Change Password
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-sm text-rose-400 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-white px-3 py-2.5 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  placeholder="Re-enter new password"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
