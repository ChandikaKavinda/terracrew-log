import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory — GreenLog" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await supabase.from("inventory_items").select("*").order("category").order("name")).data ?? [],
  });
  const { data: moves = [] } = useQuery({
    queryKey: ["inventory-moves"],
    queryFn: async () => (await supabase.from("inventory_movements").select("*, inventory_items(name, unit)").order("created_at", { ascending: false }).limit(20)).data ?? [],
  });
  const [f, setF] = useState({ name: "", category: "Nutrients", unit: "kg", quantity: "", reorder_level: "" });
  const [amt, setAmt] = useState<Record<string, string>>({});

  const refresh = () => { qc.invalidateQueries({ queryKey: ["inventory"] }); qc.invalidateQueries({ queryKey: ["inventory-moves"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); };

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return toast.error("Item name required");
    const { error } = await supabase.from("inventory_items").insert({
      name: f.name.trim().slice(0, 100), category: f.category, unit: f.unit, quantity: Number(f.quantity) || 0, reorder_level: Number(f.reorder_level) || 0,
    });
    if (error) return toast.error(error.message);
    setF({ ...f, name: "", quantity: "", reorder_level: "" });
    refresh();
  }

  async function move(id: string, sign: 1 | -1) {
    const n = Number(amt[id]);
    if (!n || n <= 0) return toast.error("Enter an amount first");
    const reason = sign > 0 ? "Restocked" : "Used";
    const { error } = await supabase.from("inventory_movements").insert({ item_id: id, change: sign * n, reason });
    if (error) return toast.error(error.message);
    setAmt({ ...amt, [id]: "" });
    refresh();
  }

  async function markChecked() {
    const { error } = await supabase.from("maintenance_logs").insert({ kind: "inventory" });
    if (error) return toast.error(error.message);
    toast.success("Inventory check recorded");
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" sub="Nutrients, seeds, sponges, chemicals and spares." actions={<Button variant="outline" onClick={markChecked}>Mark weekly check done</Button>} />
      <Section title="Add item">
        <form onSubmit={addItem} className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="lg:col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nutrient A" /></div>
          <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          <div><Label>Unit</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
          <div><Label>Qty now</Label><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
          <div><Label>Reorder at</Label><Input type="number" value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: e.target.value })} /></div>
          <div className="sm:col-span-3 lg:col-span-6 flex justify-end"><Button>Add item</Button></div>
        </form>
      </Section>
      <Section title="Stock">
        <Table>
          <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>In stock</TableHead><TableHead>Reorder at</TableHead><TableHead className="w-72">Use / restock</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.map((i) => {
              const low = Number(i.quantity) <= Number(i.reorder_level);
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell>{i.category}</TableCell>
                  <TableCell>{Number(i.quantity)} {i.unit} {low && <Badge variant="destructive" className="ml-2">Low</Badge>}</TableCell>
                  <TableCell>{Number(i.reorder_level)} {i.unit}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Input className="h-8" type="number" placeholder="Amount" value={amt[i.id] ?? ""} onChange={(e) => setAmt({ ...amt, [i.id]: e.target.value })} />
                      <Button size="sm" variant="outline" onClick={() => move(i.id, -1)} title="Used"><Minus className="h-4 w-4" /></Button>
                      <Button size="sm" onClick={() => move(i.id, 1)} title="Restocked"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {!items.length && <p className="py-4 text-sm text-muted-foreground">No items yet.</p>}
      </Section>
      <Section title="Recent movements">
        <ul className="space-y-1 text-sm">
          {moves.map((m) => (
            <li key={m.id} className="flex justify-between border-b py-1">
              <span>{m.inventory_items?.name} · {m.reason}</span>
              <span className={Number(m.change) < 0 ? "text-destructive" : "text-success"}>{Number(m.change) > 0 ? "+" : ""}{Number(m.change)} {m.inventory_items?.unit} · {new Date(m.created_at).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
