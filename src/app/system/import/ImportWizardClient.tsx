"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  Database,
} from "lucide-react";
import {
  IMPORT_ENTITIES,
  importEntityByKey,
  buildTemplateCsv,
  normalizeHeader,
  type ImportEntity,
} from "@/lib/importConfig";
import { Button } from "@/app/components/ui/Button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableCell,
  TableBody,
} from "@/app/components/ui/Table";
import { toast } from "@/lib/toastStore";

interface ParsedRow {
  values: Record<string, string>; // raw header -> cell
  data: Record<string, string>; // canonical key -> cell (via aliases)
}

interface CheckResult {
  index: number;
  valid: boolean;
  errors: string[];
  existing: boolean;
}

/** Minimal robust CSV parser — quoted fields, embedded commas/newlines,
 *  doubled-quote escapes, CRLF. No dependencies. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function toRowObjects(
  entity: ImportEntity,
  cells: string[][],
): ParsedRow[] | { error: string } {
  if (cells.length === 0) return { error: "File is empty." };
  const headers = cells[0].map((h) => h.trim());
  const matched = new Set<string>();
  const keyByHeader: string[] = headers.map((h) => {
    const key = entity.headerAliases[normalizeHeader(h)] ?? "";
    if (key) matched.add(key);
    return key;
  });
  if (matched.size === 0) {
    return {
      error:
        "No recognized headers found. Download the template for the correct columns.",
    };
  }
  const rows: ParsedRow[] = [];
  for (let i = 1; i < cells.length; i++) {
    const r = cells[i];
    const values: Record<string, string> = {};
    const data: Record<string, string> = {};
    headers.forEach((h, j) => {
      const val = (r[j] ?? "").trim();
      values[h] = val;
      const key = keyByHeader[j];
      if (key) data[key] = val;
    });
    if (Object.keys(data).length) rows.push({ values, data });
  }
  return rows;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ImportWizardClient() {
  const [activeKey, setActiveKey] = useState<ImportEntity["key"]>("products");
  const entity = importEntityByKey(activeKey)!;

  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [checks, setChecks] = useState<CheckResult[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validCount = checks?.filter((c) => c.valid).length ?? 0;
  const invalidCount = checks ? checks.length - validCount : 0;
  const updateCount = checks?.filter((c) => c.valid && c.existing).length ?? 0;

  const switchTab = (key: ImportEntity["key"]) => {
    setActiveKey(key);
    setFileName(null);
    setParseError(null);
    setRows(null);
    setChecks(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setChecks(null);
    try {
      const text = await file.text();
      const cells = parseCsv(text);
      const parsed = toRowObjects(entity, cells);
      if ("error" in parsed) {
        setParseError(parsed.error);
        setRows(null);
        return;
      }
      setRows(parsed);
      setChecking(true);
      const res = await fetch(`/api/import/${entity.key}?check=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsed.map((p) => p.data) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setParseError(json.error || "Validation failed");
      } else {
        setChecks(json.rows as CheckResult[]);
      }
    } catch {
      setParseError("Could not read the file. Make sure it is a valid CSV.");
    } finally {
      setChecking(false);
    }
  };

  const runImport = async () => {
    if (!rows || validCount === 0 || importing) return;
    setImporting(true);
    try {
      const res = await fetch(`/api/import/${entity.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rows.map((p) => p.data) }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Import failed");
        return;
      }
      toast.success(
        `Imported ${json.imported} ${entity.key}, skipped ${json.skipped}`,
      );
      setFileName(null);
      setRows(null);
      setChecks(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      toast.error("Import failed — check the server connection");
    } finally {
      setImporting(false);
    }
  };

  const previewRows = rows?.slice(0, 10) ?? [];
  const shownCount = rows?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {IMPORT_ENTITIES.map((e) => {
          const active = e.key === activeKey;
          return (
            <button
              key={e.key}
              onClick={() => switchTab(e.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "bg-white/5 backdrop-blur-xl text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white"
              }`}
            >
              {e.label}
            </button>
          );
        })}
      </div>

      {/* Entity card */}
      <motion.div
        key={entity.key}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-2xl p-6 space-y-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{entity.label}</h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              {entity.description}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `${entity.key}-template.csv`,
                  buildTemplateCsv(entity),
                )
              }
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload CSV
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Column help */}
        <div className="flex flex-wrap gap-2">
          {entity.columns.map((c) => (
            <span
              key={c.key}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                c.required
                  ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                  : "bg-white/5 text-slate-400 border-white/10"
              }`}
            >
              {c.label}
              {c.required && <span className="text-rose-400">*</span>}
            </span>
          ))}
        </div>

        {parseError && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">File rejected</p>
              <p className="mt-0.5">{parseError}</p>
            </div>
          </div>
        )}

        {fileName && !parseError && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span className="text-slate-300 font-medium">{fileName}</span>
            <span>· {rows?.length ?? 0} rows parsed</span>
            {checking && (
              <span className="inline-flex items-center gap-1.5 text-blue-400">
                <RefreshCw className="h-4 w-4 animate-spin" /> validating…
              </span>
            )}
          </div>
        )}

        {/* Summary strip */}
        {rows && checks && !checking && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300">
              <Database className="h-4 w-4" /> Total {checks.length}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> {validCount} valid
            </span>
            {updateCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300">
                <RefreshCw className="h-4 w-4" /> {updateCount} will update
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <XCircle className="h-4 w-4" /> {invalidCount} invalid
            </span>
            <Button
              variant="success"
              size="sm"
              disabled={validCount === 0}
              isLoading={importing}
              onClick={runImport}
              className="ml-auto"
            >
              <Upload className="h-4 w-4" />
              Import {validCount} valid row{validCount === 1 ? "" : "s"}
            </Button>
          </div>
        )}

        {/* Preview table (first 10 rows) */}
        {rows && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Preview — first {Math.min(shownCount, 10)} of {shownCount} rows
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead className="w-10">Status</TableHead>
                  {entity.columns.map((c) => (
                    <TableHead key={c.key}>{c.label}</TableHead>
                  ))}
                  {invalidCount > 0 && <TableHead>Issues</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => {
                  const check = checks?.[i];
                  const bad = check && !check.valid;
                  return (
                    <TableRow key={i} className={bad ? "bg-rose-500/10" : ""}>
                      <TableCell className="text-slate-500">{i + 1}</TableCell>
                      <TableCell>
                        {!check ? (
                          <span className="text-slate-500">…</span>
                        ) : bad ? (
                          <XCircle className="h-5 w-5 text-rose-400" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        )}
                      </TableCell>
                      {entity.columns.map((c) => (
                        <TableCell
                          key={c.key}
                          className={bad ? "text-rose-200" : ""}
                        >
                          {row.data[c.key] || (
                            <span className="text-slate-600">—</span>
                          )}
                        </TableCell>
                      ))}
                      {invalidCount > 0 && (
                        <TableCell className="text-xs text-rose-300 max-w-[220px]">
                          {check && !check.valid
                            ? check.errors.join(" · ")
                            : ""}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell className="text-slate-500 italic">
                      No data rows found in this file.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {!rows && !parseError && (
          <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-slate-500">
            <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              Upload a CSV (or download the template and fill it in). The first
              row must be the column headers.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
