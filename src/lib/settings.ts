import { prisma } from "./prisma";

export interface BrandingSettings {
  appName: string;
  tagline: string;
  logoUrl: string | null;
  accentColor: string;
  companyName?: string;
  companyGstin?: string;
  companyAddress?: string;
  companyState?: string;
}

export interface OEERulesSettings {
  plannedCategories: string[];
  excludePlanned: boolean;
}

export const DEFAULT_BRANDING: BrandingSettings = {
  appName: "Manufacturing Max",
  tagline: "Enterprise Manufacturing Suite",
  logoUrl: null,
  accentColor: "#3b82f6", // tailwind blue-500
  companyName: "Apex Manufacturing Ltd",
  companyGstin: "27AAACA12341Z1",
  companyAddress:
    "100 Industrial Parkway, MIDC Industrial Area, Pune 411018, Maharashtra",
  companyState: "Maharashtra",
};

export const DEFAULT_OEE_RULES: OEERulesSettings = {
  plannedCategories: [],
  excludePlanned: false,
};

/** Safely parse and clamp integer values within designated business bounds */
function parseSafeInt(
  raw: string | undefined,
  fallback: number,
  min: number = -Infinity,
  max: number = Infinity,
): number {
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  if (isNaN(n) || !isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Safely parse and clamp floating point values within designated business bounds */
function parseSafeFloat(
  raw: string | undefined,
  fallback: number,
  min: number = -Infinity,
  max: number = Infinity,
): number {
  if (!raw) return fallback;
  const n = parseFloat(raw);
  if (isNaN(n) || !isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Safely parse JSON setting with schema validation fallback */
function parseSafeJson<T>(
  raw: string | undefined,
  fallback: T,
  validator?: (data: unknown) => boolean,
): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (validator && !validator(parsed)) return fallback;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export async function getSettings() {
  const settingsList = await prisma.setting.findMany();
  const map = new Map<string, string>();
  for (const s of settingsList) {
    if (s.key && s.value !== null && s.value !== undefined) {
      map.set(s.key, s.value);
    }
  }

  const plantId = map.get("plantId") || map.get("defaultPlantId") || process.env.DEFAULT_PLANT_ID || null;

  const branding = parseSafeJson<BrandingSettings>(
    map.get("branding"),
    DEFAULT_BRANDING,
    (d) => typeof d === "object" && d !== null,
  );

  const oeeRules = parseSafeJson<OEERulesSettings>(
    map.get("oeeRules"),
    DEFAULT_OEE_RULES,
    (d) => typeof d === "object" && d !== null,
  );

  const graceMinutes = parseSafeInt(map.get("attendance_grace_minutes"), 10, 0, 120);
  const countTolerance = parseSafeInt(map.get("count_tolerance"), 0, 0, 100);
  const laborRatePerHour = parseSafeFloat(map.get("laborRatePerHour"), 150, 0, 100000);
  const machineRatePerHour = parseSafeFloat(map.get("machineRatePerHour"), 300, 0, 100000);
  const otDailyThresholdHours = parseSafeFloat(map.get("otDailyThresholdHours"), 9, 0, 24);
  const otMultiplier = parseSafeFloat(map.get("otMultiplier"), 2.0, 1.0, 5.0);

  const oeeGoodThreshold = parseSafeFloat(map.get("oeeGoodThreshold"), 85, 1, 100);
  const oeeWarningThreshold = parseSafeFloat(map.get("oeeWarningThreshold"), 70, 1, 100);
  const planGateThreshold = parseSafeFloat(map.get("planGateThreshold"), 95, 1, 100);
  const otStatutoryLimitHours = parseSafeFloat(map.get("otStatutoryLimitHours"), 50, 0, 500);

  const operatorOopsWindowMinutes = parseSafeInt(map.get("operatorOopsWindowMinutes"), 15, 1, 180);
  const kioskCountdownSeconds = parseSafeInt(map.get("kioskCountdownSeconds"), 30, 5, 300);
  const maxFileUploadMb = parseSafeInt(map.get("maxFileUploadMb"), 4, 1, 100);

  const effRatingHigh = parseSafeFloat(map.get("effRatingHigh"), 95, 1, 100);
  const effRatingMed = parseSafeFloat(map.get("effRatingMed"), 80, 1, 100);
  const effRatingLow = parseSafeFloat(map.get("effRatingLow"), 65, 1, 100);
  const suggestedPoMultiplier = parseSafeFloat(map.get("suggestedPoMultiplier"), 1.2, 1.0, 10.0);

  const dailyAvailableHours = parseSafeFloat(map.get("dailyAvailableHours"), 16.0, 1.0, 24.0);
  const minStaffingPerShift = parseSafeInt(map.get("minStaffingPerShift"), 2, 1, 500);
  const defaultEnergyCostPerKwh = parseSafeFloat(map.get("defaultEnergyCostPerKwh"), 8.0, 0.1, 1000.0);
  const defaultGrossMarginMultiplier = parseSafeFloat(map.get("defaultGrossMarginMultiplier"), 1.35, 1.0, 10.0);

  const requireMillCerts = map.get("requireMillCerts") === "true";

  const clPerYear = parseSafeInt(map.get("clPerYear"), 12, 0, 365);
  const slPerYear = parseSafeInt(map.get("slPerYear"), 8, 0, 365);
  const plPerYear = parseSafeInt(map.get("plPerYear"), 12, 0, 365);

  const googleOAuthEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  // First-run onboarding + department visibility (key absent = all departments ON).
  const activeDeptsStr = map.get("activeDepartments");
  let activeDepartments: string[] | null = null;
  if (activeDeptsStr) {
    try {
      const parsed = JSON.parse(activeDeptsStr);
      if (Array.isArray(parsed)) {
        activeDepartments = parsed.map(String).filter((s) => s.trim().length > 0);
      }
    } catch {
      activeDepartments = null;
    }
  }

  const onboardingComplete = map.get("onboardingComplete") === "true";
  const onboardingSkipped = map.get("onboardingSkipped") === "true";
  const companyCurrency = map.get("companyCurrency") || null;
  const fiscalYearStart = map.get("fiscalYearStart") || null;

  return {
    plantId,
    defaultPlantId: plantId,
    activeDepartments,
    onboardingComplete,
    onboardingSkipped,
    companyCurrency,
    fiscalYearStart,
    branding,
    oeeRules,
    graceMinutes,
    countTolerance,
    laborRatePerHour,
    machineRatePerHour,
    otDailyThresholdHours,
    otMultiplier,
    oeeGoodThreshold,
    oeeWarningThreshold,
    planGateThreshold,
    otStatutoryLimitHours,
    operatorOopsWindowMinutes,
    kioskCountdownSeconds,
    maxFileUploadMb,
    effRatingHigh,
    effRatingMed,
    effRatingLow,
    suggestedPoMultiplier,
    dailyAvailableHours,
    minStaffingPerShift,
    defaultEnergyCostPerKwh,
    defaultGrossMarginMultiplier,
    clPerYear,
    slPerYear,
    plPerYear,
    googleOAuthEnabled,
    requireMillCerts,
  };
}

export async function getBranding(): Promise<BrandingSettings> {
  const setting = await prisma.setting.findUnique({
    where: { key: "branding" },
  });
  if (!setting || !setting.value) return DEFAULT_BRANDING;
  return parseSafeJson<BrandingSettings>(
    setting.value,
    DEFAULT_BRANDING,
    (d) => typeof d === "object" && d !== null,
  );
}

export async function getOEERules(): Promise<OEERulesSettings> {
  const setting = await prisma.setting.findUnique({
    where: { key: "oeeRules" },
  });
  if (!setting || !setting.value) return DEFAULT_OEE_RULES;
  return parseSafeJson<OEERulesSettings>(
    setting.value,
    DEFAULT_OEE_RULES,
    (d) => typeof d === "object" && d !== null,
  );
}

export async function getPlantId(): Promise<string | null> {
  const setting = await prisma.setting.findFirst({
    where: { key: { in: ["plantId", "defaultPlantId"] } },
  });
  if (setting?.value) return setting.value;
  if (process.env.DEFAULT_PLANT_ID) return process.env.DEFAULT_PLANT_ID;
  const firstPlant = await prisma.plant.findFirst({ select: { id: true } });
  return firstPlant?.id || null;
}

export const getDefaultPlantId = getPlantId;
