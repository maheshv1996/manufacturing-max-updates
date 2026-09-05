/**
 * C2-2 — Pure production/downtime event ledger (DEPTH_04 W2, F2; v1 parity).
 * A DB-free reducer over a machine+WO run: events mutate an explicit run state
 * and return an exact, append-only list of row intents (`writes`) that the DB
 * adapter (C2-6) maps to transactions. The ledger never deletes (G-7 no-delete
 * is structural) and never touches Prisma.
 *
 * v1 parity mapping: START_JOB opens a ProductionLog + machine RUNNING;
 * LOG_GOOD/LOG_SCRAP/REWORK increment counters; REPORT_DOWNTIME/END_DOWNTIME
 * open/close a downtime; SETUP/RUN/CHANGEOVER move the machine state;
 * COMPLETE_JOB closes the run (machine IDLE). Re-spec deltas: a closed run
 * rejects further counters (v1 did not guard this), and every event carries an
 * explicit `at` timestamp (actor/time audit requirement).
 */
export type LedgerMachineState = "RUNNING" | "IDLE" | "SETUP" | "FAULT" | "OFF";

export type CounterField = "good" | "scrap" | "rework";

export type LedgerEvent =
  | { kind: "GOOD"; qty: number; at: string }
  | { kind: "SCRAP"; qty: number; defectCode: string; at: string }
  | { kind: "REWORK"; qty: number; at: string }
  | { kind: "DOWNTIME_START"; reasonCode: string; notes?: string; at: string }
  | { kind: "DOWNTIME_END"; at: string }
  | { kind: "SETUP"; at: string }
  | { kind: "RUN"; at: string }
  | { kind: "CHANGEOVER"; at: string }
  | { kind: "START_JOB"; at: string }
  | { kind: "COMPLETE_JOB"; at: string };

export interface OpenLogState {
  good: number;
  scrap: number;
  rework: number;
  startedAt: string;
  endedAt: string | null;
}

export interface OpenDowntimeState {
  reasonCode: string;
  startedAt: string;
  notes?: string;
}

export interface RunState {
  workOrderId: string;
  machineId: string;
  openLog: OpenLogState | null;
  openDowntime: OpenDowntimeState | null;
  machineState: LedgerMachineState;
  /** Cumulative counters across all logs of this run (drives COMPLETE qty). */
  goodTotal: number;
  scrapTotal: number;
  reworkTotal: number;
}

export type LedgerWrite =
  | { op: "LOG_CREATE"; startedAt: string }
  | { op: "COUNTER_DELTA"; field: CounterField; delta: number; defectCode?: string; at: string }
  | { op: "DOWNTIME_CREATE"; reasonCode: string; startedAt: string; notes?: string }
  | { op: "DOWNTIME_CLOSE"; reasonCode: string; startedAt: string; endedAt: string; durationMinutes: number }
  | { op: "MACHINE_STATE"; state: LedgerMachineState; at: string }
  | { op: "LOG_CLOSE"; endedAt: string };

export type LedgerErrorCode = "NO_OPEN_LOG" | "INVALID_QTY" | "DOWNTIME_ALREADY_OPEN" | "NO_OPEN_DOWNTIME" | "ALREADY_RUNNING";

export type LedgerResult =
  | { ok: true; state: RunState; writes: LedgerWrite[] }
  | { ok: false; code: LedgerErrorCode; message: string };

export function emptyRunState(opts: { workOrderId: string; machineId: string }): RunState {
  return {
    workOrderId: opts.workOrderId,
    machineId: opts.machineId,
    openLog: null,
    openDowntime: null,
    machineState: "IDLE",
    goodTotal: 0,
    scrapTotal: 0,
    reworkTotal: 0,
  };
}

function err(code: LedgerErrorCode, message: string): LedgerResult {
  return { ok: false, code, message };
}

function okWith(state: RunState, writes: LedgerWrite[]): LedgerResult {
  return { ok: true, state, writes };
}

