import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe, LKR, useBatches } from "@/lib/use-me";
import { deleteRow, updateRow } from "@/lib/db-actions";
import { PageHeader, Section } from "@/components/page-header";
import { FieldsDialog, DeleteButton, EditButton, toVals, fromVals, type Field } from "@/components/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toDateKey } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => pageMeta("Income & expenses — GreenLog", "Track greenhouse sales, costs, counterparties and batch finances."),
  component: FinancePage,
});

const cats = {
  income: ["Lettuce sales", "Other produce", "Other"],
  expense: ["Nutrients", "Seeds", "Substrates", "Chemicals", "Packaging", "Equipment", "Capital equipment", "Spares", "Electricity", "Water", "Labour", "Transport", "Repairs", "Other"],
};

function FinancePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: batches = [] } = useBatches();
  const { data: tx = [] } = useQuery({
    queryKey: ["transactions"],
    enabled: !!me?.isOwner,
    queryFn: async () => (await supabase.from("transactions").select("*").order("tx_date", { ascending: false })).data ?? [],
  });
  const blank = () => ({ kind: "income" as "income" | "expense", category: "Lettuce sales", amount: "", tx_date: toDateKey(new Date()), description: "", counterparty: "", handled_by: me?.name ?? "", batch_id: "" });
  const [f, setF] = useState(blank);
  const [edit, setEdit] = useState<(typeof tx)[number] | null>(null);

  const monthly = useMemo(() => {
    const m = new Map<string, { month: string; Income: number; Expenses: number }>();
    for (const t of [...tx].reverse()) {
      const k = t.tx_date.slice(0, 7);
      const e = m.get(k) ?? { month: k, Income: 0, Expenses: 0 };
      if (t.kind === "income") e.Income += Number(t.amount); else e.Expenses += Number(t.amount);
      m.set(k, e);
    }
    return [...m.values()];
  }, [tx]);

  if (me && !me.isOwner) return <p className="text-muted-foreground">Only the owner can view income and expenses. Stock purchases you log in Inventory are added here automatically.</p>;

  const refresh = () => { qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["fin-summary"] }); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!amount || amount <= 0) { toast.error("Enter an amount"); return; }
    const { error } = await supabase.from("transactions").insert({
      kind: f.kind, category: f.category, amount, tx_date: f.tx_date,
      description: f.description.slice(0, 300) || null, counterparty: f.counterparty.slice(0, 120) || null, handled_by: f.handled_by.slice(0, 120) || null,
      batch_id: f.batch_id && f.batch_id !== "__none" ? f.batch_id : null,
    });
    if (error) { toast.error(error.message); return; }
    setF({ ...f, amount: "", description: "", counterparty: "" });
    refresh();
  }

  const inc = tx.filter((t) => t.kind === "income").reduce((a, t) => a + Number(t.amount), 0);
  const exp = tx.filter((t) => t.kind === "expense").reduce((a, t) => a + Number(t.amount), 0);
  const isInc = f.kind === "income";

  const editKind = (edit?.kind ?? "income") as "income" | "expense";
  const editFields: Field[] = [
    { key: "kind", label: "Type", type: "select", options: [{ value: "income", label: "Income" }, { value: "expense", label: "Expense" }] },
    { key: "category", label: "Category", type: "select", options: [...new Set([...cats[editKind], edit?.category ?? "Other"])].map((c) => ({ value: c, label: c })) },
    { key: "amount", label: "Amount (Rs)", type: "number" }, { key: "tx_date", label: "Date", type: "date" },
    { key: "counterparty", label: editKind === "income" ? "Sold to (buyer)" : "Purchased from (supplier)" },
    { key: "handled_by", label: editKind === "income" ? "Sold by" : "Purchased by" },
    { key: "batch_id", label: "Batch (for cost per head)", type: "select", options: [{ value: "__none", label: "Shared / farm-wide" }, ...batches.map((b) => ({ value: b.id, label: b.code }))] },
    { key: "description", label: "Note", full: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Income & expenses" sub="All amounts in Sri Lankan Rupees." />
      <div className="grid gap-4 sm:grid-cols-3">
        {[["Total income", inc, ""], ["Total expenses", exp, ""], ["Profit", inc - exp, inc - exp < 0 ? "text-destructive" : "text-success"]].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl border bg-card p-5">
            <div className="text-sm text-muted-foreground">{l}</div>
            <div className={`mt-1 font-display text-2xl font-bold ${c}`}>{LKR(v as number)}</div>
          </div>
        ))}
      </div>
      <Section title="Add entry">
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Type</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as "income" | "expense", category: cats[v as "income" | "expense"][0] ?? "Other" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="income">Income (sale)</SelectItem><SelectItem value="expense">Expense (purchase)</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{cats[f.kind].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Amount (Rs)</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
          <div><Label>Date</Label><Input type="date" value={f.tx_date} onChange={(e) => setF({ ...f, tx_date: e.target.value })} /></div>
          <div><Label>{isInc ? "Sold to (buyer)" : "Purchased from (supplier)"}</Label><Input value={f.counterparty} onChange={(e) => setF({ ...f, counterparty: e.target.value })} placeholder={isInc ? "Keells, hotel, market…" : "Agro shop name"} /></div>
          <div><Label>{isInc ? "Sold by" : "Purchased by"}</Label><Input value={f.handled_by} onChange={(e) => setF({ ...f, handled_by: e.target.value })} placeholder={me?.name} /></div>
          <div>
            <Label>Batch</Label>
            <Select value={f.batch_id || "__none"} onValueChange={(v) => setF({ ...f, batch_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none">Shared / farm-wide</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.code}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Note</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="flex items-end"><Button className="w-full">Add</Button></div>
        </form>
      </Section>
      {monthly.length > 0 && (
        <Section title="Monthly">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <Tooltip formatter={(v: number) => LKR(v)} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="Income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}
      <Section title="Entries">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>From / to</TableHead><TableHead>By</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {tx.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{t.tx_date}</TableCell>
                  <TableCell><Badge variant={t.kind === "income" ? "default" : "secondary"} className="capitalize">{t.kind}</Badge></TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell>{t.counterparty ? `${t.kind === "income" ? "To" : "From"} ${t.counterparty}` : "—"}</TableCell>
                  <TableCell>{t.handled_by ?? "—"}</TableCell>
                  <TableCell className="max-w-56 text-xs">{t.description}</TableCell>
                  <TableCell className={`whitespace-nowrap text-right font-medium ${t.kind === "expense" ? "text-destructive" : "text-success"}`}>{t.kind === "expense" ? "−" : "+"}{LKR(Number(t.amount))}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <EditButton onClick={() => setEdit(t)} />
                    <DeleteButton what="this entry" onConfirm={async () => { const e = await deleteRow("transactions", t.id); refresh(); return e; }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!tx.length && <p className="py-4 text-sm text-muted-foreground">No entries yet.</p>}
      </Section>
      <FieldsDialog
        open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title="Edit entry" fields={editFields}
        initial={edit ? toVals(edit, editFields) : {}}
        onSave={async (v) => {
          if (!edit) return null;
          const p = fromVals(v, editFields);
          if (!p["amount"] || (p["amount"] as number) <= 0) return "Enter an amount";
          if (!p["category"]) p["category"] = "Other";
          if (p["batch_id"] === "__none") p["batch_id"] = null;
          const e = await updateRow("transactions", edit.id, p);
          if (!e) { toast.success("Entry updated"); refresh(); }
          return e;
        }}
      />
    </div>
  );
}
