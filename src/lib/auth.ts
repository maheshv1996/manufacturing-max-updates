import { SignJWT, jwtVerify } from "jose";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";

const getSecretKey = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET env var is required");
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

export async function signSessionToken(
  payload: SessionPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
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

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

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
