/**
 * CNC Machining & Turning Engineering Calculation Engine
 * Grounded in precision discrete manufacturing, aerospace alloys, Kienzle force models, and ISO 3685 tool life standards.
 */

export interface MaterialMachinability {
  id: string;
  name: string;
  category:
    | "STEEL"
    | "STAINLESS"
    | "ALUMINUM"
    | "TITANIUM"
    | "SUPERALLOY"
    | "BRASS"
    | "COPPER"
    | "CAST_IRON"
    | "TOOL_STEEL";
  recommendedVc: { min: number; max: number; opt: number }; // m/min for Carbide
  kc1: number; // Specific cutting force N/mm² at hm = 1mm
  mc: number; // Chip thickness force exponent
  taylorN: number; // Taylor tool life exponent (0.15 - 0.35)
  hardnessHRC?: number;
  densityGcm3: number;
}

export const MATERIAL_DATABASE: Record<string, MaterialMachinability> = {
  "AL-6061-T6": {
    id: "AL-6061-T6",
    name: "Aluminum 6061-T6 (Structural)",
    category: "ALUMINUM",
    recommendedVc: { min: 250, max: 800, opt: 450 },
    kc1: 700,
    mc: 0.25,
    taylorN: 0.30,
    hardnessHRC: 15,
    densityGcm3: 2.7,
  },
  "AL-7075-T6": {
    id: "AL-7075-T6",
    name: "Aluminum 7075-T6 (Aerospace Grade)",
    category: "ALUMINUM",
    recommendedVc: { min: 200, max: 650, opt: 400 },
    kc1: 850,
    mc: 0.25,
    taylorN: 0.28,
    hardnessHRC: 20,
    densityGcm3: 2.81,
  },
  "SS-304": {
    id: "SS-304",
    name: "Stainless Steel 304 (Austenitic)",
    category: "STAINLESS",
    recommendedVc: { min: 100, max: 220, opt: 160 },
    kc1: 2100,
    mc: 0.21,
    taylorN: 0.22,
    hardnessHRC: 28,
    densityGcm3: 8.0,
  },
  "SS-316L": {
    id: "SS-316L",
    name: "Stainless Steel 316L (Medical/Marine)",
    category: "STAINLESS",
    recommendedVc: { min: 90, max: 200, opt: 145 },
    kc1: 2200,
    mc: 0.22,
    taylorN: 0.20,
    hardnessHRC: 30,
    densityGcm3: 8.0,
  },
  "STEEL-EN8": {
    id: "STEEL-EN8",
    name: "Carbon Steel 080M40 (EN8 / AISI 1040)",
    category: "STEEL",
    recommendedVc: { min: 140, max: 280, opt: 210 },
    kc1: 1800,
    mc: 0.25,
    taylorN: 0.25,
    hardnessHRC: 22,
    densityGcm3: 7.85,
  },
  "STEEL-EN19": {
    id: "STEEL-EN19",
    name: "Alloy Steel 709M40 (EN19 / AISI 4140)",
    category: "STEEL",
    recommendedVc: { min: 120, max: 240, opt: 175 },
    kc1: 2100,
    mc: 0.26,
    taylorN: 0.24,
    hardnessHRC: 32,
    densityGcm3: 7.85,
  },
  "STEEL-D2": {
    id: "STEEL-D2",
    name: "Cold Work Tool Steel D2 / 1.2379",
    category: "TOOL_STEEL",
    recommendedVc: { min: 60, max: 140, opt: 95 },
    kc1: 2600,
    mc: 0.25,
    taylorN: 0.18,
    hardnessHRC: 58,
    densityGcm3: 7.7,
  },
  "TI-6AL-4V": {
    id: "TI-6AL-4V",
    name: "Titanium Grade 5 (Ti-6Al-4V Aero)",
    category: "TITANIUM",
    recommendedVc: { min: 35, max: 85, opt: 55 },
    kc1: 2500,
    mc: 0.23,
    taylorN: 0.18,
    hardnessHRC: 36,
    densityGcm3: 4.43,
  },
  "INCONEL-718": {
    id: "INCONEL-718",
    name: "Inconel 718 (Nickel Superalloy)",
    category: "SUPERALLOY",
    recommendedVc: { min: 20, max: 50, opt: 32 },
    kc1: 3100,
    mc: 0.24,
    taylorN: 0.15,
    hardnessHRC: 42,
    densityGcm3: 8.19,
  },
  "BRASS-C360": {
    id: "BRASS-C360",
    name: "Free-Cutting Brass C36000",
    category: "BRASS",
    recommendedVc: { min: 200, max: 600, opt: 380 },
    kc1: 650,
    mc: 0.2,
    taylorN: 0.32,
    hardnessHRC: 10,
    densityGcm3: 8.5,
  },
  "COPPER-C110": {
    id: "COPPER-C110",
    name: "Electrolytic Copper C11000",
    category: "COPPER",
    recommendedVc: { min: 150, max: 350, opt: 240 },
    kc1: 950,
    mc: 0.22,
    taylorN: 0.28,
    hardnessHRC: 8,
    densityGcm3: 8.94,
  },
  "CAST-IRON-FG260": {
    id: "CAST-IRON-FG260",
    name: "Grey Cast Iron FG 260 / Class 35",
    category: "CAST_IRON",
    recommendedVc: { min: 120, max: 280, opt: 190 },
    kc1: 1350,
    mc: 0.28,
    taylorN: 0.26,
    hardnessHRC: 24,
    densityGcm3: 7.2,
  },
};

