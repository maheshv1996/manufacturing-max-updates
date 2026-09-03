import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const instruments = [
    {
      id: "BG-2026-0041",
      type: "PERFORMANCE_BG",
      typeName: "Performance Bank Guarantee (PBG)",
      customerOrBeneficiary: "Bharat Dynamics Limited (BDL)",
      issuingBank: "State Bank of India (Industrial Finance Branch, Hyd)",
      amount: 4500000,
      currency: "INR",
      marginMoneyPercent: 10,
      issuedDate: "2025-10-15",
      expiryDate: new Date(Date.now() + 18 * 86400000).toISOString().split("T")[0],
      claimPeriodEndDate: new Date(Date.now() + 48 * 86400000).toISOString().split("T")[0],
      status: "EXPIRING_SOON",
      linkedContract: "PO-BDL-MISSILE-2025",
    },
    {
      id: "LC-2026-0019",
      type: "EXPORT_LC",
      typeName: "Irrevocable Export Letter of Credit",
      customerOrBeneficiary: "Lockheed Martin Aeronautics (USA)",
      issuingBank: "JPMorgan Chase Bank (New York) / HDFC Bank Confirming",
      amount: 185000,
      currency: "USD",
      marginMoneyPercent: 0,
      issuedDate: "2026-01-10",
      expiryDate: new Date(Date.now() + 65 * 86400000).toISOString().split("T")[0],
      claimPeriodEndDate: new Date(Date.now() + 80 * 86400000).toISOString().split("T")[0],
      status: "ACTIVE",
      linkedContract: "EXP-US-2026-784",
    },
    {
      id: "BG-2026-0012",
      type: "ADVANCE_BG",
      typeName: "Advance Payment Bank Guarantee (ABG)",
      customerOrBeneficiary: "Tata Advanced Systems Limited (TASL)",
      issuingBank: "ICICI Bank (Corporate Banking Branch)",
      amount: 2800000,
      currency: "INR",
      marginMoneyPercent: 15,
      issuedDate: "2025-06-01",
      expiryDate: new Date(Date.now() + 120 * 86400000).toISOString().split("T")[0],
      claimPeriodEndDate: new Date(Date.now() + 150 * 86400000).toISOString().split("T")[0],
      status: "ACTIVE",
      linkedContract: "PO-TASL-APACHE-099",
    },
  ];

  return NextResponse.json({ success: true, instruments });
}

export async function POST(req: Request) {
    await logAudit({ actor: "system", action: "BANK_TRANSACTION_RECORDED", entityType: "BankTransaction", details: "Bank transaction logged" });
  try {
    const body = await req.json();
    // @ts-ignore - body is any from req.json()
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return NextResponse.json({ success: true, message: "Bank Guarantee logged", record: body });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
