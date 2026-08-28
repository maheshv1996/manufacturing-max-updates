import PredictiveClient from "./PredictiveClient";

export const metadata = {
  title: "Predictive Maintenance & Spindle RUL | Maintenance",
  description:
    "Machine learning degradation forecasting: Weibull failure probability, ISO 10816 vibration trajectory, and preemptive bearing replacement",
};

export const dynamic = "force-dynamic";

export default function PredictivePage() {
  return <PredictiveClient />;
}
