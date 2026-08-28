import CellTwinClient from "./CellTwinClient";

export const metadata = {
  title: "3D Digital Twin & Workcell Visualizer | Digital Twin",
  description:
    "Physics-based industrial cell simulation: Spindle dynamics, 6-axis robot handling, infeed conveyors, and real-time telemetry HUD",
};

export const dynamic = "force-dynamic";

export default function CellTwinPage() {
  return <CellTwinClient />;
}
