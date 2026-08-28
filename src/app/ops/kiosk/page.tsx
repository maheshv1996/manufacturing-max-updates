import KioskClient from "./KioskClient";

export const metadata = {
  title: "Shopfloor Tablet Kiosk Mode | Operations",
  description:
    "Rugged touch terminal optimized for glove-operated tablets: 1-touch piece clocking, scrap logging, and Andon emergency calls",
};

export const dynamic = "force-dynamic";

export default function KioskPage() {
  return <KioskClient />;
}
