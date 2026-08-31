"use strict";
/**
 * Onboarding and AppShell Redirect Regression Tests
 * Verifies that OWNER/ADMIN onboarding redirection honors onboardingComplete,
 * onboardingSkipped, localStorage persistence, and excluded paths without looping.
 */
const test = require("node:test");
const assert = require("node:assert");

function evaluateNeedsOnboarding({
  user,
  onboardingComplete = false,
  onboardingSkipped = false,
  localSkipped = false,
}) {
  const isPrivileged = user && (user.isOwner || (user.permissions && user.permissions.includes("system.edit")) || user.role === "ADMIN" || user.role === "OWNER");
  return !!(
    isPrivileged &&
    !onboardingComplete &&
    !onboardingSkipped &&
    !localSkipped
  );
}

function evaluateRedirectToOnboarding({
  pathname,
  needsOnboarding,
}) {
  const isExcluded =
    pathname === "/login" ||
    pathname === "/landing" ||
    pathname === "/terminal" ||
    pathname === "/" ||
    pathname?.startsWith("/track/");

  const onOnboardingPath =
    pathname === "/onboarding" || pathname?.startsWith("/onboarding/");

  return needsOnboarding && !isExcluded && !onOnboardingPath;
}

test("onboarding: OWNER needs onboarding on fresh uninitialized tenant", () => {
  const needs = evaluateNeedsOnboarding({
    user: { id: "u1", isOwner: true },
    onboardingComplete: false,
    onboardingSkipped: false,
    localSkipped: false,
  });
  assert.strictEqual(needs, true);

  const shouldRedirect = evaluateRedirectToOnboarding({
    pathname: "/ops/floor",
    needsOnboarding: needs,
  });
  assert.strictEqual(shouldRedirect, true);
});

test("onboarding: onboardingComplete=true prevents redirect", () => {
  const needs = evaluateNeedsOnboarding({
    user: { id: "u1", isOwner: true },
    onboardingComplete: true,
    onboardingSkipped: false,
    localSkipped: false,
  });
  assert.strictEqual(needs, false);

  const shouldRedirect = evaluateRedirectToOnboarding({
    pathname: "/ops/floor",
    needsOnboarding: needs,
  });
  assert.strictEqual(shouldRedirect, false);
});

test("onboarding: onboardingSkipped=true (server setting) prevents redirect", () => {
  const needs = evaluateNeedsOnboarding({
    user: { id: "u1", isOwner: true },
    onboardingComplete: false,
    onboardingSkipped: true,
    localSkipped: false,
  });
  assert.strictEqual(needs, false);

  const shouldRedirect = evaluateRedirectToOnboarding({
    pathname: "/ops/floor",
    needsOnboarding: needs,
  });
  assert.strictEqual(shouldRedirect, false);
});

test("onboarding: localSkipped=true (persisted localStorage) prevents redirect", () => {
  const needs = evaluateNeedsOnboarding({
    user: { id: "u1", isOwner: true },
    onboardingComplete: false,
    onboardingSkipped: false,
    localSkipped: true,
  });
  assert.strictEqual(needs, false);

  const shouldRedirect = evaluateRedirectToOnboarding({
    pathname: "/ops/floor",
    needsOnboarding: needs,
  });
  assert.strictEqual(shouldRedirect, false);
});

test("onboarding: non-privileged operator user never redirects to onboarding", () => {
  const needs = evaluateNeedsOnboarding({
    user: { id: "u2", isOwner: false, role: "OPERATOR", permissions: [] },
    onboardingComplete: false,
    onboardingSkipped: false,
    localSkipped: false,
  });
  assert.strictEqual(needs, false);

  const shouldRedirect = evaluateRedirectToOnboarding({
    pathname: "/ops/floor",
    needsOnboarding: needs,
  });
  assert.strictEqual(shouldRedirect, false);
});

test("onboarding: excluded paths (/login, /terminal, /landing, /, /track/*) never redirect", () => {
  const paths = ["/login", "/terminal", "/landing", "/", "/track/token-123"];
  for (const p of paths) {
    const shouldRedirect = evaluateRedirectToOnboarding({
      pathname: p,
      needsOnboarding: true,
    });
    assert.strictEqual(shouldRedirect, false, `Path ${p} must be excluded from onboarding redirect`);
  }
});
