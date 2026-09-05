"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";

export default function AddEcoItemModal({
  ecoId,
  products,
}: {
  ecoId: string;
  products: any[];
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    productId: products[0]?.id || "",
    entityType: "BOM",
    action: "ADD",
    notes: "",
    oldData: "",
    newData: "",
  });

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        oldData: formData.oldData ? JSON.parse(formData.oldData) : null,
        newData: formData.newData ? JSON.parse(formData.newData) : null,
      };

      const res = await fetch(`/api/eco/${ecoId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsOpen(false);
        router.refresh();
        setFormData({ ...formData, notes: "", oldData: "", newData: "" });
      } else {
        alert("Failed to add item");
      }
    } catch (e) {
      logClientError(e, "AddEcoItemModal");
      alert("Error adding item or invalid JSON in Old/New Data");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 hover:bg-indigo-500/20 text-indigo-400 text-sm font-semibold rounded-xl transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Add Item
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-eco-item-title"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-800/60 rounded-2xl shadow-xl w-full max-w-lg border border-slate-700 flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <h2 id="add-eco-item-title" className="text-lg font-bold">Add Change Item</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close add change item dialog"
                className="p-1 text-slate-400 hover:text-slate-600 hover:text-slate-300 rounded-full hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-5 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Product
                </label>
                <select
                  required
                  value={formData.productId}
                  onChange={(e) =>
                    setFormData({ ...formData, productId: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Entity Type
                  </label>
                  <select
                    value={formData.entityType}
                    onChange={(e) =>
                      setFormData({ ...formData, entityType: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100"
                  >
                    <option value="BOM">BOM</option>
                    <option value="DRAWING">DRAWING</option>
                    <option value="ROUTING">ROUTING</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Action
                  </label>
                  <select
                    value={formData.action}
                    onChange={(e) =>
                      setFormData({ ...formData, action: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100"
                  >
                    <option value="ADD">ADD</option>
                    <option value="REPLACE">REPLACE</option>
                    <option value="REMOVE">REMOVE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100"
                  placeholder="Optional details about this specific item"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Old Data (JSON)
                </label>
                <textarea
                  value={formData.oldData}
                  onChange={(e) =>
                    setFormData({ ...formData, oldData: e.target.value })
                  }
                  className="w-full font-mono text-xs px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100 min-h-[80px]"
                  placeholder='{"id": "...", "qty": 1}'
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  New Data (JSON)
                </label>
                <textarea
                  value={formData.newData}
                  onChange={(e) =>
                    setFormData({ ...formData, newData: e.target.value })
                  }
                  className="w-full font-mono text-xs px-3 py-2 border border-slate-600 rounded-lg bg-slate-800/60 text-slate-100 min-h-[80px]"
                  placeholder='{"qty": 2}'
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
