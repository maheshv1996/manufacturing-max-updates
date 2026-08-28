import GatewayClient from "./GatewayClient";

export const metadata = {
  title: "MQTT / OPC-UA Edge Gateway & Ingestion | IIoT",
  description:
    "UMH Core edge daemon, Benthos streaming pipelines, and MQTT test payload injector",
};

export const dynamic = "force-dynamic";

export default function GatewayPage() {
  return <GatewayClient />;
}
