import CommissioningClient from "./CommissioningClient";

export const metadata = {
  title: "Virtual Commissioning & PLC Simulator | Digital Twin",
  description:
    "Hardware-in-the-loop simulation: Digital Inputs (DI), Actuator Outputs (DO), Analog Transducers, and Live Ladder Rungs",
};

export const dynamic = "force-dynamic";

export default function CommissioningPage() {
  return <CommissioningClient />;
}
