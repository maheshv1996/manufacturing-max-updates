import ObjectivesClient from "./ObjectivesClient";

export const dynamic = "force-dynamic";

export default function ObjectivesPage() {
  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <ObjectivesClient />
      </div>
    </div>
  );
}
