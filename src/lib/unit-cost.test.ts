import { describe, it, expect } from "vitest";
import { simulateUnitCost } from "./agronomy";
const base = { plants: 500, cycleDays: 35, mortalityPct: 10, headWeightG: 200, dailyCost: 1000, inputCostPerPlant: 20, packagingPerHead: 10, pricePerHead: 150 };
describe("simulateUnitCost", () => {
  it("computes cost per kg after mortality", () => {
    const s = simulateUnitCost(base);
    expect(s.heads).toBe(450);
    expect(s.kg).toBe(90);
    expect(s.totalCost).toBe(35000 + 10000 + 4500);
    expect(s.costPerKg).toBe(550);
    expect(s.profit).toBe(67500 - 49500);
  });
  it("longer cycle raises cost per kg", () => {
    expect(simulateUnitCost({ ...base, cycleDays: 45 }).costPerKg!).toBeGreaterThan(550);
  });
  it("100% mortality gives no cost per kg", () => {
    expect(simulateUnitCost({ ...base, mortalityPct: 100 }).costPerKg).toBeNull();
  });
});

import { capexPerCycle, priceForMargin } from "./agronomy";
describe("capital costs", () => {
  it("spreads LKR 918,000 over 5 years × 10 cycles", () => expect(capexPerCycle(918000, 5, 10)).toBe(18360));
  it("adds capex to total cost", () => expect(simulateUnitCost({ ...base, capexTotal: 918000, capexYears: 5, cyclesPerYear: 10 }).totalCost).toBe(simulateUnitCost(base).totalCost + 18360));
  it("prices for a 25% margin", () => expect(priceForMargin(75, 25)).toBe(100));
});
