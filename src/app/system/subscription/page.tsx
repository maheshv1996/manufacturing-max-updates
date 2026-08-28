import { redirect } from "next/navigation";
import { verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import SubscriptionClient from "./SubscriptionClient";
import { getDerivedLicenseStatus } from "@/lib/licenseEngine";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const cookieStore = await cookies();
  const tokenStr = cookieStore.get("app_session")?.value;
  if (!tokenStr) redirect("/login");

  const token = await verifySessionToken(tokenStr);
  if (!token || !token.isOwner) redirect("/");

  const license = await getDerivedLicenseStatus();

  const paymentHistory = await prisma.paymentRecord.findMany({
    orderBy: { at: "desc" },
  });

  const leadCount = await prisma.lead.count();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <SubscriptionClient
        license={license}
        paymentHistory={paymentHistory}
        leadCount={leadCount}
      />
    </div>
  );
}
