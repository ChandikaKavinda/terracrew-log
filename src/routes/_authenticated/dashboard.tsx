import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Bell, CheckCircle2, Droplets, Thermometer, Wind, FlaskConical, Gauge } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, ReferenceArea } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useBatches, useMe, LKR } from "@/lib/use-me";
import { computeReminders, toDateKey } from "@/lib/reminders";
import { PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeedingPrompts } from "@/components/seeding-prompts";
import { useProfiles, stageTargetsOf, stageOf } from "@/lib/crop-profiles";
import { DEFAULT_SETTINGS, useFarmSettings } from "@/lib/agronomy";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GreenLog" }] }),
  component: Dashboard,
});

const tick = { fontSize: 11, fill: "var(--muted-foreground)" };
const tooltipStyle = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" };
const short = (d: string) => d.slice(5);

function Dashboard() {
  const { data: me } = useMe();
  const { data: batches = [] } = useBatches();
  const qc = useQueryClient();
  const [days, setDays] = useState("30");
  const since = toDateKey(new Date(Date.now() - Number(days) * 86400000));

  const { data } = useQuery({
    queryKey: ["dashboard", since],
    queryFn: async () => {
      const [checks, logs, items, quality] = await Promise.all([
        supabase.from("daily_checks").select("*").gte("check_date", since).order("check_date").order("check_time"),
        supabase.from("maintenance_logs").select("kind, done_at").order("done_at", { ascending: false }).limit(50),
        supabase.from("inventory_items").select("quantity, reorder_level"),
        supabase.from("quality_inspections").select("*").gte("inspected_on", since).order("inspected_on"),
      ]);
      const lastCheck = await supabase.from("daily_checks").select("check_date").order("check_date", { ascending: false }).limit(1);
      return {
        checks: checks.data ?? [],
        logs: logs.data ?? [],
        items: items.data ?? [],
        quality: quality.data ?? [],
        lastCheckDate: lastCheck.data?.[0]?.check_date ?? null,
      };
    },
  });

  const growingBatches = batches.filter((b) => b.status !== "nursery");
  const [batchId, setBatchId] = useState<string>("");
  const selBatch = batchId || growingBatches[0]?.id || "";

  const { data: growth = [] } = useQuery({
    queryKey: ["growth", selBatch],
    enabled: !!selBatch,
    queryFn: async () => {
      const { data } = await supabase.from("growth_measurements").select("*").eq("batch_id", selBatch).order("measured_on");
      return data ?? [];
    },
  });

  const { data: fin } = useQuery({
    queryKey: ["fin-summary"],
    enabled: !!me?.isOwner,
    queryFn: async () => {
      const start = toDateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
      const { data } = await supabase.from("transactions").select("kind, amount").gte("tx_date", start);
      const inc = (data ?? []).filter((t) => t.kind === "income").reduce((a, t) => a + Number(t.amount), 0);
      const exp = (data ?? []).filter((t) => t.kind === "expense").reduce((a, t) => a + Number(t.amount), 0);
      return { inc, exp };
    },
  });

  const checks = data?.checks ?? [];
  const latest = checks[checks.length - 1];
  const { data: profiles = [] } = useProfiles();
  const { data: settings = DEFAULT_SETTINGS } = useFarmSettings();
  const latestBatch = batches.find((b) => b.id === latest?.batch_id);
  const latestProfile = profiles.find((p) => p.id === latestBatch?.profile_id);
  const stage = latest?.growth_stage === "nursery" || latest?.growth_stage === "vegetative" || latest?.growth_stage === "pre_harvest" ? latest.growth_stage : stageOf(latestBatch?.status, latestBatch?.transplanted_on, latest?.check_date ?? toDateKey(new Date()), settings.grow_days);
  const targets = stageTargetsOf(latestProfile, stage);

  // One point per day (average if several checks)
  const daily = useMemo(() => {
    const m = new Map<string, { n: number; ec: number[]; ph: number[]; wt: number[]; at: number[]; hu: number[] }>();
    for (const c of checks) {
      const e = m.get(c.check_date) ?? { n: 0, ec: [], ph: [], wt: [], at: [], hu: [] };
      if (c.ec != null) e.ec.push(Number(c.ec));
      if (c.ph != null) e.ph.push(Number(c.ph));
      if (c.water_temp != null) e.wt.push(Number(c.water_temp));
      if (c.air_temp != null) e.at.push(Number(c.air_temp));
      if (c.humidity != null) e.hu.push(Number(c.humidity));
      m.set(c.check_date, e);
    }
    const avg = (a: number[]) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null);
    return [...m.entries()].map(([d, e]) => ({ date: short(d), ec: avg(e.ec), ph: avg(e.ph), water: avg(e.wt), air: avg(e.at), humidity: avg(e.hu) }));
  }, [checks]);

  const growthDaily = useMemo(() => {
    const m = new Map<string, { h: number[]; l: number[] }>();
    for (const g of growth) {
      const e = m.get(g.measured_on) ?? { h: [], l: [] };
      if (g.height_cm != null) e.h.push(Number(g.height_cm));
      if (g.leaf_count != null) e.l.push(g.leaf_count);
      m.set(g.measured_on, e);
    }
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    let prev: { h: number | null; l: number | null; d: string } | null = null;
    return [...m.entries()].map(([d, e]) => {
      const h = avg(e.h), l = avg(e.l);
      let hr: number | null = null, lr: number | null = null;
      if (prev) {
        const gap = Math.max(1, (new Date(d).getTime() - new Date(prev.d).getTime()) / 86400000);
        if (h != null && prev.h != null) hr = +((h - prev.h) / gap).toFixed(2);
        if (l != null && prev.l != null) lr = +((l - prev.l) / gap).toFixed(2);
      }
      prev = { h, l, d };
      return { date: short(d), height: h != null ? +h.toFixed(1) : null, leaves: l != null ? +l.toFixed(1) : null, heightRate: hr, leafRate: lr };
    });
  }, [growth]);

  const qualityDaily = (data?.quality ?? []).map((q) => ({
    date: short(q.inspected_on), Macro: q.macro_deficiency, Micro: q.micro_deficiency, Insect: q.insect_damage, Disease: q.disease, "Tip burn": q.tipburn, Other: q.other,
  }));

  const lastOf = (k: string) => {
    const r = data?.logs.find((l) => l.kind === k);
    return r ? new Date(r.done_at) : null;
  };
  const reminders = data
    ? computeReminders({
        now: new Date(),
        lastCheckDate: data.lastCheckDate,
        lastFilterCheck: lastOf("filter"),
        lastInventoryCheck: lastOf("inventory"),
        lowStockCount: data.items.filter((i) => Number(i.quantity) <= Number(i.reorder_level)).length,
      })
    : [];

  async function markDone(kind: "filter" | "inventory") {
    const { error } = await supabase.from("maintenance_logs").insert({ kind });
    if (error) { toast.error(error.message); return; }
    toast.success(kind === "filter" ? "Filter check recorded" : "Inventory check recorded");
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const flags = latest
    ? [
        !latest.automation_ok && "Automation not working",
        !latest.ppe_worn && "PPE not worn",
        !latest.flow_ok && "Channel flow problem",
        latest.leaks && `Leak${latest.leaks_notes ? `: ${latest.leaks_notes}` : ""}`,
        latest.insects && `Insects${latest.insects_notes ? `: ${latest.insects_notes}` : ""}`,
        latest.gh_defects && `Greenhouse defect${latest.gh_defects_notes ? `: ${latest.gh_defects_notes}` : ""}`,
        latest.tank_debris && "Debris in tank",
        latest.tank_level === "low" && "Tank level low",
      ].filter(Boolean) as string[]
    : [];

  const kpi = (icon: React.ReactNode, label: string, v: number | null | undefined, unit: string, lo: number, hi: number) => {
    const n = v == null ? null : Number(v);
    const bad = n != null && (n < lo || n > hi);
    return (
      <div className={`rounded-xl border bg-card p-4 ${bad ? "border-destructive/60" : ""}`}>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</div>
        <div className={`mt-2 font-display text-3xl font-bold ${bad ? "text-destructive" : "text-foreground"}`}>{n ?? "—"}<span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span></div>
        <div className="text-xs text-muted-foreground">Target {lo}–{hi}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hello, ${me?.name?.split(" ")[0] ?? ""}`}
        sub={latest ? `Last checklist ${latest.check_date} at ${latest.check_time.slice(0, 5)} · ${latest.water_source === "rain" ? "Rain water" : "Tap water"}` : "No checklist recorded yet."}
        actions={
          <div className="flex gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild><Link to="/check">Fill today's checklist</Link></Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Bell className="h-5 w-5 text-primary" /> Reminders</h2>
          {reminders.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> All caught up.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {reminders.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {r.title}
                      <Badge variant={r.severity === "overdue" ? "destructive" : "secondary"}>{r.severity}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.detail}</div>
                  </div>
                  {r.id === "daily-check" && <Button size="sm" asChild><Link to="/check">Open checklist</Link></Button>}
                  {r.id === "filter" && <Button size="sm" variant="outline" onClick={() => markDone("filter")}>Mark filter checked</Button>}
                  {r.id === "inventory" && <Button size="sm" variant="outline" onClick={() => markDone("inventory")}>Mark inventory checked</Button>}
                  {r.id === "low-stock" && <Button size="sm" variant="outline" asChild><Link to="/inventory">View stock</Link></Button>}
                </li>
              ))}
            </ul>
          )}
          {!reminders.some((r) => r.id === "filter") && (
            <Button variant="link" size="sm" className="mt-2 px-0" onClick={() => markDone("filter")}>Record a filter check now</Button>
          )}
        </div>
        <div className="rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><AlertTriangle className="h-5 w-5 text-warning" /> Latest issues</h2>
          {flags.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No problems reported in the last checklist.</p> : (
            <ul className="mt-3 space-y-1 text-sm">{flags.map((x) => <li key={x} className="rounded bg-destructive/10 px-2 py-1 text-destructive">{x}</li>)}</ul>
          )}
          {me?.isOwner && fin && (
            <div className="mt-4 border-t pt-4 text-sm">
              <div className="text-muted-foreground">This month</div>
              <div className="mt-1 flex justify-between"><span>Income</span><b>{LKR(fin.inc)}</b></div>
              <div className="flex justify-between"><span>Expenses</span><b>{LKR(fin.exp)}</b></div>
              <div className="flex justify-between"><span>Profit</span><b className={fin.inc - fin.exp < 0 ? "text-destructive" : "text-success"}>{LKR(fin.inc - fin.exp)}</b></div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {kpi(<Gauge className="h-4 w-4" />, "EC", latest?.ec, "mS/cm", targets.ec_min, targets.ec_max)}
        {kpi(<FlaskConical className="h-4 w-4" />, "pH", latest?.ph, "", targets.ph_min, targets.ph_max)}
        {kpi(<Droplets className="h-4 w-4" />, "Water temp", latest?.water_temp, "°C", targets.water_temp_min, targets.water_temp_max)}
        {kpi(<Thermometer className="h-4 w-4" />, "Air temp", latest?.air_temp, "°C", targets.air_temp_min, targets.air_temp_max)}
        {kpi(<Wind className="h-4 w-4" />, "Humidity", latest?.humidity, "%", targets.humidity_min, targets.humidity_max)}
      </div>
      <SeedingPrompts />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="EC & pH" desc="Shaded bands show the target range. Adjust nutrients when lines leave them.">
          <ChartBox empty={!daily.length}>
            <LineChart data={daily}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={tick} />
              <YAxis yAxisId="ec" tick={tick} domain={[0, 3]} />
              <YAxis yAxisId="ph" orientation="right" tick={tick} domain={[4, 8]} />
              <ReferenceArea yAxisId="ec" y1={targets.ec_min} y2={targets.ec_max} fill="var(--chart-1)" fillOpacity={0.08} />
              <ReferenceArea yAxisId="ph" y1={targets.ph_min} y2={targets.ph_max} fill="var(--chart-2)" fillOpacity={0.08} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line yAxisId="ec" dataKey="ec" name="EC" stroke="var(--chart-1)" strokeWidth={2} connectNulls />
              <Line yAxisId="ph" dataKey="ph" name="pH" stroke="var(--chart-2)" strokeWidth={2} connectNulls />
            </LineChart>
          </ChartBox>
        </Section>
        <Section title="Temperature & humidity" desc="Use this to decide when to run the foggers.">
          <ChartBox empty={!daily.length}>
            <LineChart data={daily}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={tick} />
              <YAxis yAxisId="t" tick={tick} unit="°" />
              <YAxis yAxisId="h" orientation="right" tick={tick} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line yAxisId="t" dataKey="water" name="Water °C" stroke="var(--chart-2)" strokeWidth={2} connectNulls />
              <Line yAxisId="t" dataKey="air" name="Greenhouse °C" stroke="var(--chart-4)" strokeWidth={2} connectNulls />
              <Line yAxisId="h" dataKey="humidity" name="Humidity %" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="5 3" connectNulls />
            </LineChart>
          </ChartBox>
        </Section>
      </div>

      <Section title="Plant growth — 10 sample plants" desc="Average height and leaf count, plus growth per day.">
        <div className="mb-3">
          <Select value={selBatch} onValueChange={setBatchId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="No batches yet" /></SelectTrigger>
            <SelectContent>{growingBatches.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} · {b.crop}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartBox empty={!growthDaily.length}>
            <LineChart data={growthDaily}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={tick} />
              <YAxis yAxisId="h" tick={tick} unit="cm" />
              <YAxis yAxisId="l" orientation="right" tick={tick} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line yAxisId="h" dataKey="height" name="Avg height (cm)" stroke="var(--chart-1)" strokeWidth={2} connectNulls />
              <Line yAxisId="l" dataKey="leaves" name="Avg leaves" stroke="var(--chart-5)" strokeWidth={2} connectNulls />
            </LineChart>
          </ChartBox>
          <ChartBox empty={growthDaily.length < 2}>
            <BarChart data={growthDaily.slice(1)}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={tick} />
              <YAxis tick={tick} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="heightRate" name="cm / day" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leafRate" name="leaves / day" fill="var(--chart-5)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartBox>
        </div>
      </Section>

      <Section title="Produce quality — 25 random plants" desc="Number of plants with each problem per day.">
        <ChartBox empty={!qualityDaily.length}>
          <BarChart data={qualityDaily}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={tick} />
            <YAxis tick={tick} domain={[0, 25]} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar stackId="q" dataKey="Macro" fill="var(--chart-3)" />
            <Bar stackId="q" dataKey="Micro" fill="var(--chart-5)" />
            <Bar stackId="q" dataKey="Insect" fill="var(--chart-4)" />
            <Bar stackId="q" dataKey="Disease" fill="var(--destructive)" />
            <Bar stackId="q" dataKey="Tip burn" fill="var(--chart-2)" />
            <Bar stackId="q" dataKey="Other" fill="var(--muted-foreground)" />
          </BarChart>
        </ChartBox>
      </Section>
    </div>
  );
}

function ChartBox({ children, empty }: { children: React.ReactElement; empty: boolean }) {
  if (empty) return <div className="flex h-64 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">Not enough data yet — fill a few checklists.</div>;
  return <div className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}
