import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sprout, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GREENHOUSE_SETS, channelPots, overlaps } from "@/lib/greenhouse";
import { pickSentinels, zoneOfPot } from "@/lib/transplant";
import { dayNum, fromDayNum, DEFAULT_SETTINGS, useFarmSettings } from "@/lib/agronomy";
import { toDateKey } from "@/lib/reminders";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Batch = { id: string; code: string; germinated: number | null; seeds_sown: number | null };

export function TransplantDialog({ batch, available, onClose }: { batch: Batch | null; available: number; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: settings = DEFAULT_SETTINGS } = useFarmSettings();
  const { data: placements = [] } = useQuery({ queryKey: ["pot_allocations"], enabled: !!batch, queryFn: async () => (await supabase.from("pot_allocations").select("*")).data ?? [] });
  const [qty, setQty] = useState("");
  const [on, setOn] = useState(toDateKey(new Date()));
  const [end, setEnd] = useState("");
  const [pots, setPots] = useState<string[]>([]);
  const [sentinels, setSentinels] = useState<string[]>([]);
  const [mode, setMode] = useState<"pots" | "sentinel">("pots");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!batch) return;
    const today = toDateKey(new Date());
    setQty(String(available || "")); setOn(today); setEnd(fromDayNum(dayNum(today) + settings.grow_days)); setMode("pots"); setSentinels([]);
    // Start from this batch's existing nursery reservation, if any
    setPots(placements.filter((p) => p.batch_id === batch.id).map((p) => p.pot_id));
  }, [batch?.id, placements.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = Number(qty) || 0;
  const blocked = useMemo(() => new Map(placements.filter((p) => p.batch_id !== batch?.id && end > on && overlaps(p, { starts_on: on, ends_on: end })).map((p) => [p.pot_id, p])), [placements, batch?.id, on, end]);
  const own = new Set(placements.filter((p) => p.batch_id === batch?.id).map((p) => p.pot_id));
  const split = available > 0 && n < available;

  function togglePots(list: string[]) {
    const free = list.filter((p) => !blocked.has(p));
    if (mode === "sentinel") {
      const pot = free[0]; if (!pot || !pots.includes(pot)) return;
      setSentinels((s) => s.includes(pot) ? s.filter((x) => x !== pot) : s.length >= 10 ? s : [...s, pot]);
      return;
    }
    setPots((old) => {
      const next = free.every((p) => old.includes(p)) ? old.filter((p) => !free.includes(p)) : [...new Set([...old, ...free])];
      setSentinels((s) => s.filter((x) => next.includes(x)));
      return next;
    });
  }

  async function save() {
    if (!batch) return;
    if (!Number.isInteger(n) || n <= 0 || (available > 0 && n > available)) { toast.error(`Enter 1–${available} plants`); return; }
    if (pots.length !== n) { toast.error(`Select exactly ${n} pots (now ${pots.length})`); return; }
    const want = Math.min(10, n);
    if (sentinels.length !== want) { toast.error(`Choose ${want} sentinel pots`); return; }
    setBusy(true);
    const { error } = await supabase.rpc("transplant_batch", { _batch_id: batch.id, _qty: n, _on: on, _ends_on: end, _pot_ids: pots, _sentinels: sentinels });
    setBusy(false);
    if (error) { toast.error(error.code === "23P01" ? "Some pots are already booked for these dates" : error.message); return; }
    toast.success(split ? `Split ${n} plants into a new growing batch` : `${batch.code} moved to growing`);
    qc.invalidateQueries(); onClose();
  }

  const zc = (p: string) => ({ Inlet: "Inlet", Mid: "Mid", Outlet: "Outlet" })[zoneOfPot(p)];
  return (
    <Dialog open={!!batch} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Transplant {batch?.code}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Plants moving</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /><p className="mt-1 text-xs text-muted-foreground">{available} left in nursery</p></div>
          <div><Label>Transplant date</Label><Input type="date" value={on} onChange={(e) => e.target.value && setOn(e.target.value)} /></div>
          <div><Label>Pots free again on</Label><Input type="date" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} /></div>
        </div>
        <p className="text-sm">{split ? <>Partial move: creates a new growing batch <b>{batch?.code}-…</b>; the rest stays in the nursery.</> : "Full move: this batch becomes a growing batch."}</p>
        <div className="flex flex-wrap items-center gap-2 border-y py-2 text-sm">
          <Button size="sm" variant={mode === "pots" ? "default" : "outline"} onClick={() => setMode("pots")}>1 · Pick pots ({pots.length}/{n})</Button>
          <Button size="sm" variant={mode === "sentinel" ? "default" : "outline"} onClick={() => setMode("sentinel")}><Sprout className="size-4" />2 · Sentinels ({sentinels.length}/{Math.min(10, n)})</Button>
          <Button size="sm" variant="ghost" disabled={!pots.length} onClick={() => setSentinels(pickSentinels(pots, Math.min(10, n)))}><Wand2 className="size-4" />Auto-pick sentinels</Button>
          {pots.length > 0 && <Button size="sm" variant="ghost" onClick={() => { setPots([]); setSentinels([]); }}>Clear</Button>}
        </div>
        <p className="text-xs text-muted-foreground">{mode === "pots" ? "Tap a pot, or a channel letter to take the whole channel. Grey pots are booked by other batches." : "Tap selected pots to mark or unmark sentinels (aim for 3 Inlet, 4 Mid, 3 Outlet)."}</p>
        <div className="space-y-3">
          {GREENHOUSE_SETS.map((s) => (
            <div key={s.number}>
              <div className="mb-1 text-xs font-semibold">Set {s.number}</div>
              {s.channels.map((c) => { const ch = `${s.number}${c}`; return (
                <div key={c} className="mb-1 grid grid-cols-[1.75rem_repeat(10,minmax(0,1fr))] gap-1">
                  <button type="button" className="text-xs font-semibold" onClick={() => mode === "pots" && togglePots(channelPots(ch))} aria-label={`Channel ${ch}`}>{c}</button>
                  {channelPots(ch).map((p, i) => {
                    const sel = pots.includes(p), sen = sentinels.includes(p), b = blocked.has(p);
                    return <button key={p} type="button" disabled={b} title={`${p} · ${zc(p)}${b ? " · booked" : own.has(p) ? " · reserved for this batch" : ""}`} onClick={() => togglePots([p])}
                      className={cn("h-7 rounded-full border text-[10px]", b && "cursor-not-allowed bg-muted text-muted-foreground opacity-50", sel && "border-primary bg-primary text-primary-foreground", !sel && own.has(p) && "border-chart-2", sen && "ring-2 ring-ring ring-offset-1 ring-offset-background")}>
                      {sen ? "★" : i + 1}
                    </button>;
                  })}
                </div>); })}
            </div>
          ))}
        </div>
        {sentinels.length > 0 && <p className="text-xs">Sentinels: {sentinels.map((p, i) => `#${i + 1} ${p}`).join(" · ")}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Transplant"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
