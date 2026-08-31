import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import PrintButton from "@/app/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EcoRegisterReportPage() {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "engineering.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const ecos = await prisma.eco.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
    },
  });

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-8 print:p-0 print:bg-white text-slate-100 print:text-black">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-start mb-8 print:mb-4 border-b pb-4 border-slate-700 print:border-black">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wider">
              ECO Register
            </h1>
            <p className="text-slate-400 print:text-black mt-1 font-mono text-sm">
              Generated: {format(new Date(), "PPpp")}
            </p>
          </div>
          <div className="print:hidden">
            <PrintButton />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-600 print:border-black text-xs font-bold uppercase">
                <th className="py-3 px-2">ECO Number</th>
                <th className="py-3 px-2">Title / Description</th>
                <th className="py-3 px-2">Effectivity</th>
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2">Items</th>
                <th className="py-3 px-2">Dates & Signatures</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700 print:divide-black">
              {ecos.map((eco) => (
                <tr
                  key={eco.id}
                  className="align-top hover:bg-slate-900 print:hover:bg-transparent"
                >
                  <td className="py-4 px-2 font-mono font-semibold whitespace-nowrap">
                    {eco.ecoNumber}
                  </td>
                  <td className="py-4 px-2 max-w-sm">
                    <div className="font-bold">{eco.title}</div>
                    <div className="text-slate-400 print:text-black text-xs mt-1 whitespace-pre-wrap">
                      {eco.description}
                    </div>
                  </td>
                  <td className="py-4 px-2 font-mono whitespace-nowrap">
                    {eco.effectivityType === "DATE" ? "DATE: " : "SERIAL: "}
                    <br />
                    {eco.effectivityValue}
                  </td>
                  <td className="py-4 px-2 font-bold whitespace-nowrap">
                    {eco.status}
                  </td>
                  <td className="py-4 px-2 text-xs">
                    {eco.items.length} item(s)
                  </td>
                  <td className="py-4 px-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-400 print:text-black">
                        Raised:
                      </span>{" "}
                      {format(new Date(eco.createdAt), "dd-MMM-yyyy")} (
                      {eco.raisedBy})
                    </div>
                    {eco.approvedAt && (
                      <div className="mt-1">
                        <span className="font-semibold text-slate-400 print:text-black">
                          Apprvd:
                        </span>{" "}
                        {format(new Date(eco.approvedAt), "dd-MMM-yyyy")} (
                        {eco.approvedBy})
                      </div>
                    )}
                    {eco.implementedAt && (
                      <div className="mt-1">
                        <span className="font-semibold text-slate-400 print:text-black">
                          Implmt:
                        </span>{" "}
                        {format(new Date(eco.implementedAt), "dd-MMM-yyyy")}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {ecos.length === 0 && (
            <p className="text-center py-8 text-slate-500 italic">
              No ECOs found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
