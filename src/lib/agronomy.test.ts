import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS as S, daysToTarget, ecDose, effectiveTankLiters, harvestDay, dayNum, phDose, remainingPlants, seedingNeeds, shareCost, slope, vpd, vpdStatus } from "./agronomy";

describe("dosing", () => {
  it("adds Albert solution when EC is low (500 L tank, 1 EC per g/L)", () => {
    expect(ecDose(0.6, 0.8, 1.2, S)).toMatchObject({ kind: "albert", amount: 200, unit: "g" });
  });
  it("dilutes with water when EC is high", () => {
    expect(ecDose(1.5, 0.8, 1.2, S)).toMatchObject({ kind: "dilute", amount: 250 });
  });
  it("doses pH Down when pH is high", () => {
    // 6.8 → 6.0 = 8 steps × 5 L-hundreds × 5 ml
    expect(phDose(6.8, 5.5, 6.5, S)).toMatchObject({ kind: "ph_down", amount: 200 });
    expect(phDose(5.2, 5.5, 6.5, S)?.kind).toBe("ph_up");
    expect(phDose(6, 5.5, 6.5, S)?.kind).toBe("ok");
  });
});

describe("VPD", () => {
  it("computes ~1.27 kPa at 25 °C / 60 %", () => expect(vpd(25, 60)).toBe(1.27));
  it("flags very humid air as tipburn risk", () => expect(vpdStatus(vpd(22, 95), S).level).toBe("bad"));
});

describe("estimates", () => {
  const batch = { id: "b", status: "nursery", seeded_on: "2026-11-01", transplanted_on: null, expected_harvest: null, plant_count: null, germinated: 100 };
  it("includes 14 nursery days plus 35 grow-out days", () => expect(harvestDay(batch, S)).toBe(dayNum("2026-12-20")));
  it("uses transplant date for growing batches", () => expect(harvestDay({ ...batch, status: "growing", transplanted_on: "2026-11-01" }, S)).toBe(dayNum("2026-12-06")));
  it("honours the explicit planned harvest", () => expect(harvestDay({ ...batch, expected_harvest: "2026-12-25" }, S)).toBe(dayNum("2026-12-25")));
  it("deducts partial harvest and mortality from the initial population", () => expect(remainingPlants({ plant_count: 100, germinated: null }, 30, 10)).toBe(60));
  it("scales a half-full 500 L tank to 250 L and half the Albert dose", () => {
    const liters = effectiveTankLiters(500, "1/2", null);
    expect(liters).toBe(250);
    expect(ecDose(0.6, 0.8, 1.2, { ...S, tank_liters: liters ?? 0 })?.amount).toBe(100);
  });
  it("uses measured volume rather than a fraction", () => expect(effectiveTankLiters(500, "full", 120)).toBe(120));
  it("does not invent a volume for Low", () => expect(effectiveTankLiters(500, "low", null)).toBeNull());
  it("scales pH correction to 250 L", () => expect(phDose(6.8, 5.5, 6.5, { ...S, tank_liters: 250 })?.amount).toBe(100));
  it("seeds replacements 14 days before channels free and subtracts nursery stock", () => {
    const growing = { ...batch, status: "growing", transplanted_on: "2026-11-01", plant_count: 100 };
    expect(seedingNeeds([growing, { ...batch, id: "n", germinated: 40 }], S, "2026-11-07")).toEqual([{ release: "2026-12-06", seedBy: "2026-11-22", quantity: 60 }]);
  });
  it("fits a growth slope and days to target", () => {
    expect(slope([{ x: 0, y: 4 }, { x: 1, y: 5 }, { x: 2, y: 6 }])).toBe(1);
    expect(daysToTarget(6, 12, 0.5)).toBe(12);
  });
  it("shares costs by plant count", () => expect(shareCost(300, { a: 100, b: 200 })).toEqual({ a: 100, b: 200 }));
});
