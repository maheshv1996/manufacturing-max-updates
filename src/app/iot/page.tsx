import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import IoTClient from "./IoTClient";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function IoTPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const cookieStore = await cookies();
  const tokenStr = cookieStore.get("app_session")?.value;
  const token = tokenStr ? await verifySessionToken(tokenStr) : null;
  if (
    !token ||
    (token.roleName !== "ADMIN" && token.roleName !== "SUPERVISOR")
  ) {
    redirect("/login");
  }

  // Fetch machines that are IoT enabled
  const machines = await prisma.machine.findMany({
    where: { iotEnabled: true },
    select: { id: true, name: true, code: true, currentState: true },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
          IoT Telemetry & Machine Simulator
        </h1>
        <p className="text-slate-400 mt-2">
          Watch machines self-report their real-time state and auto-log
          downtime.
        </p>
      </div>
      <IoTClient machines={machines} />
    </div>
  );
}
