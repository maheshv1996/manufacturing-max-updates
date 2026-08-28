import FixturesClient from "./FixturesClient";

export const dynamic = "force-dynamic";

export default function FixturesPage() {
  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <FixturesClient />
      </div>
    </div>
  );
}
