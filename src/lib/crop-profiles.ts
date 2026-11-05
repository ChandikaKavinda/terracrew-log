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
