/**
 * C6-4 — Fixed-asset depreciation engine (v2 wrapper).
 * Reuses the v1 pure engine from ./fixedAssets with v2-aligned types.
 */

import {
  monthDepreciation as v1MonthDepreciation,
  generateSchedule as v1GenerateSchedule,
  monthKey as v1MonthKey,
  monthsBetween as v1MonthsBetween,
  periodLabel as v1PeriodLabel,
  type ScheduleRow as V1ScheduleRow,
} from "../fixedAssets";

export interface FixedAssetInput {
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: "STRAIGHT_LINE" | "WDV";
  purchaseDate: Date;
}

export interface DepreciationScheduleRow {
  period: string;
  amount: number;
  bookValueAfter: number;
}

export function monthDepreciation(
  asset: FixedAssetInput,
  period: string,
  accumulated: number,
): number {
  return v1MonthDepreciation(
    {
      cost: asset.cost,
      salvageValue: asset.salvageValue,
      usefulLifeMonths: asset.usefulLifeMonths,
      method: asset.method,
      purchaseDate: asset.purchaseDate,
    },
    period,
    accumulated,
  );
}

export function generateSchedule(asset: FixedAssetInput, upToPeriod: string): DepreciationScheduleRow[] {
  const rows = v1GenerateSchedule(
    {
      cost: asset.cost,
      salvageValue: asset.salvageValue,
      usefulLifeMonths: asset.usefulLifeMonths,
      method: asset.method,
      purchaseDate: asset.purchaseDate,
    },
    upToPeriod,
  );
  return rows.map((r: V1ScheduleRow) => ({
    period: r.period,
    amount: r.amount,
    bookValueAfter: r.bookValueAfter,
  }));
}

export { v1MonthKey as monthKey, v1MonthsBetween as monthsBetween, v1PeriodLabel as periodLabel };
