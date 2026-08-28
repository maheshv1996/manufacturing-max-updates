import EcoDiffClient from "./EcoDiffClient";

export const metadata = {
  title: "Visual Engineering Change Order (ECO) Diff | Engineering",
  description:
    "Side-by-side BOM and Routing revision comparison with multi-stakeholder electronic signatures",
};

export const dynamic = "force-dynamic";

export default function EcoDiffPage() {
  return <EcoDiffClient />;
}
