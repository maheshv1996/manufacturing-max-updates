import { prisma } from "./prisma";
import { addDays, differenceInDays } from "date-fns";

export type PlanType = "PILOT" | "STARTER" | "GROWTH" | "ENTERPRISE";
export type PaymentStatus = "TRIAL" | "ACTIVE" | "OVERDUE" | "LOCKED";

export interface LicenseInfo {
  plan: PlanType;
  planStartedAt: string;
  nextDueDate: string;
  paymentStatus: PaymentStatus;
}

const LICENSE_KEY = "LICENSE_INFO";

export const PLAN_MACHINE_LIMITS: Record<PlanType, number> = {
  PILOT: Infinity,
  STARTER: 5,
  GROWTH: 15,
  ENTERPRISE: Infinity,
};

function createDefaultLicense(): LicenseInfo {
  const now = new Date();
  return {
    plan: "PILOT",
    planStartedAt: now.toISOString(),
    nextDueDate: addDays(now, 60).toISOString(),
    paymentStatus: "TRIAL",
  };
}

export async function getLicense(): Promise<LicenseInfo> {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: LICENSE_KEY },
    });

    if (!setting || !setting.value) {
      const defaultLicense = createDefaultLicense();
      await updateLicense(defaultLicense);
      return defaultLicense;
    }

    const parsed = JSON.parse(setting.value) as Partial<LicenseInfo>;
    if (!parsed.plan || !parsed.nextDueDate) {
      return createDefaultLicense();
    }

    return {
      plan: (parsed.plan as PlanType) || "PILOT",
      planStartedAt: parsed.planStartedAt || new Date().toISOString(),
      nextDueDate: parsed.nextDueDate,
      paymentStatus: (parsed.paymentStatus as PaymentStatus) || "ACTIVE",
    };
  } catch {
    return createDefaultLicense();
  }
}

export async function updateLicense(license: LicenseInfo): Promise<void> {
  const payload = JSON.stringify(license);
  await prisma.setting.upsert({
    where: { key: LICENSE_KEY },
    update: { value: payload },
    create: { key: LICENSE_KEY, value: payload },
  });
}

export async function getDerivedLicenseStatus(): Promise<LicenseInfo> {
  const license = await getLicense();
  const now = new Date();
  const dueDate = new Date(license.nextDueDate);
  if (isNaN(dueDate.getTime())) {
    return license;
  }

  // differenceInDays(now, dueDate): >0 when now is after dueDate (expired)
  const daysPastDue = differenceInDays(now, dueDate);

  let newStatus: PaymentStatus = license.paymentStatus;

  if (daysPastDue > 7) {
    newStatus = "LOCKED";
  } else if (daysPastDue > 0) {
    newStatus = "OVERDUE";
  } else {
    // Current / not past due
    if (license.paymentStatus === "LOCKED" || license.paymentStatus === "OVERDUE") {
      newStatus = "ACTIVE";
    }
  }

  if (newStatus !== license.paymentStatus) {
    license.paymentStatus = newStatus;
    await updateLicense(license);
  }

  return license;
}

export async function canAddMachine(): Promise<{
  allowed: boolean;
  requiredPlan?: PlanType;
  currentCount?: number;
  maxAllowed?: number;
}> {
  const license = await getDerivedLicenseStatus();

  const currentMachines = await prisma.machine.count({
    where: { isActive: true },
  });

  const limit = PLAN_MACHINE_LIMITS[license.plan] ?? Infinity;

  if (currentMachines >= limit) {
    let nextPlan: PlanType = "ENTERPRISE";
    if (license.plan === "STARTER") nextPlan = "GROWTH";
    return {
      allowed: false,
      requiredPlan: nextPlan,
      currentCount: currentMachines,
      maxAllowed: limit,
    };
  }

  return {
    allowed: true,
    currentCount: currentMachines,
    maxAllowed: limit,
  };
}
