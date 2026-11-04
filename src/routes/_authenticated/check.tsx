import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBatches } from "@/lib/use-me";
import { PageHeader, Section, num } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateKey } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/check")({
  head: () => ({ meta: [{ title: "Daily checklist — GreenLog" }] }),
  component: CheckPage,
});

const nowTime = () => new Date().toTimeString().slice(0, 5);

function YesNo({ label, value, onChange, good }: { label: string; value: boolean; onChange: (v: boolean) => void; good: boolean }) {
  const ok = value === good;
  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${ok ? "" : "border-destructive/50 bg-destructive/5"}`}>
      <Label className="cursor-pointer">{label}</Label>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{value ? "Yes" : "No"}</span>
        <Switch checked={value} onCheckedChange={onChange} />
      </div>
    </div>
  );
}

function CheckPage() {
  const { data: batches = [] } = useBatches();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const active = batches.filter((b) => b.status === "growing");
  const nursery = batches.filter((b) => b.status === "nursery");

  const [f, setF] = useState({
    check_date: toDateKey(new Date()),
    check_time: nowTime(),
    batch_id: "",
    tank_level: "full",
    tank_debris: false,
    water_source: "rain",
    ec: "", ph: "", water_temp: "", air_temp: "", humidity: "",
    automation_ok: true, ppe_worn: true,
    gh_defects: false, gh_defects_notes: "",
    insects: false, insects_notes: "",
    leaks: false, leaks_notes: "",
    flow_ok: true,
    notes: "",
  });
  const [growth, setGrowth] = useState(Array.from({ length: 10 }, () => ({ h: "", l: "" })));
  const [q, setQ] = useState({ macro: "0", micro: "0", insect: "0", disease: "0", tipburn: "0", other: "0", notes: "" });
  const [germ, setGerm] = useState({ batch_id: "", germinated: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const defective = ["macro", "micro", "insect", "disease", "tipburn", "other"].reduce((a, k) => a + (Number(q[k as keyof typeof q]) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (defective > 25) return toast.error("Defect counts add up to more than 25 plants.");
    const phV = num(f.ph);
    if (phV !== null && (phV < 0 || phV > 14)) return toast.error("pH must be between 0 and 14.");
    setBusy(true);
    try {
      const { data: check, error } = await supabase
        .from("daily_checks")
        .insert({
          check_date: f.check_date, check_time: f.check_time,
          batch_id: f.batch_id || null,
          tank_level: f.tank_level, tank_debris: f.tank_debris, water_source: f.water_source,
          ec: num(f.ec), ph: phV, water_temp: num(f.water_temp), air_temp: num(f.air_temp), humidity: num(f.humidity),
          automation_ok: f.automation_ok, ppe_worn: f.ppe_worn,
          gh_defects: f.gh_defects, gh_defects_notes: f.gh_defects_notes || null,
          insects: f.insects, insects_notes: f.insects_notes || null,
          leaks: f.leaks, leaks_notes: f.leaks_notes || null,
          flow_ok: f.flow_ok,
          germination_notes: germ.notes || null,
          notes: f.notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (f.batch_id) {
        const rows = growth
          .map((g, i) => ({ batch_id: f.batch_id, check_id: check.id, plant_no: i + 1, measured_on: f.check_date, height_cm: num(g.h), leaf_count: g.l ? Math.round(Number(g.l)) : null }))
          .filter((r) => r.height_cm !== null || r.leaf_count !== null);
        if (rows.length) {
          const { error: ge } = await supabase.from("growth_measurements").upsert(rows, { onConflict: "batch_id,plant_no,measured_on" });
          if (ge) throw ge;
        }
        const { error: qe } = await supabase.from("quality_inspections").insert({
          batch_id: f.batch_id, check_id: check.id, inspected_on: f.check_date, inspected_count: 25,
          healthy: 25 - defective,
          macro_deficiency: Number(q.macro) || 0, micro_deficiency: Number(q.micro) || 0,
          insect_damage: Number(q.insect) || 0, disease: Number(q.disease) || 0,
          tipburn: Number(q.tipburn) || 0, other: Number(q.other) || 0, notes: q.notes || null,
        });
        if (qe) throw qe;
      }
      if (germ.batch_id && germ.germinated) {
        const { error: be } = await supabase.from("batches").update({ germinated: Number(germ.germinated) }).eq("id", germ.batch_id);
        if (be) throw be;
      }
      await qc.invalidateQueries();
      toast.success("Checklist saved");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const reading = (k: "ec" | "ph" | "water_temp" | "air_temp" | "humidity", label: string, hint: string) => (
    <div>
      <Label>{label}</Label>
      <Input type="number" step="0.01" inputMode="decimal" value={f[k]} onChange={(e) => up(k, e.target.value)} />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader title="Daily checklist" sub="Fill once per day. Readings feed the dashboard charts." />

      <Section title="When">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Date</Label><Input type="date" value={f.check_date} onChange={(e) => up("check_date", e.target.value)} /></div>
          <div><Label>Time</Label><Input type="time" value={f.check_time} onChange={(e) => up("check_time", e.target.value)} /></div>
          <div>
            <Label>Growing batch</Label>
            <Select value={f.batch_id} onValueChange={(v) => up("batch_id", v)}>
              <SelectTrigger><SelectValue placeholder={active.length ? "Choose batch" : "No growing batches"} /></SelectTrigger>
              <SelectContent>{active.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} · {b.crop}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section title="Nutrient tank & water">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label>Water level</Label>
            <Select value={f.tank_level} onValueChange={(v) => up("tank_level", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="3/4">3/4</SelectItem>
                <SelectItem value="1/2">1/2</SelectItem>
                <SelectItem value="1/4">1/4</SelectItem>
                <SelectItem value="low">Low — refill</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Running on</Label>
            <Select value={f.water_source} onValueChange={(v) => up("water_source", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rain">Rain water</SelectItem>
                <SelectItem value="tap">Tap water</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><div className="w-full"><YesNo label="Debris in tank?" value={f.tank_debris} onChange={(v) => up("tank_debris", v)} good={false} /></div></div>
        </div>
      </Section>

      <Section title="Readings">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {reading("ec", "EC (mS/cm)", "Lettuce: 0.8–1.2")}
          {reading("ph", "pH", "Lettuce: 5.5–6.5")}
          {reading("water_temp", "Water temp (°C)", "Ideal 18–24")}
          {reading("air_temp", "Greenhouse temp (°C)", "Ideal 18–28")}
          {reading("humidity", "Humidity (%)", "Ideal 50–70")}
        </div>
      </Section>

      <Section title="System & safety">
        <div className="grid gap-3 sm:grid-cols-2">
          <YesNo label="Automation system working" value={f.automation_ok} onChange={(v) => up("automation_ok", v)} good />
          <YesNo label="PPE worn" value={f.ppe_worn} onChange={(v) => up("ppe_worn", v)} good />
          <YesNo label="Channel flow is good" value={f.flow_ok} onChange={(v) => up("flow_ok", v)} good />
          <YesNo label="Leaks found" value={f.leaks} onChange={(v) => up("leaks", v)} good={false} />
          <YesNo label="Greenhouse defects" value={f.gh_defects} onChange={(v) => up("gh_defects", v)} good={false} />
          <YesNo label="Insects seen" value={f.insects} onChange={(v) => up("insects", v)} good={false} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {f.leaks && <Input placeholder="Where is the leak?" value={f.leaks_notes} onChange={(e) => up("leaks_notes", e.target.value)} />}
          {f.gh_defects && <Input placeholder="Describe greenhouse defect" value={f.gh_defects_notes} onChange={(e) => up("gh_defects_notes", e.target.value)} />}
          {f.insects && <Input placeholder="Which insects / where?" value={f.insects_notes} onChange={(e) => up("insects_notes", e.target.value)} />}
        </div>
      </Section>

      <Section title="Growth — 10 fixed sample plants" desc={f.batch_id ? "Measure the same 10 tagged plants every day." : "Choose a growing batch above to record growth."}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {growth.map((g, i) => (
            <div key={i} className="rounded-lg border p-2">
              <div className="mb-1 text-xs font-semibold text-muted-foreground">Plant #{i + 1}</div>
              <Input disabled={!f.batch_id} placeholder="Height cm" type="number" step="0.1" value={g.h} onChange={(e) => setGrowth((s) => s.map((x, j) => (j === i ? { ...x, h: e.target.value } : x)))} />
              <Input disabled={!f.batch_id} className="mt-1" placeholder="Leaves" type="number" value={g.l} onChange={(e) => setGrowth((s) => s.map((x, j) => (j === i ? { ...x, l: e.target.value } : x)))} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Quality — 25 random plants" desc="How many of the 25 plants show each problem?">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {([["macro", "Macro-nutrient deficiency (N, P, K…)"], ["micro", "Micro-nutrient deficiency (Fe, Mn…)"], ["insect", "Insect damage"], ["disease", "Disease"], ["tipburn", "Tip burn"], ["other", "Other"]] as const).map(([k, l]) => (
            <div key={k}>
              <Label className="text-xs">{l}</Label>
              <Input disabled={!f.batch_id} type="number" min={0} max={25} value={q[k]} onChange={(e) => setQ({ ...q, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm">Healthy: <b>{Math.max(0, 25 - defective)}</b> / 25</p>
        <Input disabled={!f.batch_id} className="mt-2" placeholder="Symptoms seen (yellowing, spots…)" value={q.notes} onChange={(e) => setQ({ ...q, notes: e.target.value })} />
      </Section>

      <Section title="Nursery germination">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={germ.batch_id} onValueChange={(v) => setGerm({ ...germ, batch_id: v })}>
            <SelectTrigger><SelectValue placeholder={nursery.length ? "Nursery batch" : "No nursery batches"} /></SelectTrigger>
            <SelectContent>{nursery.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} · {b.seeds_sown ?? "?"} seeds</SelectItem>)}</SelectContent>
          </Select>
          <Input type="number" placeholder="Seeds germinated so far" value={germ.germinated} onChange={(e) => setGerm({ ...germ, germinated: e.target.value })} />
          <Input placeholder="Nursery notes" value={germ.notes} onChange={(e) => setGerm({ ...germ, notes: e.target.value })} />
        </div>
      </Section>

      <Section title="Other notes">
        <Textarea value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Anything else (e.g. nutrients added, foggers adjusted)" />
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" disabled={busy} className="shadow-lg">{busy ? "Saving…" : "Submit checklist"}</Button>
      </div>
    </form>
  );
}
