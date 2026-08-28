import { getUserFromHeaders, can } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { computeMonthlyPayroll } from "@/lib/payrollEngine";
import { getPlantScope } from "@/lib/plantScope";
import PayrollReportClient from "./PayrollReportClient";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const revalidate = 0;

export default async function PayrollReportPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (
    !user.isOwner &&
    !can(user, "system.edit") &&
    !user.isOwner &&
    !can(user, "ops.edit")
  ) {
    redirect("/");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const plantId = await getPlantScope();
  const initialSummary = await computeMonthlyPayroll(year, month, plantId);

  return (
    <PayrollReportClient
      initialSummary={JSON.parse(JSON.stringify(initialSummary))}
    />
  );
}
