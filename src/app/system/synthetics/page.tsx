import SyntheticsClient from "./SyntheticsClient";

export const metadata = {
  title: "Synthetic Pipeline Tester | System",
  description:
    "Continuous integration test runner executing automated 7-stage factory cycles: BOM Explosion → MRP → Work Orders → Kiosk → Subcontracting → AS9102 FAI → Job Costing",
};

export const dynamic = "force-dynamic";

export default function SyntheticsPage() {
  return <SyntheticsClient />;
}
