import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import VoiceTerminalClient from "./VoiceTerminalClient";

export const metadata = {
  title: "Shopfloor Voice Terminal | Operations",
  description:
    "Acoustic voice synthesis & hands-free speech recognition: 1-spoken piece clocking, Andon radio dispatches, and telemetry lookups",
};

export const dynamic = "force-dynamic";

export default async function VoicePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/ops/voice");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <VoiceTerminalClient />;
}
