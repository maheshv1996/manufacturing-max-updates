"use client";


import { logClientError } from "@/lib/clientLogger";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock, ShieldAlert } from "lucide-react";

export default function SubscriptionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [status, setStatus] = useState<string>("ACTIVE");
  const [loading, setLoading] = useState(true);

  // Excluded paths that are always accessible
  const isExcluded =
    pathname === "/login" ||
    pathname === "/landing" ||
    pathname === "/system/subscription";

  useEffect(() => {
    if (isExcluded) {
      setLoading(false);
      return;
    }

    async function checkStatus() {
      try {
        const res = await fetch("/api/billing/status");
        if (res.ok) {
          const data = await res.json();
          setStatus(data.paymentStatus);
        }
      } catch (err) {
        logClientError("Failed to check subscription status", err, "SubscriptionGuard");
      } finally {
        setLoading(false);
      }
    }
    checkStatus();
  }, [pathname, isExcluded]);

  if (isExcluded) return <>{children}</>;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (status === "LOCKED") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-900">
        <div className="w-24 h-24 bg-rose-100 dark:bg-rose-900/30 text-rose-600 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-black text-white tracking-tight mb-4">
          Subscription Expired
        </h1>
        <p className="text-lg text-slate-400 max-w-md mb-8">
          Your access to Manufacturing Max has been locked due to an overdue
          payment. Please renew your subscription to continue.
        </p>
        <Link
          href="/system/subscription"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
        >
          <ShieldAlert className="w-5 h-5" />
          Go to Billing & Renew
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
