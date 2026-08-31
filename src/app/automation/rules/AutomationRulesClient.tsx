"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Zap,
  Plus,
  Play,
  CheckCircle2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "@/lib/toastStore";
import { soundFx } from "@/lib/soundFx";

interface AutomationRule {
  id: string;
  name: string;
  domain: string;
  triggerEvent: string;
  conditionDescription: string;
  actions: string[];
  isActive: boolean;
  lastTriggeredAt?: string;
  triggerCount: number;
}

export default function AutomationRulesClient() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>("ALL");
  const [showAddModal, setShowAddModal] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDomain, setNewDomain] = useState("QUALITY");
  const [newTrigger, setNewTrigger] = useState("");
  const [newCondition, setNewCondition] = useState("");
  const [newAction, setNewAction] = useState("");

  const fetchRules = async () => {
    try {
      const res = await fetch("/api/automation/rules");
      const data = await res.json();
      if (data?.success) {
        setRules(data.rules);
      }
    } catch (err) {
      logClientError(err, "AutomationRulesClient");
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggle = async (id: string) => {
    soundFx.playClick();
    try {
      const res = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TOGGLE_ACTIVE", ruleId: id }),
      });
      const data = await res.json();
      if (data?.success) {
        setRules(data.rules);
        toast.success("Toggled automation rule status!");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTestFire = async (id: string, name: string) => {
    soundFx.playSuccess();
    try {
      const res = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "TEST_FIRE", ruleId: id }),
      });
      const data = await res.json();
      if (data?.success) {
        setRules(data.rules);
        toast.success(`Test fired automation: "${name}"! Executed all actions.`);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newTrigger.trim()) {
      toast.error("Rule Name and Trigger Event are required");
      return;
    }

    try {
      const res = await fetch("/api/automation/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_RULE",
          newRule: {
            name: newName,
            domain: newDomain,
            triggerEvent: newTrigger,
            conditionDescription: newCondition,
            actions: newAction.split(",").map((a) => a.trim()).filter(Boolean),
          },
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setRules(data.rules);
        setShowAddModal(false);
        setNewName("");
        setNewTrigger("");
        setNewCondition("");
        setNewAction("");
        soundFx.playSuccess();
        toast.success("Created new Multi-Domain Automation Rule!");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const filteredRules = selectedDomain === "ALL" ? rules : rules.filter((r) => r.domain === selectedDomain);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-blue-950/40 border border-amber-500/20 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>UNIVERSAL 360° AUTOMATION & RULES ENGINE</span>
            </span>
            <span className="text-xs text-white/50 font-mono">CROSS-DEPARTMENT EVENT-DRIVEN SENTINEL</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Autonomous Factory Event & Business Rules Studio
          </h1>
          <p className="text-xs text-white/60 max-w-2xl leading-relaxed">
            Configure multi-domain triggers across SCM delays, Finance credit limits, CNC tool wear limits, metrology calibration expiry, statutory OT limits, and unlogged machine stoppages.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Automation Rule</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 pb-2">
        {["ALL", "SCM", "FINANCE", "QUALITY", "MACHINE_IOT", "TOOLING", "HR_EHS"].map((dom) => (
          <button
            key={dom}
            onClick={() => setSelectedDomain(dom)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
              selectedDomain === dom
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-500/30"
                : "bg-white/[0.02] text-white/60 border-white/10 hover:bg-white/[0.05]"
            }`}
          >
            {dom.replace("_", " & ")}
          </button>
        ))}
      </div>

      {/* Rules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRules.map((rule) => (
          <div
            key={rule.id}
            className={`p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${
              rule.isActive ? "bg-white/[0.02] border-white/10" : "bg-black/40 border-white/5 opacity-50"
            }`}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-white/10 text-cyan-300 border border-white/10 mb-1.5 inline-block">
                    {rule.domain.replace("_", " & ")}
                  </span>
                  <h3 className="font-extrabold text-sm text-white leading-snug">{rule.name}</h3>
                </div>

                <button
                  onClick={() => handleToggle(rule.id)}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  {rule.isActive ? (
                    <ToggleRight className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-white/30" />
                  )}
                </button>
              </div>

              {/* Trigger & Condition */}
              <div className="p-3 rounded-2xl bg-black/50 border border-white/10 space-y-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase block">⚡ Event Trigger:</span>
                  <span className="text-white/80 text-[11px]">{rule.triggerEvent}</span>
                </div>

                <div>
                  <span className="text-[10px] text-purple-400 font-bold uppercase block">🔍 Conditions:</span>
                  <span className="text-white/60 text-[11px]">{rule.conditionDescription}</span>
                </div>
              </div>

              {/* Actions Executed */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono font-bold text-white/40 uppercase">Automated Actions:</span>
                {rule.actions.map((act, i) => (
                  <div key={i} className="text-[11px] text-emerald-300 flex items-start gap-1.5 leading-tight font-mono">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer Stats & Test Button */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-white/50">
              <span>Fired: {rule.triggerCount} times</span>

              <button
                onClick={() => handleTestFire(rule.id, rule.name)}
                className="px-3 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Play className="w-3 h-3" />
                <span>Simulate / Test</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreateRule} className="p-6 rounded-3xl bg-[#0b0f19] border border-amber-500/30 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-mono font-bold text-white uppercase flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Create Multi-Domain Automation Rule</span>
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Rule Name *</label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="E.g. Inconel Hardness Spike Auto-Quarantine"
                  className="w-full h-9 rounded-xl bg-black/50 border border-white/15 px-3 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Domain *</label>
                <select
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  className="w-full h-9 rounded-xl bg-black/50 border border-white/15 px-3 text-white font-mono"
                >
                  <option value="SCM">Supply Chain & Materials (SCM)</option>
                  <option value="FINANCE">Commercial & Finance</option>
                  <option value="QUALITY">Quality & Compliance</option>
                  <option value="MACHINE_IOT">Machine IoT & Telemetry</option>
                  <option value="TOOLING">Tool Room & Engineering</option>
                  <option value="HR_EHS">HR & Safety Compliance</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Event Trigger *</label>
                <input
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  placeholder="E.g. When HRC Hardness > 48 on raw bar stock"
                  className="w-full h-9 rounded-xl bg-black/50 border border-white/15 px-3 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Condition Filters</label>
                <input
                  value={newCondition}
                  onChange={(e) => setNewCondition(e.target.value)}
                  placeholder="E.g. Alloy Grade = Inconel 718"
                  className="w-full h-9 rounded-xl bg-black/50 border border-white/15 px-3 text-white"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-white/60 block mb-1">Actions (comma-separated)</label>
                <input
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  placeholder="Lock Traveler, Notify Metallurgical Lead, Issue Supplier NCR"
                  className="w-full h-9 rounded-xl bg-black/50 border border-white/15 px-3 text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 text-white/70 hover:text-white text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold text-xs shadow"
              >
                Save Automation Rule
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
