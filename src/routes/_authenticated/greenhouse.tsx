import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, CalendarDays, Check, Map, Pencil, Plus, Sprout, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pageMeta } from "@/lib/page-meta";
import { useBatches } from "@/lib/use-me";
import { dayNum, fromDayNum, harvestDay, DEFAULT_SETTINGS, useFarmSettings } from "@/lib/agronomy";
import { toDateKey } from "@/lib/reminders";
import { ALL_POTS, GREENHOUSE_SETS, channelPots, conflicts, occupies, turnover } from "@/lib/greenhouse";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/greenhouse")({
  head: () => pageMeta("Greenhouse map & turnover — GreenLog", "Allocate batches across 51 channels and 510 pots, and schedule channel release and nursery planting."),
  component: GreenhousePage,
});
const dateLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function GreenhousePage() {
  const qc = useQueryClient();
  const { data: batches = [] } = useBatches();
  const { data: settings = DEFAULT_SETTINGS } = useFarmSettings();
  const { data: placements = [], isPending, error } = useQuery({ queryKey: ["pot_allocations"], queryFn: async () => {
    const { data, error } = await supabase.from("pot_allocations").select("*").order("starts_on");
    if (error) throw error; return data;
  }});
  const [date, setDate] = useState(toDateKey(new Date()));
  const [view, setView] = useState<"map" | "turnover">("map");
  const [batchFilter, setBatchFilter] = useState("all");
  const [editor, setEditor] = useState(false);
  const [editing, setEditing] = useState("");
  const [bid, setBid] = useState("");
  const [start, setStart] = useState(date);
  const [end, setEnd] = useState(fromDayNum(dayNum(date) + settings.grow_days));
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const active = placements.filter((p) => occupies(p, date));
  const occupancy = new Map(active.map((p) => [p.pot_id, p]));
  const occupiedCount = occupancy.size;
  const groups = [...new Set(placements.map((p) => p.allocation_id))].map((id) => ({ id, rows: placements.filter((p) => p.allocation_id === id) }));
  const sentinel = new Set(batches.flatMap((b) => b.sentinel_pot_ids));
  const blocked = new Set(conflicts(ALL_POTS, placements, start, end, editing).map((p) => p.pot_id));
  function chooseBatch(id: string) {
    setBid(id); const b = batches.find((b) => b.id === id); if (!b) return;
    const begin = b.transplanted_on ?? fromDayNum(dayNum(b.seeded_on) + settings.nursery_days);
    const finish = fromDayNum(harvestDay(b, settings));
    setStart(begin); setEnd(finish > begin ? finish : fromDayNum(dayNum(begin) + settings.grow_days));
  }
  function openNew(pots: string[] = []) { setEditing(""); setBid(""); setStart(date); setEnd(fromDayNum(dayNum(date)+settings.grow_days)); setSelected(pots); setEditor(true); }
  function openExisting(id: string) {
    const rows = placements.filter((p) => p.allocation_id === id); const first = rows[0]; if (!first) return;
    setEditing(id); setBid(first.batch_id); setStart(first.starts_on); setEnd(first.ends_on); setSelected(rows.map((p) => p.pot_id)); setEditor(true);
  }
  function toggle(pots: string[]) {
    const available = pots.filter((p) => !blocked.has(p));
    setSelected((old) => available.every((p) => old.includes(p)) ? old.filter((p) => !available.includes(p)) : [...new Set([...old,...available])]);
  }
  async function save() {
    if (!bid || !selected.length) { toast.error("Choose a batch and at least one pot"); return; }
    if (!start || !end || end <= start) { toast.error("Available date must be after planting date"); return; }
    if (conflicts(selected, placements, start, end, editing).length) { toast.error("Some pots are already booked for these dates"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("save_pot_allocation", { _allocation_id: editing || undefined, _batch_id: bid, _pot_ids: selected, _starts_on: start, _ends_on: end });
    setBusy(false);
    if (error) { toast.error(error.code === "23P01" ? "Another booking overlaps these pots. Refresh and choose different dates." : error.message); return; }
    await qc.invalidateQueries({ queryKey: ["pot_allocations"] }); setEditor(false); toast.success("Pot assignment saved");
  }
  async function remove() {
    if (!editing || !window.confirm("Remove this pot assignment? The batch and its records will remain.")) return;
    setBusy(true); const { error } = await supabase.from("pot_allocations").delete().eq("allocation_id", editing); setBusy(false);
    if (error) { toast.error(error.message); return; } await qc.invalidateQueries({queryKey:["pot_allocations"]}); setEditor(false); toast.success("Assignment removed");
  }
  const unplaced = batches.filter((b) => b.status === "growing" && !active.some((p) => p.batch_id === b.id));
  return <div className="space-y-6">
    <PageHeader title="Greenhouse map" sub="9 sets · 51 channels · 510 pots" actions={<Button onClick={() => openNew()}><Plus className="size-4" /> Assign batch</Button>} />
    <div className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-4">
      {[["Occupied pots",occupiedCount],["Free pots",510-occupiedCount],["Booked later",new Set(placements.filter((p)=>p.starts_on>date).map((p)=>p.pot_id)).size],["Operating capacity",settings.total_slots]].map(([label,value])=><div key={label}><div className="text-xs text-muted-foreground">{label}</div><div className="font-display text-3xl font-bold">{value}</div></div>)}
    </div>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex gap-1"><Button variant={view==="map"?"default":"outline"} onClick={()=>setView("map")}><Map className="size-4"/> Bed map</Button><Button variant={view==="turnover"?"default":"outline"} onClick={()=>setView("turnover")}><CalendarDays className="size-4"/> Turnover</Button></div>
      <div className="flex flex-wrap items-end gap-3"><div><Label htmlFor="map-date">On date</Label><Input id="map-date" type="date" value={date} onChange={(e)=>e.target.value&&setDate(e.target.value)} /></div><Select value={batchFilter} onValueChange={setBatchFilter}><SelectTrigger className="w-44"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All batches</SelectItem>{batches.map((b)=><SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}</SelectContent></Select></div>
    </div>
    {error && <p role="alert" className="text-destructive">Could not load pot assignments. <Button variant="outline" onClick={()=>qc.invalidateQueries({queryKey:["pot_allocations"]})}>Retry</Button></p>}
    {isPending ? <p className="py-10 text-muted-foreground">Loading greenhouse…</p> : view==="map" ? <>
      <div className="flex flex-wrap items-center gap-4 text-xs"><span className="flex items-center gap-2"><span className="size-3 rounded-full border bg-muted"/>Free</span><span className="flex items-center gap-2"><span className="size-3 rounded-full bg-primary"/>Growing</span><span className="flex items-center gap-2"><span className="size-3 rounded-full bg-chart-2"/>Nursery reservation</span><span className="flex items-center gap-2"><Sprout className="size-3"/>Sentinel</span></div>
      {unplaced.length>0&&<div className="border-l-4 border-warning bg-warning/10 p-3 text-sm">Unmapped growing batches: {unplaced.map((b)=>b.code).join(", ")}</div>}
      <div className="flex items-center gap-2 border-b pb-2 text-sm font-semibold"><ArrowDown className="size-4"/> Entrance · Set 1</div>
      <div className="grid gap-x-8 gap-y-6 xl:grid-cols-2">{GREENHOUSE_SETS.map((s)=><section key={s.number} className="min-w-0 border-b pb-5">
        <div className="mb-3 flex items-baseline justify-between"><h2 className="text-lg font-semibold">Set {s.number}</h2><span className="text-xs text-muted-foreground">{s.channels.length} channels · {s.channels.length*10} pots</span></div>
        <div className="mb-2 flex justify-between pl-10 text-xs text-muted-foreground"><span>Inlet · 1</span><span>Mid</span><span>10 · Outlet</span></div>
        <div className="space-y-2">{s.channels.map((c)=>{const channel=`${s.number}${c}`; return <div key={c} className="grid grid-cols-[2rem_repeat(10,minmax(0,1fr))] items-center gap-1">
          <Button variant="ghost" size="icon" className="size-8" title={`Assign channel ${channel}`} aria-label={`Assign channel ${channel}`} onClick={()=>openNew(channelPots(channel))}>{c}</Button>
          {channelPots(channel).map((pot,i)=>{const p=occupancy.get(pot); const b=batches.find((b)=>b.id===p?.batch_id); return <Button key={pot} size="icon" variant="outline" title={`${pot}${b?` · ${b.code} · available ${p?.ends_on}`:" · Free"}`} aria-label={`Pot ${pot}${b?` ${b.code}`:" free"}`} onClick={()=>p?openExisting(p.allocation_id):openNew([pot])} className={cn("relative h-9 w-full min-w-0 rounded-full p-0 text-xs",p&&(b?.status==="nursery"?"border-chart-2 bg-chart-2/20 text-foreground":"border-primary bg-primary text-primary-foreground"),batchFilter!=="all"&&b?.id!==batchFilter&&"opacity-30",sentinel.has(pot)&&"ring-2 ring-ring ring-offset-1 ring-offset-background")}>
            {i+1}{sentinel.has(pot)&&<Sprout className="absolute -right-1 -top-1 size-3 text-foreground"/>}
          </Button>})}
        </div>})}</div>
      </section>)}</div>
    </> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Week beginning</th><th className="p-3">Free at start</th><th className="p-3">Pots releasing</th><th className="p-3">Channels releasing</th><th className="p-3">Nursery seed by</th></tr></thead><tbody>{Array.from({length:12},(_,i)=>{const begin=fromDayNum(dayNum(date)+i*7);const finish=fromDayNum(dayNum(begin)+7);const rows=turnover(placements,begin,finish);const releasing=rows.filter((r)=>r.releasing>0);return <tr key={begin} className="border-b"><td className="whitespace-nowrap p-3"><Button variant="ghost" onClick={()=>{setDate(begin);setView("map");}}>{dateLabel(begin)}</Button></td><td className="p-3">{rows.reduce((n,r)=>n+r.free,0)}</td><td className="p-3 font-semibold text-primary">{rows.reduce((n,r)=>n+r.releasing,0)}</td><td className="min-w-48 p-3">{releasing.map((r)=>`${r.channel} (${r.releasing})`).join(", ")||"—"}</td><td className="whitespace-nowrap p-3">{releasing.length?dateLabel(fromDayNum(dayNum(begin)-settings.nursery_days)):"—"}</td></tr>})}</tbody></table></div>}
    <section className="border-t pt-5"><h2 className="mb-3 text-xl font-semibold">Batch placements</h2>{!groups.length&&<p className="text-muted-foreground">No pot assignments yet.</p>}<div className="divide-y">{groups.filter((g)=>batchFilter==="all"||g.rows[0]?.batch_id===batchFilter).map((g)=>{const p=g.rows[0];if(!p)return null;const b=batches.find((b)=>b.id===p.batch_id);return <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="font-semibold">{b?.code} <Badge variant="outline">{g.rows.length} pots</Badge></div><div className="text-sm text-muted-foreground">{b?.crop}{b?.variety?` · ${b.variety}`:""} · {dateLabel(p.starts_on)} → available {dateLabel(p.ends_on)}</div><div className="max-w-lg break-words text-xs text-muted-foreground">{[...new Set(g.rows.map((r)=>r.pot_id.slice(0,2)))].join(" · ")}</div></div><Button variant="outline" size="icon" aria-label={`Edit placement ${b?.code}`} onClick={()=>openExisting(g.id)}><Pencil className="size-4"/></Button></div>})}</div></section>
    <Dialog open={editor} onOpenChange={setEditor}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editing?"Edit pot assignment":"Assign batch to pots"}</DialogTitle></DialogHeader>
      <div className="space-y-4"><div><Label>Batch</Label><Select value={bid} onValueChange={chooseBatch}><SelectTrigger><SelectValue placeholder="Choose batch"/></SelectTrigger><SelectContent>{batches.filter((b)=>b.status!=="harvested"||b.id===bid).map((b)=><SelectItem key={b.id} value={b.id}>{b.code} · {b.status}</SelectItem>)}</SelectContent></Select></div>
      {!batches.some((b)=>b.status!=="harvested")&&<Button asChild variant="outline"><Link to="/batches">Start a batch</Link></Button>}
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="plant-date">Planting date</Label><Input id="plant-date" type="date" value={start} onChange={(e)=>setStart(e.target.value)}/></div><div><Label htmlFor="release-date">Available from</Label><Input id="release-date" type="date" value={end} onChange={(e)=>setEnd(e.target.value)}/></div></div>
      <div className="flex items-center justify-between"><span className="font-semibold">{selected.length} pots selected</span><Button variant="ghost" size="sm" onClick={()=>setSelected([])}><X className="size-4"/>Clear</Button></div>
      {conflicts(selected,placements,start,end,editing).length>0&&<p role="alert" className="text-sm text-destructive">Selected pots overlap another booking.</p>}
      <div className="space-y-4">{GREENHOUSE_SETS.map((s)=><div key={s.number}><h3 className="mb-1 text-sm font-semibold">Set {s.number}</h3><div className="space-y-1">{s.channels.map((c)=>{const ch=`${s.number}${c}`;return <div key={c} className="grid grid-cols-[2rem_repeat(10,minmax(0,1fr))] gap-1"><Button size="icon" variant="ghost" className="size-8" aria-label={`Select channel ${ch}`} onClick={()=>toggle(channelPots(ch))}>{c}</Button>{channelPots(ch).map((p,i)=><Button key={p} size="icon" variant={selected.includes(p)?"default":"outline"} disabled={blocked.has(p)} aria-label={`Select pot ${p}`} aria-pressed={selected.includes(p)} className="h-8 w-full min-w-0 p-0 text-xs" onClick={()=>toggle([p])}>{i+1}</Button>)}</div>})}</div></div>)}</div>
      <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t bg-background py-3">{editing?<Button variant="destructive" disabled={busy} onClick={remove}><Trash2 className="size-4"/>Remove</Button>:<span/>}<Button disabled={busy||!selected.length||!bid} onClick={save}><Check className="size-4"/>{busy?"Saving…":"Save assignment"}</Button></div></div>
    </DialogContent></Dialog>
  </div>;
}