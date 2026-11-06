import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS as S, daysToTarget, ecDose, phDose, shareCost, slope, vpd, vpdStatus } from "./agronomy";

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
  it("fits a growth slope and days to target", () => {
    expect(slope([{ x: 0, y: 4 }, { x: 1, y: 5 }, { x: 2, y: 6 }])).toBe(1);
    expect(daysToTarget(6, 12, 0.5)).toBe(12);
  });
  it("shares costs by plant count", () => expect(shareCost(300, { a: 100, b: 200 })).toEqual({ a: 100, b: 200 }));
});
