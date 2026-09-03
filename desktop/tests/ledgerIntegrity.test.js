const test = require("node:test");
const assert = require("node:assert");
const {
  runLedgerIntegrityCheck,
  scheduleLedgerIntegrity,
} = require("../lib/ledgerIntegrity");

test("runLedgerIntegrityCheck POSTs the control token and parses issues", async () => {
  let seenUrl = null;
  let seenAuth = null;
  const origFetch = global.fetch;
  global.fetch = async (url, opts) => {
    seenUrl = url;
    seenAuth = opts.headers.Authorization;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        unbalancedCount: 2,
        unpostedTotal: 3,
        checkedAt: "2026-09-04T02:30:00.000Z",
        run: { id: "run-1" },
      }),
    };
  };
  try {
    const res = await runLedgerIntegrityCheck({
      baseUrl: "http://127.0.0.1:3000/",
      token: "tok-abc",
    });
    assert.equal(seenUrl, "http://127.0.0.1:3000/api/finance/gl-integrity");
    assert.equal(seenAuth, "Bearer tok-abc");
    assert.equal(res.ok, true);
    assert.equal(res.unbalanced, 2);
    assert.equal(res.unposted, 3);
    assert.equal(res.runId, "run-1");
  } finally {
    global.fetch = origFetch;
  }
});

test("runLedgerIntegrityCheck surfaces HTTP and network failures", async () => {
  const origFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ error: "Forbidden" }),
  });
  try {
    const res = await runLedgerIntegrityCheck({ baseUrl: "http://x", token: "t" });
    assert.equal(res.ok, false);
    assert.equal(res.status, 403);
    assert.equal(res.error, "Forbidden");
  } finally {
    global.fetch = origFetch;
  }
  global.fetch = async () => {
    throw new Error("ECONNREFUSED");
  };
  try {
    const res = await runLedgerIntegrityCheck({ baseUrl: "http://x", token: "t" });
    assert.equal(res.ok, false);
    assert.match(res.error, /ECONNREFUSED/);
  } finally {
    global.fetch = origFetch;
  }
});

test("scheduleLedgerIntegrity arms a daily sweep that only fires once per day", async () => {
  const fired = [];
  const logs = [];
  const sweep = scheduleLedgerIntegrity({
    baseUrl: "http://127.0.0.1:3000",
    token: "tok",
    hour: 2,
    minute: 30,
    log: (m) => logs.push(m),
    isServerRunning: () => true,
  });
  assert.ok(sweep.timer, "timer armed");
  assert.ok(logs.some((l) => l.includes("scheduled for 02:30")));

  // Stub Date so the tick thinks it is 02:30; each call must fire at most once/day.
  const RealDate = Date;
  const fake = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [new RealDate("2026-09-04T02:30:00.000Z")]));
    }
    getHours() {
      return 2;
    }
    getMinutes() {
      return 30;
    }
  };
  const origFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => ({ success: true, unbalancedCount: 0, unpostedTotal: 0, checkedAt: "x" }) };
  };
  global.Date = fake;
  try {
    await sweep._tick();
    await sweep._tick();
    await sweep._tick();
    assert.equal(calls, 1, "only the first tick in a day may call the API");
    assert.ok(logs.some((l) => l.includes("daily sweep clean")));
  } finally {
    global.Date = RealDate;
    global.fetch = origFetch;
    sweep.stop();
  }
});

test("scheduleLedgerIntegrity skips when the server is not running", async () => {
  const logs = [];
  const sweep = scheduleLedgerIntegrity({
    baseUrl: "http://127.0.0.1:3000",
    token: "tok",
    hour: 2,
    minute: 30,
    log: (m) => logs.push(m),
    isServerRunning: () => false,
  });
  const origFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: true, status: 200, json: async () => ({}) };
  };
  try {
    await sweep._tick();
    assert.equal(calls, 0, "sweep must not fire while the server is down");
  } finally {
    global.fetch = origFetch;
    sweep.stop();
  }
});
