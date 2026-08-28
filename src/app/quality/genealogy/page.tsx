import GenealogyClient from "./GenealogyClient";

export const metadata = {
  title: "360° Serial & Lot Genealogy Traceability | Quality",
  description:
    "End-to-end upstream & downstream tracking: Raw Material Heat Lots, CNC Machining, Special Processes, FAI QC, and Customer Invoices",
};

export const dynamic = "force-dynamic";

export default function GenealogyPage() {
  return <GenealogyClient />;
}
