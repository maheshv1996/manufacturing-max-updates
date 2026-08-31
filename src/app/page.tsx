import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import Gateway from "./gateway/Gateway";

export const dynamic = "force-dynamic";

export default async function GatewayPage() {
  const settings = await getSettings();
  if (!settings.onboardingComplete) {
    redirect("/onboarding");
  }

  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const isLoggedIn = !!user.id || user.isOwner;

  return <Gateway initialUser={isLoggedIn ? user : null} />;
}
