import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { DEPARTMENTS } from "@/lib/departments";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("app_session")?.value;
  if (!sessionToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await verifySessionToken(sessionToken);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const query = q.toLowerCase();

  // Find matching navigation functions across all 11 departments
  const matchingFunctions: any[] = [];
  DEPARTMENTS.forEach((dept) => {
    dept.functions.forEach((fn) => {
      if (
        fn.name.toLowerCase().includes(query) ||
        fn.desc.toLowerCase().includes(query) ||
        dept.title.toLowerCase().includes(query) ||
        dept.short.toLowerCase().includes(query)
      ) {
        matchingFunctions.push({
          id: `fn-${fn.href}-${fn.name}`,
          title: `${fn.name} (${dept.short})`,
          description: fn.desc,
          type: "Function",
          href: fn.href,
        });
      }
    });
  });

  try {
    const [machines, workOrders, products, materials, users] =
      await Promise.all([
        prisma.machine.findMany({
          where: { name: { contains: query, mode: "insensitive" } },
          take: 4,
          select: { id: true, name: true, plantId: true },
        }),
        prisma.workOrder.findMany({
          where: { woNumber: { contains: query, mode: "insensitive" } },
          take: 4,
          select: { id: true, woNumber: true },
        }),
        prisma.product.findMany({
          where: { sku: { contains: query, mode: "insensitive" } },
          take: 4,
          select: { id: true, sku: true, name: true },
        }),
        prisma.rawMaterial.findMany({
          where: {
            OR: [
              { sku: { contains: query, mode: "insensitive" } },
              { name: { contains: query, mode: "insensitive" } },
            ],
          },
          take: 4,
          select: { id: true, sku: true, name: true },
        }),
        session.isOwner
          ? prisma.user.findMany({
              where: {
                OR: [
                  { name: { contains: query, mode: "insensitive" } },
                  { username: { contains: query, mode: "insensitive" } },
                ],
              },
              take: 4,
              select: { id: true, name: true, role: true },
            })
          : Promise.resolve([]),
      ]);

    const results = [
      ...matchingFunctions.slice(0, 6),
      ...machines.map((m) => ({
        id: m.id,
        title: m.name,
        type: "Machine",
        href: `/system/machines/${m.id}`,
      })),
      ...workOrders.map((w) => ({
        id: w.id,
        title: w.woNumber,
        type: "Work Order",
        href: `/ops/work-orders/${w.id}`,
      })),
      ...products.map((p) => ({
        id: p.id,
        title: `${p.sku} - ${p.name}`,
        type: "Product",
        href: `/supply/tools`,
      })),
      ...materials.map((m) => ({
        id: m.id,
        title: `${m.sku} - ${m.name}`,
        type: "Material",
        href: `/supply/vault`,
      })),
      ...users.map((u) => ({
        id: u.id,
        title: `${u.name} (${u.role})`,
        type: "User",
        href: `/system/admin`,
      })),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
