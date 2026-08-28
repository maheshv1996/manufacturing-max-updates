import { cookies } from "next/headers";
import { verifySessionToken } from "./auth";
import { prisma } from "./prisma";
import { UserPreferences } from "./userPrefs";

export async function getPlantScope(): Promise<string> {
  const cookieStore = await cookies();
  const tokenStr = cookieStore.get("app_session")?.value;
  if (!tokenStr) return "ALL";

  const token = await verifySessionToken(tokenStr);
  if (!token) return "ALL";

  const user = await prisma.user.findUnique({
    where: { id: token.id },
    select: { role: true, homePlantId: true, prefs: true },
  });

  if (!user) return "ALL";

  if (user.role?.name === "Operator") {
    return user.homePlantId || "ALL";
  }

  const prefs = user.prefs as any as UserPreferences;
  if (prefs && prefs.selectedPlantId && prefs.selectedPlantId !== "ALL") {
    return prefs.selectedPlantId;
  }

  return "ALL";
}
