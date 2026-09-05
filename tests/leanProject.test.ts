import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advancePhase,
  completeProject,
  completionEvidence,
  markItemDone,
  setStatus,
  validateActionItem,
  validateProjectDraft,
  type ActionItemInput,
  type ProjectInput,
} from "../src/lib/lean/projects";

const NOW = new Date("2026-09-05T06:00:00Z");

const project = (over: Partial<ProjectInput> = {}): ProjectInput => ({
  id: "p1",
  title: "Cut setup scrap",
  type: "DMAIC",
  phase: "DEFINE",
  status: "OPEN",
  ownerName: "Meera",
  completedAt: null,
  ...over,
});

const item = (over: Partial<ActionItemInput> = {}): ActionItemInput => ({
  id: "a1",
  description: "Fix locating pin",
  ownerName: "Arun",
  dueDate: new Date("2026-10-01T00:00:00Z"),
  status: "OPEN",
  ...over,
});

test("draft validation: title + owner mandatory, type constrained", () => {
  assert.equal(validateProjectDraft({ title: " ", ownerName: "M", type: "KAIZEN" }).tag, "err");
  assert.equal(validateProjectDraft({ title: "T", ownerName: "", type: "KAIZEN" }).tag, "err");
  const r = validateProjectDraft({ title: "Reduce changeover", ownerName: "Meera", type: "DMAIC" });
  assert.equal(r.tag, "ok");
  if (r.tag === "ok") {
    assert.equal(r.value.phase, "DEFINE");
    assert.equal(r.value.status, "OPEN");
  }
});

test("phases advance strictly sequentially and force OPEN → IN_PROGRESS", () => {
  const p1 = advancePhase(project());
  assert.equal(p1.tag, "ok");
  if (p1.tag === "ok") {
    assert.equal(p1.value.phase, "MEASURE");
    assert.equal(p1.value.status, "IN_PROGRESS");
  }
  const walk = ["ANALYZE", "IMPROVE", "CONTROL"] as const;
  let cur = p1.tag === "ok" ? p1.value : project();
  for (const expected of walk) {
    const r = advancePhase(cur);
    assert.equal(r.tag, "ok");
    if (r.tag === "ok") {
      assert.equal(r.value.phase, expected, "landing phase matches the walk");
      cur = r.value;
    }
  }
  assert.equal(cur.phase, "CONTROL");
  const pastControl = advancePhase(cur);
  assert.equal(pastControl.tag, "err");
  const onHold = advancePhase(project({ status: "ON_HOLD" }));
  assert.equal(onHold.tag, "err");
  const completed = advancePhase(project({ status: "COMPLETED" }));
  assert.equal(completed.tag, "err");
});

test("status moves: OPEN→IN_PROGRESS→ON_HOLD→IN_PROGRESS; COMPLETED only via completeProject", () => {
  assert.equal(setStatus(project(), "IN_PROGRESS").tag, "ok");
  const hold = setStatus(project({ status: "IN_PROGRESS" }), "ON_HOLD");
  assert.equal(hold.tag, "ok");
  const resume = setStatus(project({ status: "ON_HOLD" }), "IN_PROGRESS");
  assert.equal(resume.tag, "ok");
  assert.equal(setStatus(project(), "COMPLETED").tag, "err");
});

test("F11 completion evidence: RCA rootCause AND all action items DONE", () => {
  assert.deepEqual(completionEvidence(project(), { rootCause: null }, []), {
    ok: false,
    missing: ["RCA_ROOT_CAUSE"],
  });
  assert.deepEqual(completionEvidence(project(), { rootCause: "x" }, [item()]), {
    ok: false,
    missing: ["ACTION_ITEMS_OPEN"],
  });
  assert.deepEqual(
    completionEvidence(project({ status: "IN_PROGRESS" }), { rootCause: "root" }, [item({ status: "DONE" })]),
    { ok: true, missing: [] },
  );
  const done = completeProject(project({ status: "IN_PROGRESS" }), { rootCause: "root" }, [item({ status: "DONE" })], "owner1", NOW);
  assert.equal(done.tag, "ok");
  if (done.tag === "ok") {
    assert.equal(done.value.status, "COMPLETED");
    assert.equal(done.value.completedAt, NOW);
  }
  const noEvidence = completeProject(project(), { rootCause: null }, [item()], "owner1", NOW);
  assert.equal(noEvidence.tag, "err");
});

test("action items: validate and mark DONE once", () => {
  assert.equal(validateActionItem({ description: " ", ownerName: "A", dueDate: new Date() }).tag, "err");
  assert.equal(validateActionItem({ description: "d", ownerName: "", dueDate: new Date() }).tag, "err");
  assert.equal(validateActionItem({ description: "d", ownerName: "A", dueDate: null as never }).tag, "err");
  assert.equal(validateActionItem({ description: "d", ownerName: "A", dueDate: new Date("2026-10-01") }).tag, "ok");
  const done = markItemDone(item());
  assert.equal(done.tag, "ok");
  if (done.tag === "ok") assert.equal(done.value.status, "DONE");
  assert.equal(markItemDone(item({ status: "DONE" })).tag, "err");
});
