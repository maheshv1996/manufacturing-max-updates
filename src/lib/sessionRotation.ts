/**
 * C7-4 — Session rotation (W10).
 *
 * Built on the real mechanism: `app_session` is a JWT carrying a `sess`
 * (sessionEpoch) claim; the proxy re-checks the DB epoch on every request,
 * so bumping `sessionEpoch` already kills every live token. This engine adds
 * the missing piece — a typed decision layer for *healthy* sessions:
 *   • isSessionExpired — policy expiry (SESSION_EXPIRATION is 30d today; policy
 *     maxAgeHours is the shorter bound)
 *   • needsRotation — epoch mismatch ⇒ token is dead (re-login), never "refresh"
 *   • rotateSession / refreshSession — reissue a fresh token for a *current*
 *     session only; stale/policy-expired sessions are refused
 *
 * Additive by design: no existing auth flow changes; opt-in per call site.
 * Pure until refreshSession, which signs via the existing jose signer.
 */

import { ok, err, type Result } from "./core/result";
import { signSessionToken, type SessionPayload } from "./auth";

export interface RotationPolicy {
  /** Max age of a session before it must be re-established by login. */
  maxAgeHours: number;
}

/** SessionPayload claims + the issue timestamp needed for age checks. */
export interface RotationSession extends SessionPayload {
  issuedAt: Date;
}

const HOUR_MS = 3_600_000;

/** Policy expiry: a session older than maxAgeHours must re-login (>= boundary expires). */
export function isSessionExpired(s: RotationSession, policy: RotationPolicy, now: Date = new Date()): boolean {
  return now.getTime() - s.issuedAt.getTime() >= policy.maxAgeHours * HOUR_MS;
}

/**
 * Epoch staleness: token `sess` vs the user's current DB epoch.
 * Any mismatch — token behind (role/password/active changed) or ahead
 * (rolled-back DB) — means the token is not current and must not be refreshed.
 */
export function needsRotation(tokenSess: number, dbEpoch: number): boolean {
  return tokenSess !== dbEpoch;
}

export type RotateError = "EPOCH_STALE" | "SESSION_EXPIRED";

/**
 * Decide + reissue for a session candidate. Refuses stale epochs
 * (re-login required) and policy-expired sessions; a current session gets
 * the same claims back with a fresh expiry window.
 */
export function rotateSession(
  candidate: RotationSession,
  dbEpoch: number,
  policy: RotationPolicy,
  now: Date = new Date(),
): Result<{ action: "REISSUE"; payload: SessionPayload; tokenExpiresAt: Date }, RotateError> {
  if (needsRotation(candidate.sess, dbEpoch)) return err("EPOCH_STALE");
  if (isSessionExpired(candidate, policy, now)) return err("SESSION_EXPIRED");

  return ok({
    action: "REISSUE",
    payload: {
      id: candidate.id,
      username: candidate.username,
      name: candidate.name,
      roleId: candidate.roleId,
      roleName: candidate.roleName,
      permissions: [...candidate.permissions],
      isOwner: candidate.isOwner,
      level: candidate.level,
      mustChangePassword: candidate.mustChangePassword,
      sess: candidate.sess,
    },
    tokenExpiresAt: new Date(now.getTime() + policy.maxAgeHours * HOUR_MS),
  });
}

/** rotateSession + sign a fresh `app_session` JWT with the same claims. */
export async function refreshSession(
  candidate: RotationSession,
  dbEpoch: number,
  policy: RotationPolicy,
  now: Date = new Date(),
): Promise<Result<{ token: string; payload: SessionPayload; tokenExpiresAt: Date }, RotateError>> {
  const decision = rotateSession(candidate, dbEpoch, policy, now);
  if (decision.tag === "err") return decision;
  const token = await signSessionToken(decision.value.payload);
  return ok({ token, payload: decision.value.payload, tokenExpiresAt: decision.value.tokenExpiresAt });
}
