import { cookies } from "next/headers";
import { verifySessionToken } from "./auth";
import { prisma } from "./prisma";
import { UserPreferences } from "./userPrefs";

export async function getPlantScope(): Promise<string> {
  const cookieStore = await cookies();
  const tokenStr = cookieStore.get("app_session")?.value;
  // Fail-closed: unauthenticated callers must not get silent "ALL" (cross-plant leak). Callers on protected pages
  // have already passed proxy auth; public pages should not call getPlantScope.
  if (!tokenStr) throw new Error("Plant scope requires authentication");
  const token = await verifySessionToken(tokenStr);
  if (!token) throw new Error("Plant scope requires authentication");

  const user = await prisma.user.findUnique({
    where: { id: token.id },
    select: { role: true, homePlantId: true, prefs: true },
  });

  if (!user) throw new Error("Plant scope requires authentication");

  if (user.role?.name === "Operator") {
    return user.homePlantId || "ALL";
  }

  let prefs: UserPreferences | null = null;
  try {
    prefs =
      typeof user.prefs === "string"
        ? (JSON.parse(user.prefs) as UserPreferences)
        : (user.prefs as unknown as UserPreferences);
  } catch {
    prefs = null;
  }

  if (prefs && prefs.selectedPlantId && prefs.selectedPlantId !== "ALL") {
    return prefs.selectedPlantId;
  }

  return "ALL";
}

export async function resolvePlantId(
  explicitPlantId?: string | null,
): Promise<string | null> {
  if (explicitPlantId) return explicitPlantId;
  let scope: string;
  try {
    scope = await getPlantScope();
  } catch {
    // Unauthenticated caller with no explicit plant — fail-closed (no silent defaultPlantId leak)
    throw new Error("Plant scope requires authentication");
  }
  if (scope && scope !== "ALL") return scope;
  try {
    const setting = await prisma.setting.findFirst({
      where: { key: { in: ["plantId", "defaultPlantId"] } },
    });
    return setting?.value || process.env.DEFAULT_PLANT_ID || null;
  } catch {
    return process.env.DEFAULT_PLANT_ID || null;
  }
}

export async function withPlantScope<T extends Record<string, any>>(
  whereClause: T = {} as T,
  field: string = "plantId",
): Promise<T> {
  const scope = await getPlantScope();
  if (scope && scope !== "ALL") {
    return {
      ...whereClause,
      [field]: scope,
    };
  }
  return whereClause;
}

