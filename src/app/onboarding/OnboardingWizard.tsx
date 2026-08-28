"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  LayoutGrid,
  Users,
  Database,
  Check,
  ArrowLeft,
  ArrowRight,
  Rocket,
  Upload,
  X,
  Loader2,
  PartyPopper,
} from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { toast } from "@/lib/toastStore";

interface DeptInfo {
  id: string;
  no: number;
  title: string;
  short: string;
  desc: string;
}

interface SetupState {
  onboardingComplete: boolean;
  onboardingSkipped: boolean;
  activeDepartments: string[] | null;
  branding: {
    appName?: string;
    companyName?: string;
    companyGstin?: string;
    companyAddress?: string;
    logoUrl?: string;
  };
  companyCurrency: string | null;
  fiscalYearStart: string | null;
  dbEmpty: boolean;
  departments: DeptInfo[];
}

const STEPS = [
  { key: "company", label: "Company", icon: Building2 },
  { key: "departments", label: "Departments", icon: LayoutGrid },
  { key: "team", label: "Team", icon: Users },
  { key: "data", label: "Data", icon: Database },
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED"];
const MONTHS = [
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "January",
  "February",
  "March",
];

export default function OnboardingWizard() {
  const [state, setState] = useState<SetupState | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // S1 — Company
  const [companyName, setCompanyName] = useState("");
  const [companyGstin, setCompanyGstin] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [currency, setCurrency] = useState("INR");
  const [fyStart, setFyStart] = useState("April");

  // S2 — Departments
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());

  // S3 — Team
  const [adminName, setAdminName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [operatorUsername, setOperatorUsername] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");

  // S4 — Data
  const [loadSample, setLoadSample] = useState(true);

  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/setup");
        if (!res.ok) return;
        const data: SetupState = await res.json();
        setState(data);
        setCompanyName(data.branding?.companyName || "");
        setCompanyGstin(data.branding?.companyGstin || "");
        setCompanyAddress(data.branding?.companyAddress || "");
        setLogoUrl(data.branding?.logoUrl || "");
        setCurrency(data.companyCurrency || "INR");
        setFyStart(data.fiscalYearStart || "April");
        setSelectedDepts(
          new Set(
            data.activeDepartments && data.activeDepartments.length
              ? data.activeDepartments
              : data.departments.map((d) => d.id),
          ),
        );
      } catch {
        /* server down — buttons will surface errors */
      }
    })();
  }, []);

  if (!state) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-16 text-center text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
        Loading setup…
      </div>
    );
  }

  const toggleDept = (id: string) => {
    setSelectedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      toast.error("Logo must be under 1 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoUrl(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const canContinue = () => {
    if (step === 0) return companyName.trim().length > 0;
    if (step === 1) return selectedDepts.size > 0;
    if (step === 2) {
      return (
        adminName.trim().length > 0 &&
        adminUsername.trim().length > 0 &&
        adminPassword.length >= 4 &&
        operatorName.trim().length > 0 &&
        operatorUsername.trim().length > 0 &&
        operatorPassword.length >= 4
      );
    }
    return true;
  };

  const saveStep = async () => {
    setBusy(true);
    try {
      if (step === 0) {
        const res = await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "company",
            branding: {
              companyName,
              companyGstin: companyGstin || undefined,
              companyAddress: companyAddress || undefined,
              logoUrl: logoUrl || undefined,
            },
            currency,
            fiscalYearStart: fyStart,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not save company");
        toast.success("Company saved");
      } else if (step === 1) {
        const res = await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "departments",
            ids: [...selectedDepts],
          }),
        });
        const json = await res.json();
        if (!res.ok)
          throw new Error(json.error || "Could not save departments");
        toast.success(`${selectedDepts.size} departments active`);
      } else if (step === 2) {
        const res = await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "team",
            admin: {
              name: adminName,
              username: adminUsername,
              email: adminEmail || undefined,
              password: adminPassword,
              isOwner: true,
            },
            operator: {
              name: operatorName,
              username: operatorUsername,
              password: operatorPassword,
            },
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not create users");
        if (!json.success) {
          const msg = (json.errors || [])
            .map((e: any) => `${e.step}: ${e.error}`)
            .join(" · ");
          throw new Error(msg || "Could not create users");
        }
        toast.success("Team created — admin & operator");
      } else if (step === 3) {
        if (loadSample && state.dbEmpty) {
          const sres = await fetch("/api/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sample" }),
          });
          const sj = await sres.json();
          if (!sres.ok || !sj.loaded)
            throw new Error(sj.error || "Could not load sample data");
        }
        const cres = await fetch("/api/setup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete" }),
        });
        const cj = await cres.json();
        if (!cres.ok) throw new Error(cj.error || "Could not finish setup");
        toast.success("Setup complete — welcome aboard!");
        // Full page load, not client-side router.push: the root layout captured
        // onboardingComplete=false before we wrote the setting, so a soft
        // navigation would make AppShell bounce straight back to /onboarding.
        // A hard load re-renders the layout with the fresh value and lands on
        // /command without the wizard flashing again.
        window.location.href = "/command";
        return;
      }
      setStep((s) => Math.min(s + 1, 3));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    try {
      await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      });
    } catch {
      /* best effort */
    }
    window.location.href = "/command";
  };

  return (
    <div className="space-y-8">
      {/* Step tokens */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = i === step;
          const done = i < step;
          return (
            <button
              key={s.key}
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-blue-500/20 to-blue-600/10 border-blue-500/40 text-white shadow-lg shadow-blue-500/10"
                  : done
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 cursor-pointer hover:bg-emerald-500/20"
                    : "bg-white/5 border-white/10 text-slate-500"
              }`}
            >
              <span
                className={`p-2 rounded-xl ${active ? "bg-blue-500 text-white" : done ? "bg-emerald-500/20" : "bg-white/10"}`}
              >
                {done ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <span className="text-sm font-semibold">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-6 sm:p-8 space-y-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
        >
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">Company</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Who you are — this shows up on reports, invoices and challans.
                </p>
              </div>
              <div className="flex items-start gap-5">
                <div className="flex-shrink-0">
                  {logoUrl ? (
                    <div className="relative">
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="h-20 w-20 object-contain rounded-xl bg-slate-800/80 border border-white/10 p-1"
                      />
                      <button
                        onClick={() => setLogoUrl("")}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-rose-500/90 text-white hover:bg-rose-500"
                        aria-label="Remove logo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => logoInputRef.current?.click()}
                      className="h-20 w-20 rounded-xl border border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center text-slate-400 hover:border-blue-500/50 hover:text-blue-300 transition"
                    >
                      <Upload className="h-5 w-5 mb-1" />
                      <span className="text-[10px]">Logo</span>
                    </button>
                  )}
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onLogoFile(e.target.files?.[0])}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
                  <Input
                    label="Company name *"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Apex Manufacturing Ltd"
                  />
                  <Input
                    label="GSTIN"
                    value={companyGstin}
                    onChange={(e) => setCompanyGstin(e.target.value)}
                    placeholder="27AAACA12341Z1"
                  />
                  <Input
                    label="Company address"
                    value={companyAddress}
                    onChange={(e) => setCompanyAddress(e.target.value)}
                    placeholder="100 Industrial Parkway, MIDC Pune"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-slate-300">
                        FY starts
                      </label>
                      <select
                        value={fyStart}
                        onChange={(e) => setFyStart(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      >
                        {MONTHS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">Departments</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Turn on the departments your organisation uses — the gateway
                  and sidebar will only show these. (All 13 are on by default.)
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {state.departments.map((d) => {
                  const on = selectedDepts.has(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => toggleDept(d.id)}
                      className={`text-left px-4 py-3 rounded-2xl border transition-all duration-200 ${
                        on
                          ? "bg-blue-500/15 border-blue-500/40 text-white"
                          : "bg-white/5 border-white/10 text-slate-400 hover:border-white/25"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold">{d.short}</span>
                        <span
                          className={`h-5 w-5 rounded-md flex items-center justify-center ${on ? "bg-blue-500 text-white" : "bg-white/10"}`}
                        >
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </div>
                      <p className="text-[11px] mt-1 opacity-70 line-clamp-2">
                        {d.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-white">Team</h2>
                <p className="text-sm text-slate-400 mt-1">
                  Create your first two users — an administrator and a
                  shop-floor operator.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4 rounded-2xl border border-blue-500/25 bg-blue-500/5 p-5">
                  <p className="text-sm font-bold text-blue-300 uppercase tracking-wider flex items-center gap-2">
                    <Users className="h-4 w-4" /> Administrator
                  </p>
                  <Input
                    label="Full name *"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Ravi Sharma"
                  />
                  <Input
                    label="Username *"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin"
                  />
                  <Input
                    label="Email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@company.com"
                  />
                  <Input
                    label="Password * (min 4)"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••"
                  />
                </div>
                <div className="space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
                  <p className="text-sm font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                    <Database className="h-4 w-4" /> Operator
                  </p>
                  <Input
                    label="Full name *"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    placeholder="Suresh Kumar"
                  />
                  <Input
                    label="Username *"
                    value={operatorUsername}
                    onChange={(e) => setOperatorUsername(e.target.value)}
                    placeholder="operator"
                  />
                  <Input
                    label="Password * (min 4)"
                    type="password"
                    value={operatorPassword}
                    onChange={(e) => setOperatorPassword(e.target.value)}
                    placeholder="••••••"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-white">Starter data</h2>
                <p className="text-sm text-slate-400 mt-1">
                  One last thing — make the workspace feel alive for your first
                  day.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">Load sample data</p>
                  <p className="text-sm text-slate-400 mt-1">
                    {state.dbEmpty
                      ? "Adds a plant, machines, shifts, products, materials and one work order so you can explore immediately."
                      : "Your database already has data — sample loading is not needed."}
                  </p>
                </div>
                <button
                  onClick={() => setLoadSample((v) => !v)}
                  disabled={!state.dbEmpty}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-200 flex-shrink-0 ${
                    loadSample ? "bg-emerald-500" : "bg-white/15"
                  } ${!state.dbEmpty ? "opacity-40 cursor-not-allowed" : ""}`}
                  aria-pressed={loadSample}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all duration-200 ${loadSample ? "left-6" : "left-1"}`}
                  />
                </button>
              </div>
              <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-5 flex items-start gap-3">
                <PartyPopper className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-200">
                  That&apos;s it — hitting Finish saves your company,
                  departments and team, and takes you to the executive
                  dashboard.
                </p>
              </div>
            </div>
          )}

          {/* Nav */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div className="flex gap-3">
              {step > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => setStep((s) => s - 1)}
                  disabled={busy}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              ) : (
                <button
                  onClick={skip}
                  className="text-sm text-slate-500 hover:text-slate-300 transition"
                >
                  I&apos;ll do this later →
                </button>
              )}
            </div>
            <Button
              variant={step === 3 ? "success" : "primary"}
              onClick={saveStep}
              disabled={!canContinue()}
              isLoading={busy}
            >
              {step === 3 ? (
                <>
                  <Rocket className="h-4 w-4" /> Finish
                </>
              ) : (
                <>
                  Continue <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
