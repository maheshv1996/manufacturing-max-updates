import AiAssistantClient from "./AiAssistantClient";

export const metadata = {
  title: "Shopfloor AI Copilot | Industrial Assistant",
  description:
    "Generative AI assistant grounded in live telemetry, work orders, AS9102 quality records, and 3D digital twins",
};

export const dynamic = "force-dynamic";

export default function AiAssistantPage() {
  return <AiAssistantClient />;
}
