import JobCostingClient from "./JobCostingClient";

export const metadata = {
  title: "Actual vs Standard Job Costing Ledger | Finance",
  description:
    "Work order profitability, estimated BOM vs actual shopfloor consumption, and margin variance",
};

export const dynamic = "force-dynamic";

export default function JobCostingPage() {
  return <JobCostingClient />;
}
