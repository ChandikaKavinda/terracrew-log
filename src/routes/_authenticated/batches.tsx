import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBatches } from "@/lib/use-me";
import { PageHeader, Section, num } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toDateKey } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/batches")({
  head: () => ({ meta: [{ title: "Batches — GreenLog" }] }),
  component: BatchesPage,
});

const steps = ["nursery", "growing", "harvested"] as const;

function BatchesPage() {
  const { data: batches = [] } = useBatches();
  const qc = useQueryClient();
  const [f, setF] = useState({ code: "", crop: "Lettuce", variety: "", seeded_on: toDateKey(new Date()), seeds_sown: "", expected_harvest: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!f.code.trim()) { toast.error("Give the batch a code, e.g. L-2026-11-A"); return; }
    const { error } = await supabase.from("batches").insert({
      code: f.code.trim().slice(0, 50), crop: f.crop.trim() || "Lettuce", variety: f.variety || null,
      seeded_on: f.seeded_on, seeds_sown: num(f.seeds_sown), expected_harvest: f.expected_harvest || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Batch created");
    setF({ ...f, code: "", variety: "", seeds_sown: "" });
    qc.invalidateQueries({ queryKey: ["batches"] });
  }

  async function advance(b: (typeof batches)[number]) {
    const today = toDateKey(new Date());
    let patch: { status?: string; transplanted_on?: string; plant_count?: number | null; harvested_on?: string } = {};
    if (b.status === "nursery") {
      const n = prompt("How many plants are being transplanted into the system?", String(b.germinated ?? ""));
      if (n === null) return;
      patch = { status: "growing", transplanted_on: today, plant_count: Number(n) || null };
    } else if (b.status === "growing") patch = { status: "harvested", harvested_on: today };
    const { error } = await supabase.from("batches").update(patch).eq("id", b.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["batches"] });
  }

  const daysBetween = (a: string, b?: string | null) => Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 86400000);

  return (
    <div className="space-y-6">
      <PageHeader title="Batches" sub="Follow each batch from nursery to harvest." />
      <Section title="Start a new batch">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="L-NOV-A" /></div>
          <div><Label>Crop</Label><Input value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })} /></div>
          <div><Label>Variety</Label><Input value={f.variety} onChange={(e) => setF({ ...f, variety: e.target.value })} placeholder="Butterhead" /></div>
          <div><Label>Seeded on</Label><Input type="date" value={f.seeded_on} onChange={(e) => setF({ ...f, seeded_on: e.target.value })} /></div>
          <div><Label>Seeds sown</Label><Input type="number" value={f.seeds_sown} onChange={(e) => setF({ ...f, seeds_sown: e.target.value })} /></div>
          <div><Label>Expected harvest</Label><Input type="date" value={f.expected_harvest} onChange={(e) => setF({ ...f, expected_harvest: e.target.value })} /></div>
          <div className="flex items-end"><Button className="w-full">Create</Button></div>
        </form>
      </Section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {batches.map((b) => {
          const idx = steps.indexOf(b.status as (typeof steps)[number]);
          const germ = b.seeds_sown && b.germinated != null ? Math.round((b.germinated / b.seeds_sown) * 100) : null;
          return (
            <div key={b.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-xl font-bold">{b.code}</div>
                  <div className="text-sm text-muted-foreground">{b.crop}{b.variety ? ` · ${b.variety}` : ""}</div>
                </div>
                <Badge variant={b.status === "harvested" ? "secondary" : "default"} className="capitalize">{b.status}</Badge>
              </div>
              <div className="mt-4 flex items-center gap-1">
                {steps.map((s, i) => <div key={s} className={`h-2 flex-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />)}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Seeded</dt><dd>{b.seeded_on}</dd>
                <dt className="text-muted-foreground">Germination</dt><dd>{germ != null ? `${b.germinated}/${b.seeds_sown} (${germ}%)` : "—"}</dd>
                <dt className="text-muted-foreground">Transplanted</dt><dd>{b.transplanted_on ?? "—"}</dd>
                <dt className="text-muted-foreground">Plants</dt><dd>{b.plant_count ?? "—"}</dd>
                <dt className="text-muted-foreground">Harvested</dt><dd>{b.harvested_on ?? (b.expected_harvest ? `exp. ${b.expected_harvest}` : "—")}</dd>
                <dt className="text-muted-foreground">Age</dt><dd>{daysBetween(b.seeded_on, b.harvested_on)} days</dd>
              </dl>
              {b.status !== "harvested" && (
                <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => advance(b)}>
                  {b.status === "nursery" ? "Move to growing system" : "Mark harvested"}
                </Button>
              )}
            </div>
          );
        })}
        {!batches.length && <p className="text-muted-foreground">No batches yet.</p>}
      </div>
    </div>
  );
}
