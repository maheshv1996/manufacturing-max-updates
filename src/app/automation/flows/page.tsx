import FlowsClient from "./FlowsClient";

export const metadata = {
  title: "Visual Flow Automation Studio | Node-RED Engine",
  description:
    "Wire together IIoT triggers, threshold conditions, and native MES actions: Maintenance dispatch, Quality NCRs, and Audio chimes",
};

export const dynamic = "force-dynamic";

export default function FlowsPage() {
  return <FlowsClient />;
}
