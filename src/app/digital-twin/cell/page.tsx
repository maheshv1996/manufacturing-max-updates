import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { permissionForPath } from "@/lib/departments";
import CellTwinClient from "./CellTwinClient";

export const metadata = {
  title: "3D Digital Twin & Workcell Visualizer | Digital Twin",
  description:
    "Physics-based industrial cell simulation: Spindle dynamics, 6-axis robot handling, infeed conveyors, and real-time telemetry HUD",
};

export const dynamic = "force-dynamic";

export default async function CellTwinPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  const requiredPerm = permissionForPath("/digital-twin/cell");

  if (!user.isOwner && requiredPerm && !can(user, requiredPerm)) {
    redirect("/");
  }

  return <CellTwinClient />;
}
