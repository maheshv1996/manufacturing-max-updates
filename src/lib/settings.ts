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

export async function getSettings() {
  const settings = await prisma.setting.findMany();

  const brandingStr = settings.find((s) => s.key === "branding")?.value;
  const oeeRulesStr = settings.find((s) => s.key === "oeeRules")?.value;
  const graceStr = settings.find(
    (s) => s.key === "attendance_grace_minutes",
  )?.value;
  const toleranceStr = settings.find((s) => s.key === "count_tolerance")?.value;
  const laborRateStr = settings.find(
    (s) => s.key === "laborRatePerHour",
  )?.value;
  const machineRateStr = settings.find(
    (s) => s.key === "machineRatePerHour",
  )?.value;
  const oeeGoodStr = settings.find((s) => s.key === "oeeGoodThreshold")?.value;
  const oeeWarnStr = settings.find(
    (s) => s.key === "oeeWarningThreshold",
  )?.value;
  const planGateStr = settings.find(
    (s) => s.key === "planGateThreshold",
  )?.value;
  const otLimitStr = settings.find(
    (s) => s.key === "otStatutoryLimitHours",
  )?.value;
  const otThreshStr = settings.find(
    (s) => s.key === "otDailyThresholdHours",
  )?.value;
  const otMultStr = settings.find((s) => s.key === "otMultiplier")?.value;
  const oopsWinStr = settings.find(
    (s) => s.key === "operatorOopsWindowMinutes",
  )?.value;
  const kioskCountStr = settings.find(
    (s) => s.key === "kioskCountdownSeconds",
  )?.value;
  const fileCapStr = settings.find((s) => s.key === "maxFileUploadMb")?.value;
  const effHighStr = settings.find((s) => s.key === "effRatingHigh")?.value;
  const effMedStr = settings.find((s) => s.key === "effRatingMed")?.value;
  const effLowStr = settings.find((s) => s.key === "effRatingLow")?.value;
  const poMultStr = settings.find(
    (s) => s.key === "suggestedPoMultiplier",
  )?.value;
  const minStaffingStr = settings.find(
    (s) => s.key === "minStaffingPerShift",
  )?.value; // P24
  const availableHoursStr = settings.find(
    (s) => s.key === "dailyAvailableHours",
  )?.value;
  const energyCostStr = settings.find(
    (s) => s.key === "defaultEnergyCostPerKwh",
  )?.value;

  const branding: BrandingSettings = brandingStr
    ? { ...DEFAULT_BRANDING, ...JSON.parse(brandingStr) }
    : DEFAULT_BRANDING;
  const oeeRules: OEERulesSettings = oeeRulesStr
    ? { ...DEFAULT_OEE_RULES, ...JSON.parse(oeeRulesStr) }
    : DEFAULT_OEE_RULES;
  const graceMinutes: number = graceStr ? parseInt(graceStr, 10) : 10;
  const countTolerance: number = toleranceStr ? parseInt(toleranceStr, 10) : 0;
  const laborRatePerHour: number = laborRateStr
    ? parseFloat(laborRateStr)
    : 150;
  const machineRatePerHour: number = machineRateStr
    ? parseFloat(machineRateStr)
    : 300;
  const otDailyThresholdHours: number = otThreshStr
    ? parseFloat(otThreshStr)
    : 9;
  const otMultiplier: number = otMultStr ? parseFloat(otMultStr) : 2;

  const oeeGoodThreshold: number = oeeGoodStr ? parseFloat(oeeGoodStr) : 85;
  const oeeWarningThreshold: number = oeeWarnStr ? parseFloat(oeeWarnStr) : 70;
  const planGateThreshold: number = planGateStr ? parseFloat(planGateStr) : 95;
  const otStatutoryLimitHours: number = otLimitStr
    ? parseFloat(otLimitStr)
    : 50;
  const operatorOopsWindowMinutes: number = oopsWinStr
    ? parseInt(oopsWinStr, 10)
    : 15;
  const kioskCountdownSeconds: number = kioskCountStr
    ? parseInt(kioskCountStr, 10)
    : 30;
  const maxFileUploadMb: number = fileCapStr ? parseInt(fileCapStr, 10) : 4;
  const effRatingHigh: number = effHighStr ? parseFloat(effHighStr) : 95;
  const effRatingMed: number = effMedStr ? parseFloat(effMedStr) : 80;
  const effRatingLow: number = effLowStr ? parseFloat(effLowStr) : 65;
  const suggestedPoMultiplier: number = poMultStr ? parseFloat(poMultStr) : 1.2;
  const dailyAvailableHours: number = availableHoursStr
    ? parseFloat(availableHoursStr)
    : 16.0;
  const minStaffingPerShift: number = minStaffingStr
    ? parseInt(minStaffingStr, 10)
    : 2; // P24
  const defaultEnergyCostPerKwh: number = energyCostStr
    ? parseFloat(energyCostStr)
    : 8.0;

  const requireMillCertsStr = settings.find(
    (s) => s.key === "requireMillCerts",
  )?.value;
  const requireMillCerts: boolean = requireMillCertsStr === "true";

  const clStr = settings.find((s) => s.key === "clPerYear")?.value;
  const slStr = settings.find((s) => s.key === "slPerYear")?.value;
  const plStr = settings.find((s) => s.key === "plPerYear")?.value;

  const clPerYear: number = clStr ? parseInt(clStr, 10) : 12;
  const slPerYear: number = slStr ? parseInt(slStr, 10) : 8;
  const plPerYear: number = plStr ? parseInt(plStr, 10) : 12;

  const googleOAuthEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  // First-run onboarding + department visibility (key absent = all departments ON).
  const activeDeptsStr = settings.find(
    (s) => s.key === "activeDepartments",
  )?.value;
  const activeDepartments: string[] | null = activeDeptsStr
    ? (() => {
        try {
          const parsed = JSON.parse(activeDeptsStr);
          return Array.isArray(parsed) ? parsed.map(String) : null;
        } catch {
          return null;
        }
      })()
    : null;
  const onboardingComplete =
    settings.find((s) => s.key === "onboardingComplete")?.value === "true";
  const onboardingSkipped =
    settings.find((s) => s.key === "onboardingSkipped")?.value === "true";
  const companyCurrency =
    settings.find((s) => s.key === "companyCurrency")?.value || null;
  const fiscalYearStart =
    settings.find((s) => s.key === "fiscalYearStart")?.value || null;

  return {
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
  return setting
    ? { ...DEFAULT_BRANDING, ...JSON.parse(setting.value) }
    : DEFAULT_BRANDING;
}

export async function getOEERules(): Promise<OEERulesSettings> {
  const setting = await prisma.setting.findUnique({
    where: { key: "oeeRules" },
  });
  return setting
    ? { ...DEFAULT_OEE_RULES, ...JSON.parse(setting.value) }
    : DEFAULT_OEE_RULES;
}
