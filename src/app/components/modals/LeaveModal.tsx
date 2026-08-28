"use client";

import { useState, useEffect } from "react";
import { X, Calendar, FileText, Loader2 } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";

interface LeaveModalProps {
  onClose: () => void;
}

interface LeaveRequest {
  id: string;
  type: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export default function LeaveModal({ onClose }: LeaveModalProps) {
  const [activeTab, setActiveTab] = useState<"APPLY" | "HISTORY">("APPLY");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<LeaveRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [type, setType] = useState("CL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (activeTab === "HISTORY") {
      fetchHistory();
    }
  }, [activeTab]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/leaves");
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleApply = async () => {
    if (!fromDate || !toDate || !reason) {
      setError("Please fill all required fields.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          fromDate: new Date(fromDate).toISOString(),
          toDate: new Date(toDate).toISOString(),
          days: Number(days),
          reason,
        }),
      });

      if (res.ok) {
        setActiveTab("HISTORY");
        // Reset form
        setFromDate("");
        setToDate("");
        setDays(1);
        setReason("");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to apply leave.");
      }
    } catch (e) {
      setError("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-success-soft text-success border-success/20";
      case "REJECTED":
        return "bg-error-soft text-error border-error/20";
      default:
        return "bg-warning-soft text-warning border-warning/20";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="w-full max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-2">
          <h2 className="text-lg font-bold text-text-1 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            Leave Management
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-surface-3 transition-colors text-text-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-border bg-surface-1">
          <button
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${
              activeTab === "APPLY"
                ? "border-accent text-accent"
                : "border-transparent text-text-2 hover:text-text-1"
            }`}
            onClick={() => setActiveTab("APPLY")}
          >
            Apply Leave
          </button>
          <button
            className={`flex-1 py-3 text-sm font-semibold text-center border-b-2 transition-colors ${
              activeTab === "HISTORY"
                ? "border-accent text-accent"
                : "border-transparent text-text-2 hover:text-text-1"
            }`}
            onClick={() => setActiveTab("HISTORY")}
          >
            My Leaves
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-surface-1 flex-1">
          {activeTab === "APPLY" ? (
            <div className="space-y-4">
              {error && (
                <div className="text-error text-sm font-medium">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-text-2 mb-1">
                  Leave Type
                </label>
                <select
                  className="w-full p-2 rounded-control border border-border bg-surface-2 text-text-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="CL">Casual Leave (CL)</option>
                  <option value="SL">Sick Leave (SL)</option>
                  <option value="PL">Privilege Leave (PL)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="From Date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
                <Input
                  label="To Date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>

              <Input
                label="Number of Days"
                type="number"
                step="0.5"
                min="0.5"
                value={days}
                onChange={(e) => setDays(parseFloat(e.target.value) || 0)}
              />

              <div>
                <label className="block text-sm font-medium text-text-2 mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Reason
                </label>
                <textarea
                  className="w-full p-2 rounded-control border border-border bg-surface-2 text-text-1 text-sm focus:outline-none focus:ring-1 focus:ring-accent min-h-[100px] resize-none"
                  placeholder="Enter detailed reason..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <Button
                  className="w-full"
                  onClick={handleApply}
                  isLoading={loading}
                >
                  Submit Application
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {historyLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-text-3 text-sm">
                  No leave requests found.
                </div>
              ) : (
                history.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 border border-border rounded-control bg-surface-2"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-text-1">
                        {req.type} - {req.days} Day(s)
                      </div>
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded-full border ${getStatusColor(req.status)}`}
                      >
                        {req.status}
                      </span>
                    </div>
                    <div className="text-xs text-text-2 mb-2">
                      {new Date(req.fromDate).toLocaleDateString()} to{" "}
                      {new Date(req.toDate).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-text-1 italic">
                      "{req.reason}"
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
