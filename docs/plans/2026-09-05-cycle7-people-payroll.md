# Cycle 7 — People & Payroll Core Implementation Plan

> **For the executing agent:** Work on branch `v2`. TDD every task: failing test first (RED evidence) → minimal implementation (GREEN) → refactor. verification-before-completion: run the command, read the output, then claim.

**Goal (master plan C7):** Rebuild the people & payroll **state core** from DEPTH_03 F8, DEPTH_04 W10 — retiring the primary risk: **statutory correctness, session rotation, and payroll integrity**. Pure engines first, then typed adapter + `/api/v2/people/*` routes with a real-DB smoke.

**Status (2026-09-05): COMPLETE — C7-5 verification gate passed.**

**Evidence:**
- Engines TDD: `peopleEmployees` / `peopleAttendance` / `peopleLeaves` / `peoplePayroll` + `sessionRotation` (12 tests) — full suite **512 pass / 0 fail across 26 suites**; `tsc --noEmit` exit 0; `as any` scan clean over `src/lib/people`, `src/app/api/v2/people`, `src/lib/sessionRotation.ts`.
- Schema: `LeaveStatus` += `CANCELLED`; `LeaveType` += `MATERNITY|PATERNITY|COMP_OFF`; route maps API leave vocabulary → Prisma enum with a typed table (no casts).
- Payroll integrity: `PayrollRow.lopDays` computed by the engine (30 − present − late, floored at 0); payslip persists `lopDays` + `lopDeduction = gross/30 × lopDays` exactly per the schema formula (gross incl. OT).
- Adapter fixes found by the smoke: payslip FK now uses the auto-created `SalaryStructure.id` (was `employeeCode`, would FK-fail); payroll route joins attendance via `User.employeeNumber = SalaryStructure.employeeCode` (was querying cuid by employee code — always empty); attendance route resolves the active shift instead of a hardcoded `SHIFT-01` id.
- Real-DB smoke `npm run test:c7-6` (CI-wired): 14/14 green on `mfgmax_v2_test` — employee create (engine-validated, audited) + invalid-PAN rejection, badge-linked user, 28 clock logs → 26P/2L + OT stats, leave approve/cancel(CANCELLED)/reject(reason-mandatory), payroll run with LOP integrity (2 days → 2560 paise-rupee deduction on 38400 gross), idempotent re-run overwrite, audit coverage (CREATE/APPROVE/CANCEL/REJECT/RUN), session-rotation epoch/expiry/reissue round-trip with a verifiable JWT.
- Counts manifest synced: 348 API routes.

---

## 1. Existing assets to reuse/retire

| Asset | Status | Action |
|---|---|---|
| `src/lib/payrollEngine.ts` | ⚠️ v1, prisma-coupled | Retire; replace with `src/lib/people/payroll.ts` pure engine |
| `src/lib/employeeLookup.ts` | ⚠️ v1, partial | Retire; replace with `src/lib/people/employees.ts` pure engine |
| `src/app/people/**/*.tsx` | ⚠️ v1, prototype pages | Retire after parity review |
| Prisma models (`Employee`, `PayrollRun`, `AttendanceLog`, `LeaveRequest`, `SalaryStructure`) | ✅ v2 schema | Reuse as-is |

**Rule:** v1 files are NOT deleted until C7 passes its verification gate and parity review.

---

## 2. Scope

### In scope
- **Employee master:** active/inactive status, designation, department, statutory IDs (PAN, Aadhaar, PF UAN, ESI)
- **Attendance engine:** clock-in/out, present/late/absent derivation, worked hours, OT hours
- **Leave state machine:** PENDING → APPROVED | REJECTED | CANCELLED; balance check
- **Payroll engine:** monthly payroll computation from attendance + salary structure; statutory deductions (PF, ESI, PT); net pay
- **Payroll run state machine:** DRAFT → APPROVED → LOCKED; corrections audit trail
- **Session rotation:** seat session expiry, refresh token flow (W10)
- **Typed adapters + `/api/v2/people/*` routes**

### Out of scope (later cycles / tier-3)
- Recruitment pipeline & offer management
- Training & certification tracking
- Expense reimbursement workflow
- Grievance & disciplinary case management
- Appraisal cycles & 9-box grid
- Visitor management

