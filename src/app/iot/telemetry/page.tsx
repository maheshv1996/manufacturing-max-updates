import TelemetryClient from "./TelemetryClient";

export const metadata = {
  title: "Real-Time Sensor Telemetry Historian | IIoT",
  description:
    "High-frequency edge waveform streams, spindle dynamics, vibration velocity, and anomaly limits",
};

export const dynamic = "force-dynamic";

export default function TelemetryPage() {
  return <TelemetryClient />;
}
