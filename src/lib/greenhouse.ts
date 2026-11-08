export const GREENHOUSE_SETS = Array.from({ length: 9 }, (_, i) => ({
  number: i + 1,
  channels: (i + 1 === 5 || i + 1 === 8 ? "ABCDEFGH" : "ABCDE").split(""),
}));
export const CHANNELS = GREENHOUSE_SETS.flatMap((s) => s.channels.map((c) => `${s.number}${c}`));
export const channelPots = (channel: string) => Array.from({ length: 10 }, (_, i) => `${channel}${i + 1}`);
export const ALL_POTS = CHANNELS.flatMap(channelPots);
export type Placement = { id: string; allocation_id: string; batch_id: string; pot_id: string; starts_on: string; ends_on: string };
export const occupies = (p: Placement, date: string) => p.starts_on <= date && date < p.ends_on;
export const overlaps = (a: Pick<Placement, "starts_on" | "ends_on">, b: Pick<Placement, "starts_on" | "ends_on">) => a.starts_on < b.ends_on && b.starts_on < a.ends_on;
export function conflicts(pots: string[], placements: Placement[], start: string, end: string, editing = "") {
  return placements.filter((p) => p.allocation_id !== editing && pots.includes(p.pot_id) && overlaps(p, { starts_on: start, ends_on: end }));
}
export function turnover(placements: Placement[], start: string, end: string) {
  return CHANNELS.map((channel) => {
    const rows = placements.filter((p) => channelPots(channel).includes(p.pot_id));
    const occupied = new Set(rows.filter((p) => occupies(p, start)).map((p) => p.pot_id)).size;
    const releasing = new Set(rows.filter((p) => p.ends_on >= start && p.ends_on < end).map((p) => p.pot_id)).size;
    return { channel, free: 10 - occupied, releasing };
  });
}