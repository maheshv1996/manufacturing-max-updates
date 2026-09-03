/**
 * GL CORE — pure, DB-free facts of the accounting engine.
 * ---------------------------------------------------------------------------
 * Chart-of-accounts seed data, fiscal-period bucketing and the paise→rupee row
 * mapper live here (importing only ./money) so CI tests can exercise them with
 * Node's type-stripped runner WITHOUT pulling in Prisma/pg. glEngine imports
 * and re-exports from this module, so app callers keep a single import site.
 */
import { fromPaise } from "./money";
import type { GlAccountType, GlAccountGroup, GlNormalBalance } from "@prisma/client";

export interface CoaSeed {
  code: string;
  name: string;
  type: GlAccountType;
  group: GlAccountGroup;
  normalBalance: GlNormalBalance;
  description?: string;
}

export const DEFAULT_COA: CoaSeed[] = [
  // ---- ASSETS -------------------------------------------------------------
  { code: "1010", name: "Cash on Hand", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Petty cash & physical cash" },
  { code: "1020", name: "Bank Accounts", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "All operating bank balances" },
  { code: "1030", name: "Accounts Receivable", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Customer invoice receivables" },
  { code: "1040", name: "GST Input Credit (ITC)", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Input tax credit receivable" },
  { code: "1050", name: "Inventory — Raw Materials", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Raw material stock value" },
  { code: "1060", name: "Inventory — Work in Progress", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "WIP value on open work orders" },
  { code: "1070", name: "Inventory — Finished Goods", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Finished goods stock value" },
  { code: "1080", name: "Loans & Advances", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Employee / vendor advances" },
  { code: "1090", name: "Prepaid Expenses", type: "ASSET", group: "CURRENT_ASSET", normalBalance: "DEBIT", description: "Insurance, rents paid in advance" },
  { code: "1210", name: "Plant & Machinery", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "CNC machines & equipment at cost" },
  { code: "1220", name: "Tools, Jigs & Fixtures", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "Tooling & fixtures register value" },
  { code: "1230", name: "Furniture & Fixtures", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "Office furniture & fittings" },
  { code: "1240", name: "Vehicles", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "Company vehicles at cost" },
  { code: "1250", name: "Computers & IT Equipment", type: "ASSET", group: "FIXED_ASSET", normalBalance: "DEBIT", description: "IT assets at cost" },
  { code: "1260", name: "Accumulated Depreciation", type: "ASSET", group: "FIXED_ASSET", normalBalance: "CREDIT", description: "Contra-asset — cumulative depreciation" },
  { code: "1310", name: "Intangible Assets", type: "ASSET", group: "INTANGIBLE_ASSET", normalBalance: "DEBIT", description: "Software, IP, goodwill" },

  // ---- LIABILITIES --------------------------------------------------------
  { code: "2010", name: "Accounts Payable", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Supplier invoice payables" },
  { code: "2020", name: "GST Output Payable", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Output tax collected" },
  { code: "2030", name: "Statutory Dues (PF/ESI/PT)", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Payroll statutory payables" },
  { code: "2040", name: "TDS Payable", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Tax deducted at source payable" },
  { code: "2050", name: "Salary & Wages Payable", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Accrued payroll" },
  { code: "2060", name: "Customer Advances", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Advances received from customers" },
  { code: "2070", name: "Short-Term Loans", type: "LIABILITY", group: "CURRENT_LIABILITY", normalBalance: "CREDIT", description: "Working capital loans, OD" },
  { code: "2210", name: "Long-Term Loans", type: "LIABILITY", group: "LONG_TERM_LIABILITY", normalBalance: "CREDIT", description: "Term loans, vehicle finance" },
  { code: "2220", name: "Provisions", type: "LIABILITY", group: "LONG_TERM_LIABILITY", normalBalance: "CREDIT", description: "Gratuity, leave encashment provisions" },

  // ---- EQUITY -------------------------------------------------------------
  { code: "3010", name: "Owner's Capital", type: "EQUITY", group: "CAPITAL", normalBalance: "CREDIT", description: "Proprietor / partner capital" },
  { code: "3020", name: "Share Capital", type: "EQUITY", group: "CAPITAL", normalBalance: "CREDIT", description: "Paid-up equity" },
  { code: "3030", name: "Reserves & Surplus", type: "EQUITY", group: "RESERVES", normalBalance: "CREDIT", description: "General reserves, retained surplus" },
  { code: "3040", name: "Retained Earnings", type: "EQUITY", group: "RETAINED_EARNINGS", normalBalance: "CREDIT", description: "Cumulative profit ploughed back" },

  // ---- REVENUE ------------------------------------------------------------
  { code: "4010", name: "Sales — Domestic", type: "REVENUE", group: "SALES_REVENUE", normalBalance: "CREDIT", description: "Domestic product sales" },
  { code: "4020", name: "Sales — Export", type: "REVENUE", group: "SALES_REVENUE", normalBalance: "CREDIT", description: "Export product sales" },
  { code: "4030", name: "Job Work / Machining Revenue", type: "REVENUE", group: "SALES_REVENUE", normalBalance: "CREDIT", description: "Contract machining & job work" },
  { code: "4040", name: "Scrap Sales", type: "REVENUE", group: "OTHER_REVENUE", normalBalance: "CREDIT", description: "Scrap / surplus material sales" },
  { code: "4050", name: "Interest Income", type: "REVENUE", group: "OTHER_REVENUE", normalBalance: "CREDIT", description: "Bank interest, delayed-payment interest" },
  { code: "4060", name: "Other Income", type: "REVENUE", group: "OTHER_REVENUE", normalBalance: "CREDIT", description: "Miscellaneous income" },

  // ---- EXPENSES -----------------------------------------------------------
  { code: "5010", name: "Raw Material Consumed", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT", description: "Direct material cost of goods" },
  { code: "5020", name: "Direct Labour", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT", description: "Shopfloor wages & OT" },
  { code: "5030", name: "Subcontracting Charges", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT", description: "Special-process vendors" },
  { code: "5040", name: "Tooling & Consumables", type: "EXPENSE", group: "DIRECT_EXPENSE", normalBalance: "DEBIT", description: "Cutting tools, inserts, coolant" },
  { code: "5050", name: "Manufacturing Overheads", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Power, rent, indirect shopfloor costs" },
  { code: "5060", name: "Quality & Calibration Costs", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Inspection, calibration, NDT" },
  { code: "5070", name: "Scrap & Rework Loss", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Non-conformance losses" },
  { code: "5080", name: "Salaries & Wages (Staff)", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Office & staff payroll" },
  { code: "5090", name: "Rent & Utilities", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Factory & office rent, power, water" },
  { code: "5100", name: "Repairs & Maintenance", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Machine & building maintenance" },
  { code: "5110", name: "Depreciation", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Period depreciation charge" },
  { code: "5120", name: "Travel & Conveyance", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Business travel" },
  { code: "5130", name: "Marketing & Sales Expense", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Advertising, commissions, exhibitions" },
  { code: "5140", name: "Administrative Expenses", type: "EXPENSE", group: "OPERATING_EXPENSE", normalBalance: "DEBIT", description: "Office, professional fees, insurance" },
  { code: "5210", name: "Bank Charges", type: "EXPENSE", group: "FINANCE_EXPENSE", normalBalance: "DEBIT", description: "Bank & transaction charges" },
  { code: "5220", name: "Interest Expense", type: "EXPENSE", group: "FINANCE_EXPENSE", normalBalance: "DEBIT", description: "Interest on loans & OD" },
  { code: "5230", name: "Foreign Exchange Loss", type: "EXPENSE", group: "FINANCE_EXPENSE", normalBalance: "DEBIT", description: "FX realisation losses" },
  { code: "5310", name: "Tax Expenses", type: "EXPENSE", group: "TAX_EXPENSE", normalBalance: "DEBIT", description: "Income tax provision" },
];

/** YYYY-MM fiscal-period bucket for a date (invalid dates fall back to now). */
export function periodForDate(date: Date): string {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Map a ledger row (integer paise on disk) to the rupee API contract.
 * Used by glEngine and every route that reads JournalEntry/JournalLine.
 */
export function journalEntryToRupees(entry: any): any {
  return {
    ...entry,
    totalDebit: fromPaise(entry.totalDebit),
    totalCredit: fromPaise(entry.totalCredit),
    lines: Array.isArray(entry.lines)
      ? entry.lines.map((l: any) => ({
          ...l,
          debit: fromPaise(l.debit),
          credit: fromPaise(l.credit),
        }))
      : entry.lines,
  };
}
