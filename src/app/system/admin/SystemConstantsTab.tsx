"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { Loader2, Save, Sliders, CheckCircle2 } from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";
import { Card } from "@/app/components/ui/Card";
import { Input } from "@/app/components/ui/Input";
import { Button } from "@/app/components/ui/Button";

export default function SystemConstantsTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [constants, setConstants] = useState({
    oeeGoodThreshold: 85,
    oeeWarningThreshold: 70,
    planGateThreshold: 95,
    otStatutoryLimitHours: 50,
    operatorOopsWindowMinutes: 15,
    kioskCountdownSeconds: 30,
    maxFileUploadMb: 4,
    effRatingHigh: 95,
    effRatingMed: 80,
    effRatingLow: 65,
    suggestedPoMultiplier: 1.2,
    graceMinutes: 10,
    countTolerance: 0,
    laborRatePerHour: 150,
    machineRatePerHour: 300,
    otDailyThresholdHours: 9,
    otMultiplier: 2,
    dailyAvailableHours: 16,
    defaultEnergyCostPerKwh: 8.0,
    clPerYear: 12,
    slPerYear: 8,
    plPerYear: 12,
    requireMillCerts: false,
  });

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setConstants((prev) => ({
          ...prev,
          ...data,
        }));
      })
      .catch((err) => logClientError(err, "SystemConstantsTab"))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key: string, val: number) => {
    setConstants((prev) => ({ ...prev, [key]: val }));
  };

  const handleToggle = (key: string, val: boolean) => {
    setConstants((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(constants),
      });
      if (res.ok) {
        setSuccessMsg("All plant system constants saved successfully!");
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        alert("Failed to save constants");
      }
    } catch (e) {
      alert("Error saving constants");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="System Constants & Threshold Limits"
        description="Configure every magic number, threshold, time limit, and calculation parameter across the plant."
        icon={<Sliders className="w-7 h-7 text-accent" />}
      >
        <Button onClick={handleSave} isLoading={saving}>
          <Save className="w-4 h-4 mr-2" />
          Save System Constants
        </Button>
      </PageHeader>

      {successMsg && (
        <div className="p-4 bg-success-soft border border-success/20 rounded-control text-success font-bold text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-success" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OEE Thresholds */}
        <Card className="space-y-4">
          <h3 className="text-lg font-bold text-text-1 flex items-center gap-2">
            📊 OEE Threshold Limits
          </h3>
          <Input
            label="OEE Good Threshold (%)"
            type="number"
            value={constants.oeeGoodThreshold}
            onChange={(e) =>
              handleChange("oeeGoodThreshold", parseFloat(e.target.value) || 0)
            }
            description="Target above which OEE is displayed as green (Default: 85%)"
          />
          <Input
            label="OEE Warning Threshold (%)"
            type="number"
            value={constants.oeeWarningThreshold}
            onChange={(e) =>
              handleChange(
                "oeeWarningThreshold",
                parseFloat(e.target.value) || 0,
              )
            }
            description="Target below which OEE is displayed as red (Default: 70%)"
          />
        </Card>

        {/* Operational & Planning Gates */}
        <Card className="space-y-4">
          <h3 className="text-lg font-bold text-text-1 flex items-center gap-2">
            🎯 Planning & Operational Gates
          </h3>
          <Input
            label="Plan Gate Completion Threshold (%)"
            type="number"
            value={constants.planGateThreshold}
            onChange={(e) =>
              handleChange("planGateThreshold", parseFloat(e.target.value) || 0)
            }
            description="Work order completion percentage required to mark as completed (Default: 95%)"
          />
          <Input
            label="Statutory Monthly OT Cap (Hours)"
            type="number"
            value={constants.otStatutoryLimitHours}
            onChange={(e) =>
              handleChange(
                "otStatutoryLimitHours",
                parseFloat(e.target.value) || 0,
              )
            }
            description="Monthly overtime limit per operator before triggering compliance warning (Default: 50h)"
          />
        </Card>

        {/* Shopfloor & Kiosk Limits */}
        <Card className="space-y-4">
          <h3 className="text-lg font-bold text-text-1 flex items-center gap-2">
            ⏱ Shopfloor & Kiosk Time Limits
          </h3>
          <Input
            label="Operator Oops Edit Window (Minutes)"
            type="number"
            value={constants.operatorOopsWindowMinutes}
            onChange={(e) =>
              handleChange(
                "operatorOopsWindowMinutes",
                parseInt(e.target.value, 10) || 0,
              )
            }
            description="Time window within which an operator can edit their own production entry (Default: 15 mins)"
          />
          <Input
            label="Andon / Kiosk Countdown Refresh (Seconds)"
            type="number"
            value={constants.kioskCountdownSeconds}
            onChange={(e) =>
              handleChange(
                "kioskCountdownSeconds",
                parseInt(e.target.value, 10) || 0,
              )
            }
            description="Auto-refresh interval for Andon TV board & live monitors (Default: 30s)"
          />
        </Card>

        {/* Upload & Inventory Constants */}
        <Card className="space-y-4">
          <h3 className="text-lg font-bold text-text-1 flex items-center gap-2">
            📁 File & Purchasing Limits
          </h3>
          <Input
            label="Max File Upload Size (MB)"
            type="number"
            value={constants.maxFileUploadMb}
            onChange={(e) =>
              handleChange("maxFileUploadMb", parseInt(e.target.value, 10) || 0)
            }
            description="File size cap for revision-controlled drawings & SOP uploads (Default: 4 MB)"
          />
          <Input
            label="Suggested PO Multiplier"
            type="number"
            step="0.1"
            value={constants.suggestedPoMultiplier}
            onChange={(e) =>
              handleChange("suggestedPoMultiplier", parseFloat(e.target.value))
            }
            description="Multiplies the BOM required amount when suggesting a PO."
          />
          <Input
            label="Daily Available Hours (per machine)"
            type="number"
            step="0.5"
            value={constants.dailyAvailableHours}
            onChange={(e) =>
              handleChange("dailyAvailableHours", parseFloat(e.target.value))
            }
            description="Default 16 hours. Used in Capacity Heatmap planning."
          />
          <Input
            label="Default Energy Cost (₹/kWh)"
            type="number"
            step="0.1"
            value={constants.defaultEnergyCostPerKwh || 8.0}
            onChange={(e) =>
              handleChange(
                "defaultEnergyCostPerKwh",
                parseFloat(e.target.value),
              )
            }
            description="Default rate if not manually overridden."
          />
        </Card>

        {/* Rating Bands */}
        <Card className="space-y-4 md:col-span-2">
          <h3 className="text-lg font-bold text-text-1 flex items-center gap-2">
            🏆 Operator Efficiency Rating Bands (%)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="High Rating (≥ %)"
              type="number"
              value={constants.effRatingHigh}
              onChange={(e) =>
                handleChange("effRatingHigh", parseFloat(e.target.value) || 0)
              }
              description="Default: 95%"
            />
            <Input
              label="Medium Rating (≥ %)"
              type="number"
              value={constants.effRatingMed}
              onChange={(e) =>
                handleChange("effRatingMed", parseFloat(e.target.value) || 0)
              }
              description="Default: 80%"
            />
            <Input
              label="Low Rating (≥ %)"
              type="number"
              value={constants.effRatingLow}
              onChange={(e) =>
                handleChange("effRatingLow", parseFloat(e.target.value) || 0)
              }
              description="Default: 65%"
            />
          </div>
        </Card>

        {/* Leave Allowances */}
        <Card className="space-y-4 md:col-span-2">
          <h3 className="text-lg font-bold text-text-1 flex items-center gap-2">
            🏖️ Yearly Leave Allowances (Days)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Casual Leaves (CL)"
              type="number"
              value={constants.clPerYear}
              onChange={(e) =>
                handleChange("clPerYear", parseInt(e.target.value, 10) || 0)
              }
              description="Default: 12"
            />
            <Input
              label="Sick Leaves (SL)"
              type="number"
              value={constants.slPerYear}
              onChange={(e) =>
                handleChange("slPerYear", parseInt(e.target.value, 10) || 0)
              }
              description="Default: 8"
            />
            <Input
              label="Privilege Leaves (PL)"
              type="number"
              value={constants.plPerYear}
              onChange={(e) =>
                handleChange("plPerYear", parseInt(e.target.value, 10) || 0)
              }
              description="Default: 12"
            />
          </div>
        </Card>

        {/* Aerospace Quality Mode */}
        <Card className="space-y-4 md:col-span-2 border-2 border-amber-200 dark:border-amber-900/60">
          <h3 className="text-lg font-bold text-text-1 flex items-center gap-2">
            ✈️ Aerospace Quality Mode
          </h3>
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() =>
                handleToggle("requireMillCerts", !constants.requireMillCerts)
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                constants.requireMillCerts ? "bg-amber-500" : "bg-slate-600"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                  constants.requireMillCerts ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <div>
              <p className="font-bold text-sm text-text-1">
                Require Mill Certs on All Stock Receipts
              </p>
              <p className="text-xs text-slate-400 mt-0.5 max-w-lg">
                <strong>AEROSPACE MODE:</strong> Receiving stock requires a Heat
                Number + Cert (Mill Cert, CoC, or Test Report). Uncertified
                batches are hard-blocked at issuance — operators cannot issue
                stock without a cert on file. When OFF, cert fields are optional
                and nothing is blocked (general customers unchanged).
              </p>
              {constants.requireMillCerts && (
                <p className="mt-2 text-xs font-bold text-amber-400 flex items-center gap-1">
                  ⚠️ ACTIVE — All uncertified batch issuances will be blocked.
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
