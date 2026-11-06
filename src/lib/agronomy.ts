import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_SETTINGS = {
  tank_liters: 500, albert_ec_per_g_l: 1.0, ph_down_ml: 5, ph_up_ml: 5,
  vpd_min: 0.8, vpd_max: 1.2, total_slots: 500, kg_per_crate: 5, grow_days: 35, nursery_days: 14,
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
