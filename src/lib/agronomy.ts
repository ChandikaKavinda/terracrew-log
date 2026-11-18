import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_SETTINGS = {
  tank_liters: 500, albert_ec_per_g_l: 1.0, ph_down_ml: 5, ph_up_ml: 5,
  vpd_min: 0.8, vpd_max: 1.2, total_slots: 500, kg_per_crate: 5, grow_days: 35, nursery_days: 14,
  capex_years: 5, cycles_per_year: 10, target_margin_pct: 25,
};
export type FarmSettings = typeof DEFAULT_SETTINGS;

export function useFarmSettings() {
  return useQuery({
    queryKey: ["farm_settings"],
    queryFn: async (): Promise<FarmSettings> => {
      const { data } = await supabase.from("farm_settings").select("*").eq("id", 1).maybeSingle();
      const out = { ...DEFAULT_SETTINGS };
      if (data) for (const k of Object.keys(out) as (keyof FarmSettings)[]) out[k] = Number(data[k]);
      return out;
    },
  });
}

const r = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

export type Dose = { kind: "ok" | "albert" | "dilute" | "ph_down" | "ph_up"; amount: number; unit: string; text: string };

/** EC correction: add Albert solution (g) when low, add fresh water (L) when high. Aim for middle of range. */
export function ecDose(ec: number | null, min: number, max: number, s: FarmSettings): Dose | null {
  if (ec === null || Number.isNaN(ec)) return null;
  const target = (min + max) / 2;
  if (ec < min) {
    const g = ((target - ec) / s.albert_ec_per_g_l) * s.tank_liters;
    return { kind: "albert", amount: r(g), unit: "g", text: `Add ${r(g)} g Albert solution to raise EC ${ec} → ${r(target, 2)}` };
  }
  if (ec > max) {
    const l = s.tank_liters * (ec / target - 1);
    return { kind: "dilute", amount: r(l), unit: "L", text: `Add ${r(l)} L fresh water (or drain & refill) to lower EC ${ec} → ${r(target, 2)}` };
  }
  return { kind: "ok", amount: 0, unit: "", text: `EC ${ec} is in range` };
}

/** pH correction. Rates are ml per 100 L per 0.1 pH unit. */
export function phDose(ph: number | null, min: number, max: number, s: FarmSettings): Dose | null {
  if (ph === null || Number.isNaN(ph)) return null;
  const target = (min + max) / 2;
  if (ph > max || ph < min) {
    const down = ph > max;
    const ml = (Math.abs(ph - target) / 0.1) * (s.tank_liters / 100) * (down ? s.ph_down_ml : s.ph_up_ml);
    return { kind: down ? "ph_down" : "ph_up", amount: r(ml), unit: "ml", text: `Add ${r(ml)} ml pH ${down ? "Down" : "Up"} to move pH ${ph} → ${r(target, 2)}` };
  }
  return { kind: "ok", amount: 0, unit: "", text: `pH ${ph} is in range` };
}

/** Vapour pressure deficit in kPa (Tetens). */
export function vpd(tempC: number, rh: number): number {
  const svp = 0.6108 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  return r(svp * (1 - rh / 100), 2);
}

export function vpdStatus(v: number, s: Pick<FarmSettings, "vpd_min" | "vpd_max">) {
  if (v < 0.4) return { level: "bad", label: "Too humid", advice: "Very low transpiration — calcium can't reach leaf tips (tipburn) and disease risk rises. Ventilate, stop foggers." };
  if (v < s.vpd_min) return { level: "warn", label: "Low", advice: "Transpiration slowing. Increase airflow or reduce fogging." };
  if (v <= s.vpd_max) return { level: "ok", label: "Ideal", advice: "Healthy transpiration and nutrient uptake." };
  if (v <= 1.6) return { level: "warn", label: "High", advice: "Plants losing water fast. Run foggers, add shade." };
  return { level: "bad", label: "Stress", advice: "Stomata closing — growth stops and tipburn risk. Fog, shade and cool now." };
}

/** Least-squares slope of y over x. */
export function slope(points: { x: number; y: number }[]): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n, my = points.reduce((a, p) => a + p.y, 0) / n;
  const den = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  if (!den) return null;
  return points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / den;
}

export const dayNum = (d: string) => Math.floor(new Date(d + "T00:00:00Z").getTime() / 86400000);
export const fromDayNum = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);

