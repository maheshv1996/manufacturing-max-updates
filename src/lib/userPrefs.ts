export type KpiCardId =
  "oee" | "output" | "downtime" | "scrap" | "mttr" | "fpy" | "capacity";

export interface KpiCardConfig {
  id: KpiCardId;
  visible: boolean;
  order: number;
}

export interface SectionConfig {
  digest: boolean;
  oeeTrend: boolean;
  downtimePareto: boolean;
  categoryDonut: boolean;
  championTeaser: boolean;
  recentDowntime: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  kpiCards: KpiCardConfig[];
  sections: SectionConfig;
}

export interface UserPreferences {
  landingPage: string;
  activeViewId: string | null;
  selectedPlantId?: string; // "ALL" or specific plant id
  views: SavedView[];
}

export const DEFAULT_KPI_CARDS: KpiCardConfig[] = [
  { id: "oee", visible: true, order: 0 },
  { id: "output", visible: true, order: 1 },
  { id: "downtime", visible: true, order: 2 },
  { id: "scrap", visible: true, order: 3 },
  { id: "mttr", visible: false, order: 4 },
  { id: "fpy", visible: false, order: 5 },
  { id: "capacity", visible: false, order: 6 },
];

export const DEFAULT_SECTIONS: SectionConfig = {
  digest: true,
  oeeTrend: true,
  downtimePareto: true,
  categoryDonut: true,
  championTeaser: true,
  recentDowntime: true,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  landingPage: "/",
  activeViewId: null,
  selectedPlantId: "ALL",
  views: [],
};
