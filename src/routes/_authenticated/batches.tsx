import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useBatches, useMe } from "@/lib/use-me";
import { useProfiles, DEFAULT_TARGETS, type CropProfile } from "@/lib/crop-profiles";
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
  head: () => ({ meta: [{ title: "Batches & crop profiles — GreenLog" }] }),
  component: BatchesPage,
});

const steps = ["nursery", "growing", "harvested"] as const;

const profileFields: Field[] = [
  { key: "name", label: "Profile name", full: true },
  { key: "crop", label: "Crop" },
  { key: "season", label: "Season (e.g. Yala, Maha, Monsoon)" },
  { key: "ec_min", label: "EC min (mS/cm)", type: "number" }, { key: "ec_max", label: "EC max", type: "number" },
  { key: "ph_min", label: "pH min", type: "number" }, { key: "ph_max", label: "pH max", type: "number" },
  { key: "water_temp_min", label: "Water temp min (°C)", type: "number" }, { key: "water_temp_max", label: "Water temp max", type: "number" },
  { key: "air_temp_min", label: "Greenhouse temp min (°C)", type: "number" }, { key: "air_temp_max", label: "Greenhouse temp max", type: "number" },
  { key: "humidity_min", label: "Humidity min (%)", type: "number" }, { key: "humidity_max", label: "Humidity max", type: "number" },
  { key: "grade_a_min_g", label: "Grade A min weight (g)", type: "number" }, { key: "grade_a_min_leaves", label: "Grade A min leaves", type: "number" },
  { key: "grade_b_min_g", label: "Grade B min weight (g)", type: "number" }, { key: "grade_b_min_leaves", label: "Grade B min leaves", type: "number" },
  { key: "notes", label: "Notes", full: true },
];

function BatchesPage() {
  const { data: batches = [] } = useBatches();
  const { data: profiles = [] } = useProfiles();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [f, setF] = useState({ code: "", crop: "Lettuce", variety: "", seeded_on: toDateKey(new Date()), seeds_sown: "", expected_harvest: "", profile_id: "" });
  const [editBatch, setEditBatch] = useState<(typeof batches)[number] | null>(null);
  const [editProfile, setEditProfile] = useState<CropProfile | "new" | null>(null);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["batches"] }); qc.invalidateQueries({ queryKey: ["crop_profiles"] }); };
  const profileName = (id: string | null) => profiles.find((p) => p.id === id)?.name;

  const batchFields: Field[] = [
    { key: "code", label: "Code" }, { key: "crop", label: "Crop" }, { key: "variety", label: "Variety" },
    { key: "profile_id", label: "Crop profile", type: "select", options: [{ value: "__none", label: "None (default targets)" }, ...profiles.map((p) => ({ value: p.id, label: p.name }))] },
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
      patch = { status: "growing", transplanted_on: today, plant_count: Number(n) || null };
    } else if (b.status === "growing") patch = { status: "harvested", harvested_on: today };
    const err = await updateRow("batches", b.id, patch);
    if (err) { toast.error(err); return; }
    refresh();
  }

  const daysBetween = (a: string, b?: string | null) => Math.round(((b ? new Date(b) : new Date()).getTime() - new Date(a).getTime()) / 86400000);

  return (
    <div className="space-y-6">
      <PageHeader title="Batches" sub="Follow each batch from nursery to harvest." />

      <Section title="Crop profiles" desc="Seasonal targets for EC, pH, temperature, humidity and harvest grades. Assign one to each batch.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((p) => (
            <div key={p.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.crop}{p.season ? ` · ${p.season}` : ""}</div>
                </div>
                <div className="flex">
                  <EditButton onClick={() => setEditProfile(p)} />
                  <DeleteButton what={`profile ${p.name}`} disabled={!me?.isOwner} onConfirm={async () => { const e = await deleteRow("crop_profiles", p.id); refresh(); return e; }} />
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-2 text-xs">
                <dt className="text-muted-foreground">EC</dt><dd>{p.ec_min ?? "?"}–{p.ec_max ?? "?"}</dd>
                <dt className="text-muted-foreground">pH</dt><dd>{p.ph_min ?? "?"}–{p.ph_max ?? "?"}</dd>
                <dt className="text-muted-foreground">Water °C</dt><dd>{p.water_temp_min ?? "?"}–{p.water_temp_max ?? "?"}</dd>
                <dt className="text-muted-foreground">Air °C</dt><dd>{p.air_temp_min ?? "?"}–{p.air_temp_max ?? "?"}</dd>
                <dt className="text-muted-foreground">Humidity</dt><dd>{p.humidity_min ?? "?"}–{p.humidity_max ?? "?"}%</dd>
                <dt className="text-muted-foreground">Grade A</dt><dd>≥{p.grade_a_min_g ?? "?"} g, ≥{p.grade_a_min_leaves ?? 0} leaves</dd>
                <dt className="text-muted-foreground">Grade B</dt><dd>≥{p.grade_b_min_g ?? "?"} g</dd>
              </dl>
            </div>
          ))}
          <button onClick={() => setEditProfile("new")} className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground hover:bg-muted/50">
            <Plus className="h-4 w-4" /> New crop profile
          </button>
        </div>
      </Section>

      <Section title="Start a new batch">
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="L-NOV-A" /></div>
          <div><Label>Crop</Label><Input value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })} /></div>
          <div><Label>Variety</Label><Input value={f.variety} onChange={(e) => setF({ ...f, variety: e.target.value })} placeholder="Butterhead" /></div>
          <div>
            <Label>Crop profile</Label>
            <Select value={f.profile_id} onValueChange={(v) => setF({ ...f, profile_id: v })}>
              <SelectTrigger><SelectValue placeholder={profiles.length ? "Choose profile" : "No profiles yet"} /></SelectTrigger>
              <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
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
                  <EditButton onClick={() => setEditBatch(b)} />
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

      <FieldsDialog
        open={!!editBatch} onOpenChange={(o) => !o && setEditBatch(null)} title={`Edit batch ${editBatch?.code ?? ""}`}
        fields={batchFields} initial={editBatch ? toVals(editBatch, batchFields) : {}}
        onSave={async (v) => {
          if (!editBatch) return;
          const patch = fromVals(v, batchFields);
          if (!patch.code) return "Code is required";
          if (!patch.crop) patch.crop = "Lettuce";
          const e = await updateRow("batches", editBatch.id, patch);
          if (!e) { toast.success("Batch updated"); refresh(); }
          return e;
        }}
      />
      <FieldsDialog
        open={!!editProfile} onOpenChange={(o) => !o && setEditProfile(null)}
        title={editProfile === "new" ? "New crop profile" : "Edit crop profile"} fields={profileFields}
        initial={editProfile === "new" ? toVals({ ...DEFAULT_TARGETS, crop: "Lettuce" }, profileFields) : editProfile ? toVals(editProfile, profileFields) : {}}
        onSave={async (v) => {
          const patch = fromVals(v, profileFields);
          if (!patch.name) return "Give the profile a name";
          if (!patch.crop) patch.crop = "Lettuce";
          if (editProfile === "new") {
            const { error } = await supabase.from("crop_profiles").insert(patch as never);
            if (error) return error.message;
          } else if (editProfile) {
            const e = await updateRow("crop_profiles", editProfile.id, patch);
            if (e) return e;
          }
          toast.success("Profile saved");
          refresh();
        }}
      />
    </div>
  );
}
