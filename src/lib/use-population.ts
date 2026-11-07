import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePopulation() {
  return useQuery({
    queryKey: ["population"],
    queryFn: async () => {
      const [h, l] = await Promise.all([
        supabase.from("harvests").select("batch_id,plants_harvested"),
        supabase.from("batch_losses").select("*"),
      ]);
      if (h.error) throw h.error;
      if (l.error) throw l.error;
      const harvested: Record<string, number> = {}, lost: Record<string, number> = {};
      for (const r of h.data) harvested[r.batch_id] = (harvested[r.batch_id] ?? 0) + r.plants_harvested;
      for (const r of l.data) lost[r.batch_id] = (lost[r.batch_id] ?? 0) + r.quantity;
      return { harvested, lost, losses: l.data };
    },
  });
}