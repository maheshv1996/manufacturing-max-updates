"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Topbar from "./Topbar";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import OfflineToastNotifier from "./OfflineToastNotifier";
import ServerHealthBanner from "./ServerHealthBanner";
import SubscriptionGuard from "./SubscriptionGuard";
import CommandPalette from "./CommandPalette";
import ShortcutsModal from "./ShortcutsModal";
import TopProgressBar from "./TopProgressBar";
import GlossaryModal from "./GlossaryModal";
import SessionInactivityGuard from "./SessionInactivityGuard";
import InvestorDemoModal from "@/app/components/shared/InvestorDemoModal";
import { can } from "@/lib/permissions";
import { useDeviceTier, PREMIUM_EASE } from "@/lib/motion";

export default function AppShell({
  children,
  user,
  branding: _branding,
  onboardingComplete = false,
  onboardingSkipped = false,
}: {
  children: React.ReactNode;
  user: any;
  branding?: any;
  activeDepartments?: string[] | null;
  onboardingComplete?: boolean;
  onboardingSkipped?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const tier = useDeviceTier();

  const isExcluded =
    pathname === "/login" ||
    pathname === "/landing" ||
    pathname === "/terminal" ||
    pathname === "/" ||
    pathname?.startsWith("/track/");

  // First-run wizard: OWNER/ADMIN users are routed to /onboarding until they
  // complete (or dismiss) it. Skipped paths never redirect.
  const needsOnboarding = !!(
    user &&
    (user.isOwner || can(user, "system.edit")) &&
    !onboardingComplete &&
    !onboardingSkipped
  );
  const onOnboardingPath =
    pathname === "/onboarding" || pathname?.startsWith("/onboarding/");
  const redirectToOnboarding =
    needsOnboarding && !isExcluded && !onOnboardingPath;

  useEffect(() => {
    if (redirectToOnboarding) router.replace("/onboarding");
  }, [redirectToOnboarding, router]);

  if (redirectToOnboarding) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen">
        <div className="text-center text-slate-400">
          <div className="h-8 w-8 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          Preparing your workspace…
        </div>
      </div>
    );
  }

  // Slow drifting aurora behind the app — transform/opacity only, so it
  // stays GPU-composited; only on capable desktops, never on touch or with
  // reduced motion. This is what makes glass cards read as "lit from behind".
  const showAurora = !reducedMotion && tier === "high";

  return (
    <>
      {showAurora && !isExcluded && (
        <div
          aria-hidden
          className="fixed inset-0 -z-10 pointer-events-none overflow-hidden hidden lg:block"
        >
          <div
            className="absolute -top-[20%] -left-[10%] w-[55vw] h-[55vw] rounded-full opacity-60 blur-[110px] animate-aurora"
            style={{
              background:
                "radial-gradient(circle, rgba(59,130,246,0.16), transparent 65%)",
            }}
          />
          <div
            className="absolute -bottom-[25%] -right-[10%] w-[60vw] h-[60vw] rounded-full opacity-50 blur-[130px] animate-aurora-delayed"
            style={{
              background:
                "radial-gradient(circle, rgba(139,92,246,0.12), transparent 65%)",
            }}
          />
        </div>
      )}
      <TopProgressBar />
      <ServiceWorkerRegister />
      <OfflineToastNotifier />
      <ServerHealthBanner />
      <CommandPalette />
      <ShortcutsModal />
      <GlossaryModal />
      <SessionInactivityGuard />
      <InvestorDemoModal />

      <div className="flex-1 flex flex-col min-h-screen">
        {!isExcluded && <Topbar user={user} />}

        {isExcluded ? (
          children
        ) : (
          <SubscriptionGuard>
            <motion.main
              key={pathname}
              initial={reducedMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: PREMIUM_EASE }}
              className="flex-1 p-6 print:!p-0 print:!transform-none print:!animate-none"
            >
              {children}
            </motion.main>
          </SubscriptionGuard>
        )}
      </div>
    </>
  );
}
