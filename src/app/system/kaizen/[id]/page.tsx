import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import KaizenDetailClient from "./KaizenDetailClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function KaizenDetailPage({ params }: PageProps) {
  const { id } = await params;

  const project = await prisma.improvementProject.findUnique({
    where: { id },
    include: {
      machine: { select: { name: true, code: true } },
      rcaRecord: true,
      actionItems: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!project) notFound();

  // Serialize dates to strings for client component
  const serialized = {
    ...project,
    createdAt: project.createdAt.toISOString(),
    completedAt: project.completedAt?.toISOString() ?? null,
    updatedAt: project.updatedAt.toISOString(),
    rcaRecord: project.rcaRecord
      ? {
          ...project.rcaRecord,
          updatedAt: project.rcaRecord.updatedAt.toISOString(),
        }
      : null,
    actionItems: project.actionItems.map((a) => ({
      ...a,
      dueDate: a.dueDate.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <Link
          href="/system/kaizen"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>

        <KaizenDetailClient
          project={
            serialized as Parameters<typeof KaizenDetailClient>[0]["project"]
          }
        />
      </div>
    </div>
  );
}
