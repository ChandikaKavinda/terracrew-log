import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useBatches, useMe, LKR } from "@/lib/use-me";
import { useProfiles, targetsOf, potZone, isBrix, type Zone } from "@/lib/crop-profiles";
import { DEFAULT_SETTINGS, dayNum, daysToTarget, harvestDay, remainingPlants, fromDayNum, shareCost, slope, useFarmSettings, type FarmSettings } from "@/lib/agronomy";
import { usePopulation } from "@/lib/use-population";
import { SeedingPrompts } from "@/components/seeding-prompts";
import { toDateKey } from "@/lib/reminders";
import { PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => pageMeta("Insights & planning — GreenLog", "Plan nursery seeding, channel turnover and harvest forecasts with live plant counts."),
  component: InsightsPage,
});

const tick = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" };
const ZONES: Zone[] = ["Inlet", "Mid", "Outlet"];
const ZC: Record<Zone, string> = { Inlet: "var(--chart-1)", Mid: "var(--chart-2)", Outlet: "var(--chart-4)" };
const today = () => toDateKey(new Date());

function InsightsPage() {
  const { data: me } = useMe();
  const { data: batches = [] } = useBatches();
  const { data: profiles = [] } = useProfiles();
  const { data: s = DEFAULT_SETTINGS } = useFarmSettings();
  const { data: population } = usePopulation();
  const liveBatches = batches.map((b) => ({ ...b, plant_count: remainingPlants(b, population?.harvested[b.id], population?.lost[b.id]) }));
  const growing = batches.filter((b) => b.status === "growing");
  const [bid, setBid] = useState("");
  useEffect(() => { if (!bid && growing[0]) setBid(growing[0].id); }, [growing, bid]);
  const batch = batches.find((b) => b.id === bid);
  const profile = profiles.find((p) => p.id === batch?.profile_id);

  const { data: growth = [] } = useQuery({
    queryKey: ["insights-growth", bid], enabled: !!bid,
    queryFn: async () => (await supabase.from("growth_measurements").select("*").eq("batch_id", bid).order("measured_on")).data ?? [],
  });
  const { data: harvests = [] } = useQuery({
    queryKey: ["harvests"], queryFn: async () => (await supabase.from("harvests").select("*").order("harvested_on")).data ?? [],
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Insights & planning" sub="Channel diagnostics, harvest forecasts, cost per head and planting schedule."
        actions={
          <Select value={bid} onValueChange={setBid}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Choose batch" /></SelectTrigger>
            <SelectContent>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.code} · {b.status}</SelectItem>)}</SelectContent>
          </Select>
        } />
      <Gradient growth={growth} />
      {batch && <Forecast batch={{ ...batch, plant_count: remainingPlants(batch, population?.harvested[batch.id], population?.lost[batch.id]) }} growth={growth} harvests={harvests} batches={batches} s={s} profile={profile} />}
      <SeedingPrompts />
      <Planner batches={liveBatches} s={s} />
      {me?.isOwner && <Economics batches={batches} harvests={harvests} />}
      {me?.isOwner && <SettingsForm s={s} />}
    </div>
  );
}

type G = { measured_on: string; plant_no: number; height_cm: number | null; leaf_count: number | null; pot_id?: string | null; zone?: string | null };
const growthZone = (g: G): Zone => g.zone === "Inlet" || g.zone === "Mid" || g.zone === "Outlet" ? g.zone : potZone(g.pot_id ?? "", g.plant_no);

