import VoiceTerminalClient from "./VoiceTerminalClient";

export const metadata = {
  title: "Shopfloor Voice Terminal | Operations",
  description:
    "Acoustic voice synthesis & hands-free speech recognition: 1-spoken piece clocking, Andon radio dispatches, and telemetry lookups",
};

export const dynamic = "force-dynamic";

export default function VoicePage() {
  return <VoiceTerminalClient />;
}
