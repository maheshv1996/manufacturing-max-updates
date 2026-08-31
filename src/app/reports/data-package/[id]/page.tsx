import { getUserFromHeaders, can } from "@/lib/permissions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fetchLiveDossierData } from "@/lib/dataPackageLiveFetch";
import PrintDossierButton from "./PrintDossierButton";

export const dynamic = "force-dynamic";

export default async function DataPackageDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.isOwner && !can(user, "ops.view") && !can(user, "reports.print")) {
    redirect("/");
  }

  const { id } = await params;

  const dataPackage = await prisma.dataPackage.findUnique({
    where: { id },
  });

  if (!dataPackage) notFound();

  let data: any;

  if (dataPackage.status === "RELEASED" && dataPackage.snapshot) {
    data = dataPackage.snapshot;
  } else {
    data = await fetchLiveDossierData(dataPackage.workOrderId);
  }

  if (!data) {
    return (
      <div className="p-8 text-red-500">
        Failed to load data package content.
      </div>
    );
  }

  const {
    product,
    productionLogs,
    inventoryTransactions,
    faiReports,
    ncrReports,
    holdPointSignoffs,
    serialUnits,
    qualityInspections,
  } = data;

  const woNumber = data.woNumber;
  const productName = product?.name || "Unknown Product";
  const sku = product?.sku || "N/A";

  // Calculate total good
  const totalGood = (productionLogs || []).reduce(
    (sum: number, log: any) => sum + (log.goodQuantity || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-white text-black p-8 font-sans print:p-0 print:bg-white print:text-black">
      {/* Print styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body {
            -webkit-print-color-adjust: exact;
          }
          .page-break {
            page-break-before: always;
          }
          .no-print {
            display: none !important;
          }
        }
      `,
        }}
      />

      {/* COVER */}
      <div className="max-w-5xl mx-auto border-2 border-slate-900 p-12 min-h-[1050px] flex flex-col relative">
        <div className="absolute top-12 right-12 text-right">
          <p className="font-mono text-sm text-slate-500">Document No.</p>
          <p className="font-mono text-xl font-bold">
            {dataPackage.packageNumber}
          </p>
          <div
            className={`mt-2 inline-block px-3 py-1 font-bold border-2 ${dataPackage.status === "RELEASED" ? "border-emerald-600 text-emerald-600" : "border-red-600 text-red-600"}`}
          >
            {dataPackage.status === "RELEASED"
              ? "RELEASED & FROZEN"
              : "DRAFT - LIVE DATA"}
          </div>
        </div>

        <div className="mt-32">
          <h1 className="text-5xl font-black uppercase tracking-tight">
            Data Package
            <br />
            Birth Record
          </h1>
        </div>

        <div className="mt-24 space-y-8 flex-1">
          <div className="grid grid-cols-2 gap-8 text-lg">
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                Work Order
              </p>
              <p className="font-mono font-bold text-2xl">{woNumber}</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                Product
              </p>
              <p className="font-bold text-2xl">{productName}</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                Drawing Revision
              </p>
              <p className="font-mono">{sku}</p>
            </div>
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider">
                Customer / PO
              </p>
              <p className="font-mono">{data.customerName || "N/A"}</p>
            </div>
          </div>

          {data.trackingMode === "SERIAL" && (
            <div className="mt-12">
              <p className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">
                Included Serial Numbers
              </p>
              <div className="flex flex-wrap gap-2">
                {(serialUnits || []).map((s: any) => (
                  <span
                    key={s.id}
                    className="px-2 py-1 bg-slate-100 border border-slate-300 font-mono text-sm"
                  >
                    {s.serialNo}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-12 pt-8 border-t-2 border-slate-900 mt-auto">
          <div>
            <p className="text-sm font-bold uppercase text-slate-500 mb-8">
              Prepared By
            </p>
            <div className="border-b-2 border-slate-400 w-full mb-2"></div>
            <p className="text-sm">
              {dataPackage.createdBy} -{" "}
              {new Date(dataPackage.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm font-bold uppercase text-slate-500 mb-8">
              Released By
            </p>
            {dataPackage.status === "RELEASED" ? (
              <>
                <p className="font-signature text-3xl text-indigo-700 mb-2 font-serif italic border-b-2 border-slate-400 pb-1">
                  {dataPackage.releasedBy}
                </p>
                <p className="text-sm">
                  {dataPackage.releasedBy} -{" "}
                  {dataPackage.releasedAt
                    ? new Date(dataPackage.releasedAt).toLocaleDateString()
                    : ""}
                </p>
              </>
            ) : (
              <>
                <div className="border-b-2 border-slate-400 w-full mb-2 h-8"></div>
                <p className="text-sm text-slate-400 italic">Pending Release</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* SECTION A - CERTIFICATE OF CONFORMANCE */}
      <div className="page-break mt-16 max-w-5xl mx-auto border-2 border-slate-900 p-12 min-h-[1050px] flex flex-col">
        <h2 className="text-2xl font-black uppercase border-b-4 border-slate-900 pb-2 mb-8">
          Section A: Certificate of Conformance
        </h2>
        <div className="prose max-w-none text-lg">
          <p>
            We hereby certify that the parts supplied against Work Order{" "}
            <strong>{woNumber}</strong> conform in all respects to the drawing
            requirements, specifications, and terms of the referenced purchase
            order.
          </p>
          <p>
            All materials and processes utilized in the manufacture of these
            parts have been verified and full traceability is maintained on
            file.
          </p>

          <div className="mt-16 grid grid-cols-2 gap-8 text-sm">
            <div>
              <strong>Part Name:</strong> {productName}
              <br />
              <strong>Part Number (SKU):</strong> {sku}
              <br />
              <strong>Quantity:</strong> {totalGood}
            </div>
            <div>
              <strong>Package No:</strong> {dataPackage.packageNumber}
              <br />
              <strong>Date:</strong>{" "}
              {dataPackage.releasedAt
                ? new Date(dataPackage.releasedAt).toLocaleDateString()
                : new Date().toLocaleDateString()}
            </div>
          </div>
        </div>

        <div className="mt-auto w-1/2 pt-8 border-t-2 border-slate-900">
          <p className="text-sm font-bold uppercase text-slate-500 mb-8">
            Authorized Quality Representative
          </p>
          {dataPackage.status === "RELEASED" ? (
            <p className="font-signature text-3xl text-indigo-700 mb-2 font-serif italic border-b-2 border-slate-400 pb-1">
              {dataPackage.releasedBy}
            </p>
          ) : (
            <div className="border-b-2 border-slate-400 w-full mb-2 h-8"></div>
          )}
        </div>
      </div>

      {/* SECTION B - MATERIAL CERTIFICATION */}
      <div className="page-break mt-16 max-w-5xl mx-auto border-2 border-slate-900 p-12 min-h-[1050px]">
        <h2 className="text-2xl font-black uppercase border-b-4 border-slate-900 pb-2 mb-8">
          Section B: Material Certification Traceability
        </h2>

        {inventoryTransactions?.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 p-2 text-left">
                  Material
                </th>
                <th className="border border-slate-300 p-2 text-left">
                  Heat No.
                </th>
                <th className="border border-slate-300 p-2 text-left">
                  Cert No.
                </th>
                <th className="border border-slate-300 p-2 text-left">
                  Supplier
                </th>
                <th className="border border-slate-300 p-2 text-left">Grade</th>
                <th className="border border-slate-300 p-2 text-right">
                  Qty Consumed
                </th>
              </tr>
            </thead>
            <tbody>
              {inventoryTransactions
                .filter((tx: any) => tx.type === "CONSUME")
                .map((tx: any) => (
                  <tr key={tx.id}>
                    <td className="border border-slate-300 p-2">
                      {tx.rawMaterial?.name} ({tx.rawMaterial?.code})
                    </td>
                    <td className="border border-slate-300 p-2 font-mono">
                      {tx.materialCert?.heatNumber || "N/A"}
                    </td>
                    <td className="border border-slate-300 p-2 font-mono">
                      {tx.materialCert?.certNumber || "N/A"}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {tx.materialCert?.supplier?.name || "N/A"}
                    </td>
                    <td className="border border-slate-300 p-2">
                      {tx.materialCert?.specGrade || "N/A"}
                    </td>
                    <td className="border border-slate-300 p-2 text-right">
                      {tx.quantity}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        ) : (
          <p className="italic text-slate-500">
            No material consumptions recorded.
          </p>
        )}
      </div>

      {/* SECTION C - FIRST ARTICLE */}
      <div className="page-break mt-16 max-w-5xl mx-auto border-2 border-slate-900 p-12 min-h-[1050px]">
        <h2 className="text-2xl font-black uppercase border-b-4 border-slate-900 pb-2 mb-8">
          Section C: First Article Inspection (FAI)
        </h2>

        {faiReports?.length > 0 ? (
          <div className="space-y-12">
            {faiReports.map((fai: any) => (
              <div
                key={fai.id}
                className="border border-slate-300 p-6 rounded-sm"
              >
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <strong>FAI Number:</strong> {fai.faiNumber}
                  </div>
                  <div>
                    <strong>Type:</strong> {fai.type}
                  </div>
                  <div>
                    <strong>Status:</strong> {fai.status}
                  </div>
                  <div>
                    <strong>Date:</strong>{" "}
                    {new Date(fai.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {/* Normally we'd render the full Form 3 characteristics here, but they are stored in JSON. For the brevity of this code we will just dump it or show a summary. */}
                <h3 className="font-bold border-b border-slate-200 pb-1 mb-2">
                  Form 3 Summary (Characteristics)
                </h3>
                <div className="text-xs bg-slate-50 p-2 font-mono border">
                  {typeof fai.form3Data === "string"
                    ? fai.form3Data
                    : JSON.stringify(fai.form3Data || {}, null, 2)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="italic text-slate-500">
            No First Article Inspections recorded.
          </p>
        )}
      </div>

      {/* SECTION D - IN-PROCESS INSPECTIONS */}
      <div className="page-break mt-16 max-w-5xl mx-auto border-2 border-slate-900 p-12 min-h-[1050px]">
        <h2 className="text-2xl font-black uppercase border-b-4 border-slate-900 pb-2 mb-8">
          Section D: In-Process Quality Inspections
        </h2>

        {qualityInspections?.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 p-2 text-left">Date</th>
                <th className="border border-slate-300 p-2 text-left">
                  Step Seq
                </th>
                <th className="border border-slate-300 p-2 text-left">Type</th>
                <th className="border border-slate-300 p-2 text-left">
                  Inspector
                </th>
                <th className="border border-slate-300 p-2 text-left">
                  Result
                </th>
                <th className="border border-slate-300 p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {qualityInspections.map((qi: any) => (
                <tr key={qi.id}>
                  <td className="border border-slate-300 p-2">
                    {new Date(qi.inspectedAt).toLocaleString()}
                  </td>
                  <td className="border border-slate-300 p-2">
                    {qi.routingStepSeq}
                  </td>
                  <td className="border border-slate-300 p-2">{qi.type}</td>
                  <td className="border border-slate-300 p-2">
                    {qi.inspector?.name || "N/A"}
                  </td>
                  <td className="border border-slate-300 p-2 font-bold">
                    {qi.isPassed ? "PASS" : "FAIL"}
                  </td>
                  <td className="border border-slate-300 p-2 text-xs">
                    {qi.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="italic text-slate-500">
            No in-process inspections recorded.
          </p>
        )}
      </div>

      {/* SECTION E - NON-CONFORMANCES */}
      <div className="page-break mt-16 max-w-5xl mx-auto border-2 border-slate-900 p-12 min-h-[1050px]">
        <h2 className="text-2xl font-black uppercase border-b-4 border-slate-900 pb-2 mb-8">
          Section E: Non-Conformances (NCR)
        </h2>

        {ncrReports?.length > 0 ? (
          <div className="space-y-6">
            {ncrReports.map((ncr: any) => (
              <div
                key={ncr.id}
                className="border border-slate-300 p-6 rounded-sm text-sm"
              >
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <strong className="text-slate-500 uppercase text-xs">
                      NCR Number:
                    </strong>
                    <br />
                    {ncr.ncrNumber}
                  </div>
                  <div>
                    <strong className="text-slate-500 uppercase text-xs">
                      Status:
                    </strong>
                    <br />
                    {ncr.status}
                  </div>
                  <div className="col-span-2">
                    <strong className="text-slate-500 uppercase text-xs">
                      Defect / Description:
                    </strong>
                    <br />
                    {ncr.defectCode?.description || ""} - {ncr.description}
                  </div>
                  <div>
                    <strong className="text-slate-500 uppercase text-xs">
                      Disposition:
                    </strong>
                    <br />
                    {ncr.disposition || "PENDING"} (
                    {ncr.dispositionAuthority || "N/A"})
                  </div>
                  <div>
                    <strong className="text-slate-500 uppercase text-xs">
                      Corrective Action:
                    </strong>
                    <br />
                    {ncr.correctiveAction || "None"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-bold text-lg">
            None recorded. Parts were produced without any documented
            non-conformances.
          </p>
        )}
      </div>

      {/* SECTION F - HOLD POINT SIGN-OFFS */}
      <div className="page-break mt-16 max-w-5xl mx-auto border-2 border-slate-900 p-12 min-h-[1050px]">
        <h2 className="text-2xl font-black uppercase border-b-4 border-slate-900 pb-2 mb-8">
          Section F: Quality Hold Point Sign-Offs
        </h2>

        {holdPointSignoffs?.length > 0 ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 p-2 text-left">Date</th>
                <th className="border border-slate-300 p-2 text-left">
                  Operation
                </th>
                <th className="border border-slate-300 p-2 text-left">
                  Inspector Name
                </th>
                <th className="border border-slate-300 p-2 text-left">
                  Organization
                </th>
                <th className="border border-slate-300 p-2 text-left">
                  Result
                </th>
                <th className="border border-slate-300 p-2 text-left">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {holdPointSignoffs.map((hp: any) => (
                <tr key={hp.id}>
                  <td className="border border-slate-300 p-2">
                    {new Date(hp.signedAt).toLocaleString()}
                  </td>
                  <td className="border border-slate-300 p-2">
                    {hp.routingStep?.stationName ||
                      `Step ${hp.routingStep?.seq}`}
                  </td>
                  <td className="border border-slate-300 p-2 font-signature font-serif text-lg text-indigo-700">
                    {hp.inspectorName}
                  </td>
                  <td className="border border-slate-300 p-2">
                    {hp.inspectorOrg}
                  </td>
                  <td className="border border-slate-300 p-2 font-bold">
                    {hp.result}
                  </td>
                  <td className="border border-slate-300 p-2">{hp.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="italic text-slate-500">
            No hold point sign-offs recorded.
          </p>
        )}
      </div>

      {/* SECTION G - SERIAL GENEALOGY */}
      {data.trackingMode === "SERIAL" && (
        <div className="page-break mt-16 max-w-5xl mx-auto border-2 border-slate-900 p-12 min-h-[1050px]">
          <h2 className="text-2xl font-black uppercase border-b-4 border-slate-900 pb-2 mb-8">
            Section G: Serial Genealogy & Build History
          </h2>

          {serialUnits?.length > 0 ? (
            <div className="space-y-8">
              {serialUnits.map((su: any) => (
                <div key={su.id} className="border border-slate-300">
                  <div className="bg-slate-100 p-3 font-bold border-b border-slate-300 flex justify-between">
                    <span>
                      Serial No:{" "}
                      <span className="font-mono text-lg ml-2">
                        {su.serialNo}
                      </span>
                    </span>
                    <span>Status: {su.status}</span>
                  </div>
                  <div className="p-4">
                    {su.events?.length > 0 ? (
                      <table className="w-full text-sm border-collapse text-xs">
                        <thead>
                          <tr>
                            <th className="border-b p-1 text-left">Date</th>
                            <th className="border-b p-1 text-left">Type</th>
                            <th className="border-b p-1 text-left">Details</th>
                            <th className="border-b p-1 text-left">Operator</th>
                          </tr>
                        </thead>
                        <tbody>
                          {su.events.map((evt: any) => (
                            <tr key={evt.id}>
                              <td className="border-b border-slate-100 p-1">
                                {new Date(evt.at).toLocaleString()}
                              </td>
                              <td className="border-b border-slate-100 p-1">
                                {evt.type}
                              </td>
                              <td className="border-b border-slate-100 p-1">
                                {evt.details}
                              </td>
                              <td className="border-b border-slate-100 p-1">
                                {evt.operatorName}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="italic text-slate-500 text-sm">
                        No events logged for this serial unit.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="italic text-slate-500">No serial units found.</p>
          )}
        </div>
      )}

      {/* FAB Print Button (No Print) */}
      <PrintDossierButton />
    </div>
  );
}