function Gradient({ growth }: { growth: G[] }) {
  const { series, rates } = useMemo(() => {
    const byDate = new Map<string, Record<string, number[]>>();
    for (const g of growth) {
      const z = growthZone(g);
      const e = byDate.get(g.measured_on) ?? {};
      if (g.height_cm !== null) (e[z] ??= []).push(Number(g.height_cm));
      byDate.set(g.measured_on, e);
    }
    const avg = (a?: number[]) => (a?.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null);
    const series = [...byDate.entries()].map(([d, e]) => ({ date: d.slice(5), day: dayNum(d), Inlet: avg(e["Inlet"]), Mid: avg(e["Mid"]), Outlet: avg(e["Outlet"]) }));
    const rates = ZONES.map((z) => {
      const h = slope(series.filter((p) => p[z] !== null).map((p) => ({ x: p.day, y: p[z] as number })));
      const lv = slope(growth.filter((g) => growthZone(g) === z && g.leaf_count !== null).map((g) => ({ x: dayNum(g.measured_on), y: Number(g.leaf_count) })));
      return { zone: z, "Height cm/day": h === null ? 0 : +h.toFixed(2), "Leaves/day": lv === null ? 0 : +lv.toFixed(2) };
    });
    return { series, rates };
  }, [growth]);
  const inlet = rates[0]?.["Height cm/day"] ?? 0, outlet = rates[2]?.["Height cm/day"] ?? 0;
  const drop = inlet > 0 ? Math.round(((inlet - outlet) / inlet) * 100) : null;

  return (
    <Section title="Channel gradient — Inlet vs Mid vs Outlet" desc="Sentinel plants 1–3 Inlet, 4–7 Mid, 8–10 Outlet. Slower outlet growth points to nutrient or oxygen drop-off along the channel.">
      {series.length < 2 ? <p className="text-sm text-muted-foreground">Record sentinel plants on at least two days to see the gradient.</p> : (
        <>
          {drop !== null && (
            <div className={`mb-4 rounded-lg border p-3 text-sm ${drop > 15 ? "border-destructive/50 bg-destructive/10" : "border-success/40 bg-success/10"}`}>
              {drop > 15
                ? <>Outlet plants grow <b>{drop}% slower</b> than inlet. Check flow rate per channel, raise dissolved oxygen (air stones, shorter channels) and confirm EC at the outlet end.</>
                : <>Growth is even along the channel ({drop}% difference). Flow and nutrients reach the outlet well.</>}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64"><ResponsiveContainer><LineChart data={series}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tick={tick} /><YAxis tick={tick} unit="cm" />
              <Tooltip contentStyle={tip} /><Legend />
              {ZONES.map((z) => <Line key={z} dataKey={z} stroke={ZC[z]} strokeWidth={2} dot={false} connectNulls />)}
            </LineChart></ResponsiveContainer></div>
            <div className="h-64"><ResponsiveContainer><BarChart data={rates}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="zone" tick={tick} /><YAxis tick={tick} />
              <Tooltip contentStyle={tip} /><Legend />
              <Bar dataKey="Height cm/day" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Leaves/day" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
            </BarChart></ResponsiveContainer></div>
          </div>
        </>
      )}
    </Section>
  );
}

type B = ReturnType<typeof useBatches>["data"] extends (infer T)[] | undefined ? T : never;
type H = { batch_id: string; harvested_on: string; plants_harvested: number; total_weight_kg: number; rejected: number };

function Forecast({ batch, growth, harvests, batches, s, profile }: { batch: B; growth: G[]; harvests: H[]; batches: B[]; s: FarmSettings; profile: Parameters<typeof targetsOf>[0] }) {
  const t = targetsOf(profile);
  const brix = isBrix(profile);
  // Historical: kg per plant & transplant→harvest days for the same crop
  const same = batches.filter((b) => b.crop === batch.crop && b.id !== batch.id);
  const hs = harvests.filter((h) => same.some((b) => b.id === h.batch_id));
  const plants = hs.reduce((a, h) => a + h.plants_harvested, 0);
  const histKgPerPlant = plants ? hs.reduce((a, h) => a + Number(h.total_weight_kg), 0) / plants : null;
  const cycles = same.flatMap((b) => b.transplanted_on && b.harvested_on ? [dayNum(b.harvested_on) - dayNum(b.transplanted_on)] : []);
  const histDays = cycles.length ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null;

  const byDay = new Map<number, number[]>();
  for (const g of growth) if (g.leaf_count !== null) { const d = dayNum(g.measured_on); byDay.set(d, [...(byDay.get(d) ?? []), Number(g.leaf_count)]); }
  const pts = [...byDay.entries()].map(([x, a]) => ({ x, y: a.reduce((p, q) => p + q, 0) / a.length })).sort((a, b) => a.x - b.x);
  const rate = slope(pts);
  const last = pts.at(-1);
  const dt = !brix && last ? daysToTarget(last.y, t.grade_a_min_leaves, rate) : null;

  const fallbackDay = harvestDay(batch, s, histDays ?? s.grow_days);
  let predicted: number; let basis: string;
  if (batch.status === "nursery" || !batch.transplanted_on) {
    predicted = fallbackDay;
    basis = batch.expected_harvest ? "planned harvest date (nursery phase)" : `nursery phase: seeding + ${s.nursery_days} nursery days + ${histDays ?? s.grow_days} grow-out days`;
  } else if (dt !== null && last) { predicted = Math.max(last.x + dt, dayNum(today())); basis = `sentinel leaf velocity ${(rate ?? 0).toFixed(2)} leaves/day → ${t.grade_a_min_leaves} leaves`; if (histDays) { predicted = Math.max(dayNum(today()), Math.round(predicted * 0.7 + fallbackDay * 0.3)); basis += `, blended with ${histDays}-day history`; } }
  else { predicted = fallbackDay; basis = batch.expected_harvest ? "planned harvest date" : histDays ? `average of ${cycles.length} past ${batch.crop} cycles (${histDays} days)` : `default ${s.grow_days}-day grow-out`; }

  const heads = batch.plant_count ?? batch.germinated ?? 0;
  const kgPer = histKgPerPlant ?? t.grade_a_min_g / 1000;
  const kg = heads * kgPer;
  return (
    <Section title={`Yield & harvest forecast — ${batch.code}`} desc={`Based on ${basis}.`}>
      <div className="grid gap-4 sm:grid-cols-4">
        {[["Predicted harvest", batch.harvested_on ?? fromDayNum(predicted)], ["Days to go", batch.harvested_on ? "Harvested" : String(Math.max(0, predicted - dayNum(today())))],
          ["Projected yield", `${kg.toFixed(1)} kg`], ["Crates", `${Math.ceil(kg / s.kg_per_crate)} × ${s.kg_per_crate} kg`]].map(([l, v]) => (
          <div key={l} className="rounded-lg border p-4"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 font-display text-xl font-bold">{v}</div></div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {heads} plants × {(kgPer * 1000).toFixed(0)} g {histKgPerPlant ? `(your past ${batch.crop} average)` : "(profile Grade A weight — no harvest history yet)"}.
        {batch.expected_harvest && ` Planned date: ${batch.expected_harvest}.`}
      </p>
    </Section>
  );
}

function batchWindow(b: B, s: FarmSettings) {
  const start = b.transplanted_on ?? fromDayNum(dayNum(b.seeded_on) + s.nursery_days);
  const end = b.harvested_on ?? b.expected_harvest ?? fromDayNum(dayNum(start) + s.grow_days);
  return { start: dayNum(start), end: dayNum(end) };
}

function Planner({ batches, s }: { batches: B[]; s: FarmSettings }) {
  const weeks = useMemo(() => {
    const now = dayNum(today());
    const monday = now - ((new Date().getUTCDay() + 6) % 7);
    return Array.from({ length: 12 }, (_, i) => {
      const ws = monday + i * 7, we = ws + 6;
      const row: Record<string, number | string> = { week: fromDayNum(ws).slice(5) };
      let used = 0, freeing = 0;
      for (const b of batches) {
        if (b.status === "harvested") continue;
        const w = batchWindow(b, s); const n = b.plant_count ?? b.germinated ?? b.seeds_sown ?? 0;
        if (w.start <= we && w.end >= ws) { row[b.code] = n; used += n; }
        if (w.end >= ws && w.end <= we) freeing += n;
      }
      row["Free"] = Math.max(0, s.total_slots - used);
      return { row, ws, used, freeing, seedBy: fromDayNum(ws + 7 - s.nursery_days) };
    });
  }, [batches, s]);
  const codes = [...new Set(weeks.flatMap((w) => Object.keys(w.row).filter((k) => k !== "week" && k !== "Free")))];
  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const weeklyTarget = Math.round(s.total_slots / Math.max(1, Math.ceil(s.grow_days / 7)));
  const current = weeks[0];

  return (
    <Section title={`Channel turnover planner — ${s.total_slots} slots`} desc={`For steady weekly supply, transplant about ${weeklyTarget} plants every week (${s.grow_days}-day grow-out, ${s.nursery_days}-day nursery).`}>
      {current && (
        <div className="mb-4">
          <div className="mb-1 text-xs text-muted-foreground">This week: {current.used} of {s.total_slots} slots in use</div>
          <div className="grid gap-px overflow-hidden rounded-md" style={{ gridTemplateColumns: "repeat(50, minmax(0, 1fr))" }}>
            {(() => {
              const cells: string[] = [];
              codes.forEach((c, i) => { const n = Number(current.row[c] ?? 0); for (let k = 0; k < n && cells.length < s.total_slots; k++) cells.push(palette[i % palette.length] ?? "var(--muted)"); });
              while (cells.length < s.total_slots) cells.push("var(--muted)");
              return cells.map((c, i) => <div key={i} className="aspect-square" style={{ background: c }} />);
            })()}
          </div>
        </div>
      )}
      <div className="h-72"><ResponsiveContainer><BarChart data={weeks.map((w) => w.row)}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="week" tick={tick} /><YAxis tick={tick} />
        <Tooltip contentStyle={tip} /><Legend />
        <ReferenceLine y={s.total_slots} stroke="var(--destructive)" strokeDasharray="4 4" />
        {codes.map((c, i) => <Bar key={c} dataKey={c} stackId="a" fill={palette[i % palette.length]} />)}
        <Bar dataKey="Free" stackId="a" fill="var(--muted)" />
      </BarChart></ResponsiveContainer></div>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Week of</TableHead><TableHead>In use</TableHead><TableHead>Slots freeing</TableHead><TableHead>Free</TableHead><TableHead>Seed nursery by</TableHead></TableRow></TableHeader>
          <TableBody>{weeks.map((w) => (
            <TableRow key={w.ws}>
              <TableCell>{fromDayNum(w.ws)}</TableCell><TableCell>{w.used}</TableCell><TableCell>{w.freeing || "—"}</TableCell>
              <TableCell><Badge variant={Number(w.row["Free"]) >= 50 ? "default" : "secondary"}>{w.row["Free"]}</Badge></TableCell>
              <TableCell>{Number(w.row["Free"]) >= 50 ? <span>{w.seedBy} · ~{Math.min(Number(w.row["Free"]), weeklyTarget)} seeds</span> : "—"}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
    </Section>
  );
}

function Economics({ batches, harvests }: { batches: B[]; harvests: H[] }) {
  const { data: tx = [] } = useQuery({ queryKey: ["transactions"], queryFn: async () => (await supabase.from("transactions").select("*").order("tx_date", { ascending: false })).data ?? [] });
  const rows = useMemo(() => {
    const cost: Record<string, number> = {}, direct: Record<string, number> = {}, income: Record<string, number> = {};
    const win = (b: B) => ({ a: b.seeded_on, z: b.harvested_on ?? today() });
    for (const t of tx) {
      const amt = Number(t.amount);
      if (t.batch_id) {
        if (t.kind === "income") income[t.batch_id] = (income[t.batch_id] ?? 0) + amt;
        else { direct[t.batch_id] = (direct[t.batch_id] ?? 0) + amt; cost[t.batch_id] = (cost[t.batch_id] ?? 0) + amt; }
      } else if (t.kind === "expense") {
        const active: Record<string, number> = {};
        for (const b of batches) { const w = win(b); if (t.tx_date >= w.a && t.tx_date <= w.z) active[b.id] = b.plant_count ?? b.germinated ?? b.seeds_sown ?? 1; }
        for (const [k, v] of Object.entries(shareCost(amt, active))) cost[k] = (cost[k] ?? 0) + v;
      }
    }
    return batches.map((b) => {
      const hs = harvests.filter((h) => h.batch_id === b.id);
      const harvested = hs.reduce((a, h) => a + h.plants_harvested - h.rejected, 0);
      const heads = harvested || b.plant_count || 0;
      const c = cost[b.id] ?? 0, inc = income[b.id] ?? 0;
      return { b, c, d: direct[b.id] ?? 0, inc, heads, projected: !harvested, perHead: heads ? c / heads : null };
    }).filter((r) => r.c || r.inc);
  }, [tx, batches, harvests]);

  return (
    <Section title="Cost per head & margin by batch" desc="Expenses tagged to a batch count directly. Shared costs (electricity, water, labour…) are split across batches in the system on that date by plant count. Tag sales and purchases to a batch in Income & expenses.">
      {!rows.length ? <p className="text-sm text-muted-foreground">No costs yet. Add expenses in Income & expenses.</p> : (
        <div className="overflow-x-auto"><Table>
          <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead className="text-right">Direct</TableHead><TableHead className="text-right">Total cost</TableHead><TableHead className="text-right">Heads</TableHead><TableHead className="text-right">Cost / head</TableHead><TableHead className="text-right">Sales</TableHead><TableHead className="text-right">Margin</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map((r) => {
            const m = r.inc - r.c;
            return (
              <TableRow key={r.b.id}>
                <TableCell className="font-medium">{r.b.code}</TableCell>
                <TableCell className="text-right">{LKR(Math.round(r.d))}</TableCell>
                <TableCell className="text-right">{LKR(Math.round(r.c))}</TableCell>
                <TableCell className="text-right">{r.heads}{r.projected && <span className="text-xs text-muted-foreground"> (planned)</span>}</TableCell>
                <TableCell className="text-right font-semibold">{r.perHead !== null ? LKR(+r.perHead.toFixed(2)) : "—"}</TableCell>
                <TableCell className="text-right">{r.inc ? LKR(r.inc) : "—"}</TableCell>
                <TableCell className={`text-right font-semibold ${m < 0 ? "text-destructive" : "text-success"}`}>{r.inc ? `${LKR(Math.round(m))} (${Math.round((m / r.inc) * 100)}%)` : "—"}</TableCell>
              </TableRow>
            );
          })}</TableBody>
        </Table></div>
      )}
    </Section>
  );
}

const FIELDS: [keyof FarmSettings, string, string][] = [
  ["tank_liters", "Nutrient tank (L)", "1"], ["albert_ec_per_g_l", "EC rise per 1 g/L Albert", "0.01"],
  ["ph_down_ml", "pH Down ml per 100 L per 0.1", "0.1"], ["ph_up_ml", "pH Up ml per 100 L per 0.1", "0.1"],
  ["vpd_min", "Ideal VPD min (kPa)", "0.05"], ["vpd_max", "Ideal VPD max (kPa)", "0.05"],
  ["total_slots", "Total plant slots", "1"], ["kg_per_crate", "kg per crate", "0.1"],
  ["grow_days", "Transplant → harvest (days)", "1"], ["nursery_days", "Nursery (days)", "1"],
];

function SettingsForm({ s }: { s: FarmSettings }) {
  const qc = useQueryClient();
  const [v, setV] = useState<Record<string, string>>({});
  useEffect(() => setV(Object.fromEntries(Object.entries(s).map(([k, x]) => [k, String(x)]))), [s]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const row: Record<string, number> = {};
    for (const [k] of FIELDS) { const n = Number(v[k]); if (!(n > 0)) { toast.error("All values must be above 0"); return; } row[k] = n; }
    const { error } = await supabase.from("farm_settings").upsert({ id: 1, ...row, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["farm_settings"] });
  }
  return (
    <Section title="Farm & dosing settings" desc="Calibrate once: dissolve 1 g Albert per litre in a jug and measure the EC rise; dose a known ml of pH Down into 100 L and note the pH drop.">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {FIELDS.map(([k, l, step]) => (
          <div key={k}><Label className="text-xs">{l}</Label><Input type="number" step={step} value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>
        ))}
        <div className="flex items-end"><Button className="w-full">Save</Button></div>
      </form>
    </Section>
  );
}
