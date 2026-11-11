import { describe, expect, it } from "vitest";
import { channelPots } from "./greenhouse";
import { pickSentinels, zoneOfPot } from "./transplant";
describe("sentinel auto-distribution", () => {
  it("picks 3 Inlet, 4 Mid, 3 Outlet from full channels", () => {
    const s = pickSentinels([...channelPots("1A"), ...channelPots("1B")]);
    expect(s).toHaveLength(10);
    expect(s.filter((p) => zoneOfPot(p) === "Inlet")).toHaveLength(3);
    expect(s.filter((p) => zoneOfPot(p) === "Mid")).toHaveLength(4);
    expect(s.filter((p) => zoneOfPot(p) === "Outlet")).toHaveLength(3);
  });
  it("still picks 10 when a zone is missing", () => {
    const pots = ["1A1","1A2","1A3","1B1","1B2","1B3","1C1","1C2","1C3","1D1","1D2","1D3"];
    expect(new Set(pickSentinels(pots)).size).toBe(10);
  });
  it("uses every pot when fewer than 10 are transplanted", () => { expect(pickSentinels(["1A1","1A5"])).toHaveLength(2); });
});
