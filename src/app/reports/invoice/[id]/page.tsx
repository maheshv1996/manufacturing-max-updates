import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { numberToIndianWords } from "@/lib/invoicingEngine";
import InvoicePrintClient from "./InvoicePrintClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [invoice, settings] = await Promise.all([
    (prisma as any).invoice.findUnique({
      where: { id },
      include: {
        dispatchRecord: true,
        workOrder: {
          include: { product: true },
        },
      },
    }),
    getSettings(),
  ]);

  if (!invoice) {
    notFound();
  }

  const totalWords = numberToIndianWords(invoice.totalValue);

  return (
    <InvoicePrintClient
      invoice={JSON.parse(JSON.stringify(invoice))}
      branding={settings.branding}
      totalWords={totalWords}
    />
  );
}
