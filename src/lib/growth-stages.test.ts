import { describe, expect, it } from "vitest";
import { stageOf, stageTargetsOf, validPotId, potZone } from "./crop-profiles";

describe("growth stages and physical pots", () => {
  it("uses nursery targets without changing harvest standards", () => {
    const targets = stageTargetsOf({ ec_min: 0.8, grade_a_min_g: 200, stage_targets: { nursery: { ec_min: 0.4, ec_max: 0.6 } } }, "nursery");
    expect(targets.ec_min).toBe(0.4); expect(targets.ec_max).toBe(0.6); expect(targets.grade_a_min_g).toBe(200);
  });
  it("inherits base targets if the stage is not configured", () => expect(stageTargetsOf({ ec_min: 1.4 }, "vegetative").ec_min).toBe(1.4));
  it("uses pre-harvest in the final 7 days of a 35-day cycle", () => expect(stageOf("growing", "2026-11-01", "2026-11-29", 35)).toBe("pre_harvest"));
  it("has 510 valid IDs across 51 channels", () => {
    let count = 0;
    for (let s=1;s<=9;s++) for (const c of "ABCDEFGH") for (let p=1;p<=10;p++) if (validPotId(`${s}${c}${p}`)) count++;
    expect(count).toBe(510); expect(validPotId("1F1")).toBe(false); expect(validPotId("5H10")).toBe(true); expect(validPotId("8H10")).toBe(true); expect(validPotId("9E11")).toBe(false);
  });
  it("takes inlet/outlet from the physical pot, not sentinel number", () => { expect(potZone("8H10", 1)).toBe("Outlet"); expect(potZone("1A1", 10)).toBe("Inlet"); });
});