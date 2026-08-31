import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import CommissioningClient from "./CommissioningClient";

export const metadata = {
  title: "Virtual Commissioning & PLC Simulator | Digital Twin",
  description:
    "Hardware-in-the-loop simulation: Digital Inputs (DI), Actuator Outputs (DO), Analog Transducers, and Live Ladder Rungs",
};

export const dynamic = "force-dynamic";

export default async function CommissioningPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/digital-twin/commissioning");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <CommissioningClient />;
}
