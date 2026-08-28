import DirectoryClient from "./DirectoryClient";

export const metadata = {
  title: "Factory+ Asset Directory & Device Catalog | Factory+",
  description:
    "Centralized UUID-indexed registry of Edge Gateways, CNC Machine Tools, CMM Metrology, and Sensors linked to standardized JSON schemas",
};

export const dynamic = "force-dynamic";

export default function DirectoryPage() {
  return <DirectoryClient />;
}
