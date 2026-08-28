import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request) {
  try {
    const { company, contactName, phone, email } = await req.json();

    if (!company || !contactName || !phone || !email) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const lead = await prisma.lead.create({
      data: {
        company,
        contactName,
        phone,
        email,
      },
    });

    await logAudit({
      actor: "public",
      action: "LEAD_SUBMITTED",
      entityType: "Lead",
      entityId: lead.id,
      details: `${company} · ${contactName} · ${email}`,
    });

    return NextResponse.json({ success: true, leadId: lead.id });
  } catch (error: any) {
    console.error("Lead submission error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
