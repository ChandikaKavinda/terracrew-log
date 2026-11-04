import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const isOwner = (roles ?? []).some((r) => r.role === "admin");
      return { id: user.id, email: user.email ?? "", name: profile?.full_name ?? user.email ?? "", isOwner };
    },
  });
}

export const LKR = (n: number) =>
  "Rs " + n.toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function useBatches() {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("batches").select("*").order("seeded_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
