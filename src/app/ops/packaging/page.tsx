import PackagingStation from "./PackagingStation";

export const metadata = {
  title: "Packaging Station | MES Operations",
  description:
    "Barcode scanning station for finished product packaging and shift tracking",
};

export const dynamic = "force-dynamic";

export default function PackagingPage() {
  return <PackagingStation />;
}
