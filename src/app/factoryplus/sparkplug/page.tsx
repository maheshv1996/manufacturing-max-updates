import SparkplugClient from "./SparkplugClient";

export const metadata = {
  title: "MQTT Sparkplug B Node & Device Manager | Factory+",
  description:
    "AMRC Factory+ Report-by-Exception protocol: DBIRTH/DDEATH certificates, metric alias compression, and sequence integrity tracking",
};

export const dynamic = "force-dynamic";

export default function SparkplugPage() {
  return <SparkplugClient />;
}
