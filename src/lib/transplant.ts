/** Transplant helpers: pick sentinel pots balanced along the channel gradient. */
const potNo = (id: string) => Number(id.match(/(\d+)$/)?.[1] ?? 0);
export const zoneOfPot = (id: string) => { const n = potNo(id); return n <= 3 ? "Inlet" : n <= 7 ? "Mid" : "Outlet"; };

/** Pick up to 10 sentinels: 3 Inlet, 4 Mid, 3 Outlet, spread evenly through each zone's pots. Fills gaps from other zones. */
export function pickSentinels(pots: string[], count = 10): string[] {
  const want = Math.min(count, pots.length);
  const quota: Record<string, number> = { Inlet: 3, Mid: 4, Outlet: 3 };
  const spread = (list: string[], k: number) => k <= 0 ? [] : k >= list.length ? list : Array.from({ length: k }, (_, i) => list[Math.floor((i + 0.5) * list.length / k)]!);
  const picked: string[] = [];
  for (const z of ["Inlet", "Mid", "Outlet"]) picked.push(...spread(pots.filter((p) => zoneOfPot(p) === z), quota[z]!));
  const rest = pots.filter((p) => !picked.includes(p));
  picked.push(...spread(rest, want - picked.length));
  return picked.slice(0, want);
}
