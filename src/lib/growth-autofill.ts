/**
 * Sentinel growth autofill.
 *
 * The daily checklist pre-fills the 10 fixed plants from the newest measurement
 * already on record. "Newest" includes a check submitted earlier on the same day,
 * so re-opening the form after a morning entry continues from that entry instead
 * of jumping back to yesterday.
 */

export type GrowthMeasurementRow = {
  plant_no: number;
  measured_on: string;
  created_at?: string | null;
  height_cm: number | null;
  leaf_count: number | null;
  variety: string | null;
  pot_id: string | null;
};

/** Enough rows for ten checks' worth of plants without pulling the whole table. */
export const PREV_GROWTH_LIMIT = 100;

/** The slice of the database query chain the autofill relies on. */
export type GrowthQueryChain = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eq: (column: any, value: any) => GrowthQueryChain;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lte: (column: any, value: any) => GrowthQueryChain;
  order: (column: any, options: { ascending: boolean }) => GrowthQueryChain;
  limit: (count: number) => PromiseLike<{ data: GrowthMeasurementRow[] | null }>;
};

/** True when `a` was recorded after `b`: later date first, then later timestamp. */
function isNewer(a: GrowthMeasurementRow, b: GrowthMeasurementRow): boolean {
  const ad = a.measured_on ?? "";
  const bd = b.measured_on ?? "";
  if (ad !== bd) return ad > bd;
  return (a.created_at ?? "") > (b.created_at ?? "");
}

/** Keep only the newest row for each sentinel plant number. */
export function latestPerPlant(rows: GrowthMeasurementRow[]): GrowthMeasurementRow[] {
  const best = new Map<number, GrowthMeasurementRow>();
  for (const row of rows) {
    const current = best.get(row.plant_no);
    if (!current || isNewer(row, current)) best.set(row.plant_no, row);
  }
  return [...best.values()];
}

/**
 * Newest measurement per plant for a batch, up to and including `checkDate`.
 * Same-day rows are included and the latest submission wins.
 */
export async function fetchPreviousGrowth(
  chain: GrowthQueryChain,
  batchId: string,
  checkDate: string,
): Promise<GrowthMeasurementRow[]> {
  const { data } = await chain
    .eq("batch_id", batchId)
    .lte("measured_on", checkDate)
    .order("measured_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(PREV_GROWTH_LIMIT);
  return latestPerPlant(data ?? []);
}
