"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
} from "lucide-react";

const CATEGORIES = [
  { key: "SORT", label: "1S — Sort" },
  { key: "SET_IN_ORDER", label: "2S — Set in Order" },
  { key: "SHINE", label: "3S — Shine" },
  { key: "STANDARDIZE", label: "4S — Standardize" },
  { key: "SUSTAIN", label: "5S — Sustain" },
];

export default function FiveSChecklistTab() {
  const [activeCategory, setActiveCategory] = useState<string>("SORT");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  // Edit/Add modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    initialData: any | null;
    category: string;
    text: string;
  }>({
    isOpen: false,
    initialData: null,
    category: "SORT",
    text: "",
  });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/fives");
      if (res.ok) {
        const json = await res.json();
        setItems(json.items || []);
      }
    } catch (err) {
      logClientError(err, "FiveSChecklistTab");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const categoryItems = items
    .filter((i) => i.category === activeCategory)
    .sort((a, b) => a.seq - b.seq);

  const handleReorder = async (index: number, direction: "up" | "down") => {
    const newItems = [...categoryItems];
    const targetIdx = direction === "up" ? index - 1 : index + 1;

    if (targetIdx < 0 || targetIdx >= newItems.length) return;

    // Swap items
    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;

    // Reassign seq
    const updatedSeqItems = newItems.map((item, idx) => ({
      ...item,
      seq: idx + 1,
    }));

    // Update local state
    setItems((prev) =>
      prev.map((i) => {
        const match = updatedSeqItems.find((u) => u.id === i.id);
        return match ? match : i;
      }),
    );

    try {
      await fetch("/api/fives/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorder",
          items: updatedSeqItems.map((i) => ({ id: i.id, seq: i.seq })),
        }),
      });
    } catch (err) {
      logClientError("Failed to reorder 5S items:", err, "FiveSChecklistTab");
      fetchItems();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this checklist item?"))
      return;

    try {
      const res = await fetch("/api/fives/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      if (res.ok) {
        fetchItems();
      }
    } catch (err) {
      logClientError("Failed to delete item:", err, "FiveSChecklistTab");
    }
  };

  const handleOpenAdd = () => {
    setModalState({
      isOpen: true,
      initialData: null,
      category: activeCategory,
      text: "",
    });
  };

  const handleOpenEdit = (item: any) => {
    setModalState({
      isOpen: true,
      initialData: item,
      category: item.category,
      text: item.text,
    });
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const isEdit = Boolean(modalState.initialData);
      const res = await fetch("/api/fives/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isEdit ? "update" : "create",
          id: modalState.initialData?.id,
          category: modalState.category,
          text: modalState.text.trim(),
        }),
      });

      if (res.ok) {
        setModalState((prev) => ({ ...prev, isOpen: false }));
        fetchItems();
      } else {
        alert("Failed to save item");
      }
    } catch (err) {
      logClientError(err, "FiveSChecklistTab");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs & Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider transition-all ${
                activeCategory === cat.key
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Item to {activeCategory}
        </button>
      </div>

      {/* Items Table */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : categoryItems.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 rounded-xl border border-slate-800">
          <p className="text-slate-400">
            No 5S items found for {activeCategory}.
          </p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-800/50 text-slate-300 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Seq</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Checklist Text</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {categoryItems.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono font-bold text-slate-400">
                      #{item.seq}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-slate-800 rounded border border-slate-700 text-xs font-mono text-cyan-300 font-bold">
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white max-w-lg truncate">
                      {item.text}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleReorder(idx, "up")}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded border border-slate-700 transition-colors"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === categoryItems.length - 1}
                        onClick={() => handleReorder(idx, "down")}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 rounded border border-slate-700 transition-colors"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg transition-colors border border-slate-700 text-xs font-bold"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 rounded-lg transition-colors border border-rose-800/60 text-xs font-bold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white">
                {modalState.initialData
                  ? "Edit 5S Item"
                  : "Add 5S Checklist Item"}
              </h3>
              <button
                onClick={() =>
                  setModalState((prev) => ({ ...prev, isOpen: false }))
                }
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Category *
                </label>
                <select
                  value={modalState.category}
                  onChange={(e) =>
                    setModalState((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1">
                  Checklist Question / Criterion *
                </label>
                <textarea
                  rows={3}
                  required
                  value={modalState.text}
                  onChange={(e) =>
                    setModalState((prev) => ({ ...prev, text: e.target.value }))
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-medium focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Machine surfaces, guards, and touchpoints are clean..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() =>
                    setModalState((prev) => ({ ...prev, isOpen: false }))
                  }
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
