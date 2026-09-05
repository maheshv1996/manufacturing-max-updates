"use client";

import { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { UserPreferences, KpiCardConfig, SectionConfig } from "@/lib/userPrefs";
import { v4 as uuidv4 } from "uuid";

export default function DashboardCustomizer({
  isOpen,
  onClose,
  prefs,
  onUpdatePrefs,
}: {
  isOpen: boolean;
  onClose: () => void;
  prefs: UserPreferences;
  onUpdatePrefs: (p: UserPreferences) => void;
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);
  const activeView = prefs.activeViewId
    ? prefs.views.find((v) => v.id === prefs.activeViewId)
    : null;
  const initialCards = activeView?.kpiCards ||
    (prefs as any).kpiCards || [
      { id: "oee", visible: true, order: 0 },
      { id: "output", visible: true, order: 1 },
      { id: "downtime", visible: true, order: 2 },
      { id: "scrap", visible: true, order: 3 },
      { id: "mttr", visible: false, order: 4 },
      { id: "fpy", visible: false, order: 5 },
    ];
  const initialSections = activeView?.sections ||
    (prefs as any).sections || {
      digest: true,
      oeeTrend: true,
      downtimePareto: true,
      categoryDonut: true,
      championTeaser: true,
      recentDowntime: true,
    };

  const [cards, setCards] = useState<KpiCardConfig[]>(initialCards);
  const [sections, setSections] = useState<SectionConfig>(initialSections);
  const [viewName, setViewName] = useState("");
  const [isSavingAs, setIsSavingAs] = useState(false);

  if (!isOpen) return null;

  const handleToggleCard = (id: string) => {
    setCards(
      cards.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)),
    );
  };

  const handleMoveCard = (index: number, direction: number) => {
    if (index + direction < 0 || index + direction >= cards.length) return;
    const newCards = [...cards];
    const temp = newCards[index];
    newCards[index] = newCards[index + direction];
    newCards[index + direction] = temp;

    // Update order property
    newCards.forEach((c, i) => (c.order = i));
    setCards(newCards);
  };

  const handleToggleSection = (key: keyof SectionConfig) => {
    setSections({ ...sections, [key]: !sections[key] });
  };

  const handleSave = () => {
    if (prefs.activeViewId) {
      // Update existing view
      const updatedViews = prefs.views.map((v) =>
        v.id === prefs.activeViewId ? { ...v, kpiCards: cards, sections } : v,
      );
      onUpdatePrefs({ ...prefs, views: updatedViews });
    } else {
      // Update root level prefs (default)
      onUpdatePrefs({ ...prefs, kpiCards: cards, sections } as any);
    }
  };

  const handleSaveAs = () => {
    if (!viewName.trim()) return;
    const newView = {
      id: uuidv4(),
      name: viewName,
      kpiCards: cards,
      sections,
    };
    onUpdatePrefs({
      ...prefs,
      views: [...prefs.views, newView],
      activeViewId: newView.id,
    });
    setIsSavingAs(false);
    setViewName("");
  };

  const handleSwitchView = (id: string | null) => {
    onUpdatePrefs({ ...prefs, activeViewId: id });
  };

  const handleDeleteView = (id: string) => {
    const updatedViews = prefs.views.filter((v) => v.id !== id);
    onUpdatePrefs({
      ...prefs,
      views: updatedViews,
      activeViewId: prefs.activeViewId === id ? null : prefs.activeViewId,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dashboard-customizer-title"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm"
    >
      <div className="w-full max-w-md h-full bg-slate-800/60 border-l border-slate-700 shadow-xl overflow-y-auto">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800/60 z-10">
          <h2 id="dashboard-customizer-title" className="text-lg font-bold">Customize Dashboard</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close customizer"
            className="p-2 hover:bg-slate-800/90 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* View Management */}
          <div>
            <h3 className="font-bold text-white mb-3">Active View</h3>
            <div className="flex gap-2 mb-4">
              <select
                aria-label="Active View"
                className="flex-1 p-2 border border-slate-600 rounded-lg bg-slate-800/60"
                value={prefs.activeViewId || ""}
                onChange={(e) => handleSwitchView(e.target.value || null)}
              >
                <option value="">Default View</option>
                {prefs.views.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              {prefs.activeViewId && (
                <button
                  type="button"
                  onClick={() => handleDeleteView(prefs.activeViewId!)}
                  className="px-3 py-2 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 hover:bg-rose-900/30"
                >
                  Delete
                </button>
              )}
            </div>

            {isSavingAs ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="View name..."
                  className="flex-1 p-2 border border-slate-600 rounded-lg bg-transparent"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSaveAs}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg font-medium"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingAs(false)}
                  className="px-3 py-2 text-slate-500"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSavingAs(true)}
                className="text-sm font-medium text-blue-400 hover:underline"
              >
                + Save current layout as...
              </button>
            )}
          </div>

          <hr className="border-slate-700" />

          {/* KPI Cards */}
          <div>
            <h3 className="font-bold text-white mb-3">
              KPI Cards (Order & Visibility)
            </h3>
            <div className="space-y-2">
              {cards.map((c, idx) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-600 rounded-lg"
                >
                  <div className="flex flex-col gap-1 cursor-pointer opacity-50 hover:opacity-100">
                    <button
                      type="button"
                      aria-label={`Move ${c.id} up`}
                      onClick={() => handleMoveCard(idx, -1)}
                      disabled={idx === 0}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${c.id} down`}
                      onClick={() => handleMoveCard(idx, 1)}
                      disabled={idx === cards.length - 1}
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    type="checkbox"
                    aria-label={`Show ${c.id} card`}
                    checked={c.visible}
                    onChange={() => handleToggleCard(c.id)}
                    className="w-4 h-4"
                  />
                  <span className="font-medium capitalize">{c.id}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sections */}
          <div>
            <h3 className="font-bold text-white mb-3">Sections</h3>
            <div className="space-y-3">
              {Object.entries(sections).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center gap-3 p-3 bg-slate-800/60 border border-slate-600 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={() =>
                      handleToggleSection(key as keyof SectionConfig)
                    }
                    className="w-4 h-4"
                  />
                  <span className="font-medium capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full flex justify-center items-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-colors"
          >
            <Save className="w-5 h-5" />
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
