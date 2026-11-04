import { describe, expect, it } from "vitest";
import { computeReminders } from "./reminders";

const now = new Date(2026, 10, 4, 9, 0);
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const base = { now, lastCheckDate: "2026-11-04", lastFilterCheck: daysAgo(0), lastInventoryCheck: daysAgo(0), lowStockCount: 0 };
const ids = (r: ReturnType<typeof computeReminders>) => r.map((x) => x.id);

describe("reminders", () => {
  it("daily check is due when today's checklist is missing", () => {
    expect(ids(computeReminders({ ...base, lastCheckDate: "2026-11-03" }))).toContain("daily-check");
    expect(ids(computeReminders(base))).not.toContain("daily-check");
  });
  it("filter check (twice a week) is due after 3 days, not after 2", () => {
    expect(ids(computeReminders({ ...base, lastFilterCheck: daysAgo(2) }))).not.toContain("filter");
    expect(ids(computeReminders({ ...base, lastFilterCheck: daysAgo(3) }))).toContain("filter");
  });
  it("inventory check is due weekly", () => {
    expect(ids(computeReminders({ ...base, lastInventoryCheck: daysAgo(6) }))).not.toContain("inventory");
    expect(ids(computeReminders({ ...base, lastInventoryCheck: daysAgo(7) }))).toContain("inventory");
  });
});
