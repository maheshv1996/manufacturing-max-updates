import FleetRadarClient from "./FleetRadarClient";

export const metadata = {
  title: "Supply Chain Fleet Radar | Logistics",
  description:
    "Real-time multi-modal logistics tracking: Inbound raw materials, outward subcontracting challans, and aerospace customer dispatches",
};

export const dynamic = "force-dynamic";

export default function FleetRadarPage() {
  return <FleetRadarClient />;
}
