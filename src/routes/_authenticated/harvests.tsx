import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useBatches, useMe } from "@/lib/use-me";
import { useProfiles, targetsOf, isBrix } from "@/lib/crop-profiles";
import { deleteRow, updateRow } from "@/lib/db-actions";
import { FieldsDialog, DeleteButton, EditButton, toVals, fromVals, type Field } from "@/components/edit-dialog";
import { PageHeader, Section, num } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toDateKey } from "@/lib/reminders";
import { remainingPlants } from "@/lib/agronomy";
import { usePopulation } from "@/lib/use-population";

export const Route = createFileRoute("/_authenticated/harvests")({
  head: () => ({ meta: [{ title: "Harvest & grading — GreenLog" }] }),
  component: HarvestPage,
});

function HarvestPage() {
  const { data: batches = [] } = useBatches();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery({
    queryKey: ["harvests"],
    queryFn: async () => (await supabase.from("harvests").select("*, batches(code, crop)").order("harvested_on", { ascending: false })).data ?? [],
  });
  const empty = { batch_id: "", profile_id: "", harvested_on: toDateKey(new Date()), plants_harvested: "", total_weight_kg: "", avg_leaf_count: "", avg_brix: "", grade_a: "", grade_b: "", grade_c: "", rejected: "", notes: "" };
  const [f, setF] = useState(empty);
  const { data: me } = useMe();
  const { data: profiles = [] } = useProfiles();
  const [edit, setEdit] = useState<(typeof rows)[number] | null>(null);
  const { data: population } = usePopulation();
  const selectedBatch = batches.find((b) => b.id === f.batch_id);
  const prof = profiles.find((p) => p.id === f.profile_id);
  const remaining = selectedBatch ? remainingPlants(selectedBatch, population?.harvested[selectedBatch.id], population?.lost[selectedBatch.id]) : 0;
  const t = targetsOf(prof);
  const fields: Field[] = [
    { key: "batch_id", label: "Batch", type: "select", options: batches.map((b) => ({ value: b.id, label: b.code })) },
    { key: "profile_id", label: "Crop profile", type: "select", options: profiles.map((p) => ({ value: p.id, label: p.name })) },
    { key: "harvested_on", label: "Date", type: "date" },
    { key: "plants_harvested", label: "Plants harvested", type: "number" }, { key: "total_weight_kg", label: "Total weight (kg)", type: "number" },
    ...(isBrix(profiles.find((p) => p.id === (edit?.profile_id ?? batches.find((b) => b.id === edit?.batch_id)?.profile_id))) ? [{ key: "avg_brix", label: "Avg Brix °", type: "number" as const }] : [{ key: "avg_leaf_count", label: "Avg leaves / plant", type: "number" as const }]),
    { key: "grade_a", label: "Grade A", type: "number" }, { key: "grade_b", label: "Grade B", type: "number" },
    { key: "grade_c", label: "Grade C", type: "number" }, { key: "rejected", label: "Rejected", type: "number" },
    { key: "notes", label: "Notes", full: true },
  ];
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.batch_id) { toast.error("Choose a batch"); return; }
    if (!prof) { toast.error("Choose a crop profile"); return; }
    if (selectedBatch?.profile_id && selectedBatch.profile_id !== prof.id) { toast.error("Use the crop profile assigned to this batch"); return; }
    if (!Number.isInteger(Number(f.plants_harvested)) || Number(f.plants_harvested) <= 0 || Number(f.plants_harvested) > remaining) { toast.error(`Harvest between 1 and ${remaining} remaining plants`); return; }
    const { error } = await supabase.from("harvests").insert({
      batch_id: f.batch_id, profile_id: prof.id, harvested_on: f.harvested_on,
      plants_harvested: Number(f.plants_harvested) || 0, total_weight_kg: Number(f.total_weight_kg) || 0,
      avg_leaf_count: isBrix(prof) ? null : num(f.avg_leaf_count), avg_brix: isBrix(prof) ? num(f.avg_brix) : null,
      grade_a: Number(f.grade_a) || 0, grade_b: Number(f.grade_b) || 0, grade_c: Number(f.grade_c) || 0, rejected: Number(f.rejected) || 0,
      notes: f.notes || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Harvest recorded");
    setF(empty);
    qc.invalidateQueries();
  }

  const chart = [...rows].reverse().map((r) => ({ name: `${r.batches?.code ?? ""} ${r.harvested_on.slice(5)}`, A: r.grade_a, B: r.grade_b, C: r.grade_c, Rejected: r.rejected }));

  return (
    <div className="space-y-6">
      <PageHeader title={prof ? `Harvest & grading · ${prof.crop}` : "Harvest & grading"} sub={isBrix(prof)
        ? `${prof?.name} grades — A: ≥${t.grade_a_min_g} g & ≥${prof?.grade_a_min_brix ?? "?"}° Brix · B: ≥${t.grade_b_min_g} g & ≥${prof?.grade_b_min_brix ?? "?"}° Brix · C: below B.`
        : `${prof ? prof.name : "Default"} grades — A: ≥${t.grade_a_min_g} g & ≥${t.grade_a_min_leaves} leaves · B: ≥${t.grade_b_min_g} g${t.grade_b_min_leaves ? ` & ≥${t.grade_b_min_leaves} leaves` : ""} · C: below B. Pick a batch to see its profile.`} />
      <section className="border-y py-5">
        <div className="mb-4 max-w-md"><Label>Crop profile</Label><Select value={f.profile_id} onValueChange={(v) => setF({ ...f, profile_id: v, batch_id: selectedBatch?.profile_id && selectedBatch.profile_id !== v ? "" : f.batch_id, avg_leaf_count: "", avg_brix: "" })}><SelectTrigger aria-label="Crop profile"><SelectValue placeholder="Select grading profile" /></SelectTrigger><SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
        <h2 className="mb-3 text-lg font-semibold">{prof?.name ?? "Harvest"} standards</h2>
        {prof ? <div className="grid gap-3 sm:grid-cols-3">{(["A", "B", "C"] as const).map((grade) => <div key={grade} className="rounded-lg border bg-card p-4"><div className="font-semibold">Grade {grade}</div><p className="mt-1 text-sm text-muted-foreground">{grade === "C" ? "Below Grade B" : `≥${grade === "A" ? t.grade_a_min_g : t.grade_b_min_g} g and ${isBrix(prof) ? `≥${grade === "A" ? prof.grade_a_min_brix ?? 0 : prof.grade_b_min_brix ?? 0}° Brix` : `≥${grade === "A" ? t.grade_a_min_leaves : t.grade_b_min_leaves} leaves`}`}</p></div>)}</div> : <p className="text-sm text-muted-foreground">No crop profile selected.</p>}
      </section>
      <Section title="Record a harvest">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <Label>Batch</Label>
            <Select value={f.batch_id} onValueChange={(v) => { const b = batches.find((x) => x.id === v); setF({ ...f, batch_id: v, profile_id: b?.profile_id ?? f.profile_id, avg_leaf_count: "", avg_brix: "" }); }}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{batches.filter((b) => b.status === "growing" && (!f.profile_id || !b.profile_id || b.profile_id === f.profile_id)).map((b) => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={f.harvested_on} onChange={set("harvested_on")} /></div>
          <div><Label>Plants harvested</Label><Input type="number" min="1" max={remaining || undefined} value={f.plants_harvested} onChange={set("plants_harvested")} />{selectedBatch && <p className="mt-1 text-xs text-muted-foreground">{remaining} remaining · final harvest completes batch</p>}</div>
          <div><Label>Total weight (kg)</Label><Input type="number" step="0.01" value={f.total_weight_kg} onChange={set("total_weight_kg")} /></div>
          {isBrix(prof) ? <div><Label>Avg Brix °</Label><Input type="number" step="0.1" value={f.avg_brix} onChange={set("avg_brix")} /></div> : <div><Label>Avg leaves / plant</Label><Input type="number" step="0.1" value={f.avg_leaf_count} onChange={set("avg_leaf_count")} /></div>}
          <div><Label>Grade A</Label><Input type="number" value={f.grade_a} onChange={set("grade_a")} /></div>
          <div><Label>Grade B</Label><Input type="number" value={f.grade_b} onChange={set("grade_b")} /></div>
          <div><Label>Grade C</Label><Input type="number" value={f.grade_c} onChange={set("grade_c")} /></div>
          <div><Label>Rejected</Label><Input type="number" value={f.rejected} onChange={set("rejected")} /></div>
          <div className="flex items-end"><Button disabled={!prof || !f.batch_id} className="w-full">Save</Button></div>
          <div className="sm:col-span-3 lg:col-span-5"><Input placeholder="Notes" value={f.notes} onChange={set("notes")} /></div>
        </form>
      </Section>

      {chart.length > 0 && (
        <Section title="Grade breakdown">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Bar stackId="g" dataKey="A" fill="var(--chart-1)" />
                <Bar stackId="g" dataKey="B" fill="var(--chart-5)" />
                <Bar stackId="g" dataKey="C" fill="var(--chart-3)" />
                <Bar stackId="g" dataKey="Rejected" fill="var(--chart-4)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      <Section title="Harvest history">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Date</TableHead><TableHead>Batch / profile</TableHead><TableHead>Plants</TableHead><TableHead>Weight</TableHead><TableHead>Avg g/plant</TableHead><TableHead>Leaves / Brix</TableHead><TableHead>A / B / C / Rej</TableHead><TableHead>% Grade A</TableHead><TableHead /></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.harvested_on}</TableCell>
                <TableCell>{r.batches?.code}<div className="text-xs text-muted-foreground">{profiles.find((p) => p.id === r.profile_id)?.name}</div></TableCell>
                <TableCell>{r.plants_harvested}</TableCell>
                <TableCell>{Number(r.total_weight_kg)} kg</TableCell>
                <TableCell>{r.plants_harvested ? Math.round((Number(r.total_weight_kg) * 1000) / r.plants_harvested) : "—"}</TableCell>
                <TableCell>{r.avg_brix != null ? `${r.avg_brix}° Brix` : r.avg_leaf_count != null ? `${r.avg_leaf_count} leaves` : "—"}</TableCell>
                <TableCell>{r.grade_a} / {r.grade_b} / {r.grade_c} / {r.rejected}</TableCell>
                <TableCell>{r.plants_harvested ? Math.round((r.grade_a / r.plants_harvested) * 100) + "%" : "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <EditButton onClick={() => setEdit(r)} />
                  <DeleteButton what="this harvest record" disabled={!me?.isOwner} onConfirm={async () => { const e = await deleteRow("harvests", r.id); qc.invalidateQueries(); return e; }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <p className="py-4 text-sm text-muted-foreground">No harvests yet.</p>}
      </Section>
      <FieldsDialog
        open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title="Edit harvest" fields={fields}
        initial={edit ? toVals(edit, fields) : {}}
        onSave={async (v) => {
          if (!edit) return null;
          const patch = fromVals(v, fields);
          for (const k of ["plants_harvested", "total_weight_kg", "grade_a", "grade_b", "grade_c", "rejected"]) patch[k] = patch[k] ?? 0;
          const e = await updateRow("harvests", edit.id, patch);
          if (!e) { toast.success("Harvest updated"); qc.invalidateQueries(); }
          return e;
        }}
      />
    </div>
  );
}
