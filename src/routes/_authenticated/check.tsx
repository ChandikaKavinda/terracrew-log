import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { useProfiles, stageTargetsOf, stageOf, STAGES, STAGE_LABELS, inRange, GERMINATION_ISSUES, potZone, defectTagsOf, type Zone, type GrowthStage } from "@/lib/crop-profiles";
import { DEFAULT_SETTINGS, effectiveTankLiters, useFarmSettings } from "@/lib/agronomy";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckHistory } from "@/components/check-history";
import { DosingPanel } from "@/components/dosing-panel";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useBatches } from "@/lib/use-me";
import { PageHeader, Section, num } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toDateKey } from "@/lib/reminders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/check")({
  validateSearch: (s: Record<string, unknown>): { edit?: string } => (typeof s["edit"] === "string" ? { edit: s["edit"] } : {}),
  head: () => ({ meta: [{ title: "Daily checklist — GreenLog" }, { name: "description", content: "Quick-tap daily greenhouse walk-through." }] }),
  component: CheckPage,
});

const nowTime = () => new Date().toTimeString().slice(0, 5);
const SAMPLE = 25;

const ZONE_STYLE: Record<Zone, string> = {
  Inlet: "bg-primary/15 text-primary border-primary/30",
  Mid: "bg-accent text-accent-foreground border-accent",
  Outlet: "bg-secondary text-secondary-foreground border-secondary",
};

/** Map a crop-specific tag onto the legacy summary columns used by dashboard charts. */
function legacyKey(tag: string): "macro_deficiency" | "micro_deficiency" | "insect_damage" | "disease" | "tipburn" | "other" {
  const t = tag.toLowerCase();
  if (t.includes("macro") || /nitrogen|phosph|potass|calcium|magnes/.test(t)) return "macro_deficiency";
  if (t.includes("micro") || /iron|mangan|zinc|boron/.test(t)) return "micro_deficiency";
  if (/insect|aphid|mite|thrip|whitefl|caterp|gnat/.test(t)) return "insect_damage";
  if (/disease|mildew|botrytis|mould|mold|rot|blight/.test(t)) return "disease";
  if (t.includes("tip burn") || t.includes("tipburn")) return "tipburn";
  return "other";
}

/** Big two-button yes/no for gloved fingers. */
function YesNo({ label, value, onChange, good }: { label: string; value: boolean; onChange: (v: boolean) => void; good: boolean }) {
  const ok = value === good;
  return (
    <div className={cn("rounded-xl border p-3", !ok && "border-destructive/50 bg-destructive/5")}>
      <div className="mb-2 text-sm font-medium">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            className={cn("h-12 rounded-lg border text-base font-semibold transition-colors",
              value === v ? (v === good ? "border-primary bg-primary text-primary-foreground" : "border-destructive bg-destructive text-destructive-foreground") : "bg-background text-muted-foreground")}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </div>
  );
}

