"use client";


import { logClientError } from "@/lib/clientLogger";
import { offlineFetchWrapper } from "@/lib/offlineSync";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  KeyRound,
  LogOut,
  Loader2,
  X,
  Search,
  Bell,
  User as UserIcon,
  AlertCircle,
  AlertTriangle,
  Home,
  LayoutGrid,
  HelpCircle,
  Sparkles,
  Brain,
  Settings,
} from "lucide-react";
import InstallPrompt from "@/app/components/layout/InstallPrompt";
import OfflineSyncBadge from "@/app/components/layout/OfflineSyncBadge";
import PlantSwitcher from "@/app/components/layout/PlantSwitcher";
import ShiftClock from "@/app/components/layout/ShiftClock";
import ThemeSwitcher from "@/app/components/layout/ThemeSwitcher";
import SoundToggle from "@/app/components/layout/SoundToggle";
import LeaveModal from "../modals/LeaveModal";

interface TopbarProps {
  user: any;
  sessionPayload?: any;
}

export default function Topbar({ user }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [landingPage, setLandingPage] = useState<string>("/");
  const [fetchingPrefs, setFetchingPrefs] = useState(false);


  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      logClientError("Logout error:", err, "Topbar");
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

  const fetchPreferences = async () => {
    setFetchingPrefs(true);
    try {
      const res = await fetch("/api/user/prefs");
      const data = await res.json();
      if (data.prefs?.landingPage) {
        setLandingPage(data.prefs.landingPage);
      }
    } catch (err) {
      logClientError("Failed to fetch preferences:", err, "Topbar");
    } finally {
      setFetchingPrefs(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      logClientError("Failed to fetch notifications:", err, "Topbar");
    }
  };

  const handleAccountMenuToggle = () => {
    setShowAccountMenu(!showAccountMenu);
    setShowNotifications(false);
  };

  const handleNotificationsToggle = () => {
    setShowNotifications(!showNotifications);
    setShowAccountMenu(false);
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
      logClientError("Failed to update landing page", err, "Topbar");
    }
  };

  useEffect(() => {
    if (showAccountMenu && !fetchingPrefs) {
      fetchPreferences();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAccountMenu]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Poll every minute
    return () => clearInterval(interval);
  }, []);

  if (
    pathname === "/login" ||
    pathname === "/terminal" ||
    pathname === "/landing" ||
    pathname === "/" ||
    pathname?.startsWith("/track/")
  ) {
    return null;
  }

  return (
    <>
      <header className="sticky top-0 z-40 h-14 bg-surface-1/95 backdrop-blur-md border-b border-border text-text-1 flex items-center justify-between px-6 no-print">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 transition-all font-semibold text-sm"
            title="Return to 3D Home Gateway"
          >
            <Home className="w-4 h-4" />
            <span className="hidden sm:inline">Gateway</span>
          </Link>

          <Link
            href="/departments"
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-surface-3 transition-colors text-sm font-medium"
            title="Department Directory"
          >
            <LayoutGrid className="w-4 h-4 text-slate-400" />
            <span className="hidden sm:inline">Departments</span>
          </Link>

          <div className="h-5 w-px bg-border hidden md:block" />

          <div className="hidden md:flex items-center gap-2 text-sm font-medium text-text-2">
            <span className="capitalize">
              {pathname.split("/")[1] || "Dashboard"}
            </span>
            {pathname.split("/").length > 2 && (
              <>
                <span className="text-text-3">/</span>
                <span className="capitalize text-text-1">
                  {pathname.split("/")[2]}
                </span>
              </>
            )}
          </div>
          <button
            onClick={() =>
              window.dispatchEvent(new Event("open-command-palette"))
            }
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-2 border border-border rounded-control text-sm text-text-3 hover:text-text-2 hover:border-accent/50 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="hidden sm:inline-flex items-center gap-1 font-sans text-xs bg-surface-3 px-1.5 py-0.5 rounded ml-2">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <OfflineSyncBadge />
          {user && (user.isOwner || user.permissions?.includes("ops.view")) && (
            <div className="h-6 w-px bg-border mx-2 hidden sm:block" />
          )}
          {user && (user.isOwner || user.permissions?.includes("ops.view")) && (
            <PlantSwitcher user={user} />
          )}
          <ShiftClock />
          <ThemeSwitcher />
          <InstallPrompt />

          <Link
            href="/ai/cortex"
            className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-indigo-500/20 to-purple-600/20 hover:from-indigo-500/30 hover:to-purple-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Master Brain AI Cortex & 12 Autonomous Agents"
          >
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
            <span>Master Brain</span>
          </Link>

          <button
            onClick={() =>
              window.dispatchEvent(new Event("open-investor-modal"))
            }
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer shadow-xs"
            title="Investor Presentation & Interactive ROI Simulator"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Investor Demo</span>
          </button>

          <button
            onClick={() =>
              window.dispatchEvent(new Event("open-glossary-modal"))
            }
            className="p-1.5 text-text-2 hover:text-cyan-400 hover:bg-surface-3 rounded-control transition-colors cursor-pointer"
            title="Industrial & Aerospace Glossary (Definitions & Standards)"
            aria-label="Industrial & Aerospace Glossary"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <Link
            href="/system/admin"
            className="p-1.5 text-text-2 hover:text-white hover:bg-surface-3 rounded-control transition-colors cursor-pointer"
            title="System & AI Settings"
            aria-label="System & AI Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>

          <SoundToggle />

          <div className="relative">
            <button
              onClick={handleNotificationsToggle}
              aria-label="Notifications"
              aria-expanded={showNotifications}
              className="relative p-1.5 text-text-2 hover:text-text-1 hover:bg-surface-3 rounded-control transition-colors"
            >
              <Bell className="w-5 h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full ring-2 ring-surface-1"></span>
              )}
            </button>

            {showNotifications && (
              <div role="region" aria-label="Notifications panel" className="absolute right-0 mt-2 w-80 bg-surface-1 rounded-card shadow-modal border border-border overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-border bg-surface-2 flex justify-between items-center">
                  <h3 className="font-semibold text-text-1">Notifications</h3>
                  <span className="text-xs bg-surface-3 px-2 py-0.5 rounded-full text-text-2">
                    {notifications.length}
                  </span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-text-3">
                      No new notifications.
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {notifications.map((notif: any) => (
                        <a
                          key={notif.id}
                          href={notif.link}
                          className="block p-4 hover:bg-surface-2 transition-colors"
                          onClick={() => setShowNotifications(false)}
                        >
                          <div className="flex gap-3">
                            <div className="mt-0.5">
                              {notif.type === "danger" ? (
                                <AlertCircle className="w-5 h-5 text-rose-500" />
                              ) : (
                                <AlertTriangle className="w-5 h-5 text-orange-500" />
                              )}
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-text-1">
                                {notif.title}
                              </h4>
                              <p className="text-xs text-text-2 mt-1 line-clamp-2">
                                {notif.description}
                              </p>
                            </div>
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <a
                  href="/notifications"
                  onClick={() => setShowNotifications(false)}
                  className="block text-center py-2.5 text-xs font-semibold text-accent hover:bg-surface-2 border-t border-border transition-colors"
                >
                  View All →
                </a>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              onClick={handleAccountMenuToggle}
              className="flex items-center gap-2 p-1.5 rounded-control hover:bg-surface-3 transition-colors duration-200"
              aria-label="Account menu"
              title={user?.name ? `Good shift, ${user.name}` : "Account menu"}
            >
              <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center font-semibold uppercase">
                {user?.name?.[0] || "U"}
              </div>
            </button>

            {showAccountMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-surface-1 rounded-card shadow-modal border border-border overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-border bg-surface-2">
                  <p className="text-sm font-medium text-text-1 truncate">
                    {user?.name || "User"}
                  </p>
                </div>

                <div className="px-4 py-3 border-b border-border">
                  <label className="block text-xs font-semibold text-text-3 uppercase tracking-wider mb-2">
                    Default Landing Page
                  </label>
                  <select
                    value={landingPage}
                    onChange={(e) => handleLandingPageChange(e.target.value)}
                    className="w-full bg-surface-2 border border-border rounded-control text-sm px-2 py-1.5 focus:outline-none focus:border-accent"
                  >
                    <option value="/">Dashboard</option>
                    <option value="/terminal">Operator Terminal</option>
                    <option value="/ops/andon">Andon Screen</option>
                    <option value="/ops/schedule">Schedule</option>
                  </select>
                </div>

                <div className="py-1">
                  <Link
                    href="/system/admin"
                    onClick={() => setShowAccountMenu(false)}
                    className="w-full text-left px-4 py-2 text-sm text-text-2 hover:bg-surface-3 hover:text-text-1 flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    System & AI Settings
                  </Link>
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowLeaveModal(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text-2 hover:bg-surface-3 hover:text-text-1 flex items-center gap-2"
                  >
                    <UserIcon className="w-4 h-4" />
                    Apply Leave / History
                  </button>
                  <button
                    onClick={() => {
                      setShowAccountMenu(false);
                      setShowPasswordModal(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-text-2 hover:bg-surface-3 hover:text-text-1 flex items-center gap-2"
                  >
                    <KeyRound className="w-4 h-4" />
                    Change Password
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-danger-soft flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {showLeaveModal && (
          <LeaveModal onClose={() => setShowLeaveModal(false)} />
        )}
      </header>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-1 rounded-card shadow-modal max-w-md w-full border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-semibold text-text-1">
                Change Password
              </h3>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-text-3 hover:text-text-1 p-1 rounded-control hover:bg-surface-3 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-danger-soft border border-danger/20 text-danger text-sm rounded-control">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-2 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-surface-1 border border-border rounded-control px-3 py-2 text-sm text-text-1 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-2 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-surface-1 border border-border rounded-control px-3 py-2 text-sm text-text-1 focus:outline-none focus:border-accent"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-2 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-surface-1 border border-border rounded-control px-3 py-2 text-sm text-text-1 focus:outline-none focus:border-accent"
                    minLength={6}
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 text-sm font-medium text-text-2 hover:text-text-1 hover:bg-surface-3 rounded-control transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-control hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
