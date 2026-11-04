import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useBatches } from "@/lib/use-me";
import { PageHeader, Section, num } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toDateKey } from "@/lib/reminders";

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
  const empty = { batch_id: "", harvested_on: toDateKey(new Date()), plants_harvested: "", total_weight_kg: "", avg_leaf_count: "", grade_a: "", grade_b: "", grade_c: "", rejected: "", notes: "" };
  const [f, setF] = useState(empty);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.batch_id) return toast.error("Choose a batch");
    const { error } = await supabase.from("harvests").insert({
      batch_id: f.batch_id, harvested_on: f.harvested_on,
      plants_harvested: Number(f.plants_harvested) || 0, total_weight_kg: Number(f.total_weight_kg) || 0,
      avg_leaf_count: num(f.avg_leaf_count),
      grade_a: Number(f.grade_a) || 0, grade_b: Number(f.grade_b) || 0, grade_c: Number(f.grade_c) || 0, rejected: Number(f.rejected) || 0,
      notes: f.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Harvest recorded");
    setF(empty);
    qc.invalidateQueries({ queryKey: ["harvests"] });
  }

  const chart = [...rows].reverse().map((r) => ({ name: `${r.batches?.code ?? ""} ${r.harvested_on.slice(5)}`, A: r.grade_a, B: r.grade_b, C: r.grade_c, Rejected: r.rejected }));

  return (
    <div className="space-y-6">
      <PageHeader title="Harvest & grading" sub="Grade A: ≥150 g & ≥12 leaves, firm, no defects · B: 100–150 g or minor blemish · C: under 100 g or visible defects (adjust to your market)." />
      <Section title="Record a harvest">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <Label>Batch</Label>
            <Select value={f.batch_id} onValueChange={(v) => setF({ ...f, batch_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
              <SelectContent>{batches.filter((b) => b.status !== "nursery").map((b) => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={f.harvested_on} onChange={set("harvested_on")} /></div>
          <div><Label>Plants harvested</Label><Input type="number" value={f.plants_harvested} onChange={set("plants_harvested")} /></div>
          <div><Label>Total weight (kg)</Label><Input type="number" step="0.01" value={f.total_weight_kg} onChange={set("total_weight_kg")} /></div>
          <div><Label>Avg leaves / plant</Label><Input type="number" step="0.1" value={f.avg_leaf_count} onChange={set("avg_leaf_count")} /></div>
          <div><Label>Grade A</Label><Input type="number" value={f.grade_a} onChange={set("grade_a")} /></div>
          <div><Label>Grade B</Label><Input type="number" value={f.grade_b} onChange={set("grade_b")} /></div>
          <div><Label>Grade C</Label><Input type="number" value={f.grade_c} onChange={set("grade_c")} /></div>
          <div><Label>Rejected</Label><Input type="number" value={f.rejected} onChange={set("rejected")} /></div>
          <div className="flex items-end"><Button className="w-full">Save</Button></div>
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
            <TableRow><TableHead>Date</TableHead><TableHead>Batch</TableHead><TableHead>Plants</TableHead><TableHead>Weight</TableHead><TableHead>Avg g/plant</TableHead><TableHead>Avg leaves</TableHead><TableHead>A / B / C / Rej</TableHead><TableHead>% Grade A</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.harvested_on}</TableCell>
                <TableCell>{r.batches?.code}</TableCell>
                <TableCell>{r.plants_harvested}</TableCell>
                <TableCell>{Number(r.total_weight_kg)} kg</TableCell>
                <TableCell>{r.plants_harvested ? Math.round((Number(r.total_weight_kg) * 1000) / r.plants_harvested) : "—"}</TableCell>
                <TableCell>{r.avg_leaf_count ?? "—"}</TableCell>
                <TableCell>{r.grade_a} / {r.grade_b} / {r.grade_c} / {r.rejected}</TableCell>
                <TableCell>{r.plants_harvested ? Math.round((r.grade_a / r.plants_harvested) * 100) + "%" : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <p className="py-4 text-sm text-muted-foreground">No harvests yet.</p>}
      </Section>
    </div>
  );
}
