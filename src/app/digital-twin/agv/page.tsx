import AgvFleetClient from "./AgvFleetClient";

export const metadata = {
  title:
    "Intralogistics AGV & Automated Storage (AS/RS) Monitor | Digital Twin",
  description:
    "Autonomous Guided Vehicle (AGV) fleet routing, real-time telemetry, battery health, and high-bay AS/RS warehouse utilization",
};

export const dynamic = "force-dynamic";

export default function AgvPage() {
  return <AgvFleetClient />;
}
