import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function FaiReportPrint({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await prisma.faiReport.findUnique({
    where: { id },
    include: {
      workOrder: true,
      product: {
        include: {
          bomLines: {
            include: { rawMaterial: true },
          },
        },
      },
      serialUnit: true,
      characteristics: {
        orderBy: { charNo: "asc" },
      },
    },
  });

  if (!report) return notFound();

  const printDate = new Date().toLocaleDateString();

  return (
    <div className="bg-white text-black min-h-screen p-8 text-sm max-w-5xl mx-auto print:p-0 print:m-0">
      {/* HEADER */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            AS9102 FIRST ARTICLE INSPECTION REPORT
          </h1>
          <p className="text-gray-600">Report No: {report.faiNumber}</p>
        </div>
        <div className="text-right">
          <p>
            <strong>Date Printed:</strong> {printDate}
          </p>
          <p>
            <strong>Status:</strong> {report.status}
          </p>
        </div>
      </div>

      {/* FORM 1 */}
      <div className="mb-8 page-break-after">
        <h2 className="text-lg font-bold bg-gray-200 p-2 mb-4 border border-black">
          FORM 1: PART NUMBER ACCOUNTABILITY
        </h2>

        <div className="grid grid-cols-2 gap-4 border border-black p-4 mb-4">
          <div>
            <p>
              <strong>1. Part Number:</strong> {report.product.sku}
            </p>
            <p>
              <strong>2. Part Name:</strong> {report.product.name}
            </p>
            <p>
              <strong>3. Serial Number:</strong>{" "}
              {report.serialUnit?.serialNo || "N/A"}
            </p>
          </div>
          <div>
            <p>
              <strong>4. FAI Report Number:</strong> {report.faiNumber}
            </p>
            <p>
              <strong>5. Part Revision Level:</strong>{" "}
              {report.drawingRevision || "N/A"}
            </p>
            <p>
              <strong>6. Drawing Number:</strong> {report.product.sku}-DRW
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 border border-black p-4 mb-4">
          <div>
            <p>
              <strong>7. Manufacturing Process Reference:</strong> WO{" "}
              {report.workOrder.woNumber}
            </p>
            <p>
              <strong>8. Organization Name:</strong> Manufacturing-Max Plant
            </p>
          </div>
          <div>
            <p>
              <strong>9. Customer Name:</strong> {report.customerName || "N/A"}
            </p>
            <p>
              <strong>10. FAI Type:</strong> {report.type}
            </p>
          </div>
        </div>

        <div className="border border-black p-4">
          <h3 className="font-bold border-b border-black pb-2 mb-4">
            11. Signatures
          </h3>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="mb-8">
                <strong>Prepared By:</strong> {report.preparedBy}
              </p>
              <div className="border-b border-black w-full"></div>
              <p className="text-xs mt-1">Signature & Date</p>
            </div>
            <div>
              <p className="mb-8">
                <strong>Approved By:</strong>{" "}
                {report.approvedBy || "___________________"}
              </p>
              <div className="border-b border-black w-full"></div>
              <p className="text-xs mt-1">Signature & Date</p>
            </div>
          </div>
        </div>
      </div>

      {/* FORM 2 */}
      <div className="mb-8 page-break-after">
        <h2 className="text-lg font-bold bg-gray-200 p-2 mb-4 border border-black">
          FORM 2: PRODUCT ACCOUNTABILITY - MATERIALS, SPECIAL PROCESSES, AND
          FUNCTIONAL TESTING
        </h2>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-left">
                5. Material or Process Name
              </th>
              <th className="border border-black p-2 text-left">
                6. Specification Number
              </th>
              <th className="border border-black p-2 text-left">
                7. Supplier / Cert Number
              </th>
            </tr>
          </thead>
          <tbody>
            {report.product.bomLines.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="border border-black p-2 text-center text-gray-500"
                >
                  No materials recorded
                </td>
              </tr>
            ) : (
              report.product.bomLines.map((bom, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-2">
                    {bom.rawMaterial.name}
                  </td>
                  <td className="border border-black p-2">
                    {bom.rawMaterial.sku}
                  </td>
                  <td className="border border-black p-2">CoC-ON-FILE</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FORM 3 */}
      <div>
        <h2 className="text-lg font-bold bg-gray-200 p-2 mb-4 border border-black">
          FORM 3: CHARACTERISTIC ACCOUNTABILITY, VERIFICATION AND COMPATIBILITY
          EVALUATION
        </h2>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-left">5. Char No.</th>
              <th className="border border-black p-2 text-left">
                6. Reference Location
              </th>
              <th className="border border-black p-2 text-left">
                7. Characteristic Designator
              </th>
              <th className="border border-black p-2 text-left">
                8. Requirement (LSL - USL)
              </th>
              <th className="border border-black p-2 text-left">
                9. Results (Actual)
              </th>
              <th className="border border-black p-2 text-left">
                10. Insp. Tool
              </th>
              <th className="border border-black p-2 text-center">
                11. Non-Conformance
              </th>
            </tr>
          </thead>
          <tbody>
            {report.characteristics.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="border border-black p-2 text-center text-gray-500"
                >
                  No characteristics recorded
                </td>
              </tr>
            ) : (
              report.characteristics.map((c) => (
                <tr key={c.id}>
                  <td className="border border-black p-2">{c.charNo}</td>
                  <td className="border border-black p-2">{c.description}</td>
                  <td className="border border-black p-2">DIMENSIONAL</td>
                  <td className="border border-black p-2">
                    {c.target ? `Tgt: ${c.target} ` : ""}
                    {c.lsl !== null || c.usl !== null
                      ? `[${c.lsl || "-"} to ${c.usl || "-"}]`
                      : ""}
                  </td>
                  <td className="border border-black p-2 font-mono font-bold">
                    {c.actual !== null ? c.actual : "-"}
                  </td>
                  <td className="border border-black p-2">
                    {c.method || "Standard"}
                  </td>
                  <td className="border border-black p-2 text-center">
                    {c.status === "FAIL" ? "YES (NCR REQ)" : "NO"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {report.notes && (
          <div className="mt-4 p-4 border border-black">
            <h3 className="font-bold mb-1">14. Remarks / Notes</h3>
            <p>{report.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