function Pills({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("h-11 min-w-14 rounded-full border px-4 text-sm font-semibold", value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Counter({ label, value, onChange, max, disabled }: { label: string; value: number; onChange: (v: number) => void; max: number; disabled?: boolean }) {
  const set = (v: number) => onChange(Math.max(0, Math.min(max, v)));
  return (
    <div className={cn("rounded-xl border p-3", value > 0 && "border-destructive/50 bg-destructive/5")}>
      <div className="mb-2 min-h-10 text-sm font-medium leading-tight">{label}</div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" disabled={disabled || value === 0} onClick={() => set(value - 1)}><Minus /></Button>
        <div className="flex-1 text-center text-2xl font-bold tabular-nums">{value}</div>
        <Button type="button" size="icon" className="h-12 w-12 shrink-0" disabled={disabled} onClick={() => set(value + 1)}><Plus /></Button>
        <Button type="button" variant="secondary" className="h-12 shrink-0 px-3" disabled={disabled} onClick={() => set(value + 5)}>+5</Button>
      </div>
    </div>
  );
}

const emptyForm = () => ({
  check_date: toDateKey(new Date()), check_time: nowTime(), batch_id: "",
  tank_level: "full", tank_liters_actual: "", growth_stage: "", tank_debris: false, water_source: "rain",
  ec: "", ph: "", water_temp: "", air_temp: "", humidity: "",
  automation_ok: true, ppe_worn: true,
  gh_defects: false, gh_defects_notes: "", insects: false, insects_notes: "", leaks: false, leaks_notes: "",
  flow_ok: true, notes: "",
});
const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function CheckPage() {
  const { edit } = Route.useSearch();
  const { data: batches = [] } = useBatches();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const nursery = batches.filter((b) => b.status === "nursery");

  const [f, setF] = useState(emptyForm);
  const [growth, setGrowth] = useState(Array.from({ length: 10 }, () => ({ h: "", l: "", v: "" })));
  const [prev, setPrev] = useState<({ h: number | null; l: number | null } | null)[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [qNotes, setQNotes] = useState("");
  const [germ, setGerm] = useState({ batch_id: "", germinated: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [loadedEdit, setLoadedEdit] = useState<string | null>(null);
  const { data: profiles = [] } = useProfiles();
  const { data: settings = DEFAULT_SETTINGS } = useFarmSettings();

  const selBatch = batches.find((b) => b.id === f.batch_id);
  const active = batches.filter((b) => b.status !== "harvested" || b.id === f.batch_id);
  const profile = profiles.find((p) => p.id === selBatch?.profile_id);
  const stage = (f.growth_stage || stageOf(selBatch?.status, selBatch?.transplanted_on, f.check_date, settings.grow_days)) as GrowthStage;
  const t = stageTargetsOf(profile, stage);
  const zone = (i: number) => potZone(selBatch?.sentinel_pot_ids[i] ?? "", i + 1);
  const tags = defectTagsOf(profile);
  const up = <K extends keyof ReturnType<typeof emptyForm>>(k: K, v: ReturnType<typeof emptyForm>[K]) => setF((x) => ({ ...x, [k]: v }));

  // Load a checklist for editing
  const { data: editData } = useQuery({
    queryKey: ["check-edit", edit],
    enabled: !!edit,
    queryFn: async () => {
      if (!edit) throw new Error("Choose a checklist to edit");
      const [c, g, q] = await Promise.all([
        supabase.from("daily_checks").select("*").eq("id", edit).single(),
        supabase.from("growth_measurements").select("*").eq("check_id", edit),
        supabase.from("quality_inspections").select("*").eq("check_id", edit).limit(1),
      ]);
      if (c.error) throw c.error;
      return { check: c.data, growth: g.data ?? [], quality: q.data?.[0] ?? null };
    },
  });
  useEffect(() => {
    if (!edit) { if (loadedEdit) { setLoadedEdit(null); setF(emptyForm()); setCounts({}); setIssues([]); setQNotes(""); setGerm({ batch_id: "", germinated: "", notes: "" }); } return; }
    if (!editData || loadedEdit === edit) return;
    const c = editData.check;
    setF({
      check_date: c.check_date, check_time: String(c.check_time).slice(0, 5), batch_id: c.batch_id ?? "",
      tank_level: c.tank_level ?? "full", tank_liters_actual: s(c.tank_liters_actual), growth_stage: c.growth_stage ?? "", tank_debris: c.tank_debris, water_source: c.water_source,
      ec: s(c.ec), ph: s(c.ph), water_temp: s(c.water_temp), air_temp: s(c.air_temp), humidity: s(c.humidity),
      automation_ok: c.automation_ok, ppe_worn: c.ppe_worn,
      gh_defects: c.gh_defects, gh_defects_notes: c.gh_defects_notes ?? "", insects: c.insects, insects_notes: c.insects_notes ?? "",
      leaks: c.leaks, leaks_notes: c.leaks_notes ?? "", flow_ok: c.flow_ok, notes: c.notes ?? "",
    });
    setIssues(c.germination_issues ?? []);
    setGerm({ batch_id: c.nursery_batch_id ?? "", germinated: s(c.germinated_count), notes: c.germination_notes ?? "" });
    setGrowth(Array.from({ length: 10 }, (_, i) => {
      const r = editData.growth.find((x) => x.plant_no === i + 1);
      return { h: s(r?.height_cm), l: s(r?.leaf_count), v: r?.variety ?? "" };
    }));
    const q = editData.quality;
    const dc = (q?.defect_counts ?? {}) as Record<string, number>;
    setCounts(Object.keys(dc).length ? dc : q ? {
      "Macro-nutrient deficiency": q.macro_deficiency, "Micro-nutrient deficiency": q.micro_deficiency, "Insect damage": q.insect_damage,
      Disease: q.disease, "Tip burn": q.tipburn, Other: q.other,
    } : {});
    setQNotes(q?.notes ?? "");
    setLoadedEdit(edit);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [edit, editData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Previous sentinel values for autofill
  const { data: lastGrowth } = useQuery({
    queryKey: ["growth-prev", f.batch_id, f.check_date],
    enabled: !!f.batch_id,
    queryFn: async () => (await supabase.from("growth_measurements").select("*").eq("batch_id", f.batch_id).lt("measured_on", f.check_date).order("measured_on", { ascending: false }).limit(100)).data ?? [],
  });
  useEffect(() => {
    if (!f.batch_id) return;
    const rows = lastGrowth ?? [];
    const p = Array.from({ length: 10 }, (_, i) => {
      const r = rows.find((x) => x.plant_no === i + 1);
      return r ? { h: r.height_cm, l: r.leaf_count, v: r.variety } : null;
    });
    setPrev(p);
    if (edit) return; // keep the saved values when editing
    setGrowth(p.map((x) => ({ h: x?.h != null ? String(x.h) : "", l: x?.l != null ? String(x.l) : "", v: x?.v ?? selBatch?.variety ?? "" })));
  }, [lastGrowth, f.batch_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const defective = Object.entries(counts).filter(([k]) => tags.includes(k)).reduce((a, [, v]) => a + (v || 0), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (defective > SAMPLE) { toast.error(`Defect counts add up to more than ${SAMPLE} plants.`); return; }
    const phV = num(f.ph);
    if (phV !== null && (phV < 0 || phV > 14)) { toast.error("pH must be between 0 and 14."); return; }
    if (f.tank_liters_actual && effectiveTankLiters(settings.tank_liters, f.tank_level, num(f.tank_liters_actual)) === null) { toast.error(`Measured volume must be above 0 and no more than ${settings.tank_liters} L`); return; }
    setBusy(true);
    try {
      const payload = {
        check_date: f.check_date, check_time: f.check_time, batch_id: f.batch_id || null,
        tank_level: f.tank_level, tank_liters_actual: num(f.tank_liters_actual), growth_stage: stage, tank_debris: f.tank_debris, water_source: f.water_source,
        ec: num(f.ec), ph: phV, water_temp: num(f.water_temp), air_temp: num(f.air_temp), humidity: num(f.humidity),
        automation_ok: f.automation_ok, ppe_worn: f.ppe_worn,
        gh_defects: f.gh_defects, gh_defects_notes: f.gh_defects_notes || null,
        insects: f.insects, insects_notes: f.insects_notes || null,
        leaks: f.leaks, leaks_notes: f.leaks_notes || null, flow_ok: f.flow_ok,
        germination_notes: germ.notes || null, germination_issues: issues,
        nursery_batch_id: germ.batch_id || null, germinated_count: germ.germinated ? Number(germ.germinated) : null,
        notes: f.notes || null,
      };
      let checkId: string;
      if (edit) {
        const { error } = await supabase.from("daily_checks").update(payload).eq("id", edit);
        if (error) throw error;
        checkId = edit;
      } else {
        const { data, error } = await supabase.from("daily_checks").insert(payload).select().single();
        if (error) throw error;
        checkId = data.id;
      }

      if (f.batch_id) {
        const rows = growth
          .map((g, i) => ({ batch_id: f.batch_id, check_id: checkId, plant_no: i + 1, zone: zone(i), pot_id: selBatch?.sentinel_pot_ids[i] || null, variety: g.v || null, measured_on: f.check_date, height_cm: num(g.h), leaf_count: g.l ? Math.round(Number(g.l)) : null }))
          .filter((r) => r.height_cm !== null || r.leaf_count !== null);
        if (rows.length) {
          const { error: ge } = await supabase.from("growth_measurements").upsert(rows, { onConflict: "batch_id,plant_no,measured_on" });
          if (ge) throw ge;
        }
        const used: Record<string, number> = {};
        const legacy = { macro_deficiency: 0, micro_deficiency: 0, insect_damage: 0, disease: 0, tipburn: 0, other: 0 };
        for (const tag of tags) { const v = counts[tag] || 0; used[tag] = v; legacy[legacyKey(tag)] += v; }
        const qrow = { batch_id: f.batch_id, check_id: checkId, inspected_on: f.check_date, inspected_count: SAMPLE, healthy: SAMPLE - defective, ...legacy, defect_counts: used, notes: qNotes || null };
        const existing = edit ? editData?.quality?.id : undefined;
        const { error: qe } = existing
          ? await supabase.from("quality_inspections").update(qrow).eq("id", existing)
          : await supabase.from("quality_inspections").insert(qrow);
        if (qe) throw qe;
      }
      if (germ.batch_id && germ.germinated) {
        const { error: be } = await supabase.from("batches").update({ germinated: Number(germ.germinated) }).eq("id", germ.batch_id);
        if (be) throw be;
      }
      await qc.invalidateQueries();
      toast.success(edit ? "Checklist updated" : "Checklist saved");
      navigate({ to: edit ? "/check" : "/dashboard", search: {} });
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
        <Input type="number" step="0.01" inputMode="decimal" value={f[k]} onChange={(e) => up(k, e.target.value)} className={cn("h-12 text-lg", ok === false && "border-destructive")} />
        <p className={`mt-1 text-xs ${ok === false ? "text-destructive" : "text-muted-foreground"}`}>Target {min}–{max}{ok === false ? " · out of range" : ""}</p>
      </div>
    );
  };

  const zoneAvg = (z: Zone) => {
    const hs = growth.map((g, i) => ({ g, z: zone(i) })).filter((x) => x.z === z && x.g.h !== "").map((x) => Number(x.g.h));
    return hs.length ? (hs.reduce((a, b) => a + b, 0) / hs.length).toFixed(1) : "–";
  };

  return (
    <div className="space-y-5">
    <form onSubmit={submit} className="space-y-5">
      <PageHeader title={edit ? "Edit checklist" : "Daily checklist"} sub={edit ? "You are editing a saved checklist. Every section below can be changed." : "Quick-tap walk-through. Fill once per day."} />
      {edit && (
        <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm">
          <span>Editing checklist from <b>{f.check_date}</b></span>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate({ to: "/check", search: {} })}>Cancel edit</Button>
        </div>
      )}

      <Section title="When">
        <div className="grid gap-4 sm:grid-cols-3">
          <div><Label>Date</Label><Input className="h-12" type="date" value={f.check_date} onChange={(e) => up("check_date", e.target.value)} /></div>
          <div><Label>Time</Label><Input className="h-12" type="time" value={f.check_time} onChange={(e) => up("check_time", e.target.value)} /></div>
          <div>
            <Label>Crop batch</Label>
            <Select value={f.batch_id} onValueChange={(v) => setF((x) => ({ ...x, batch_id: v, growth_stage: "" }))}>
              <SelectTrigger className="h-12"><SelectValue placeholder={active.length ? "Choose batch" : "No growing batches"} /></SelectTrigger>
              <SelectContent>{active.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} · {b.crop}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </Section>

      <Section title="Nutrient tank & water">
        <div className="space-y-4">
          <div><Label className="mb-2 block">Water level</Label>
            <Pills value={f.tank_level} onChange={(v) => up("tank_level", v)} options={[{ value: "full", label: "Full" }, { value: "3/4", label: "3/4" }, { value: "1/2", label: "1/2" }, { value: "1/4", label: "1/4" }, { value: "low", label: "Low" }]} />
          </div>
          <div className="max-w-sm"><Label htmlFor="actual-liters">Measured tank volume (L)</Label><Input id="actual-liters" type="number" min="0.1" max={settings.tank_liters} step="0.1" value={f.tank_liters_actual} onChange={(e) => up("tank_liters_actual", e.target.value)} placeholder={`Optional · capacity ${settings.tank_liters} L`} /><p className="mt-1 text-xs text-muted-foreground">Measured volume overrides the selected fraction. Low requires a measurement.</p></div>
          <div><Label className="mb-2 block">Running on</Label>
            <Pills value={f.water_source} onChange={(v) => up("water_source", v)} options={[{ value: "rain", label: "Rain water" }, { value: "tap", label: "Tap water" }]} />
          </div>
          <div className="max-w-sm"><YesNo label="Debris in tank?" value={f.tank_debris} onChange={(v) => up("tank_debris", v)} good={false} /></div>
        </div>
      </Section>

      <Section title="Readings" desc={`${profile?.name ?? "Default lettuce"} · ${STAGE_LABELS[stage]} targets`}>
        <div className="mb-4 max-w-sm"><Label>Growth stage</Label><Select value={stage} onValueChange={(v) => up("growth_stage", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STAGES.map((x) => <SelectItem key={x} value={x}>{STAGE_LABELS[x]}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {reading("ec", "EC (mS/cm)", t.ec_min, t.ec_max)}
          {reading("ph", "pH", t.ph_min, t.ph_max)}
          {reading("water_temp", "Water temp (°C)", t.water_temp_min, t.water_temp_max)}
          {reading("air_temp", "Greenhouse temp (°C)", t.air_temp_min, t.air_temp_max)}
          {reading("humidity", "Humidity (%)", t.humidity_min, t.humidity_max)}
        </div>
        <DosingPanel ec={num(f.ec)} ph={num(f.ph)} airTemp={num(f.air_temp)} humidity={num(f.humidity)} t={t} tankLevel={f.tank_level} actualLiters={num(f.tank_liters_actual)} />
      </Section>

      <Section title="System & safety">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <YesNo label="Automation system working" value={f.automation_ok} onChange={(v) => up("automation_ok", v)} good />
          <YesNo label="PPE worn" value={f.ppe_worn} onChange={(v) => up("ppe_worn", v)} good />
          <YesNo label="Channel flow is good" value={f.flow_ok} onChange={(v) => up("flow_ok", v)} good />
          <YesNo label="Leaks found" value={f.leaks} onChange={(v) => up("leaks", v)} good={false} />
          <YesNo label="Greenhouse defects" value={f.gh_defects} onChange={(v) => up("gh_defects", v)} good={false} />
          <YesNo label="Insects seen" value={f.insects} onChange={(v) => up("insects", v)} good={false} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {f.leaks && <Input className="h-12" placeholder="Where is the leak?" value={f.leaks_notes} onChange={(e) => up("leaks_notes", e.target.value)} />}
          {f.gh_defects && <Input className="h-12" placeholder="Describe greenhouse defect" value={f.gh_defects_notes} onChange={(e) => up("gh_defects_notes", e.target.value)} />}
          {f.insects && <Input className="h-12" placeholder="Which insects / where?" value={f.insects_notes} onChange={(e) => up("insects_notes", e.target.value)} />}
        </div>
      </Section>

      <Section title="Sentinel plants — 10 fixed plants by channel zone" desc={f.batch_id ? "Plants 1–3 Inlet · 4–7 Mid · 8–10 Outlet. Previous values are filled in — change what grew." : "Choose a growing batch above to record growth."}>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {(["Inlet", "Mid", "Outlet"] as Zone[]).map((z) => <Badge key={z} variant="outline" className={cn("px-3 py-1", ZONE_STYLE[z])}>{z} avg height: {zoneAvg(z)} cm</Badge>)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {growth.map((g, i) => {
            const set = (k: "h" | "l" | "v", val: string) => setGrowth((x) => x.map((y, j) => (j === i ? { ...y, [k]: val } : y)));
            const p = prev[i]; const z = zone(i);
            const leaves = Number(g.l) || 0;
            return (
              <div key={i} className={cn("rounded-xl border-2 p-2", ZONE_STYLE[z])}>
                <div className="mb-1 flex items-center justify-between text-xs font-bold"><span>#{i + 1}</span><span>{z}</span></div>
                <Badge variant="outline" className="mb-2 bg-background">{selBatch?.sentinel_pot_ids[i] || "Pot unassigned"}</Badge>
                <Input disabled={!f.batch_id} className="mb-1 h-9 bg-background text-xs" placeholder="Variety" value={g.v} onChange={(e) => set("v", e.target.value)} />
                <Input disabled={!f.batch_id} className="h-11 bg-background" inputMode="decimal" placeholder="Height cm" type="number" step="0.1" value={g.h} onChange={(e) => set("h", e.target.value)} />
                <div className="mt-1 flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" disabled={!f.batch_id || leaves === 0} onClick={() => set("l", String(Math.max(0, leaves - 1)))}><Minus /></Button>
                  <div className="flex-1 text-center"><div className="text-lg font-bold tabular-nums text-foreground">{g.l || 0}</div><div className="text-[10px] text-muted-foreground">leaves</div></div>
                  <Button type="button" size="icon" className="h-11 w-11 shrink-0" disabled={!f.batch_id} onClick={() => set("l", String(leaves + 1))}><Plus /></Button>
                </div>
                {p && <div className="mt-1 text-center text-[10px] text-muted-foreground">Prev {p.h ?? "–"} cm · {p.l ?? "–"} lv</div>}
              </div>
            );
          })}
        </div>
      </Section>

      <Section title={`Quality — ${SAMPLE} random plants`} desc={`${profile ? profile.name : "Default"} defect list. Tap + for each affected plant.`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {tags.map((tag) => (
            <Counter key={tag} label={tag} value={counts[tag] || 0} max={SAMPLE} disabled={!f.batch_id} onChange={(v) => setCounts((c) => ({ ...c, [tag]: v }))} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className={cn("rounded-full px-4 py-2 text-sm font-semibold", defective > SAMPLE ? "bg-destructive text-destructive-foreground" : "bg-primary/15 text-primary")}>
            Healthy {Math.max(0, SAMPLE - defective)} / {SAMPLE} · Defective {defective}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setCounts({})}><RotateCcw className="h-4 w-4" /> Reset</Button>
        </div>
        <Input disabled={!f.batch_id} className="mt-3 h-12" placeholder="Symptoms seen (yellowing, spots…)" value={qNotes} onChange={(e) => setQNotes(e.target.value)} />
      </Section>

      <Section title="Nursery germination">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={germ.batch_id} onValueChange={(v) => setGerm({ ...germ, batch_id: v })}>
            <SelectTrigger className="h-12"><SelectValue placeholder={nursery.length ? "Nursery batch" : "No nursery batches"} /></SelectTrigger>
            <SelectContent>{batches.filter((b) => b.status === "nursery" || b.id === germ.batch_id).map((b) => <SelectItem key={b.id} value={b.id}>{b.code} · {b.seeds_sown ?? "?"} seeds</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-12" type="number" placeholder="Seeds germinated so far" value={germ.germinated} onChange={(e) => setGerm({ ...germ, germinated: e.target.value })} />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {GERMINATION_ISSUES.map((g) => (
            <label key={g} className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm", issues.includes(g) && "border-destructive/50 bg-destructive/5")}>
              <Checkbox className="h-5 w-5" checked={issues.includes(g)} onCheckedChange={(c) => setIssues((x) => (c ? [...x, g] : x.filter((y) => y !== g)))} />
              {g}
            </label>
          ))}
        </div>
        <Input className="mt-3 h-12" placeholder="Other nursery observations (optional)" value={germ.notes} onChange={(e) => setGerm({ ...germ, notes: e.target.value })} />
      </Section>

      <Section title="Other notes">
        <Textarea value={f.notes} onChange={(e) => up("notes", e.target.value)} placeholder="Anything else (e.g. nutrients added, foggers adjusted)" />
      </Section>

      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" disabled={busy} className="h-14 px-8 text-base shadow-lg">{busy ? "Saving…" : edit ? "Save changes" : "Submit checklist"}</Button>
      </div>
    </form>
    <CheckHistory />
    </div>
  );
}
