import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { deleteRow } from "@/lib/db-actions";
import { Section } from "@/components/page-header";
import { DeleteButton, EditButton } from "@/components/edit-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = { id: string; check_date: string; check_time: string; ec: number | null; ph: number | null; water_temp: number | null; air_temp: number | null; humidity: number | null; batches: { code: string } | null; germination_issues: string[] } & Record<string, unknown>;

export function CheckHistory() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const { data: rows = [] } = useQuery({
    queryKey: ["daily_checks", "history"],
    queryFn: async () => ((await supabase.from("daily_checks").select("*, batches(code)").order("check_date", { ascending: false }).order("check_time", { ascending: false }).limit(30)).data ?? []) as unknown as Row[],
  });

  return (
    <Section title="Recent checklists" desc="Last 30 entries. Tap edit to reopen the full checklist and change any section.">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Batch</TableHead><TableHead>EC</TableHead><TableHead>pH</TableHead><TableHead>Water/Air °C</TableHead><TableHead>RH%</TableHead><TableHead>Nursery issues</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{r.check_date} {String(r.check_time).slice(0, 5)}</TableCell>
                <TableCell>{r.batches?.code ?? "—"}</TableCell>
                <TableCell>{r.ec ?? "—"}</TableCell>
                <TableCell>{r.ph ?? "—"}</TableCell>
                <TableCell>{r.water_temp ?? "—"} / {r.air_temp ?? "—"}</TableCell>
                <TableCell>{r.humidity ?? "—"}</TableCell>
                <TableCell className="max-w-48 text-xs">{r.germination_issues?.join(", ") || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <EditButton onClick={() => navigate({ to: "/check", search: { edit: r.id } })} />
                  <DeleteButton what="this checklist and its growth/quality readings" disabled={!me?.isOwner} onConfirm={async () => { const e = await deleteRow("daily_checks", r.id); qc.invalidateQueries(); return e; }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <p className="py-4 text-sm text-muted-foreground">No checklists yet.</p>}
      </div>
    </Section>
  );
}
