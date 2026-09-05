/**
 * C1-8 — Typed auth core. Thin, typed surface over the existing (already
 * hardened) primitives in src/lib/auth.ts — password hashing via node-scrypt
 * (salt:derivedKey, timing-safe) and JWT sessions via jose with the
 * sessionEpoch rotation re-checked by the proxy per request. No duplication;
 * this module exists to give call sites typed, narrow entry points.
 */
import {
  hashPasswordAsync,
  verifyPasswordAsync,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "../auth";

export type { SessionPayload };

export const hashPassword = hashPasswordAsync;
export const verifyPassword = verifyPasswordAsync;
export { signSessionToken, verifySessionToken };

/** Bump a user's sessionEpoch — invalidates every issued session token. */
export function rotateEpoch(current: number): number {
  return current + 1;
}

export interface SessionClaimsInput {
  id: string;
  username: string;
  name?: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  isOwner: boolean;
  level: string;
  mustChangePassword: boolean;
  sess: number;
}

/** Map an auth result into the exact SessionPayload the proxy verifies. */
export function buildSessionClaims(input: SessionClaimsInput): SessionPayload {
  return {
    id: input.id,
    username: input.username,
    name: input.name,
    roleId: input.roleId,
    roleName: input.roleName,
    permissions: [...input.permissions],
    isOwner: input.isOwner,
    level: input.level,
    mustChangePassword: input.mustChangePassword,
    sess: input.sess,
  };
}
