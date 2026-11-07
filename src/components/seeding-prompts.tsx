import { Link } from "@tanstack/react-router";
import { useBatches } from "@/lib/use-me";
import { DEFAULT_SETTINGS, remainingPlants, seedingNeeds, useFarmSettings } from "@/lib/agronomy";
import { usePopulation } from "@/lib/use-population";
import { toDateKey } from "@/lib/reminders";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SeedingPrompts() {
  const { data: batches = [] } = useBatches();
  const { data: settings = DEFAULT_SETTINGS } = useFarmSettings();
  const { data: population } = usePopulation();
  const today = toDateKey(new Date());
  const counts = Object.fromEntries(batches.map((b) => [b.id, remainingPlants(b, population?.harvested[b.id], population?.lost[b.id])]));
  const needs = seedingNeeds(batches, settings, today, counts);
  return <section className="border-y py-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Nursery seeding schedule</h2><Button asChild size="sm" variant="outline"><Link to="/batches">Start nursery batch</Link></Button></div>
    {needs.length ? <div className="divide-y">{needs.map((n) => <div key={n.release} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><div className="text-sm font-medium">Seed {n.quantity} plants by {n.seedBy}</div><p className="text-xs text-muted-foreground">Replace plants leaving channels on {n.release} · existing nursery stock deducted</p></div><Badge variant={n.seedBy < today ? "destructive" : "secondary"}>{n.seedBy < today ? "Overdue" : n.seedBy === today ? "Due today" : "Upcoming"}</Badge></div>)}</div> : <p className="text-sm text-muted-foreground">No uncovered replacement demand.</p>}
  </section>;
}