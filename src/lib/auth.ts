import { SignJWT, jwtVerify } from "jose";
import { scrypt, scryptSync, randomBytes, timingSafeEqual } from "crypto";
import util from "util";

const scryptAsync = util.promisify(scrypt);

/**
 * Resolves the JWT secret key.
 * In production, strictly requires the SESSION_SECRET environment variable.
 */
export const getSecretKey = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET environment variable must be configured in production.",
      );
    }
    return new TextEncoder().encode(
      "mfg-enterprise-dev-local-secret-32-chars-long-min-for-security",
    );
  }
  if (secret.length < 32 && process.env.NODE_ENV === "production") {
    throw new Error(
      "CRITICAL SECURITY CONFIGURATION ERROR: SESSION_SECRET must be at least 32 characters long in production.",
    );
  }
  return new TextEncoder().encode(secret);
};

export interface SessionPayload {
  id: string;
  username: string;
  /** display name (user.name) — badge culture greets with the real name */
  name?: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  isOwner: boolean;
  /** WORKER | MANAGER — department heads; approve/override actions require MANAGER */
  level: string;
  mustChangePassword: boolean;
  /** user.sessionEpoch at issue time — proxy re-checks against the DB to rotate sessions on role/permission change */
  sess: number;
}

/**
 * Signs a secure JWT session token with configurable expiration.
 * Defaults to 30 days unless overridden via SESSION_EXPIRATION env var.
 */
export async function signSessionToken(
  payload: SessionPayload,
  expiresIn?: string,
): Promise<string> {
  const expiry = expiresIn || process.env.SESSION_EXPIRATION || "30d";
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.id === "string" &&
      typeof payload.username === "string" &&
      typeof payload.mustChangePassword === "boolean" &&
      typeof payload.roleId === "string" &&
      typeof payload.roleName === "string" &&
      Array.isArray(payload.permissions) &&
      typeof payload.isOwner === "boolean"
    ) {
      return {
        id: payload.id,
        username: payload.username,
        name: typeof payload.name === "string" ? payload.name : undefined,
        roleId: payload.roleId,
        roleName: payload.roleName,
        permissions: payload.permissions as string[],
        isOwner: payload.isOwner,
        level: typeof payload.level === "string" ? payload.level : "WORKER",
        mustChangePassword: payload.mustChangePassword,
        sess: typeof payload.sess === "number" ? payload.sess : 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

const COMMON_WEAK_PASSWORDS = new Set([
  "password",
  "12345678",
  "123456789",
  "admin123",
  "password123",
  "operator123",
  "factory123",
  "plant1234",
  "qwerty123",
  "welcome123",
]);

/**
 * Validates enterprise password complexity policies (AS9100 / ISO 27001 / NIST SP 800-63B).
 * Requires minimum 8 characters, maximum 128 characters, uppercase, lowercase, numbers,
 * and special characters, checking against weak password dictionaries.
 */
export function validatePasswordPolicy(password: string): {
  ok: boolean;
  error?: string;
} {
  if (!password || typeof password !== "string") {
    return { ok: false, error: "Password cannot be empty" };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters long" };
  }
  if (password.length > 128) {
    return { ok: false, error: "Password must not exceed 128 characters" };
  }
  if (COMMON_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return {
      ok: false,
      error: "Password is too common. Please choose a stronger unique password.",
    };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~` ]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return {
      ok: false,
      error:
        "Password must contain uppercase letters, lowercase letters, numbers, and at least one special character (e.g. !@#$%^&*).",
    };
  }

  return { ok: true };
}

/**
 * Asynchronous, non-blocking password hashing using scrypt.
 */
export async function hashPasswordAsync(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Synchronous password hashing for standard scripts and migrations.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

/**
 * Asynchronous, non-blocking timing-safe password verification.
 */
export async function verifyPasswordAsync(
  password: string,
  hash: string,
): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Synchronous timing-safe password verification.
 */
export function verifyPassword(password: string, hash: string): boolean {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = scryptSync(password, salt, 64);
    return timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}
