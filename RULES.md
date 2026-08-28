# Coding Laws & Rules

1. **Serverless-Safe (No Filesystem Writes)**
   - The application is deployed on a serverless environment (Vercel). You MUST NOT use `fs.writeFileSync` or attempt to store state locally on disk. All files and state must go directly into the PostgreSQL database.

2. **Audit on Every Mutation**
   - Every significant database `CREATE`, `UPDATE`, or `DELETE` MUST be accompanied by an entry in the `AuditLog` table via `logAudit()`.

3. **AdjustmentHistory on Every Edit**
   - Editable records MUST track changes via an `adjustmentHistory` JSON column, preserving who changed what, and when.

4. **Dual-Mode Defaults**
   - Defaults must reflect a non-intrusive start: 
     - `trackingMode: BATCH` (not SERIAL by default).
     - `requireMillCerts: OFF` (unless strictly configured).

5. **Print CSS Never Breaks**
   - Pages inside `/src/app/reports` MUST be optimized for printing (`@media print`). Pagination, page-breaks, and tabular layouts must strictly render correctly on A4/Letter size without breaking rows.

6. **Typography & Styling**
   - Font: Inter.
   - Numbers: Use `tabular-nums` for all metrics, quantities, and financial figures to ensure columns align.
   - Transitions: Fixed at 150ms (`transition-all duration-150`).

7. **Hierarchical RBAC Subset Rule**
   - Permissions are strict. If an action requires `system.edit`, it cannot be bypassed. The RBAC tree is evaluated hierarchically.

8. **Build Green Before Deploy**
   - Never assume code is complete without type checking (`npx tsc --noEmit`) and verifying a clean production build (`npm run build`).

9. **Loop Mode Never Asks Questions**
   - When running in an autonomous loop or executing a predefined prompt, do NOT pause to ask questions. Make reasonable architectural choices that adhere to these rules and document them in `MEMORY.md`.
