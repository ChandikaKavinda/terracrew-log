import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type T = keyof Database["public"]["Tables"];

/** Delete one row; returns an error message or null. Detects rows hidden by owner-only delete rules. */
export async function deleteRow(table: T, id: string): Promise<string | null> {
  const { data, error } = await supabase.from(table as "batches").delete().eq("id", id).select("id");
  if (error) return error.message;
  if (!data?.length) return "Only the owner can delete this.";
  return null;
}

export async function updateRow(table: T, id: string, patch: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.from(table as "batches").update(patch as never).eq("id", id);
  return error ? error.message : null;
}
