import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import PredictiveClient from "./PredictiveClient";

export const metadata = {
  title: "Predictive Maintenance & Spindle RUL | Maintenance",
  description:
    "Machine learning degradation forecasting: Weibull failure probability, ISO 10816 vibration trajectory, and preemptive bearing replacement",
};

export const dynamic = "force-dynamic";

export default async function PredictivePage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/maintenance/predictive");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <PredictiveClient />;
}