---

## 3. Tasks

### Task C7-1: People pure engines — employee + attendance + leave (TDD)
**Files:** `src/lib/people/employees.ts`, `src/lib/people/attendance.ts`, `src/lib/people/leaves.ts`, `tests/peopleEmployees.test.ts`, `tests/peopleAttendance.test.ts`, `tests/peopleLeaves.test.ts`.

**Behavior:**
- `computeAttendance(logs, userId, month)` → presentDays, lateDays, workedHours, otHours, regularHours.
- `classifyAttendance(logs)` → present/late/absent per day.
- `transitionLeave(current, action)` → PENDING→APPROVED|REJECTED|CANCELLED; CANCELLED only from PENDING; REJECTED requires reason.
- `nextLeaveNumber(date)` → `LV-YYYY-NNN` format.
- `validateEmployee(input)` → required fields, PAN/Aadhaar format checks.

**Tests (~25):** attendance classification + hours; leave transitions + numbering; employee validation.

---

### Task C7-2: Payroll pure engine (TDD)
**Files:** `src/lib/people/payroll.ts`, `tests/peoplePayroll.test.ts`.

**Behavior:**
- `computePayrollRow(employee, attendance, salaryStructure, settings)` → regularPay, otPay, grossPay, statutoryDeductions (PF, ESI, PT), netPay.
- `computeMonthlyPayroll(employees, attendanceMap, salaryStructures, settings, year, month)` → aggregate summary with totals.
- `applyStatutoryDeductions(grossPay, settings)` → PF (employee + employer), ESI, PT based on statutory limits.

**Tests (~20):** single row computation; monthly aggregate; statutory limits; OT above threshold; WDV method not applicable (skip).

---

### Task C7-3: Typed adapters + `/api/v2/people/*` routes
**Files:**
- `src/lib/people/peopleTx.ts`
- `src/app/api/v2/people/employees/route.ts`
- `src/app/api/v2/people/attendance/route.ts`
- `src/app/api/v2/people/leaves/route.ts`
- `src/app/api/v2/people/leaves/[id]/action/route.ts`
- `src/app/api/v2/people/payroll/route.ts`
- `src/app/api/v2/people/payroll/[month]/run/route.ts`

**Pattern per route:** zod schema → `parseOr400` → authz (`people.view` / `people.edit` / `people.approve`) → adapter call → `toApiError` mapping. In-tx audit via `buildAuditEvent`. Idempotency via `runIdempotent` where clientId present.

**Permissions:**
- `people.view` — read employees, attendance, leaves, payroll runs
- `people.edit` — create/update employees, clock attendance, request leave
- `people.approve` — approve/reject leaves, approve payroll runs

---

### Task C7-4: Session rotation (W10)
**Files:** `src/lib/sessionRotation.ts`, `tests/sessionRotation.test.ts`.

**Behavior:**
- `rotateSession(user, currentSession)` → issue new session token with extended expiry; invalidate old token gracefully.
- `isSessionExpired(session)` → check expiry against rotation policy.
- `refreshSession(refreshToken)` → validate refresh token, issue new access token.

**Tests (~10):** rotation issues new token; expired session detected; refresh token validates correctly.

---

### Task C7-5: Cycle 7 verification gate
1. **TypeScript**: `tsc --noEmit` exit 0; `npm test` all green.
2. **`as any` scan**: clean across `src/lib/people`, `src/app/api/v2/people`.
3. **Real-DB smoke** on `mfgmax_v2_test`:
   - Create employee → clock attendance → compute payroll row → approve payroll run.
   - Submit leave → approve leave.
4. **CI wired**: any new smoke scripts added to `package.json` `ci` script.
5. **Boundaries**:
   - Session rotation is additive; existing auth flows unaffected.

---

## 4. Verification commands

```bash
npm test
npx tsc --noEmit
grep -rn "as any" src/lib/people src/app/api/v2/people || echo "clean"
```

---

## 5. Out of scope (later cycles / tier-3)

Recruitment, training, expenses, grievances, disciplinary, appraisals, visitor management, IRN/GSTR-1/3B exports for payroll.

---

*C7-1…C7-5 executed and verified; boundaries held — session rotation is additive (no existing auth flow changed), v1 people pages untouched pending parity review.*
