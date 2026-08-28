import ReliabilityClient from "./ReliabilityClient";

export const metadata = {
  title: "TPM & Machine Reliability Dashboard | Maintenance",
  description:
    "Total Productive Maintenance, MTBF, MTTR, PM Schedules, and Work Order Kanban",
};

export const dynamic = "force-dynamic";

export default function ReliabilityPage() {
  return <ReliabilityClient />;
}
