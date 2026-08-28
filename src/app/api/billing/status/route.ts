import { NextResponse } from "next/server";
import { getDerivedLicenseStatus } from "@/lib/licenseEngine";

export async function GET() {
  try {
    const license = await getDerivedLicenseStatus();
    return NextResponse.json(license);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get license status" },
      { status: 500 },
    );
  }
}
