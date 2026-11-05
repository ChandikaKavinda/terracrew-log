import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { deleteRow, updateRow } from "@/lib/db-actions";
import { Section } from "@/components/page-header";
import { FieldsDialog, DeleteButton, EditButton, toVals, fromVals, type Field } from "@/components/edit-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fields: Field[] = [
  { key: "check_date", label: "Date", type: "date" }, { key: "check_time", label: "Time", type: "time" },
  { key: "tank_level", label: "Tank level", type: "select", options: ["full", "3/4", "1/2", "1/4", "low"].map((v) => ({ value: v, label: v })) },
  { key: "water_source", label: "Water source", type: "select", options: [{ value: "rain", label: "Rain water" }, { value: "tap", label: "Tap water" }] },
  { key: "ec", label: "EC", type: "number" }, { key: "ph", label: "pH", type: "number" },
  { key: "water_temp", label: "Water temp °C", type: "number" }, { key: "air_temp", label: "Greenhouse temp °C", type: "number" },
  { key: "humidity", label: "Humidity %", type: "number" },
  { key: "tank_debris", label: "Debris in tank", type: "bool" },
  { key: "automation_ok", label: "Automation working", type: "bool" }, { key: "ppe_worn", label: "PPE worn", type: "bool" },
  { key: "flow_ok", label: "Channel flow good", type: "bool" }, { key: "leaks", label: "Leaks found", type: "bool" },
  { key: "gh_defects", label: "Greenhouse defects", type: "bool" }, { key: "insects", label: "Insects seen", type: "bool" },
  { key: "notes", label: "Notes", full: true },
];

type Row = { id: string; check_date: string; check_time: string; ec: number | null; ph: number | null; water_temp: number | null; air_temp: number | null; humidity: number | null; batches: { code: string } | null; germination_issues: string[] } & Record<string, unknown>;

export function CheckHistory() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const [edit, setEdit] = useState<Row | null>(null);
  const { data: rows = [] } = useQuery({
    queryKey: ["daily_checks", "history"],
    queryFn: async () => ((await supabase.from("daily_checks").select("*, batches(code)").order("check_date", { ascending: false }).order("check_time", { ascending: false }).limit(30)).data ?? []) as unknown as Row[],
  });

  return (
    <Section title="Recent checklists" desc="Last 30 entries. Fix mistakes or remove duplicates here.">
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
                  <EditButton onClick={() => setEdit(r)} />
                  <DeleteButton what="this checklist and its growth/quality readings" disabled={!me?.isOwner} onConfirm={async () => { const e = await deleteRow("daily_checks", r.id); qc.invalidateQueries(); return e; }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!rows.length && <p className="py-4 text-sm text-muted-foreground">No checklists yet.</p>}
      </div>
      <FieldsDialog
        open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={`Edit checklist ${edit?.check_date ?? ""}`}
        fields={fields} initial={edit ? toVals(edit, fields) : {}}
        onSave={async (v) => {
          if (!edit) return;
          const patch = fromVals(v, fields);
          const ph = patch.ph as number | null;
          if (ph !== null && (ph < 0 || ph > 14)) return "pH must be between 0 and 14.";
          const e = await updateRow("daily_checks", edit.id, patch);
          if (!e) { toast.success("Checklist updated"); qc.invalidateQueries(); }
          return e;
        }}
      />
    </Section>
  );
}
