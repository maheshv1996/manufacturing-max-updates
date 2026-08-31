/**
 * Enterprise CSV serialization and browser download utilities.
 * Compliant with RFC 4180, UTF-8 BOM, multiline escaping, dynamic column discovery, and SSR-safe environments.
 */

function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? '""' : `"${val.toISOString()}"`;
  }
  if (typeof val === "object") {
    try {
      return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
    } catch {
      return `"${String(val).replace(/"/g, '""')}"`;
    }
  }
  return `"${String(val).replace(/"/g, '""')}"`;
}

/**
 * Pure RFC 4180 CSV String Generator.
 * Discovers all unique keys across all rows to prevent missing columns on sparse records.
 */
export function generateCsvString(
  data: Record<string, any>[],
  explicitHeaders?: string[],
): string {
  if (!data || data.length === 0) return "";

  const headers =
    explicitHeaders && explicitHeaders.length > 0
      ? explicitHeaders
      : Array.from(
          new Set(
            data.flatMap((row) => (row && typeof row === "object" ? Object.keys(row) : [])),
          ),
        );

  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map(escapeCsvCell).join(","));

  // Data rows
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const values = headers.map((h) => escapeCsvCell(row[h]));
    csvRows.push(values.join(","));
  }

  // Include UTF-8 Byte Order Mark (BOM) for seamless Excel compatibility
  return "\uFEFF" + csvRows.join("\r\n");
}

/**
 * Trigger client-side CSV download in browser environment.
 * Safe against SSR execution and cleans up object URLs to avoid memory leaks.
 */
export function exportToCsv(
  data: Record<string, any>[],
  filename: string = "export",
  explicitHeaders?: string[],
): string | void {
  const csvString = generateCsvString(data, explicitHeaders);
  if (!csvString) return;

  // If executing in Node.js / SSR context, return CSV string directly
  if (typeof window === "undefined" || typeof document === "undefined") {
    return csvString;
  }

  const cleanFilename = String(filename || "export")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateSuffix = new Date().toISOString().split("T")[0];
  const fullFilename = `${cleanFilename}_${dateSuffix}.csv`;

  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.setAttribute("href", url);
  link.setAttribute("download", fullFilename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up object URL after dispatch to prevent browser memory leaks
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
