import { describe, expect, it } from "vitest";
import { DEFAULT_TARGETS, gradePlant, gradeFruit, inRange, targetsOf, zoneOf } from "./crop-profiles";

describe("crop profile targets", () => {
  it("grades A at 150 g with 12 leaves by default", () => {
    expect(gradePlant(150, 12, DEFAULT_TARGETS)).toBe("A");
    expect(gradePlant(150, 11, DEFAULT_TARGETS)).toBe("B");
  });
  it("grades B from 100 g and C below", () => {
    expect(gradePlant(100, 5, DEFAULT_TARGETS)).toBe("B");
    expect(gradePlant(99, 20, DEFAULT_TARGETS)).toBe("C");
  });
  it("uses the profile's own grade limits", () => {
    const t = targetsOf({ grade_a_min_g: 200, grade_a_min_leaves: 14 });
    expect(gradePlant(180, 15, t)).toBe("B");
    expect(t.ec_min).toBe(0.8);
  });
  it("grades strawberries by weight and Brix", () => {
    const p = { grade_a_min_g: 20, grade_a_min_brix: 9, grade_b_min_g: 12, grade_b_min_brix: 7 };
    expect(gradeFruit(22, 9.5, p)).toBe("A");
    expect(gradeFruit(22, 8, p)).toBe("B");
    expect(gradeFruit(10, 10, p)).toBe("C");
  });
  it("maps sentinel plants to Inlet 1–3, Mid 4–7, Outlet 8–10", () => {
    expect([1, 3, 4, 7, 8, 10].map(zoneOf)).toEqual(["Inlet", "Inlet", "Mid", "Mid", "Outlet", "Outlet"]);
  });
  it("checks readings against a range", () => {
    expect(inRange(1.3, 0.8, 1.2)).toBe(false);
    expect(inRange(6, 5.5, 6.5)).toBe(true);
    expect(inRange(null, 0, 1)).toBeNull();
  });
});
