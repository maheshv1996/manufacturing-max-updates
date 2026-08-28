# Finance & Accounts — Full Department Walkthrough

How the Manufacturing MAX app implements the Finance & Accounts function (dept #8 of the org tree), page by page, workflow by workflow, with honest gap notes.

---

## 1. Quotations & Estimation
**Where:** `/commercial/quotations`
**What's live:**
- Create quotations for customers with line items, quantities, and pricing.
- Quotation lifecycle tracked to conversion (won/lost statuses), feeding the sales pipeline.
- CRM fundamentals are shared with the Commercial desk (customers, contacts).

**Workflow:** Customer enquiry → quotation → approval → won quote → sales order → work order (production).

## 2. Order Booking & Invoicing (Accounts Receivable)
**Where:** `/commercial/desk` (Sales Hub), `/reports/receivables`
**What's live:**
- Sales invoices with statuses `UNPAID / PARTIAL / PAID`.
- Payments recorded against invoices; partial payments supported (`paidAmount`).
- **Receivables aging** computed live: 0–30 / 31–60 / 61–90 / 90+ buckets, total outstanding surfaced on `/command`.
- GST invoice register: `/reports/sales-register` with CGST / SGST / IGST breakdown per invoice.

**Workflow:** Dispatch goods → raise GST invoice → track payment → apply receipt → aging updates automatically on the dashboard.

## 3. Accounts Payable (Suppliers)
**Where:** `/commercial/desk`, `/reports/po-register`, `/supply/vault`
**What's live:**
- Suppliers + purchase orders with `RECEIVED` status driving payable recognition.
- Supplier payments recorded (`RecordSupplierPaymentModal`); balance = purchases − payments.
- Payables summary on `/command` (total outstanding).
- PO register report covers open/closed POs, commitments, delivery dates.

**Workflow:** PO raised → goods received (IN transaction, mill-cert attached) → payment recorded → balance tracked.

## 4. Cost Accounting (Job Costing)
**Where:** `/reports/profitability`, engine: `src/lib/costingEngine.ts`
**What's live:**
- Every work order is costed from labor (operator hours × rate), machine time (machine hours × rate), and material consumed.
- Revenue per WO from price/qty; **net profit and margin % per job**.
- Profitability report flags loss-making orders; monthly financial summary (revenue / cost / profit / margin) is computed on `/command`.
- Settings drive rates: `laborRatePerHour`, `machineRatePerHour` (defaults ₹150 / ₹300).

**Workflow:** Rates configured in settings → logs accumulate hours → costing engine rolls up per WO → month-end P&L view on the dashboard.

## 5. Payroll
**Where:** `/reports/payroll`
**What's live:**
- Monthly operator payroll calculation: present days, late days, regular pay, **OT pay** (daily threshold + multiplier + statutory 50h limit flag), gross pay.
- Printable payroll register + **Excel/Tally-compatible CSV export**.
- Attendance source data: `/people/attendance`, shift logs, grace minutes.

**Gap:** Payroll covers operators/attendance-driven pay; no full salary-structure engine (CTC breakup, TDS/PT deductions) yet — that's a candidate next module.

## 6. Taxation (GST) & Statutory Filings
**Where:** `/reports/sales-register`, `/people/statutory`, `/reports/pf-esi-challan`
**What's live:**
- **GST:** taxable sales ledger with CGST/SGST/IGST per invoice + grand totals (GSTR-1 input data).
- **PF/ESI:** monthly statutory contribution register per employee (12% PF employee/employer, 0.75%/3.25% ESI) with totals.
- **Challan:** `/reports/pf-esi-challan` — aggregated monthly payment challan with amount-in-words (Indian numbering), signature blocks, and employee annexure; month picker included.
- Company GSTIN from branding settings appears on challan/reports.

**Workflow:** Invoices raise GST liability → sales register aggregates → PF/ESI register built monthly → challan generated for bank payment.

## 7. Budgeting, Treasury & Audit
**Where:** `/commercial/treasury` (two tabs: Budget Lines + Treasury ledger), `/system/admin` → Audit tab
**What's live:**
- **Budget lines** per fiscal year / department / category with allocated vs spent.
- **Treasury ledger** — cash inflows/outflows by account (Main, Payroll, etc.) with references.
- **Audit trail** — every DB mutation across the app writes an `AuditLog`; browsable/filterable in Admin → Audit tab (API: `/api/audit`).

**Gap:** Treasury is a register, not yet a bank-reconciliation workflow (statement import / matching) — `/supply/reconcile` covers inventory reconciliation only.

---

## Cross-cutting
- **Executive visibility:** `/command` shows monthly revenue/cost/profit/margin, receivables aging, payables, and compliance red-flags (which include budget/contract signals).
- **Reports hub (`/reports`)** hosts the printable finance suite: Payroll, Sales/GST Register, PO Register, Receivables, Inventory Valuation, Job Profitability, Statutory Register, PF/ESI Challan.
- **Permissions:** `commercial.edit` / `people.edit` / `system.edit` gate finance actions; owners bypass.

## Gap summary for Finance
| Gap | Notes |
|---|---|
| Salary structure engine | CTC breakup, TDS, PT, net-pay slips |
| Bank reconciliation | Statement upload + matching vs treasury |
| Budget vs actual variance alerts | Tie budget lines to actuals and flag overruns on `/command` |
| Challan → treasury auto-posting | Generated challan should create an OUTFLOW transaction automatically |
| Audit export | CSV export of audit log for compliance filings |
