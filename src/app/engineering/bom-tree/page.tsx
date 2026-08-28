import BomTreeClient from "./BomTreeClient";

export const metadata = {
  title: "Multi-Level BOM Tree & Cost Exploder | Engineering",
  description:
    "Interactive multi-level bill of materials hierarchy, raw material explosion and rollup costing",
};

export const dynamic = "force-dynamic";

export default function BomTreePage() {
  return <BomTreeClient />;
}
