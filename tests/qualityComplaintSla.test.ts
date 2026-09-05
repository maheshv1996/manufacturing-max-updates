import { test } from "node:test";
import assert from "node:assert/strict";
import { slaStatus, ACK_WINDOW_MS, EIGHT_D_WINDOW_MS } from "../src/lib/quality/complaintSla";

const created = new Date("2026-09-01T08:00:00.000Z");

test("a fresh complaint is PENDING on both clocks", () => {
  const s = slaStatus(created, null, new Date("2026-09-01T09:00:00.000Z"));
  assert.equal(s.ack, "PENDING");
  assert.equal(s.eightD, "PENDING");
});

test("acknowledging within 24h is OK", () => {
  const s = slaStatus(created, new Date("2026-09-01T20:00:00.000Z"), new Date("2026-09-01T20:01:00.000Z"));
  assert.equal(s.ack, "OK");
  assert.equal(s.eightD, "PENDING");
});

test("acknowledging after 24h is OVERDUE", () => {
  const late = new Date(created.getTime() + ACK_WINDOW_MS + 60_000);
  const s = slaStatus(created, late, late);
  assert.equal(s.ack, "OVERDUE");
});

test("no ack past the 24h window is OVERDUE", () => {
  const s = slaStatus(created, null, new Date(created.getTime() + ACK_WINDOW_MS + 1_000));
  assert.equal(s.ack, "OVERDUE");
});

test("the 8D clock runs from receipt: past 10 days is OVERDUE even with an OK ack", () => {
  const now = new Date(created.getTime() + EIGHT_D_WINDOW_MS + 60_000);
  const s = slaStatus(created, new Date(created.getTime() + 2 * 3600_000), now);
  assert.equal(s.ack, "OK");
  assert.equal(s.eightD, "OVERDUE");
});

test("deadlines are exposed and exactly 24h / 10d from receipt", () => {
  const s = slaStatus(created, null, created);
  assert.equal(s.ackDeadline.getTime() - created.getTime(), ACK_WINDOW_MS);
  assert.equal(s.eightDDeadline.getTime() - created.getTime(), EIGHT_D_WINDOW_MS);
});