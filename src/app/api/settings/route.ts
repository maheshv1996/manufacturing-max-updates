import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { logAudit } from "@/lib/audit";

export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    if (body.branding) {
      await prisma.setting.upsert({
        where: { key: "branding" },
        update: { value: JSON.stringify(body.branding) },
        create: { key: "branding", value: JSON.stringify(body.branding) },
      });
    }

    if (body.oeeRules) {
      await prisma.setting.upsert({
        where: { key: "oeeRules" },
        update: { value: JSON.stringify(body.oeeRules) },
        create: { key: "oeeRules", value: JSON.stringify(body.oeeRules) },
      });
    }

    if (body.graceMinutes !== undefined) {
      await prisma.setting.upsert({
        where: { key: "attendance_grace_minutes" },
        update: { value: String(body.graceMinutes) },
        create: {
          key: "attendance_grace_minutes",
          value: String(body.graceMinutes),
        },
      });
    }

    if (body.countTolerance !== undefined) {
      await prisma.setting.upsert({
        where: { key: "count_tolerance" },
        update: { value: String(body.countTolerance) },
        create: { key: "count_tolerance", value: String(body.countTolerance) },
      });
    }

    if (body.laborRatePerHour !== undefined) {
      await prisma.setting.upsert({
        where: { key: "laborRatePerHour" },
        update: { value: String(body.laborRatePerHour) },
        create: {
          key: "laborRatePerHour",
          value: String(body.laborRatePerHour),
        },
      });
    }

    if (body.machineRatePerHour !== undefined) {
      await prisma.setting.upsert({
        where: { key: "machineRatePerHour" },
        update: { value: String(body.machineRatePerHour) },
        create: {
          key: "machineRatePerHour",
          value: String(body.machineRatePerHour),
        },
      });
    }

    if (body.otDailyThresholdHours !== undefined) {
      await prisma.setting.upsert({
        where: { key: "otDailyThresholdHours" },
        update: { value: String(body.otDailyThresholdHours) },
        create: {
          key: "otDailyThresholdHours",
          value: String(body.otDailyThresholdHours),
        },
      });
    }

    if (body.otMultiplier !== undefined) {
      await prisma.setting.upsert({
        where: { key: "otMultiplier" },
        update: { value: String(body.otMultiplier) },
        create: { key: "otMultiplier", value: String(body.otMultiplier) },
      });
    }

    const constantKeys = [
      "oeeGoodThreshold",
      "oeeWarningThreshold",
      "planGateThreshold",
      "otStatutoryLimitHours",
      "operatorOopsWindowMinutes",
      "kioskCountdownSeconds",
      "maxFileUploadMb",
      "effRatingHigh",
      "effRatingMed",
      "effRatingLow",
      "suggestedPoMultiplier",
      "clPerYear",
      "slPerYear",
      "plPerYear",
      "dailyAvailableHours",
      "defaultEnergyCostPerKwh",
    ];

    for (const key of constantKeys) {
      if (body[key] !== undefined) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(body[key]) },
          create: { key, value: String(body[key]) },
        });
      }
    }

    // Handle boolean toggles
    if (body.requireMillCerts !== undefined) {
      await prisma.setting.upsert({
        where: { key: "requireMillCerts" },
        update: { value: body.requireMillCerts ? "true" : "false" },
        create: {
          key: "requireMillCerts",
          value: body.requireMillCerts ? "true" : "false",
        },
      });
    }

    // Onboarding: which departments are active (JSON array of department ids;
    // key absent = all ON).
    if (body.activeDepartments !== undefined) {
      const value = Array.isArray(body.activeDepartments)
        ? JSON.stringify(body.activeDepartments.map(String))
        : "";
      await prisma.setting.upsert({
        where: { key: "activeDepartments" },
        update: { value },
        create: { key: "activeDepartments", value },
      });
    }

    // Onboarding state flags.
    for (const key of ["onboardingComplete", "onboardingSkipped"]) {
      if (body[key] !== undefined) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: body[key] ? "true" : "false" },
          create: { key, value: body[key] ? "true" : "false" },
        });
      }
    }

    // Company step: currency + fiscal year start.
    if (body.companyCurrency !== undefined) {
      await prisma.setting.upsert({
        where: { key: "companyCurrency" },
        update: { value: String(body.companyCurrency) },
        create: { key: "companyCurrency", value: String(body.companyCurrency) },
      });
    }
    if (body.fiscalYearStart !== undefined) {
      await prisma.setting.upsert({
        where: { key: "fiscalYearStart" },
        update: { value: String(body.fiscalYearStart) },
        create: { key: "fiscalYearStart", value: String(body.fiscalYearStart) },
      });
    }

    await logAudit({
      actor: "system",
      action: "SETTINGS_UPDATED",
      entityType: "Setting",
      details: Object.keys(body).join(","),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
