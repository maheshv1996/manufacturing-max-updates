import PpapClient from "./PpapClient";

export const dynamic = "force-dynamic";

export default function PpapPage() {
  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <PpapClient />
      </div>
    </div>
  );
}
