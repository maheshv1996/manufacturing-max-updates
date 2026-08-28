import UnsExplorerClient from "./UnsExplorerClient";

export const metadata = {
  title: "ISA-95 Unified Namespace (UNS) Live Explorer | IIoT",
  description:
    "Standardized industrial IoT topic tree, MQTT edge topics, and real-time process value inspector",
};

export const dynamic = "force-dynamic";

export default function UnsPage() {
  return <UnsExplorerClient />;
}
