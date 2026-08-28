import { prisma } from "./prisma";
import { addDays, differenceInDays } from "date-fns";

export type PlanType = "PILOT" | "STARTER" | "GROWTH";
export type PaymentStatus = "TRIAL" | "ACTIVE" | "OVERDUE" | "LOCKED";

export interface LicenseInfo {
  plan: PlanType;
  planStartedAt: string;
  nextDueDate: string;
  paymentStatus: PaymentStatus;
}

const LICENSE_KEY = "LICENSE_INFO";

export async function getLicense(): Promise<LicenseInfo> {
  const setting = await prisma.setting.findUnique({
    where: { key: LICENSE_KEY },
  });

  if (!setting) {
    // Default to Pilot mode starting today if no license exists
    const now = new Date();
    const defaultLicense: LicenseInfo = {
      plan: "PILOT",
      planStartedAt: now.toISOString(),
      nextDueDate: addDays(now, 60).toISOString(),
      paymentStatus: "TRIAL",
    };
    await updateLicense(defaultLicense);
    return defaultLicense;
  }

  try {
    return JSON.parse(setting.value) as LicenseInfo;
  } catch {
    const now = new Date();
    return {
      plan: "PILOT",
      planStartedAt: now.toISOString(),
      nextDueDate: addDays(now, 60).toISOString(),
      paymentStatus: "TRIAL",
    };
  }
}

export async function updateLicense(license: LicenseInfo) {
  await prisma.setting.upsert({
    where: { key: LICENSE_KEY },
    update: { value: JSON.stringify(license) },
    create: { key: LICENSE_KEY, value: JSON.stringify(license) },
  });
}

export async function getDerivedLicenseStatus(): Promise<LicenseInfo> {
  const license = await getLicense();
  const now = new Date();
  const dueDate = new Date(license.nextDueDate);
  const diff = differenceInDays(now, dueDate);

  let status = license.paymentStatus;

  if (diff > 7) {
    status = "LOCKED";
  } else if (diff > 0) {
    status = "OVERDUE";
  } else if (status === "LOCKED" || status === "OVERDUE") {
    status = "ACTIVE"; // if somehow paid but status was stuck
  }

  // If PILOT trial ended, force overdue
  if (license.plan === "PILOT" && diff > 0) {
    status = "OVERDUE";
    if (diff > 7) status = "LOCKED";
  }

  if (status !== license.paymentStatus) {
    license.paymentStatus = status;
    await updateLicense(license);
  }

  return license;
}

export async function canAddMachine(): Promise<{
  allowed: boolean;
  requiredPlan?: string;
}> {
  const license = await getDerivedLicenseStatus();

  const currentMachines = await prisma.machine.count({
    where: { isActive: true },
  });

  if (license.plan === "PILOT") return { allowed: true };
  if (license.plan === "STARTER" && currentMachines >= 5) {
    return { allowed: false, requiredPlan: "GROWTH" };
  }
  if (license.plan === "GROWTH" && currentMachines >= 15) {
    // Arbitrary cap for growth per instructions (or maybe no limit, but prompt says max 15 machines)
    return { allowed: false, requiredPlan: "ENTERPRISE" };
  }

  return { allowed: true };
}
