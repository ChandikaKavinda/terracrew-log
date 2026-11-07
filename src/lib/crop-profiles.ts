import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CropProfile = Tables<"crop_profiles">;

/** Starting values for a new profile (lettuce). */
export const DEFAULT_TARGETS = {
  ec_min: 0.8, ec_max: 1.2, ph_min: 5.5, ph_max: 6.5,
  water_temp_min: 18, water_temp_max: 24, air_temp_min: 18, air_temp_max: 28,
  humidity_min: 50, humidity_max: 70,
  grade_a_min_g: 150, grade_a_min_leaves: 12, grade_b_min_g: 100, grade_b_min_leaves: 0,
};

export type Targets = typeof DEFAULT_TARGETS;

export const STAGES = ["nursery", "vegetative", "pre_harvest"] as const;
export type GrowthStage = typeof STAGES[number];
export const STAGE_LABELS: Record<GrowthStage, string> = { nursery: "Nursery", vegetative: "Vegetative", pre_harvest: "Pre-harvest" };
export function stageOf(status: string | undefined, transplanted: string | null | undefined, date: string, growDays: number): GrowthStage {
  if (status === "nursery") return "nursery";
  const age = transplanted ? (new Date(date).getTime() - new Date(transplanted).getTime()) / 86400000 : 0;
  return age >= Math.max(0, growDays - 7) ? "pre_harvest" : "vegetative";
}
export function stageTargetsOf(p: Partial<CropProfile> | undefined, stage: GrowthStage): Targets {
  const base = targetsOf(p);
  const stages = (p?.stage_targets ?? {}) as Partial<Record<GrowthStage, Partial<Targets>>>;
  const override = stages[stage];
  if (override) for (const k of Object.keys(base) as (keyof Targets)[]) {
    const v = override[k]; if (typeof v === "number" && Number.isFinite(v)) base[k] = v;
  }
  return base;
}

export function validPotId(id: string): boolean {
  const m = /^([1-9])([A-H])(10|[1-9])$/.exec(id);
  if (!m?.[1] || !m[2]) return false;
  return m[2] <= (m[1] === "5" || m[1] === "8" ? "H" : "E");
}
export function potZone(id: string, plantNo: number): Zone {
  const m = /^\d[A-H](10|[1-9])$/.exec(id);
  return validPotId(id) && m ? zoneOf(Number(m[1])) : zoneOf(plantNo);
}

export function targetsOf(p?: Partial<CropProfile> | null): Targets {
  const out = { ...DEFAULT_TARGETS };
  if (!p) return out;
  for (const k of Object.keys(out) as (keyof Targets)[]) {
    const v = p[k];
    if (v !== null && v !== undefined) out[k] = Number(v);
  }
  return out;
}

export function inRange(v: number | null | undefined, min: number, max: number): boolean | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return v >= min && v <= max;
}

/** Grade one plant by weight (grams) and leaf count against a profile. */
export function gradePlant(weightG: number, leaves: number, t: Targets): "A" | "B" | "C" {
  if (weightG >= t.grade_a_min_g && leaves >= t.grade_a_min_leaves) return "A";
  if (weightG >= t.grade_b_min_g && leaves >= t.grade_b_min_leaves) return "B";
  return "C";
}

/** Grade by weight + Brix (fruiting crops like strawberry). */
export function gradeFruit(weightG: number, brix: number, p: Partial<CropProfile> | null | undefined): "A" | "B" | "C" {
  const t = targetsOf(p);
  const aB = Number(p?.grade_a_min_brix ?? 0), bB = Number(p?.grade_b_min_brix ?? 0);
  if (weightG >= t.grade_a_min_g && brix >= aB) return "A";
  if (weightG >= t.grade_b_min_g && brix >= bB) return "B";
  return "C";
}

export const isBrix = (p?: Partial<CropProfile> | null) => p?.grade_metric === "brix";

export type Zone = "Inlet" | "Mid" | "Outlet";
/** Sentinel plants: 1–3 Inlet, 4–7 Mid, 8–10 Outlet. */
export function zoneOf(plantNo: number): Zone {
  return plantNo <= 3 ? "Inlet" : plantNo <= 7 ? "Mid" : "Outlet";
}

export const DEFAULT_DEFECTS = ["Macro-nutrient deficiency", "Micro-nutrient deficiency", "Insect damage", "Disease", "Tip burn", "Other"];

export function defectTagsOf(p?: Partial<CropProfile> | null): string[] {
  return p?.defect_tags?.length ? p.defect_tags : DEFAULT_DEFECTS;
}

export const PROFILE_TEMPLATES: Record<string, Partial<CropProfile>> = {
  "Butterhead lettuce": {
    name: "Butterhead lettuce", crop: "Lettuce", grade_metric: "leaves",
    ec_min: 0.8, ec_max: 1.2, ph_min: 5.5, ph_max: 6.5, water_temp_min: 18, water_temp_max: 24,
    air_temp_min: 18, air_temp_max: 28, humidity_min: 50, humidity_max: 70,
    grade_a_min_g: 200, grade_a_min_leaves: 12, grade_b_min_g: 150, grade_b_min_leaves: 0,
    defect_tags: ["Tip burn", "Nitrogen deficiency (yellowing)", "Calcium deficiency", "Iron deficiency", "Aphids", "Downy mildew", "Bolting", "Leaf scorch"],
  },
  "Greenhouse strawberry": {
    name: "Greenhouse strawberry", crop: "Strawberry", grade_metric: "brix",
    ec_min: 1.4, ec_max: 2.0, ph_min: 5.5, ph_max: 6.2, water_temp_min: 16, water_temp_max: 22,
    air_temp_min: 15, air_temp_max: 26, humidity_min: 60, humidity_max: 75,
    grade_a_min_g: 20, grade_a_min_brix: 9, grade_b_min_g: 12, grade_b_min_brix: 7,
    defect_tags: ["Botrytis (grey mould)", "Powdery mildew", "Misshapen fruit", "Spider mites", "Thrips", "Calcium deficiency", "Sunscald", "Albinism"],
  },
};

export const GERMINATION_ISSUES = [
  "Damping-off (stem rot)",
  "Algae / mould on substrate",
  "Uneven / delayed germination",
  "Leggy / stretched seedlings",
  "Yellowing seedlings",
  "Seed coat stuck (helmet heads)",
  "Substrate too dry / waterlogged",
  "Pests / fungus gnats",
] as const;

export function useProfiles() {
  return useQuery({
    queryKey: ["crop_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crop_profiles").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}
