import SchemasClient from "./SchemasClient";

export const metadata = {
  title: "Industrial Schema Validator & Metric Registry | Factory+",
  description:
    "Official AMRC Factory+ JSON Schema repository: Standardized metrics for CNC Milling, CMM Metrology, and Cleanrooms with live validation",
};

export const dynamic = "force-dynamic";

export default function SchemasPage() {
  return <SchemasClient />;
}
