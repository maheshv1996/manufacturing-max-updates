import RecipesClient from "./RecipesClient";

export const metadata = {
  title: "Industrial Automation Recipe Catalog | Automation",
  description:
    "Pre-packaged edge recipes: Thermal runaway protection, ISO 10816 vibration quality gates, and milestone acoustic synths",
};

export const dynamic = "force-dynamic";

export default function RecipesPage() {
  return <RecipesClient />;
}
