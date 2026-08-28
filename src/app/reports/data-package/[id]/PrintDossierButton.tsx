"use client";

export default function PrintDossierButton() {
  return (
    <div className="fixed bottom-8 right-8 no-print">
      <button
        onClick={() => window.print()}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-full shadow-lg font-bold text-lg transition-transform hover:scale-105"
      >
        Print Dossier
      </button>
    </div>
  );
}
