import SubcontractingClient from "./SubcontractingClient";

export const metadata = {
  title: "Subcontracting & Special Process Outsourcing | Supply Chain",
  description:
    "Manage special process vendor delivery challans (Heat Treatment, Anodizing, Plating, NDT) and inward QC verification",
};

export const dynamic = "force-dynamic";

export default function SubcontractingPage() {
  return <SubcontractingClient />;
}
