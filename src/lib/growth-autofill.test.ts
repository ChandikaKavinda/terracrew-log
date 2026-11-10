import { describe, expect, it } from "vitest";

import {
  PREV_GROWTH_LIMIT,
  fetchPreviousGrowth,
  latestPerPlant,
  type GrowthMeasurementRow,
  type GrowthQueryChain,
} from "@/lib/growth-autofill";

function row(over: Partial<GrowthMeasurementRow> & { plant_no: number }): GrowthMeasurementRow {
  return {
    measured_on: "2026-11-09",
    created_at: "2026-11-09T01:00:00Z",
    height_cm: null,
    leaf_count: null,
    variety: null,
    pot_id: null,
    ...over,
  };
}

/** Records the filter/order chain so the query shape can be asserted. */
class FakeChain implements GrowthQueryChain {
  steps: string[] = [];

  constructor(private rows: GrowthMeasurementRow[]) {}

  eq(column: string, value: string) {
    this.steps.push(`eq:${column}:${value}`);
    return this;
  }

  lte(column: string, value: string) {
    this.steps.push(`lte:${column}:${value}`);
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.steps.push(`order:${column}:${options.ascending ? "asc" : "desc"}`);
    return this;
  }

  limit(count: number) {
    this.steps.push(`limit:${count}`);
    return Promise.resolve({ data: this.rows });
  }
}

describe("Sentinel growth autofill", () => {
  it("prefills from the check already submitted on the same day", async () => {
    const chain = new FakeChain([
      row({ plant_no: 1, measured_on: "2026-11-10", created_at: "2026-11-10T01:30:00Z", height_cm: 7, leaf_count: 9 }),
      row({ plant_no: 1, measured_on: "2026-11-09", height_cm: 4, leaf_count: 8 }),
      row({ plant_no: 2, measured_on: "2026-11-09", height_cm: 3, leaf_count: 6 }),
    ]);

    const rows = await fetchPreviousGrowth(chain, "batch-1", "2026-11-10");

    expect(chain.steps).toContain("lte:measured_on:2026-11-10");
    expect(chain.steps.some((s) => s.startsWith("lt:"))).toBe(false);

    const plant1 = rows.find((r) => r.plant_no === 1);
    expect(plant1?.height_cm).toBe(7);
    expect(plant1?.leaf_count).toBe(9);

    const plant2 = rows.find((r) => r.plant_no === 2);
    expect(plant2?.height_cm).toBe(3);
    expect(plant2?.measured_on).toBe("2026-11-09");
  });

  it("uses the newest same-day entry when a check is re-submitted", async () => {
    const chain = new FakeChain([
      row({ plant_no: 1, measured_on: "2026-11-10", created_at: "2026-11-10T08:00:00Z", height_cm: 5 }),
      row({ plant_no: 1, measured_on: "2026-11-10", created_at: "2026-11-10T12:30:00Z", height_cm: 6.5, leaf_count: 10 }),
    ]);

    const rows = await fetchPreviousGrowth(chain, "batch-1", "2026-11-10");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.height_cm).toBe(6.5);
    expect(rows[0]?.leaf_count).toBe(10);
  });

  it("orders newest first by date, then by submission time", async () => {
    const chain = new FakeChain([]);

    await fetchPreviousGrowth(chain, "batch-1", "2026-11-10");

    expect(chain.steps).toEqual([
      "eq:batch_id:batch-1",
      "lte:measured_on:2026-11-10",
      "order:measured_on:desc",
      "order:created_at:desc",
      `limit:${PREV_GROWTH_LIMIT}`,
    ]);
  });

  it("keeps a plant's older reading when it has no newer one", () => {
    const kept = latestPerPlant([
      row({ plant_no: 3, measured_on: "2026-11-10", created_at: "2026-11-10T02:00:00Z", height_cm: 8 }),
      row({ plant_no: 3, measured_on: "2026-11-09", height_cm: 5 }),
      row({ plant_no: 4, measured_on: "2026-11-08", height_cm: 2 }),
    ]);

    expect(kept).toHaveLength(2);
    expect(kept.find((r) => r.plant_no === 3)?.height_cm).toBe(8);
    expect(kept.find((r) => r.plant_no === 4)?.height_cm).toBe(2);
  });
});
