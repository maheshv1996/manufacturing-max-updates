"use client";


import { logClientError } from "@/lib/clientLogger";
import { useState, useEffect } from "react";
import {
  Zap,
  ShieldCheck,
  Wrench,
  Volume2,
  Leaf,
  RefreshCw,
} from "lucide-react";
import PageHeader from "@/app/components/shared/PageHeader";

interface Recipe {
  id: string;
  name: string;
  category: string;
  description: string;
  trigger: string;
  action: string;
  status: "ENABLED" | "DISABLED";
  triggersCount24h: number;
  lastTriggered?: string | null;
  tags: string[];
}

export default function RecipesClient() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stats, setStats] = useState({
    totalRecipes: 0,
    enabledRecipes: 0,
    totalTriggers24h: 0,
  });
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [_loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/automation/recipes");
      if (res.ok) {
        const data = await res.json();
        setRecipes(data.recipes || []);
        setStats(
          data.stats || {
            totalRecipes: 0,
            enabledRecipes: 0,
            totalTriggers24h: 0,
          },
        );
      }
    } catch (err) {
      logClientError("Failed to load recipes:", err, "RecipesClient");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggle = async (
    recipeId: string,
    currentStatus: "ENABLED" | "DISABLED",
  ) => {
    const newStatus = currentStatus === "ENABLED" ? "DISABLED" : "ENABLED";
    setTogglingId(recipeId);
    try {
      const res = await fetch("/api/automation/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeId, status: newStatus }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      logClientError("Toggle error:", err, "RecipesClient");
    } finally {
      setTogglingId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category.includes("MAINTENANCE") || category.includes("SAFETY"))
      return <Wrench className="w-4 h-4 text-rose-400" />;
    if (category.includes("QUALITY"))
      return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
    if (category.includes("AUDIO"))
      return <Volume2 className="w-4 h-4 text-purple-400" />;
    if (category.includes("ENERGY"))
      return <Leaf className="w-4 h-4 text-lime-400" />;
    return <Zap className="w-4 h-4 text-amber-400" />;
  };

  const filteredRecipes = recipes.filter((r) => {
    if (filterCategory === "ALL") return true;
    if (filterCategory === "SAFETY")
      return (
        r.category.includes("SAFETY") || r.category.includes("MAINTENANCE")
      );
    if (filterCategory === "QUALITY") return r.category.includes("QUALITY");
    if (filterCategory === "ENERGY") return r.category.includes("ENERGY");
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Industrial Automation Recipe & Rule Catalog"
        description="Pre-packaged edge recipes: Thermal runaway protection, ISO 10816 vibration quality gates, and milestone acoustic synths."
      >
        <button
          onClick={fetchData}
          className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-text-1 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </PageHeader>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Total Recipes
          </span>
          <div className="text-2xl font-black font-mono text-cyan-400 mt-1">
            {stats.totalRecipes} Recipes
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Industrial pre-packaged automations
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Active Rules Running
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400 mt-1 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{stats.enabledRecipes} Enabled</span>
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Live on shop floor edge nodes
          </div>
        </div>

        <div className="bg-surface-1 border border-border rounded-2xl p-5 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-text-3">
            Events Triggered (24h)
          </span>
          <div className="text-2xl font-black font-mono text-amber-400 mt-1">
            {stats.totalTriggers24h} Dispatched
          </div>
          <div className="text-[11px] text-text-3 mt-0.5">
            Safety & QC automated actions
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-surface-1 p-1.5 rounded-2xl border border-border w-fit overflow-x-auto">
        <button
          onClick={() => setFilterCategory("ALL")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterCategory === "ALL"
              ? "bg-accent text-white shadow-sm"
              : "text-text-3 hover:text-text-1"
          }`}
        >
          All Recipes ({recipes.length})
        </button>
        <button
          onClick={() => setFilterCategory("SAFETY")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterCategory === "SAFETY"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-text-3 hover:text-text-1"
          }`}
        >
          Safety & Maintenance
        </button>
        <button
          onClick={() => setFilterCategory("QUALITY")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterCategory === "QUALITY"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-text-3 hover:text-text-1"
          }`}
        >
          Quality & Metrology
        </button>
        <button
          onClick={() => setFilterCategory("ENERGY")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filterCategory === "ENERGY"
              ? "bg-lime-600 text-white shadow-sm"
              : "text-text-3 hover:text-text-1"
          }`}
        >
          Energy & Coolant
        </button>
      </div>

      {/* Recipe Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredRecipes.map((r) => {
          const isEnabled = r.status === "ENABLED";

          return (
            <div
              key={r.id}
              className={`bg-surface-1 border rounded-3xl p-6 shadow-sm space-y-4 transition-all ${
                isEnabled
                  ? "border-border hover:border-accent/40"
                  : "border-border/40 opacity-70"
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-surface-2 border border-border">
                      {getCategoryIcon(r.category)}
                    </div>
                    <h3 className="font-extrabold text-sm text-text-1">
                      {r.name}
                    </h3>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => handleToggle(r.id, r.status)}
                  disabled={togglingId === r.id}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer font-mono ${
                    isEnabled
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-surface-2 text-text-3 border border-border"
                  }`}
                >
                  {togglingId === r.id
                    ? "Updating..."
                    : isEnabled
                      ? "ENABLED"
                      : "DISABLED"}
                </button>
              </div>

              <p className="text-xs text-text-2">{r.description}</p>

              {/* Trigger & Action Flow Box */}
              <div className="p-3.5 rounded-2xl bg-surface-2 border border-border/80 space-y-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="font-bold">{r.trigger}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="font-bold">{r.action}</span>
                </div>
              </div>

              {/* Tags & Stats Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-text-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {r.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-surface-2 border border-border text-[10px] font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="font-mono">
                  Triggers 24h:{" "}
                  <span className="font-bold text-text-1">
                    {r.triggersCount24h}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
