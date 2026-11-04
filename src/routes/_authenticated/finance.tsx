import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useMe, LKR } from "@/lib/use-me";
import { PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toDateKey } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [{ title: "Income & expenses — GreenLog" }] }),
  component: FinancePage,
});

const cats = { income: ["Lettuce sales", "Other produce", "Other"], expense: ["Nutrients", "Seeds", "Electricity", "Water", "Labour", "Packaging", "Transport", "Repairs", "Other"] };

function FinancePage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: tx = [] } = useQuery({
    queryKey: ["transactions"],
    enabled: !!me?.isOwner,
    queryFn: async () => (await supabase.from("transactions").select("*").order("tx_date", { ascending: false })).data ?? [],
  });
  const [f, setF] = useState({ kind: "income" as "income" | "expense", category: "Lettuce sales", amount: "", tx_date: toDateKey(new Date()), description: "" });

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

  if (me && !me.isOwner) return <p className="text-muted-foreground">Only the owner can view income and expenses.</p>;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(f.amount);
    if (!amount || amount <= 0) return toast.error("Enter an amount");
    const { error } = await supabase.from("transactions").insert({ ...f, amount, description: f.description.slice(0, 300) || null });
    if (error) return toast.error(error.message);
    setF({ ...f, amount: "", description: "" });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["fin-summary"] });
  }

  const inc = tx.filter((t) => t.kind === "income").reduce((a, t) => a + Number(t.amount), 0);
  const exp = tx.filter((t) => t.kind === "expense").reduce((a, t) => a + Number(t.amount), 0);

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
        <form onSubmit={save} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <Label>Type</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v as "income" | "expense", category: cats[v as "income" | "expense"][0] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent>
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
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Category</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
          <TableBody>
            {tx.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.tx_date}</TableCell>
                <TableCell className="capitalize">{t.kind}</TableCell>
                <TableCell>{t.category}</TableCell>
                <TableCell>{t.description}</TableCell>
                <TableCell className={`text-right font-medium ${t.kind === "expense" ? "text-destructive" : "text-success"}`}>{t.kind === "expense" ? "−" : "+"}{LKR(Number(t.amount))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </div>
  );
}
