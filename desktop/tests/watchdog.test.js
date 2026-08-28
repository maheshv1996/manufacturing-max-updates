"use strict";
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { Watchdog } = require("../lib/watchdog");

function helperScript(script) {
  return path.join(__dirname, "helpers", script);
}

test("watchdog restarts a dying process up to maxTries then crashes", async () => {
  const crashes = [];
  const events = [];
  const wd = new Watchdog({
    name: "test",
    command: process.execPath,
    args: [helperScript("exit-immediately.js")],
    restartDelayMs: 50,
    maxTries: 3,
    stabilizeMs: 5_000_000, // never stabilize so tries accumulate
    log: () => {},
    onCrash: (info) => crashes.push(info),
  });

  // Track spawns by monkey-patching spawnChild
  const orig = wd.spawnChild.bind(wd);
  wd.spawnChild = () => {
    events.push("spawn");
    orig();
  };

  wd.start();
  // Generous window: under whole-suite load (parallel test processes) a node
  // child spawn can take >150ms, so the tight 600ms left < 4 spawns and flaked
  // the assertion below. 1500ms is comfortably enough even when the event loop
  // is busy (crash fires at maxTries; extra time just means earlier spawns).
  await new Promise((r) => setTimeout(r, 1500));
  wd.stop();

  assert.strictEqual(crashes.length, 1, "onCrash should fire once");
  assert.ok(events.length >= 4, `expected >= 4 spawn attempts, got ${events.length}`);
});

test("watchdog resets the try budget after a stable run", async () => {
  const crashes = [];
  const wd = new Watchdog({
    name: "test",
    command: process.execPath,
    args: [helperScript("exit-after-100ms.js")],
    restartDelayMs: 50,
    maxTries: 2,
    stabilizeMs: 50, // 100ms run > 50ms stabilize => resets budget each time
    log: () => {},
    onCrash: (info) => crashes.push(info),
  });
  wd.start();
  await new Promise((r) => setTimeout(r, 1000));
  wd.stop();
  // A stable run resets tries each time, so it keeps restarting forever.
  assert.strictEqual(crashes.length, 0);
});

test("watchdog stops cleanly and does not restart after stop()", async () => {
  let spawnCount = 0;
  const wd = new Watchdog({
    name: "test",
    command: process.execPath,
    args: [helperScript("exit-immediately.js")],
    restartDelayMs: 30,
    maxTries: 5,
    log: () => {},
  });
  const orig = wd.spawnChild.bind(wd);
  wd.spawnChild = () => {
    spawnCount++;
    orig();
  };
  wd.start();
  // Generous window: the staged (obfuscated) test run is slower than the source
  // run, so a tight 120ms can elapse with only the initial spawn and fail the
  // "it did restart" assertion below. 800ms comfortably allows >= 2 spawns even
  // when the event loop is busy under staging/parallel load.
  await new Promise((r) => setTimeout(r, 800));
  wd.stop();
  const afterStop = spawnCount;
  await new Promise((r) => setTimeout(r, 200));
  assert.strictEqual(spawnCount, afterStop, "no restarts after stop");
  assert.ok(afterStop >= 2, "it did restart while running");
});
