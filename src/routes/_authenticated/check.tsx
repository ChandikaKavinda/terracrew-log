import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useProfiles, targetsOf, inRange, GERMINATION_ISSUES } from "@/lib/crop-profiles";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckHistory } from "@/components/check-history";
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
  const [growth, setGrowth] = useState(Array.from({ length: 10 }, () => ({ h: "", l: "", v: "" })));
  const [prev, setPrev] = useState<({ h: number | null; l: number | null; date: string } | null)[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const { data: profiles = [] } = useProfiles();
  const selBatch = batches.find((b) => b.id === f.batch_id);
  const t = targetsOf(profiles.find((p) => p.id === selBatch?.profile_id));
  const { data: lastGrowth } = useQuery({
    queryKey: ["growth-prev", f.batch_id, f.check_date],
    enabled: !!f.batch_id,
    queryFn: async () => {
      const { data } = await supabase.from("growth_measurements").select("*").eq("batch_id", f.batch_id).lt("measured_on", f.check_date).order("measured_on", { ascending: false }).limit(100);
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!f.batch_id) return;
    const rows = lastGrowth ?? [];
    const p = Array.from({ length: 10 }, (_, i) => {
      const r = rows.find((x) => x.plant_no === i + 1);
      return r ? { h: r.height_cm, l: r.leaf_count, date: r.measured_on, v: r.variety } : null;
    });
    setPrev(p);
    setGrowth(p.map((x) => ({ h: x?.h != null ? String(x.h) : "", l: x?.l != null ? String(x.l) : "", v: x?.v ?? selBatch?.variety ?? "" })));
  }, [lastGrowth, f.batch_id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [q, setQ] = useState({ macro: "0", micro: "0", insect: "0", disease: "0", tipburn: "0", other: "0", notes: "" });
  const [germ, setGerm] = useState({ batch_id: "", germinated: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const up = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const defective = ["macro", "micro", "insect", "disease", "tipburn", "other"].reduce((a, k) => a + (Number(q[k as keyof typeof q]) || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (defective > 25) { toast.error("Defect counts add up to more than 25 plants."); return; }
    const phV = num(f.ph);
    if (phV !== null && (phV < 0 || phV > 14)) { toast.error("pH must be between 0 and 14."); return; }
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
          germination_issues: issues,
          notes: f.notes || null,
        })
        .select()
        .single();
      if (error) throw error;

      if (f.batch_id) {
        const rows = growth
          .map((g, i) => ({ batch_id: f.batch_id, check_id: check.id, plant_no: i + 1, variety: g.v || null, measured_on: f.check_date, height_cm: num(g.h), leaf_count: g.l ? Math.round(Number(g.l)) : null }))
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

  const reading = (k: "ec" | "ph" | "water_temp" | "air_temp" | "humidity", label: string, min: number, max: number) => {
    const ok = inRange(num(f[k]), min, max);
    return (
      <div>
        <Label>{label}</Label>
        <Input type="number" step="0.01" inputMode="decimal" value={f[k]} onChange={(e) => up(k, e.target.value)} className={ok === false ? "border-destructive" : ""} />
        <p className={`mt-1 text-xs ${ok === false ? "text-destructive" : "text-muted-foreground"}`}>Target {min}–{max}{ok === false ? " · out of range" : ""}</p>
      </div>
    );
  };

  return (
    <div className="space-y-5">
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

      <Section title="Readings" desc={selBatch ? `Targets from ${profiles.find((p) => p.id === selBatch.profile_id)?.name ?? "default lettuce"} profile.` : "Default lettuce targets. Choose a batch to use its crop profile."}>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {reading("ec", "EC (mS/cm)", t.ec_min, t.ec_max)}
          {reading("ph", "pH", t.ph_min, t.ph_max)}
          {reading("water_temp", "Water temp (°C)", t.water_temp_min, t.water_temp_max)}
          {reading("air_temp", "Greenhouse temp (°C)", t.air_temp_min, t.air_temp_max)}
          {reading("humidity", "Humidity (%)", t.humidity_min, t.humidity_max)}
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

      <Section title="Growth — 10 fixed sample plants" desc={f.batch_id ? "Yesterday's values are filled in — just change what grew." : "Choose a growing batch above to record growth."}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {growth.map((g, i) => {
            const set = (k: "h" | "l" | "v", val: string) => setGrowth((s) => s.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
            const p = prev[i];
            return (
              <div key={i} className="rounded-lg border p-2">
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Plant #{i + 1}</span>
                </div>
                <Input disabled={!f.batch_id} className="mb-1 h-8 text-xs" placeholder="Variety" value={g.v} onChange={(e) => set("v", e.target.value)} />
                <Input disabled={!f.batch_id} placeholder="Height cm" type="number" step="0.1" value={g.h} onChange={(e) => set("h", e.target.value)} />
                <Input disabled={!f.batch_id} className="mt-1" placeholder="Leaves" type="number" value={g.l} onChange={(e) => set("l", e.target.value)} />
                {p && <Badge variant="secondary" className="mt-1 w-full justify-center text-[10px] font-normal">Prev {p.h ?? "–"} cm · {p.l ?? "–"} lv</Badge>}
              </div>
            );
          })}
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
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {GERMINATION_ISSUES.map((g) => (
            <label key={g} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm">
              <Checkbox checked={issues.includes(g)} onCheckedChange={(c) => setIssues((s) => (c ? [...s, g] : s.filter((x) => x !== g)))} />
              {g}
            </label>
          ))}
        </div>
        <Input className="mt-3" placeholder="Other nursery observations (optional)" value={germ.notes} onChange={(e) => setGerm({ ...germ, notes: e.target.value })} />
      </Section>

      <Section title="Other notes">
        <Textarea value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Anything else (e.g. nutrients added, foggers adjusted)" />
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" disabled={busy} className="shadow-lg">{busy ? "Saving…" : "Submit checklist"}</Button>
      </div>
    </form>
    <CheckHistory />
    </div>
  );
}
