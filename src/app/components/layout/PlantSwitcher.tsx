"use client";


import { logClientError } from "@/lib/clientLogger";
import { offlineFetchWrapper } from "@/lib/offlineSync";
import { can } from "@/lib/permissions";

import { useState, useEffect } from "react";
import { Factory, ChevronDown } from "lucide-react";
import { DEFAULT_PREFERENCES } from "@/lib/userPrefs";
import { useRouter } from "next/navigation";

export default function PlantSwitcher({ user }: { user: any }) {
  const router = useRouter();
  const [plants, setPlants] = useState<any[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState<string>("ALL");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [plantsRes, prefsRes] = await Promise.all([
          fetch("/api/plants"),
          fetch("/api/user/prefs"),
        ]);

        if (plantsRes.ok) {
          const pData = await plantsRes.json();
          setPlants(pData.plants || []);
        }

        if (prefsRes.ok) {
          const prData = await prefsRes.json();
          if (prData.prefs?.selectedPlantId) {
            setSelectedPlantId(prData.prefs.selectedPlantId);
          } else {
            setSelectedPlantId("ALL");
          }
        }
      } catch (err) {
        logClientError("Failed to load plant switcher data", err, "PlantSwitcher");
      } finally {
        setLoading(false);
      }
    }
    if (user?.isOwner || can(user, "ops.view")) {
      loadData();
    }
  }, [user]);

  if (!user || (!user.isOwner && !can(user, "ops.view"))) {
    return null; // Operators don't see this
  }

  if (loading) {
    return <div className="h-8 w-32 bg-slate-800 rounded animate-pulse" />;
  }

  const handleSelect = async (plantId: string) => {
    setSelectedPlantId(plantId);
    setIsOpen(false);

    try {
      // Fetch current prefs first
      const currentRes = await fetch("/api/user/prefs");
      const currentData = await currentRes.json();
      const updatedPrefs = {
        ...DEFAULT_PREFERENCES,
        ...(currentData.prefs || {}),
      };
      updatedPrefs.selectedPlantId = plantId;

      await offlineFetchWrapper("/api/user/prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedPrefs),
      });

      // Refresh the page to apply new plant scope globally
      router.refresh();
      // Sometimes router.refresh isn't enough to force a hard reload of all data
      window.location.reload();
    } catch (err) {
      logClientError("Failed to update selected plant", err, "PlantSwitcher");
    }
  };

  const activePlantName =
    selectedPlantId === "ALL"
      ? "All Plants"
      : plants.find((p) => p.id === selectedPlantId)?.name || "Unknown Plant";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm font-medium text-slate-200 transition-colors"
      >
        <Factory className="w-4 h-4 text-accent" />
        <span className="truncate max-w-[150px]">{activePlantName}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden py-1 z-50">
          {(user?.isOwner || can(user, "system.view")) && (
            <>
              <button
                onClick={() => handleSelect("ALL")}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${
                  selectedPlantId === "ALL"
                    ? "bg-accent/10 text-accent"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Factory className="w-4 h-4" />
                All Plants
              </button>
              <div className="h-px bg-slate-800 my-1" />
            </>
          )}

          {plants.map((plant) => (
            <button
              key={plant.id}
              onClick={() => handleSelect(plant.id)}
              className={`w-full text-left px-4 py-2 text-sm font-medium flex items-center gap-2 ${
                selectedPlantId === plant.id
                  ? "bg-accent/10 text-accent"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span className="w-4 text-xs font-mono text-slate-500">
                {plant.code || "PL"}
              </span>
              {plant.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
