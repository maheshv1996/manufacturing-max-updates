import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import TelemetryClient from "./TelemetryClient";

export const metadata = {
  title: "Real-Time Sensor Telemetry Historian | IIoT",
  description:
    "High-frequency edge waveform streams, spindle dynamics, vibration velocity, and anomaly limits",
};

export const dynamic = "force-dynamic";

export default async function TelemetryPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/iot/telemetry");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <TelemetryClient />;
}
