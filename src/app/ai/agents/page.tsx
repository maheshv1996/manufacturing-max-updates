import AgentsClient from "./AgentsClient";
import { AGENT_REGISTRY } from "@/app/api/ai/agents/route";

export const metadata = {
  title: "Autonomous Multi-Agent Hub | Manufacturing Max",
  description:
    "Deploy specialized goal-driven AI agents across machine diagnostics, procurement, aerospace quality, and energy management.",
};

export default function AgentsPage() {
  return <AgentsClient initialAgents={AGENT_REGISTRY} />;
}