export interface TurningParametersInput {
  workpieceDiameterMm: number;
  lengthOfCutMm: number;
  cuttingSpeedVcMMin: number;
  feedPerRevMm: number;
  depthOfCutApMm: number;
  noseRadiusREpsilonMm?: number;
  materialId?: string;
  passesCount?: number;
  approachAngleDeg?: number;
  machineEfficiency?: number;
  coolantApplied?: boolean;
}

export interface TurningCalculationResult {
  spindleSpeedRpm: number;
  feedRateMmMin: number;
  metalRemovalRateCm3Min: number;
  cuttingPowerKw: number;
  cuttingTimeSec: number;
  estimatedSurfaceRoughnessRaMicrons: number;
  chipThicknessHm: number;
  chipThicknessMm: number;
  recommendations: string[];
}

/**
 * Calculate CNC Turning cutting parameters, cycle time, power, and surface finish.
 */
export function calculateCncTurning(
  input: TurningParametersInput,
): TurningCalculationResult {
  // Input Validation and Bounds
  const workpieceDiameterMm = Math.max(1, Number(input.workpieceDiameterMm) || 50);
  const lengthOfCutMm = Math.max(1, Number(input.lengthOfCutMm) || 50);
  const cuttingSpeedVcMMin = Math.max(5, Number(input.cuttingSpeedVcMMin) || 150);
  const feedPerRevMm = Math.max(0.01, Number(input.feedPerRevMm) || 0.15);
  const depthOfCutApMm = Math.max(0.05, Number(input.depthOfCutApMm) || 1.5);
  const noseRadiusREpsilonMm =
    input.noseRadiusREpsilonMm !== undefined
      ? Math.max(0.1, Number(input.noseRadiusREpsilonMm))
      : 0.8;
  const passesCount = Math.max(1, Math.round(Number(input.passesCount) || 1));
  const approachAngleDeg =
    input.approachAngleDeg !== undefined
      ? Number(input.approachAngleDeg)
      : 95;
  const machineEfficiency = Math.max(
    0.5,
    Math.min(1.0, Number(input.machineEfficiency) || 0.85),
  );
  const coolantApplied = input.coolantApplied ?? true;

  const recommendations: string[] = [];

  // Material Lookup with Case-Insensitive Matching
  const rawMatKey = String(input.materialId || "").trim().toUpperCase();
  let mat = MATERIAL_DATABASE[rawMatKey];
  if (!mat) {
    if (input.materialId) {
      recommendations.push(
        `Material '${input.materialId}' not in standard database. Applied baseline Carbon Steel EN8 parameters.`,
      );
    }
    mat = MATERIAL_DATABASE["STEEL-EN8"];
  }

  // 1. Spindle Speed N = (Vc * 1000) / (PI * D)
  const spindleSpeedRpm = Math.round((cuttingSpeedVcMMin * 1000) / (Math.PI * workpieceDiameterMm));

  // 2. Feed Rate Vf = fn * N (mm/min)
  const feedRateMmMin = Math.round(feedPerRevMm * spindleSpeedRpm * 10) / 10;

  // 3. Metal Removal Rate Q = (Vc * ap * fn) in cm³/min
  const metalRemovalRateCm3Min =
    Math.round(cuttingSpeedVcMMin * depthOfCutApMm * feedPerRevMm * 100) / 100;

  // 4. Cutting Force & Power Pc = (Q * kc) / (60 * 1000 * eta)
  const kappaRad = (approachAngleDeg * Math.PI) / 180;
  const chipThicknessMm = Math.round(feedPerRevMm * Math.sin(kappaRad) * 1000) / 1000;
  const kc = mat.kc1 * Math.pow(Math.max(0.01, chipThicknessMm), -mat.mc);

  // Coolant factor reduces specific cutting force by ~10%
  const coolantFactor = coolantApplied ? 0.90 : 1.0;
  const cuttingPowerKw =
    Math.round(((metalRemovalRateCm3Min * (kc * coolantFactor)) / (60 * 1000 * machineEfficiency)) * 100) / 100;

  // 5. Cutting Time Tc = (L / (fn * N)) * passes in seconds
  const singlePassTimeMinutes = feedRateMmMin > 0 ? lengthOfCutMm / feedRateMmMin : 0;
  const totalCuttingTimeSec = Math.round(singlePassTimeMinutes * 60 * passesCount * 10) / 10;

  // 6. Surface Roughness Ra ≈ (fn² / (32 * r_epsilon)) * 1000 (microns)
  // Empirical 1.5 multiplier accounts for tool nose wear and machine vibration
  const theoreticalRa = (Math.pow(feedPerRevMm, 2) / (32 * noseRadiusREpsilonMm)) * 1000;
  const estimatedSurfaceRoughnessRaMicrons = Math.round(theoreticalRa * 1.5 * 100) / 100;

  if (cuttingSpeedVcMMin < mat.recommendedVc.min) {
    recommendations.push(
      `Cutting speed (${cuttingSpeedVcMMin} m/min) is below recommended minimum (${mat.recommendedVc.min} m/min) for ${mat.name}. Risk of built-up edge (BUE).`,
    );
  } else if (cuttingSpeedVcMMin > mat.recommendedVc.max) {
    recommendations.push(
      `Cutting speed (${cuttingSpeedVcMMin} m/min) exceeds recommended maximum (${mat.recommendedVc.max} m/min). Accelerated tool flank/crater wear.`,
    );
  }

  if (estimatedSurfaceRoughnessRaMicrons > 3.2) {
    // Derived from Ra = (fn² / (32 * re)) * 1000 * 1.5 for Ra <= 1.6 um
    const idealFeed = Math.round(Math.sqrt((1.6 * 32 * noseRadiusREpsilonMm) / 1500) * 100) / 100;
    recommendations.push(
      `Estimated surface finish Ra is ${estimatedSurfaceRoughnessRaMicrons} µm. For precision finish (Ra < 1.6 µm), reduce feed to ~${idealFeed} mm/rev.`,
    );
  }

  return {
    spindleSpeedRpm,
    feedRateMmMin,
    metalRemovalRateCm3Min,
    cuttingPowerKw,
    cuttingTimeSec: totalCuttingTimeSec,
    estimatedSurfaceRoughnessRaMicrons,
    chipThicknessHm: chipThicknessMm,
    chipThicknessMm,
    recommendations,
  };
}

/**
 * Extended Taylor Tool Life Equation: V * T^n = C
 */
export function estimateToolLifeMinutes(
  actualVc: number,
  standardVc: number,
  standardLifeMinutes: number = 45,
  taylorExponentN?: number,
  materialId?: string,
): number {
  if (actualVc <= 0 || standardVc <= 0) return standardLifeMinutes;

  const rawMatKey = materialId ? String(materialId).trim().toUpperCase() : "";
  const mat = rawMatKey ? MATERIAL_DATABASE[rawMatKey] : null;
  const n = taylorExponentN ?? mat?.taylorN ?? 0.25;

  const life = standardLifeMinutes * Math.pow(standardVc / actualVc, 1 / n);
  return Math.round(Math.max(1, Math.min(600, life)));
}
