import { logAuditTx } from "@/lib/audit";
import { NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { analyzeQuery } from "@/lib/analystEngine";
import { getPlantScope } from "@/lib/plantScope";
import { cookies } from "next/headers";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const tokenStr = cookieStore.get("app_session")?.value;
    if (!tokenStr)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const token = await verifySessionToken(tokenStr);
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { question } = await req.json();
    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 },
      );
    }

    const plantId = await getPlantScope();

    // Analyze question
    const answer = await analyzeQuery(question, plantId, token.id);

    // Save history and audit log atomically
    await prisma.$transaction(async (tx) => {
      await tx.analystQuery.create({
        data: {
          userId: token.id,
          question,
          answerTitle: answer.title,
        },
      });

      await logAuditTx(tx, {
        actor: token.id,
        action: "ANALYST_QUERY",
        entityType: "AI_ANALYST",
        details: `Asked: "${question}" (Answered: ${answer.title})`,
      });
    });

    return NextResponse.json({ answer });
  } catch (error: any) {
    console.error("Analyst Route Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
