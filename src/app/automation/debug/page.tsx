import DebugConsoleClient from "./DebugConsoleClient";

export const metadata = {
  title: "Node-RED Real-Time Debug Wire | Automation",
  description:
    "Streaming telemetry evaluation logs, threshold triggers, action dispatch records, and sub-millisecond execution latencies",
};

export const dynamic = "force-dynamic";

export default function DebugPage() {
  return <DebugConsoleClient />;
}
