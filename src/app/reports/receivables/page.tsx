export const maxDuration = 60;
import { prisma } from "@/lib/prisma";
import ReceivablesClient from "./ReceivablesClient";
import { verifySessionToken } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ReceivablesReportPage() {
  const cookieStore = await cookies();
  const tokenStr = cookieStore.get("app_session")?.value;
  const token = tokenStr ? await verifySessionToken(tokenStr) : null;
  if (
    !token ||
    (token.roleName !== "ADMIN" && token.roleName !== "SUPERVISOR")
  ) {
    redirect("/login");
  }

  const invoices = await (prisma as any).invoice.findMany({
    include: {
      payments: true,
    },
    orderBy: {
      invoiceDate: "desc",
    },
  });

  const settings = await getSettings();

  return (
    <ReceivablesClient invoices={invoices} branding={settings.branding} />
  );
}
