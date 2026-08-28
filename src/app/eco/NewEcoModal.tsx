"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function NewEcoModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    effectivityType: "DATE",
    effectivityValue: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/eco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        const data = await res.json();
        setIsOpen(false);
        router.push(`/eco/${data.eco.id}`);
      } else {
        alert("Failed to create ECO");
      }
    } catch (e) {
      console.error(e);
      alert("Error creating ECO");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4" />
        New ECO
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-md border border-slate-700 flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 className="text-lg font-bold">Raise New ECO</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:text-slate-300 rounded-full hover:bg-slate-800/90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100"
                  placeholder="e.g. Upgrade Valve Material"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100 min-h-[80px]"
                  placeholder="Reason for change..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Effectivity Type
                  </label>
                  <select
                    value={formData.effectivityType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        effectivityType: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100"
                  >
                    <option value="DATE">Date</option>
                    <option value="SERIAL">Serial Number</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Effectivity Value
                  </label>
                  <input
                    type={formData.effectivityType === "DATE" ? "date" : "text"}
                    required
                    value={formData.effectivityValue}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        effectivityValue: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100"
                    placeholder={
                      formData.effectivityType === "SERIAL" ? "e.g. SN-005" : ""
                    }
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800/90 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                >
                  {loading ? "Creating..." : "Create ECO"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
