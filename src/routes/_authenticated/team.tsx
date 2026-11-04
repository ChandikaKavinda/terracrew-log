import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — GreenLog" }] }),
  component: TeamPage,
});

function TeamPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: people = [] } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (p ?? []).map((x) => ({ ...x, isOwner: (r ?? []).some((y) => y.user_id === x.id && y.role === "admin") }));
    },
  });

  async function toggle(id: string, makeOwner: boolean) {
    const { error } = makeOwner
      ? await supabase.from("user_roles").insert({ user_id: id, role: "admin" })
      : await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin");
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Team" sub="Invite workers by sharing this site — they sign up with 'Join team'." />
      <Section title="Members">
        <ul className="divide-y">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-3">
              <div>
                <div className="font-medium">{p.full_name}</div>
                <div className="text-sm text-muted-foreground">{p.email}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={p.isOwner ? "default" : "secondary"}>{p.isOwner ? "Owner" : "Worker"}</Badge>
                {me?.isOwner && p.id !== me.id && (
                  <Button size="sm" variant="outline" onClick={() => toggle(p.id, !p.isOwner)}>{p.isOwner ? "Make worker" : "Make owner"}</Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
