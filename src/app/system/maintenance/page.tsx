import { cookies } from "next/headers";
import { verifySessionToken } from "@/lib/auth";
import MaintenanceClient from "./MaintenanceClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MaintenancePage() {
  const cookieStore = await cookies();
  const tokenStr = cookieStore.get("app_session")?.value;
  const token = tokenStr ? await verifySessionToken(tokenStr) : null;
  const roleName = (token?.roleName as string) || "OPERATOR";
  const userName = (token as any)?.name || "User";

  return <MaintenanceClient role={roleName} userName={userName} />;
}