export type PopulationBatch = { id: string; status: string; seeded_on: string; transplanted_on: string | null; expected_harvest: string | null; plant_count: number | null; germinated: number | null; seeds_sown?: number | null };
export function harvestDay(b: PopulationBatch, s: FarmSettings, growDays = s.grow_days): number {
  if (b.expected_harvest) return dayNum(b.expected_harvest);
  return b.status === "nursery" || !b.transplanted_on
    ? dayNum(b.seeded_on) + s.nursery_days + growDays
    : dayNum(b.transplanted_on) + growDays;
}
export function remainingPlants(b: Pick<PopulationBatch, "plant_count" | "germinated" | "seeds_sown">, harvested = 0, lost = 0) {
  return Math.max(0, (b.plant_count ?? b.germinated ?? b.seeds_sown ?? 0) - harvested - lost);
}
export function effectiveTankLiters(capacity: number, level: string, actual: number | null): number | null {
  if (actual !== null) return Number.isFinite(actual) && actual > 0 && actual <= capacity ? actual : null;
  const fraction: Record<string, number> = { full: 1, "3/4": 0.75, "1/2": 0.5, "1/4": 0.25 };
  return fraction[level] !== undefined ? capacity * fraction[level] : null;
}
export function seedingNeeds(batches: PopulationBatch[], s: FarmSettings, today: string, counts: Record<string, number> = {}) {
  const groups = new Map<number, number>();
  for (const b of batches.filter((b) => b.status === "growing")) {
    const release = Math.max(dayNum(today), harvestDay(b, s));
    const quantity = counts[b.id] ?? remainingPlants(b);
    groups.set(release, (groups.get(release) ?? 0) + quantity);
  }
  let nurserySupply = batches.filter((b) => b.status === "nursery").reduce((n, b) => n + (counts[b.id] ?? remainingPlants(b)), 0);
  return [...groups].sort(([a], [b]) => a - b).map(([release, count]) => {
    const covered = Math.min(count, nurserySupply); nurserySupply -= covered;
    return { release: fromDayNum(release), seedBy: fromDayNum(release - s.nursery_days), quantity: count - covered };
  }).filter((n) => n.quantity > 0);
}

/** Days until mean leaf count reaches the target, given current mean and daily rate. */
export function daysToTarget(current: number, target: number, ratePerDay: number | null): number | null {
  if (current >= target) return 0;
  if (!ratePerDay || ratePerDay <= 0) return null;
  return Math.ceil((target - current) / ratePerDay);
}

/** Share an unallocated cost across batches by plant count. */
export function shareCost(amount: number, plants: Record<string, number>): Record<string, number> {
  const total = Object.values(plants).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(plants)) out[k] = total ? (amount * v) / total : 0;
  return out;
}

export type SimInput = { capexTotal?: number; capexYears?: number; cyclesPerYear?: number; targetMarginPct?: number; plants: number; cycleDays: number; mortalityPct: number; headWeightG: number; dailyCost: number; inputCostPerPlant: number; packagingPerHead: number; pricePerHead: number };
/** Unit cost & profit for one harvest cycle. Daily overheads accrue over cycle days; packaging applies only to surviving heads. */
/** Capital cost recovered per harvest cycle (straight-line over lifespan). */
export function capexPerCycle(total: number, years: number, cyclesPerYear: number): number {
  const n = years * cyclesPerYear;
  return n > 0 ? total / n : 0;
}
/** Price that leaves the target margin on revenue after all costs. */
export function priceForMargin(cost: number, marginPct: number): number | null {
  const m = marginPct / 100;
  return m < 1 ? cost / (1 - m) : null;
}
export function simulateUnitCost(i: SimInput) {
  const heads = Math.max(0, i.plants * (1 - Math.min(100, Math.max(0, i.mortalityPct)) / 100));
  const kg = (heads * i.headWeightG) / 1000;
  const opex = i.dailyCost * i.cycleDays + i.plants * i.inputCostPerPlant + heads * i.packagingPerHead;
  const capex = capexPerCycle(i.capexTotal ?? 0, i.capexYears ?? 0, i.cyclesPerYear ?? 0);
  const totalCost = opex + capex;
  const revenue = heads * i.pricePerHead;
  const profit = revenue - totalCost;
  const costPerHead = heads > 0 ? totalCost / heads : null;
  const rec = costPerHead != null ? priceForMargin(costPerHead, i.targetMarginPct ?? 0) : null;
  return {
    heads: r(heads), kg: r(kg, 2), opex: r(opex, 2), capex: r(capex, 2), totalCost: r(totalCost, 2), revenue: r(revenue, 2), profit: r(profit, 2),
    costPerKg: kg > 0 ? r(totalCost / kg, 2) : null, costPerHead: costPerHead != null ? r(costPerHead, 2) : null,
    pricePerKg: kg > 0 ? r(revenue / kg, 2) : null, marginPct: revenue > 0 ? r((profit / revenue) * 100, 1) : null,
    profitPerDay: i.cycleDays > 0 ? r(profit / i.cycleDays, 2) : null,
    recommendedPerHead: rec != null ? r(rec, 2) : null,
    recommendedPerKg: rec != null && kg > 0 ? r((rec * heads) / kg, 2) : null,
  };
}
