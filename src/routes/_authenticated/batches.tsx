import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBatches, useMe } from "@/lib/use-me";
import { useProfiles, validPotId } from "@/lib/crop-profiles";
import { remainingPlants } from "@/lib/agronomy";
import { usePopulation } from "@/lib/use-population";
import { deleteRow, updateRow } from "@/lib/db-actions";
import { PageHeader, Section, num } from "@/components/page-header";
import { FieldsDialog, DeleteButton, EditButton, toVals, fromVals, type Field } from "@/components/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateKey } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/batches")({
  head: () => ({ meta: [{ title: "Batches — GreenLog" }] }),
  component: BatchesPage,
});

const steps = ["nursery", "growing", "harvested"] as const;


function BatchesPage() {
  const { data: batches = [] } = useBatches();
  const { data: profiles = [] } = useProfiles();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [f, setF] = useState({ code: "", crop: "Lettuce", variety: "", seeded_on: toDateKey(new Date()), seeds_sown: "", expected_harvest: "", profile_id: "" });
  const [editBatch, setEditBatch] = useState<(typeof batches)[number] | null>(null);
  const { data: population } = usePopulation();
  const [pots, setPots] = useState<string[]>(Array(10).fill(""));
  const [lossBatch, setLossBatch] = useState<(typeof batches)[number] | null>(null);
  const [editLoss, setEditLoss] = useState<NonNullable<typeof population>["losses"][number] | null>(null);
  const lossFields: Field[] = [{ key: "lost_on", label: "Date", type: "date" }, { key: "kind", label: "Type", type: "select", options: [{ value: "cull", label: "Cull" }, { value: "mortality", label: "Mortality" }] }, { key: "quantity", label: "Plants removed", type: "number" }, { key: "reason", label: "Reason", full: true }];

  const refresh = () => { qc.invalidateQueries(); };
  const profileName = (id: string | null) => profiles.find((p) => p.id === id)?.name;

  const batchFields: Field[] = [
    { key: "code", label: "Code" }, { key: "crop", label: "Crop" }, { key: "variety", label: "Variety" },
    { key: "profile_id", label: "Crop profile", type: "select", options: [{ value: "__none", label: "None (default targets)" }, ...profiles.map((p) => ({ value: p.id, label: p["name"] }))] },
    { key: "status", label: "Stage", type: "select", options: steps.map((s) => ({ value: s, label: s })) },
    { key: "seeded_on", label: "Seeded on", type: "date" },
    { key: "seeds_sown", label: "Seeds sown", type: "number" }, { key: "germinated", label: "Germinated", type: "number" },
    { key: "transplanted_on", label: "Transplanted on", type: "date" }, { key: "plant_count", label: "Plants in system", type: "number" },
    { key: "expected_harvest", label: "Expected harvest", type: "date" }, { key: "harvested_on", label: "Harvested on", type: "date" },
    { key: "notes", label: "Notes", full: true },
  ];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!f.code.trim()) { toast.error("Give the batch a code, e.g. L-2026-11-A"); return; }
    const { error } = await supabase.from("batches").insert({
      code: f.code.trim().slice(0, 50), crop: f.crop.trim() || "Lettuce", variety: f.variety || null,
      seeded_on: f.seeded_on, seeds_sown: num(f.seeds_sown), expected_harvest: f.expected_harvest || null,
      profile_id: f.profile_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Batch created");
    setF({ ...f, code: "", variety: "", seeds_sown: "" });
    refresh();
  }

  async function advance(b: (typeof batches)[number]) {
    const today = toDateKey(new Date());
    let patch: Record<string, unknown> = {};
    if (b.status === "nursery") {
      const n = prompt("How many plants are being transplanted into the system?", String(b.germinated ?? ""));
      if (n === null) return;
      if (!Number.isInteger(Number(n)) || Number(n) <= 0) { toast.error("Enter a positive whole plant count"); return; }
      patch = { status: "growing", transplanted_on: today, plant_count: Number(n) };
    } else if (b.status === "growing") patch = { status: "harvested", harvested_on: today };
    const err = await updateRow("batches", b.id, patch);
    if (err) { toast.error(err); return; }
    refresh();
  }

  const daysBetween = (a: string, b?: string | null) => Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 86400000);

  return (
    <div className="space-y-6">
      <PageHeader title="Batches" sub="Follow each batch from nursery to harvest. Set crop targets on the Crop profiles page." />


      <Section title="Start a new batch">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="L-NOV-A" /></div>
          <div><Label>Crop</Label><Input value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })} /></div>
          <div><Label>Variety</Label><Input value={f.variety} onChange={(e) => setF({ ...f, variety: e.target.value })} placeholder="Butterhead" /></div>
          <div>
            <Label>Crop profile</Label>
            <Select value={f.profile_id} onValueChange={(v) => setF({ ...f, profile_id: v })}>
              <SelectTrigger><SelectValue placeholder={profiles.length ? "Choose profile" : "No profiles yet"} /></SelectTrigger>
              <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p["name"]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-xl font-bold">{b.code}</div>
                  <div className="text-sm text-muted-foreground">{b.crop}{b.variety ? ` · ${b.variety}` : ""}</div>
                  <div className="text-xs text-muted-foreground">{profileName(b.profile_id) ?? "Default targets"}</div>
                </div>
                <div className="flex items-center">
                  <Badge variant={b.status === "harvested" ? "secondary" : "default"} className="mr-1 capitalize">{b.status}</Badge>
                  <EditButton onClick={() => { setEditBatch(b); setPots(Array.from({ length: 10 }, (_, i) => b.sentinel_pot_ids[i] ?? "")); }} />
                  <DeleteButton what={`batch ${b.code} and all its growth, quality and harvest records`} disabled={!me?.isOwner} onConfirm={async () => { const e = await deleteRow("batches", b.id); qc.invalidateQueries(); return e; }} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1">
                {steps.map((s, i) => <div key={s} className={`h-2 flex-1 rounded-full ${i <= idx ? "bg-primary" : "bg-muted"}`} />)}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Seeded</dt><dd>{b.seeded_on}</dd>
                <dt className="text-muted-foreground">Germination</dt><dd>{germ != null ? `${b.germinated}/${b.seeds_sown} (${germ}%)` : "—"}</dd>
                <dt className="text-muted-foreground">Transplanted</dt><dd>{b.transplanted_on ?? "—"}</dd>
                <dt className="text-muted-foreground">Live plants</dt><dd>{remainingPlants(b, population?.harvested[b.id], population?.lost[b.id])} / {b.plant_count ?? b.germinated ?? b.seeds_sown ?? "—"}</dd>
                <dt className="text-muted-foreground">Culled / died</dt><dd>{population?.lost[b.id] ?? 0}</dd>
                <dt className="text-muted-foreground">Harvested</dt><dd>{b.harvested_on ?? (b.expected_harvest ? `exp. ${b.expected_harvest}` : "—")}</dd>
                <dt className="text-muted-foreground">Age</dt><dd>{daysBetween(b.seeded_on, b.harvested_on)} days</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1">{b.sentinel_pot_ids.filter(Boolean).map((pot) => <Badge key={pot} variant="outline">{pot}</Badge>)}</div>
              {b.status === "growing" && <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => { setEditLoss(null); setLossBatch(b); }}>Record cull / mortality</Button>}
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

      <Section title="Cull & mortality history">
        {population?.losses.length ? <div className="divide-y">{[...population.losses].sort((a,b) => b.lost_on.localeCompare(a.lost_on)).map((loss) => <div key={loss.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="text-sm"><b>{batches.find((b) => b.id === loss.batch_id)?.code}</b> · {loss.quantity} plants · {loss.kind}<div className="text-xs text-muted-foreground">{loss.lost_on} · {loss.reason || "No reason"}</div></div><div className="flex"><EditButton onClick={() => { setEditLoss(loss); setLossBatch(batches.find((b) => b.id === loss.batch_id) ?? null); }} /><DeleteButton what="this loss record" disabled={!me?.isOwner} onConfirm={async () => { const { error } = await supabase.from("batch_losses").delete().eq("id", loss.id); refresh(); return error?.message; }} /></div></div>)}</div> : <p className="text-sm text-muted-foreground">No losses recorded.</p>}
      </Section>
      <FieldsDialog open={!!lossBatch} onOpenChange={(o) => { if (!o) { setLossBatch(null); setEditLoss(null); } }} title={`Cull / mortality · ${lossBatch?.code ?? ""}`} fields={lossFields} initial={editLoss ? toVals(editLoss, lossFields) : { lost_on: toDateKey(new Date()), kind: "cull", quantity: "", reason: "" }} onSave={async (v) => {
        if (!lossBatch) return "Choose a batch";
        const quantity = Number(v["quantity"]);
        const available = remainingPlants(lossBatch, population?.harvested[lossBatch.id], population?.lost[lossBatch.id]) + (editLoss?.quantity ?? 0);
        if (!Number.isInteger(quantity) || quantity <= 0 || quantity > available) return `Enter 1–${available} plants`;
        const payload = { batch_id: lossBatch.id, quantity, kind: String(v["kind"]), lost_on: String(v["lost_on"]), reason: String(v["reason"] || "") || null };
        const { error } = editLoss ? await supabase.from("batch_losses").update(payload).eq("id", editLoss.id) : await supabase.from("batch_losses").insert(payload);
        if (error) return error.message; refresh(); toast.success("Loss recorded"); return null;
      }} />

      <FieldsDialog
        open={!!editBatch} onOpenChange={(o) => !o && setEditBatch(null)} title={`Edit batch ${editBatch?.code ?? ""}`}
        fields={batchFields} initial={editBatch ? toVals(editBatch, batchFields) : {}}
        extra={<div><h3 className="mb-2 font-semibold">Fixed sentinel pot IDs</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{pots.map((pot, i) => <div key={i}><Label htmlFor={`pot-${i}`}>Plant #{i + 1}</Label><Input id={`pot-${i}`} placeholder="e.g. 1A1" value={pot} onChange={(e) => setPots((x) => x.map((p,j) => j === i ? e.target.value.toUpperCase().trim() : p))} /></div>)}</div><p className="mt-2 text-xs text-muted-foreground">Sets 1–9 · A–E (A–H in sets 5 & 8) · pots 1–10. Blank means unassigned.</p></div>}
        onSave={async (v) => {
          if (!editBatch) return null;
          const patch = fromVals(v, batchFields);
          if (!patch["code"]) return "Code is required";
          if (!patch["crop"]) patch["crop"] = "Lettuce";
          const assigned = pots.filter(Boolean);
          if (assigned.some((id) => !validPotId(id))) return "Invalid pot ID; use IDs such as 1A1 or 8H10";
          if (new Set(assigned).size !== assigned.length) return "Each sentinel must have a different pot ID";
          const e = await updateRow("batches", editBatch.id, { ...patch, sentinel_pot_ids: pots });
          if (!e) { toast.success("Batch updated"); refresh(); }
          return e;
        }}
      />
    </div>
  );
}
