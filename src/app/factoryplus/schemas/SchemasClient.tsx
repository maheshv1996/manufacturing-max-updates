"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Copy,
  Check,
  RefreshCw,
  Terminal,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface SchemaItem {
  uuid: string;
  name: string;
  version: string;
  author: string;
  description: string;
  schemaDefinition: {
    $schema: string;
    type: string;
    required: string[];
    properties: Record<string, any>;
  };
  sampleValidPayload: Record<string, any>;
}

export default function SchemasClient() {
  const [schemas, setSchemas] = useState<SchemaItem[]>([]);
  const [selectedSchemaUuid, setSelectedSchemaUuid] = useState<string>("");
  const [stats, setStats] = useState({
    totalSchemas: 0,
    validatedPackets24h: 0,
    schemaCompliancePct: 0,
  });
  const [_loading, setLoading] = useState(true);
  const [testPayloadText, setTestPayloadText] = useState("");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/factoryplus/schemas");
      if (res.ok) {
        const data = await res.json();
        setSchemas(data.schemas || []);
        setStats(
          data.stats || {
            totalSchemas: 0,
            validatedPackets24h: 0,
            schemaCompliancePct: 0,
          },
        );
        if (!selectedSchemaUuid && data.schemas?.length > 0) {
          setSelectedSchemaUuid(data.schemas[0].uuid);
          setTestPayloadText(
            JSON.stringify(data.schemas[0].sampleValidPayload, null, 2),
          );
        }
      }
    } catch (err) {
      logClientError("Failed to load schemas:", err, "SchemasClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeSchema =
    schemas.find((s) => s.uuid === selectedSchemaUuid) || schemas[0];

  const handleSelectSchema = (schema: SchemaItem) => {
    setSelectedSchemaUuid(schema.uuid);
    setTestPayloadText(JSON.stringify(schema.sampleValidPayload, null, 2));
    setValidationResult(null);
  };

  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    try {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(testPayloadText);
      } catch {
        setValidationResult({
          valid: false,
          qualityCode: "BAD_0",
          message: "Invalid JSON format syntax",
          errors: ["JSON Parse Error: Please check braces and quotes."],
        });
        setValidating(false);
        return;
      }

      const res = await fetch("/api/factoryplus/schemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaUuid: selectedSchemaUuid,
          payload: parsedPayload,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setValidationResult(data);
      }
    } catch (err) {
      logClientError("Validation error:", err, "SchemasClient");
    } finally {
      setValidating(false);
    }
  };

  const copyUuid = (uuid: string) => {
    navigator.clipboard.writeText(uuid);
    setCopiedUuid(uuid);
    setTimeout(() => setCopiedUuid(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Industrial Schema Validator & Metric Registry"
        description="Official AMRC Factory+ JSON Schema repository: Standardized metrics for CNC Milling, CMM Metrology, and Cleanrooms with live schema conformity validation."
      >
        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active Data Schemas
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {stats.totalSchemas} Standard Schemas
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            AMRC / Catapult Framework
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Validated Telemetry (24h)
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
            {stats.validatedPackets24h.toLocaleString()} Packets
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Ingress stream conformity
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Compliance Rate
          </span>
          <div className="text-2xl font-black font-mono text-purple-400 mt-1">
            {stats.schemaCompliancePct}%
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Quality Code: GOOD_192
          </div>
        </div>
      </div>

      {/* Schema Selector Tabs */}
      <div className="flex items-center gap-2 bg-surface-1 p-1.5 rounded-2xl border border-border w-fit overflow-x-auto">
        {schemas.map((s) => (
          <button
            key={s.uuid}
            onClick={() => handleSelectSchema(s)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedSchemaUuid === s.uuid
                ? "bg-accent text-white shadow-sm"
                : "text-text-3 hover:text-text-1"
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>
              {s.name} ({s.version})
            </span>
          </button>
        ))}
      </div>

      {activeSchema && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Schema Definition Inspector (6 cols) */}
          <div className="lg:col-span-6 bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-base text-text-1">
                  {activeSchema.name} {activeSchema.version}
                </h3>
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold">
                  JSON Schema Draft 2020-12
                </span>
              </div>
              <div className="text-xs font-mono text-text-3 flex items-center gap-2 mt-1">
                <span>UUID: {activeSchema.uuid}</span>
                <button
                  onClick={() => copyUuid(activeSchema.uuid)}
                  className="hover:text-text-1 text-accent cursor-pointer"
                >
                  {copiedUuid === activeSchema.uuid ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <p className="text-xs text-text-2 mt-2">
                {activeSchema.description}
              </p>
            </div>

            {/* Properties Matrix */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-3 block">
                Required Metric Properties (
                {activeSchema.schemaDefinition.required.length})
              </span>
              <div className="space-y-2 font-mono text-xs">
                {Object.entries(activeSchema.schemaDefinition.properties).map(
                  ([propName, propDef]: [string, any]) => {
                    const isRequired =
                      activeSchema.schemaDefinition.required.includes(propName);

                    return (
                      <div
                        key={propName}
                        className="p-3 rounded-2xl bg-surface-2 border border-border/80 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-cyan-300">
                            {propName}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-text-2">
                              {propDef.type}
                            </span>
                            {isRequired && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                                REQUIRED
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-text-3 font-sans">
                          {propDef.description}
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Live Schema Validator (6 cols) */}
          <div className="lg:col-span-6 bg-surface-1 border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-2 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                Live Ingress Payload Validator
              </h3>
              <button
                onClick={() =>
                  setTestPayloadText(
                    JSON.stringify(activeSchema.sampleValidPayload, null, 2),
                  )
                }
                className="text-[11px] text-accent hover:underline cursor-pointer"
              >
                Reset Sample
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-3">
                Telemetry JSON Payload:
              </label>
              <textarea
                value={testPayloadText}
                onChange={(e) => setTestPayloadText(e.target.value)}
                rows={10}
                className="w-full bg-slate-950 border border-border/80 rounded-2xl p-3.5 font-mono text-xs text-emerald-300 focus:outline-none focus:border-accent"
              />
            </div>

            <button
              onClick={handleValidate}
              disabled={validating}
              className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {validating ? "Validating..." : "Validate Against Schema"}
            </button>

            {/* Validation Result Banner */}
            {validationResult && (
              <div
                className={`p-4 rounded-2xl border text-xs space-y-2 ${
                  validationResult.valid
                    ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                    : "bg-rose-950/30 border-rose-500/40 text-rose-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                    )}
                    {validationResult.message}
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-surface-1">
                    Quality: {validationResult.qualityCode}
                  </span>
                </div>

                {validationResult.errors?.length > 0 && (
                  <div className="pt-2 border-t border-rose-500/30 space-y-1 font-mono text-[11px]">
                    {validationResult.errors.map((err: string, i: number) => (
                      <div key={i} className="text-rose-300">
                        • {err}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
