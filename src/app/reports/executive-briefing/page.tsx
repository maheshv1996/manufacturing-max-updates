import ExecutiveBriefingClient from "./ExecutiveBriefingClient";

export const metadata = {
  title: "Executive Monthly Briefing | Management",
  description:
    "Consolidated executive report: Financial margin waterfalls, plant composite OEE, AS9102 aerospace quality yield, and department health scorecards",
};

export const dynamic = "force-dynamic";

export default function ExecutiveBriefingPage() {
  return <ExecutiveBriefingClient />;
}
