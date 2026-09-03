import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/app/components/shared/PageHeader";
import { Layers } from "lucide-react";
import CustomEntityClient from "./CustomEntityClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomEntityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const headersList = await headers();
  const user = getUserFromHeaders(headersList);
  if (!user.id) redirect("/login");

  const entity = await (prisma as any).customEntity.findUnique({
    where: { slug },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });
  if (!entity) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <PageHeader title="Not Found" description={`No custom entity "${slug}"`} icon={<Layers className="w-6 h-6" />} iconTone="rose" />
      </div>
    );
  }
  if (!user.isOwner && !can(user, "system.view") && !can(user, "engineering.view") && !can(user, "ops.view")) {
    redirect("/login");
  }

  const records = await (prisma as any).customRecord.findMany({
    where: { entityId: entity.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return <CustomEntityClient entity={entity} initialRecords={records} />;
}
