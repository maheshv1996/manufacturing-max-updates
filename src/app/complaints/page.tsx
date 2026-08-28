import { can, getUserFromHeaders } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import ComplaintsClient from "./ComplaintsClient";

export default async function ComplaintsPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);

  if (!can(user, "ops.view") && !can(user, "commercial.view")) {
    redirect("/");
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Customer Complaints & Returns
        </h1>
        <p className="text-slate-400 max-w-3xl">
          Track customer issues, initiate investigations, trace defects back to
          batch origin, and document CAPA actions.
        </p>
      </div>

      <ComplaintsClient
        canEdit={can(user, "ops.edit") || can(user, "commercial.edit")}
      />
    </div>
  );
}
