"use client";

import SourceRecordEditModal from "../modals/SourceRecordEditModal";
import { Cpu, Clock, CheckCircle2, Truck, Boxes } from "lucide-react";

interface WorkOrderTablesWithEditsProps {
  wo: any;
  userRole?: string;
  downtimeReasons?: any[];
}

export default function WorkOrderTablesWithEdits({
  wo,
  userRole = "ADMIN",
  downtimeReasons = [],
}: WorkOrderTablesWithEditsProps) {
  const refreshPage = () => {
    window.location.reload();
  };

  const reasonOptions = downtimeReasons.map((r) => ({
    label: `${r.code} - ${r.description}`,
    value: r.id,
  }));

  return (
    <div className="space-y-8">
      {/* 1. PRODUCTION LOGS TABLE */}
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-500" />
          Production Logs ({wo.productionLogs?.length || 0})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
              <tr>
                <th className="py-2.5 px-3">Date / Start</th>
                <th className="py-2.5 px-3">Machine</th>
                <th className="py-2.5 px-3">Operator</th>
                <th className="py-2.5 px-3">Good Pcs</th>
                <th className="py-2.5 px-3">Scrap Pcs</th>
                <th className="py-2.5 px-3">Rework Pcs</th>
                <th className="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {!wo.productionLogs || wo.productionLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-slate-400 italic"
                  >
                    No production logs recorded yet.
                  </td>
                </tr>
              ) : (
                wo.productionLogs.map((log: any) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/40"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {new Date(log.startTime).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {log.machine?.name || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-slate-300">
                      {log.operator?.name || "—"}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {log.goodQuantity}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-rose-400">
                      {log.scrapQuantity}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-amber-400">
                      {log.reworkQuantity}
                    </td>
                    <td className="py-2.5 px-3">
                      <SourceRecordEditModal
                        entityType="ProductionLog"
                        entityId={log.id}
                        title="Production Log"
                        fields={[
                          {
                            key: "goodQuantity",
                            label: "Good Quantity",
                            type: "number",
                          },
                          {
                            key: "scrapQuantity",
                            label: "Scrap Quantity",
                            type: "number",
                          },
                          {
                            key: "reworkQuantity",
                            label: "Rework Quantity",
                            type: "number",
                          },
                          {
                            key: "startTime",
                            label: "Start Time",
                            type: "datetime",
                          },
                          {
                            key: "endTime",
                            label: "End Time",
                            type: "datetime",
                          },
                        ]}
                        initialValues={{
                          goodQuantity: log.goodQuantity,
                          scrapQuantity: log.scrapQuantity,
                          reworkQuantity: log.reworkQuantity,
                          startTime: log.startTime,
                          endTime: log.endTime,
                        }}
                        userRole={userRole}
                        onSaved={refreshPage}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. DOWNTIME LOGS TABLE */}
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          Downtime Logs ({wo.downtimeLogs?.length || 0})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
              <tr>
                <th className="py-2.5 px-3">Start Time</th>
                <th className="py-2.5 px-3">End Time</th>
                <th className="py-2.5 px-3">Duration (Mins)</th>
                <th className="py-2.5 px-3">Reason</th>
                <th className="py-2.5 px-3">Notes</th>
                <th className="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {!wo.downtimeLogs || wo.downtimeLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-6 text-center text-slate-400 italic"
                  >
                    No downtime logs recorded.
                  </td>
                </tr>
              ) : (
                wo.downtimeLogs.map((log: any) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/40"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {new Date(log.startTime).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {log.endTime
                        ? new Date(log.endTime).toLocaleString()
                        : "Ongoing"}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-amber-400">
                      {log.durationMinutes?.toFixed(1) || "—"} mins
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {log.reason
                        ? `${log.reason.code} - ${log.reason.description}`
                        : "Unspecified"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">
                      {log.notes || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <SourceRecordEditModal
                        entityType="DowntimeLog"
                        entityId={log.id}
                        title="Downtime Log"
                        fields={[
                          {
                            key: "startTime",
                            label: "Start Time",
                            type: "datetime",
                          },
                          {
                            key: "endTime",
                            label: "End Time",
                            type: "datetime",
                          },
                          {
                            key: "durationMinutes",
                            label: "Duration (Minutes)",
                            type: "number",
                          },
                          {
                            key: "reasonId",
                            label: "Downtime Reason",
                            type: "select",
                            options: reasonOptions,
                          },
                          { key: "notes", label: "Notes", type: "text" },
                        ]}
                        initialValues={{
                          startTime: log.startTime,
                          endTime: log.endTime,
                          durationMinutes: log.durationMinutes,
                          reasonId: log.reasonId,
                          notes: log.notes,
                        }}
                        userRole={userRole}
                        onSaved={refreshPage}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. QUALITY INSPECTIONS TABLE */}
      <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          Quality Inspections ({wo.qualityInspections?.length || 0})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
              <tr>
                <th className="py-2.5 px-3">Inspected At</th>
                <th className="py-2.5 px-3">Inspector</th>
                <th className="py-2.5 px-3">Total Inspected</th>
                <th className="py-2.5 px-3">Passed</th>
                <th className="py-2.5 px-3">Failed</th>
                <th className="py-2.5 px-3">Notes</th>
                <th className="py-2.5 px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 divide-slate-800">
              {!wo.qualityInspections || wo.qualityInspections.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 text-center text-slate-400 italic"
                  >
                    No quality inspections logged.
                  </td>
                </tr>
              ) : (
                wo.qualityInspections.map((q: any) => (
                  <tr
                    key={q.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/40"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {new Date(q.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium">
                      {q.inspector?.name || "QC Inspector"}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {q.totalInspected}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">
                      {q.passed}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                      {q.failed}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-slate-500">
                      {q.notes || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <SourceRecordEditModal
                        entityType="QualityInspection"
                        entityId={q.id}
                        title="Quality Inspection"
                        fields={[
                          {
                            key: "totalInspected",
                            label: "Total Inspected",
                            type: "number",
                          },
                          {
                            key: "passed",
                            label: "Passed Units",
                            type: "number",
                          },
                          {
                            key: "failed",
                            label: "Failed Units",
                            type: "number",
                          },
                          {
                            key: "notes",
                            label: "Inspection Notes",
                            type: "text",
                          },
                        ]}
                        initialValues={{
                          totalInspected: q.totalInspected,
                          passed: q.passed,
                          failed: q.failed,
                          notes: q.notes,
                        }}
                        userRole={userRole}
                        onSaved={refreshPage}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. MOVEMENT LOGS TABLE */}
      {wo.movementLogs && wo.movementLogs.length > 0 && (
        <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Truck className="w-5 h-5 text-purple-500" />
            Station Movement Logs ({wo.movementLogs.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">From Station</th>
                  <th className="py-2.5 px-3">To Station</th>
                  <th className="py-2.5 px-3">Quantity</th>
                  <th className="py-2.5 px-3">Moved By</th>
                  <th className="py-2.5 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {wo.movementLogs.map((m: any) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/40"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {new Date(m.at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 text-slate-300">
                      {m.fromStation}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-purple-400">
                      {m.toStation}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold">
                      {m.quantity} pcs
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs">
                      {m.movedByName}
                    </td>
                    <td className="py-2.5 px-3">
                      <SourceRecordEditModal
                        entityType="MovementLog"
                        entityId={m.id}
                        title="Station Movement Log"
                        fields={[
                          {
                            key: "quantity",
                            label: "Moved Quantity",
                            type: "number",
                          },
                          {
                            key: "fromStation",
                            label: "From Station",
                            type: "text",
                          },
                          {
                            key: "toStation",
                            label: "To Station",
                            type: "text",
                          },
                        ]}
                        initialValues={{
                          quantity: m.quantity,
                          fromStation: m.fromStation,
                          toStation: m.toStation,
                        }}
                        userRole={userRole}
                        onSaved={refreshPage}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 5. INVENTORY TRANSACTIONS TABLE */}
      {wo.inventoryTransactions && wo.inventoryTransactions.length > 0 && (
        <section className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-cyan-500" />
            Materials Consumed &amp; Lot Batch Traceability (
            {wo.inventoryTransactions.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/60 text-slate-400 uppercase text-xs">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Material SKU</th>
                  <th className="py-2.5 px-3">Batch / Lot No</th>
                  <th className="py-2.5 px-3">Heat No</th>
                  <th className="py-2.5 px-3">Cert</th>
                  <th className="py-2.5 px-3">Quantity Issued</th>
                  <th className="py-2.5 px-3">Unit Cost (₹)</th>
                  <th className="py-2.5 px-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 divide-slate-800">
                {wo.inventoryTransactions.map((tx: any) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-slate-50/60 hover:bg-slate-800/90/40"
                  >
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {new Date(tx.at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {tx.rawMaterial?.sku || "—"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs bg-slate-800/60 px-2 py-0.5 rounded">
                      {tx.batchNo || "BATCH-DEFAULT"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs">
                      {tx.materialCert ? (
                        <span className="text-emerald-400 font-bold">
                          {tx.materialCert.heatNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {tx.materialCert ? (
                        tx.materialCert.fileData ? (
                          <a
                            href={`/api/certs/${tx.materialCert.id}/file`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-300 text-[10px] font-bold hover:bg-emerald-200 transition-colors"
                          >
                            ✓ CERT
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-300 text-[10px] font-bold">
                            ✓ CERT
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-300 text-[10px] font-bold">
                          NO CERT
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                      {tx.qty}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs">
                      ₹{tx.unitCost || tx.rawMaterial?.unitCost || 0}
                    </td>
                    <td className="py-2.5 px-3">
                      <SourceRecordEditModal
                        entityType="InventoryTransaction"
                        entityId={tx.id}
                        title="Inventory Transaction"
                        fields={[
                          {
                            key: "qty",
                            label: "Quantity Issued",
                            type: "number",
                          },
                          {
                            key: "unitCost",
                            label: "Unit Cost (₹)",
                            type: "number",
                          },
                          {
                            key: "batchNo",
                            label: "Batch / Lot No",
                            type: "text",
                          },
                          {
                            key: "reference",
                            label: "Reference",
                            type: "text",
                          },
                        ]}
                        initialValues={{
                          qty: tx.qty,
                          unitCost: tx.unitCost || tx.rawMaterial?.unitCost,
                          batchNo: tx.batchNo,
                          reference: tx.reference,
                        }}
                        userRole={userRole}
                        onSaved={refreshPage}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
