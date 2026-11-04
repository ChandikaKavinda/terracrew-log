export type Reminder = {
  id: "daily-check" | "filter" | "inventory" | "low-stock";
  title: string;
  detail: string;
  severity: "due" | "overdue" | "info";
};

/** Filter must be checked twice a week → due once 3 days have passed since the last check. */
export const FILTER_INTERVAL_DAYS = 3;
/** Inventory count is due weekly. */
export const INVENTORY_INTERVAL_DAYS = 7;

const DAY = 86_400_000;

function daysSince(now: Date, past: Date | null): number {
  if (!past) return Infinity;
  return Math.floor((now.getTime() - past.getTime()) / DAY);
}

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeReminders(input: {
  now: Date;
  lastCheckDate: string | null; // YYYY-MM-DD
  lastFilterCheck: Date | null;
  lastInventoryCheck: Date | null;
  lowStockCount: number;
}): Reminder[] {
  const { now } = input;
  const out: Reminder[] = [];

  if (input.lastCheckDate !== toDateKey(now)) {
    out.push({
      id: "daily-check",
      title: "Daily checklist not done today",
      detail: "Fill today's greenhouse checklist.",
      severity: "due",
    });
  }

  const f = daysSince(now, input.lastFilterCheck);
  if (f >= FILTER_INTERVAL_DAYS) {
    out.push({
      id: "filter",
      title: "Check the filter",
      detail: f === Infinity ? "No filter check recorded yet." : `Last checked ${f} days ago.`,
      severity: f >= FILTER_INTERVAL_DAYS + 2 ? "overdue" : "due",
    });
  }

  const i = daysSince(now, input.lastInventoryCheck);
  if (i >= INVENTORY_INTERVAL_DAYS) {
    out.push({
      id: "inventory",
      title: "Weekly inventory check",
      detail: i === Infinity ? "No inventory check recorded yet." : `Last checked ${i} days ago.`,
      severity: i >= INVENTORY_INTERVAL_DAYS * 2 ? "overdue" : "due",
    });
  }

  if (input.lowStockCount > 0) {
    out.push({
      id: "low-stock",
      title: `${input.lowStockCount} item(s) at or below reorder level`,
      detail: "Restock soon.",
      severity: "info",
    });
  }
  return out;
}
