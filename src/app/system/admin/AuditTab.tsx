"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Search, Loader2, Download } from "lucide-react";
import DateRangeBar from "@/app/components/dashboard/DateRangeBar";
import { useSearchParams } from "next/navigation";

interface AuditLog {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
  at: string;
}

export default function AuditTab() {
  const searchParams = useSearchParams();
  const range = searchParams.get("range") || "7d";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");

  useEffect(() => {
    fetchLogs();
  }, [range, from, to, actionFilter, entityFilter]); // Trigger re-fetch when these change

  const fetchLogs = async (cursor?: string) => {
    try {
      if (cursor) setLoadingMore(true);
      else setLoading(true);

      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (search) params.set("search", search);
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      if (entityFilter !== "ALL") params.set("entityType", entityFilter);

      // We translate the DateRangeBar range here for the API,
      // or we can let the API handle the range if it doesn't already...
      // Actually, DateRangeBar uses 'range' or 'from/to'.
      // If we need the API to understand range, we should pass from/to directly to API.
      // Wait, let's compute 'from' and 'to' based on 'range' locally to pass exact dates to the API.
      let apiFrom = from;
      let apiTo = to;

      if (!apiFrom && range) {
        const now = new Date();
        const past = new Date();
        if (range === "today") past.setHours(0, 0, 0, 0);
        if (range === "7d") past.setDate(now.getDate() - 7);
        if (range === "30d") past.setDate(now.getDate() - 30);
        if (range === "90d") past.setDate(now.getDate() - 90);
        if (range === "180d") past.setDate(now.getDate() - 180);
        if (range === "365d") past.setDate(now.getDate() - 365);
        apiFrom = past.toISOString();
        apiTo = now.toISOString();
      }

      if (apiFrom) params.set("from", apiFrom);
      if (apiTo) params.set("to", apiTo);

      const res = await fetch(`/api/audit?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (cursor) {
          setLogs((prev) => [...prev, ...data.logs]);
        } else {
          setLogs(data.logs);
        }
        setNextCursor(data.nextCursor);
      }
    } catch (err) {
      console.error("Failed to fetch logs", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (actionFilter !== "ALL") params.set("action", actionFilter);
    if (entityFilter !== "ALL") params.set("entityType", entityFilter);
    let apiFrom = from;
    let apiTo = to;
    if (!apiFrom && range) {
      const now = new Date();
      const past = new Date();
      if (range === "today") past.setHours(0, 0, 0, 0);
      if (range === "7d") past.setDate(now.getDate() - 7);
      if (range === "30d") past.setDate(now.getDate() - 30);
      if (range === "90d") past.setDate(now.getDate() - 90);
      if (range === "180d") past.setDate(now.getDate() - 180);
      if (range === "365d") past.setDate(now.getDate() - 365);
      apiFrom = past.toISOString();
      apiTo = now.toISOString();
    }
    if (apiFrom) params.set("from", apiFrom);
    if (apiTo) params.set("to", apiTo);
    window.location.href = `/api/audit/export?${params.toString()}`;
  };

  const actionOptions = [
    "ALL",
    "LOGIN_SUCCESS",
    "LOGIN_FAILURE",
    "LOGOUT",
    "CHANGE_PASSWORD",
    "START_JOB",
    "LOG_GOOD",
    "LOG_SCRAP",
    "REPORT_DOWNTIME",
    "END_DOWNTIME",
    "COMPLETE_JOB",
    "CREATE_WORK_ORDER",
    "UPDATE_WORK_ORDER",
    "EXPORT_REPORT",
  ];

  const entityOptions = [
    "ALL",
    "USER",
    "MACHINE",
    "WORK_ORDER",
    "REPORT",
    "MACHINES",
    "USERS",
    "PRODUCTS",
    "LINES",
    "SHIFTS",
    "DOWNTIMEREASONS",
    "DEFECTCODES",
  ];

  return (
    <div className="space-y-6">
      <DateRangeBar />

      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg p-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search actor or details..."
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block pl-10 p-2.5"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className="hidden">
              Search
            </button>
          </form>

          <div className="flex gap-4 w-full md:w-auto">
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
              title="Download the filtered audit log as CSV (Excel/Tally friendly)"
            >
              <Download className="w-4 h-4" /> CSV
            </button>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 flex-1 md:flex-none"
            >
              {actionOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "ALL" ? "All Actions" : opt}
                </option>
              ))}
            </select>

            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 flex-1 md:flex-none"
            >
              {entityOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "ALL" ? "All Entities" : opt}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium rounded-tl-lg">Time</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium rounded-tr-lg">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No audit logs found for the selected filters.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-400">
                      {format(new Date(log.at), "MMM d, HH:mm:ss")}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {log.actor}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-slate-800 text-slate-300 text-xs rounded-md font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {log.entityType}{" "}
                      {log.entityId ? (
                        <span className="text-slate-500 text-xs ml-1">
                          ({log.entityId.slice(0, 8)})
                        </span>
                      ) : null}
                    </td>
                    <td
                      className="px-4 py-3 text-slate-400 max-w-md truncate"
                      title={log.details}
                    >
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {nextCursor && !loading && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => fetchLogs(nextCursor)}
              disabled={loadingMore}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {loadingMore ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : null}
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
