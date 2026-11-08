import { describe, expect, it } from "vitest";
import { ALL_POTS, CHANNELS, channelPots, conflicts, occupies, turnover, type Placement } from "./greenhouse";
const row: Placement = { id: "1", allocation_id: "a", batch_id: "b", pot_id: "1A1", starts_on: "2026-11-08", ends_on: "2026-11-15" };
describe("physical greenhouse", () => {
  it("has 51 channels and 510 unique pots", () => { expect(CHANNELS).toHaveLength(51); expect(new Set(ALL_POTS).size).toBe(510); });
  it("uses eight channels only in sets 5 and 8", () => { expect(CHANNELS).toContain("5H"); expect(CHANNELS).toContain("8H"); expect(CHANNELS).not.toContain("1F"); expect(channelPots("5H")).toContain("5H10"); });
  it("releases pots on the available date", () => { expect(occupies(row,"2026-11-14")).toBe(true); expect(occupies(row,"2026-11-15")).toBe(false); });
  it("rejects overlapping bookings but permits adjacent cycles", () => { expect(conflicts(["1A1"],[row],"2026-11-14","2026-11-20")).toHaveLength(1); expect(conflicts(["1A1"],[row],"2026-11-15","2026-11-20")).toHaveLength(0); });
  it("excludes the edited allocation from conflicts", () => { expect(conflicts(["1A1"],[row],row.starts_on,row.ends_on,"a")).toHaveLength(0); });
  it("counts each channel's free and releasing pots", () => { expect(turnover([row],"2026-11-08","2026-11-16")[0]).toEqual({channel:"1A",free:9,releasing:1}); });
});