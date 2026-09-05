"use strict";
/**
 * WATCHDOG (Phase 1)
 * ------------------
 * Supervises a child process (the standalone Next server, or Postgres).
 * If the child dies:
 *   - restart within restartDelayMs (default 5s per spec)
 *   - max 3 consecutive tries, then flip to CRASHED and notify
 * A successful health check or a process living > stabilizeMs resets the
 * try counter, so a crash after a healthy run starts a fresh budget.
 *
 * Pure Node — no dependencies.
 */
const { spawn } = require("child_process");

class Watchdog {
  constructor({
    name = "process",
    command,
    args = /** @type {string[]} */ ([]),
    cwd = process.cwd(),
    env = {},
    restartDelayMs = 5000,
    maxTries = 3,
    stabilizeMs = 30_000,
    log = console.log,
    onCrash = () => {},
  }) {
    this.name = name;
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.restartDelayMs = restartDelayMs;
    this.maxTries = maxTries;
    this.stabilizeMs = stabilizeMs;
    this.log = log;
    this.onCrash = onCrash;

    this.child = null;
    this.tries = 0;
    this.stopped = false;
    this.startedAt = 0;
    this.restartTimer = null;
  }

  start() {
    this.stopped = false;
    this.spawnChild();
    return this;
  }

  stop() {
    this.stopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    if (this.child && !this.child.killed) {
      try {
        this.child.kill();
      } catch {}
    }
    this.child = null;
  }

  get alive() {
    return Boolean(this.child && !this.child.killed && this.child.exitCode === null);
  }

  spawnChild() {
    if (this.stopped) return;
    this.startedAt = Date.now();
    this.log(`[watchdog:${this.name}] starting ${this.command} ${this.args.join(" ")}`);
    try {
      this.child = spawn(this.command, this.args, {
        cwd: this.cwd,
        env: { ...process.env, ...this.env },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (err) {
      this.log(`[watchdog:${this.name}] spawn failed: ${err.message}`);
      this.handleDeath(err);
      return;
    }

    this.child.stdout?.on("data", (d) => this.log(`[${this.name}] ${String(d).trimEnd()}`));
    this.child.stderr?.on("data", (d) => this.log(`[${this.name}:err] ${String(d).trimEnd()}`));

    let deathHandled = false;
    const onDead = (info) => {
      if (deathHandled) return;
      deathHandled = true;
      this.handleDeath(info);
    };

    this.child.on("exit", (code, signal) => {
      this.log(`[watchdog:${this.name}] exited (code=${code} signal=${signal})`);
      onDead({ code, signal });
    });
    this.child.on("error", (err) => {
      this.log(`[watchdog:${this.name}] error: ${err.message}`);
      onDead(err);
    });
  }

  handleDeath(_info) {
    this.child = null;
    if (this.stopped) return;

    // A run that survived stabilizeMs means the process is healthy —
    // reset the failure budget so intermittent crashes don't accumulate.
    if (Date.now() - this.startedAt >= this.stabilizeMs) {
      this.tries = 0;
    }

    this.tries += 1;
    if (this.tries > this.maxTries) {
      this.log(`[watchdog:${this.name}] CRASHED after ${this.maxTries} restart tries — alerting.`);
      this.onCrash({ name: this.name, tries: this.tries });
      return;
    }

    this.log(`[watchdog:${this.name}] restarting in ${this.restartDelayMs}ms (try ${this.tries}/${this.maxTries})`);
    this.restartTimer = setTimeout(() => this.spawnChild(), this.restartDelayMs);
  }
}

module.exports = { Watchdog };