function validQty(qty: number): boolean {
  return Number.isInteger(qty) && qty > 0;
}

export function applyLedgerEvent(state: RunState, ev: LedgerEvent): LedgerResult {
  switch (ev.kind) {
    case "START_JOB": {
      if (state.openLog) return err("ALREADY_RUNNING", "A job is already running on this machine");
      const next: RunState = {
        ...state,
        openLog: { good: 0, scrap: 0, rework: 0, startedAt: ev.at, endedAt: null },
        machineState: "RUNNING",
      };
      return okWith(next, [
        { op: "LOG_CREATE", startedAt: ev.at },
        { op: "MACHINE_STATE", state: "RUNNING", at: ev.at },
      ]);
    }

    case "GOOD":
    case "SCRAP":
    case "REWORK": {
      if (!state.openLog || state.openLog.endedAt) return err("NO_OPEN_LOG", "No open production log on this machine");
      if (!validQty(ev.qty)) return err("INVALID_QTY", `Quantity must be a positive integer, got ${ev.qty}`);
      const field: CounterField = ev.kind === "GOOD" ? "good" : ev.kind === "SCRAP" ? "scrap" : "rework";
      const delta = ev.qty;
      const next: RunState = {
        ...state,
        openLog: { ...state.openLog, [field]: state.openLog[field] + delta },
        goodTotal: state.goodTotal + (field === "good" ? delta : 0),
        scrapTotal: state.scrapTotal + (field === "scrap" ? delta : 0),
        reworkTotal: state.reworkTotal + (field === "rework" ? delta : 0),
      };
      const write: LedgerWrite = {
        op: "COUNTER_DELTA",
        field,
        delta,
        at: ev.at,
        ...(ev.kind === "SCRAP" ? { defectCode: ev.defectCode } : {}),
      };
      return okWith(next, [write]);
    }

    case "DOWNTIME_START": {
      if (state.openDowntime) return err("DOWNTIME_ALREADY_OPEN", "A downtime is already open on this machine");
      const next: RunState = {
        ...state,
        openDowntime: { reasonCode: ev.reasonCode, startedAt: ev.at, notes: ev.notes },
      };
      return okWith(next, [{ op: "DOWNTIME_CREATE", reasonCode: ev.reasonCode, startedAt: ev.at, notes: ev.notes }]);
    }

    case "DOWNTIME_END": {
      if (!state.openDowntime) return err("NO_OPEN_DOWNTIME", "No open downtime to end");
      const durationMinutes = Math.max(
        0,
        Math.round((new Date(ev.at).getTime() - new Date(state.openDowntime.startedAt).getTime()) / 60000),
      );
      const next: RunState = { ...state, openDowntime: null };
      return okWith(next, [
        {
          op: "DOWNTIME_CLOSE",
          reasonCode: state.openDowntime.reasonCode,
          startedAt: state.openDowntime.startedAt,
          endedAt: ev.at,
          durationMinutes,
        },
      ]);
    }

    case "SETUP":
    case "RUN":
    case "CHANGEOVER": {
      const machineState: LedgerMachineState = ev.kind === "SETUP" || ev.kind === "CHANGEOVER" ? "SETUP" : "RUNNING";
      const next: RunState = { ...state, machineState };
      return okWith(next, [{ op: "MACHINE_STATE", state: machineState, at: ev.at }]);
    }

    case "COMPLETE_JOB": {
      if (!state.openLog || state.openLog.endedAt) return err("NO_OPEN_LOG", "No open production log to complete");
      // Close the run: drop the open log (totals persist) so the same machine
      // can start the next WO. Counters against a closed run are rejected.
      const next: RunState = {
        ...state,
        openLog: null,
        machineState: "IDLE",
      };
      return okWith(next, [
        { op: "LOG_CLOSE", endedAt: ev.at },
        { op: "MACHINE_STATE", state: "IDLE", at: ev.at },
      ]);
    }
  }
}
