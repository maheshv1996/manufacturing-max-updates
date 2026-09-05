import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { DEPARTMENTS } from "@/lib/departments";

// ── Fuzzy Trigram & Token Similarity Engine ──
function getBigrams(str: string): Set<string> {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  const bigrams = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) {
    bigrams.add(s.slice(i, i + 2));
  }
  return bigrams;
}

function computeSimilarity(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase().trim();

  if (!q || !t) return 0;
  if (q === t) return 1.0;
  if (t.startsWith(q)) return 0.95;
  if (t.includes(q)) return 0.85;

  // Token subset match
  const qTokens = q.split(/\s+/);
  const tTokens = t.split(/\s+/);
  const matchedTokens = qTokens.filter((qt) =>
    tTokens.some((tt) => tt.startsWith(qt) || tt.includes(qt)),
  );
  if (matchedTokens.length === qTokens.length) {
    return 0.75;
  }

  // Bigram Dice coefficient
  const qBigrams = getBigrams(q);
  const tBigrams = getBigrams(t);
  if (qBigrams.size === 0 || tBigrams.size === 0) return 0;

  let intersection = 0;
  for (const bg of qBigrams) {
    if (tBigrams.has(bg)) intersection++;
  }

  return (2 * intersection) / (qBigrams.size + tBigrams.size);
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("app_session")?.value;
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await verifySessionToken(sessionToken);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const rawQ = searchParams.get("q")?.trim();

    if (!rawQ || rawQ.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Bound query length to max 100 characters to prevent ReDoS / CPU starvation on fuzzy trigrams
    const query = rawQ.slice(0, 100).toLowerCase();
    const SIMILARITY_THRESHOLD = 0.35;

    // 1. Fuzzy index matching across all 11 departments and 100+ functions
    const scoredFunctions: {
      id: string;
      title: string;
      description: string;
      type: string;
      href: string;
      score: number;
    }[] = [];

    DEPARTMENTS.forEach((dept) => {
      dept.functions.forEach((fn) => {
        const nameScore = computeSimilarity(query, fn.name);
        const descScore = computeSimilarity(query, fn.desc) * 0.7;
        const deptScore = computeSimilarity(query, dept.title) * 0.6;
        const shortScore = computeSimilarity(query, dept.short) * 0.8;
        const hrefScore = computeSimilarity(query, fn.href.replace(/\//g, " ")) * 0.75;

        const maxScore = Math.max(nameScore, descScore, deptScore, shortScore, hrefScore);

        if (maxScore >= SIMILARITY_THRESHOLD) {
          scoredFunctions.push({
            id: `fn-${fn.href}-${fn.name}`,
            title: `${fn.name} (${dept.short})`,
            description: fn.desc,
            type: "Function",
            href: fn.href,
            score: maxScore,
          });
        }
      });
    });

    // 2. Parallel Database Entity Search with Trigram / Substring Fallback
    const [machines, workOrders, products, materials, complaints, users] =
      await Promise.all([
        prisma.machine.findMany({
          where: {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { code: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 5,
          select: { id: true, name: true, code: true },
        }),
        prisma.workOrder.findMany({
          where: {
            OR: [
              { woNumber: { contains: query, mode: "insensitive" } },
              { customerName: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 5,
          select: { id: true, woNumber: true, customerName: true },
        }),
        prisma.product.findMany({
          where: {
            OR: [
              { sku: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 5,
          select: { id: true, sku: true, name: true },
        }),
        prisma.rawMaterial.findMany({
          where: {
            OR: [
              { sku: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 5,
          select: { id: true, sku: true, name: true },
        }),
        prisma.customerComplaint.findMany({
          where: {
            OR: [
              { complaintNumber: { contains: query, mode: "insensitive" } },
              { customerName: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 4,
          select: { id: true, complaintNumber: true, customerName: true },
        }),
        session.isOwner
          ? prisma.user.findMany({
              where: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { username: { contains: query, mode: "insensitive" } },
                  { employeeNumber: { contains: query, mode: "insensitive" } },
                ],
              },
              take: 4,
              select: { id: true, name: true, role: true, employeeNumber: true },
            })
          : Promise.resolve([]),
      ]);

    // Format DB results
    const dbResults: {
      id: string;
      title: string;
      description?: string;
      type: string;
      href: string;
      score: number;
    }[] = [
      ...machines.map((m) => ({
        id: m.id,
        title: `${m.name} (${m.code})`,
        description: "Machine Center",
        type: "Machine",
        href: `/system/machines/${m.id}`,
        score: computeSimilarity(query, m.name) > 0 ? computeSimilarity(query, m.name) : 0.8,
      })),
      ...workOrders.map((w) => ({
        id: w.id,
        title: w.woNumber,
        description: w.customerName ? `Customer: ${w.customerName}` : "Work Order",
        type: "Work Order",
        href: `/ops/work-orders/${w.id}`,
        score: computeSimilarity(query, w.woNumber) > 0 ? computeSimilarity(query, w.woNumber) : 0.85,
      })),
      ...products.map((p) => ({
        id: p.id,
        title: `${p.sku} - ${p.name}`,
        description: "Finished Goods Product",
        type: "Product",
        href: "/supply/tools",
        score: computeSimilarity(query, p.sku) > 0 ? computeSimilarity(query, p.sku) : 0.75,
      })),
      ...materials.map((m) => ({
        id: m.id,
        title: `${m.sku} - ${m.name}`,
        description: "Raw Material SKU",
        type: "Material",
        href: "/supply/vault",
        score: computeSimilarity(query, m.sku) > 0 ? computeSimilarity(query, m.sku) : 0.75,
      })),
      ...complaints.map((c) => ({
        id: c.id,
        title: `${c.complaintNumber} - ${c.customerName || "Customer"}`,
        description: "Quality Complaint",
        type: "Complaint",
        href: "/quality/escalations",
        score: 0.7,
      })),
      ...users.map((u) => ({
        id: u.id,
        title: `${u.name} (${u.role})`,
        description: u.employeeNumber ? `Emp #: ${u.employeeNumber}` : "User",
        type: "User",
        href: "/system/admin",
        score: computeSimilarity(query, u.name) > 0 ? computeSimilarity(query, u.name) : 0.65,
      })),
    ];

    // Combine, sort by score descending, and cap top results
    scoredFunctions.sort((a, b) => b.score - a.score);
    dbResults.sort((a, b) => b.score - a.score);

    const results = [
      ...scoredFunctions.slice(0, 8),
      ...dbResults.slice(0, 8),
    ].sort((a, b) => b.score - a.score);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
