import { pageMeta } from "@/lib/page-meta";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Search, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { deleteRow, updateRow } from "@/lib/db-actions";
import { PageHeader, Section } from "@/components/page-header";
import { FieldsDialog, DeleteButton, EditButton, toVals, fromVals, type Field } from "@/components/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toDateKey } from "@/lib/reminders";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => pageMeta("Inventory — GreenLog", "Track greenhouse stock, usage, purchases and reorder levels."),
  component: InventoryPage,
});

const CATEGORIES = ["Nutrients", "Seeds", "Substrates", "Chemicals", "Packaging", "Equipment", "Spares", "Other"];

const itemFields: Field[] = [
  { key: "name", label: "Item name", full: true },
  { key: "category", label: "Category", type: "select", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
  { key: "unit", label: "Unit (kg, L, packs…)" },
  { key: "quantity", label: "Quantity in stock", type: "number" },
  { key: "reorder_level", label: "Reorder when at or below", type: "number" },
];

type Item = { id: string; name: string; category: string; unit: string; quantity: number; reorder_level: number };

function status(i: Item) {
  const q = Number(i.quantity);
  if (q <= 0) return { label: "Out of stock", v: "destructive" as const };
  if (q <= Number(i.reorder_level)) return { label: "Low stock", v: "outline" as const };
  return { label: "In stock", v: "secondary" as const };
}

function InventoryPage() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: items = [] } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => ((await supabase.from("inventory_items").select("*").order("category").order("name")).data ?? []) as Item[],
  });
  const { data: moves = [] } = useQuery({
    queryKey: ["inventory-moves"],
    queryFn: async () => (await supabase.from("inventory_movements").select("*, inventory_items(name, unit)").order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("All");
  const [dlg, setDlg] = useState<{ kind: "new" | "edit" | "buy" | "use"; item?: Item } | null>(null);

  const refresh = () => ["inventory", "inventory-moves", "dashboard", "transactions", "fin-summary"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const cats = useMemo(() => ["All", ...new Set([...CATEGORIES.filter((c) => items.some((i) => i.category === c)), ...items.map((i) => i.category)])], [items]);
  const shown = items.filter((i) => (cat === "All" || i.category === cat) && i.name.toLowerCase().includes(search.toLowerCase()));
  const low = items.filter((i) => Number(i.quantity) <= Number(i.reorder_level)).length;
  const out = items.filter((i) => Number(i.quantity) <= 0).length;

  const itemOpts = items.map((i) => ({ value: i.id, label: `${i.name} (${i.unit})` }));
  const buyFields: Field[] = [
    { key: "item_id", label: "Item", type: "select", options: itemOpts, full: true },
    { key: "qty", label: "Quantity bought", type: "number" },
    { key: "cost", label: "Total cost (Rs)", type: "number" },
    { key: "vendor", label: "Purchased from (shop / supplier)" },
    { key: "date", label: "Date", type: "date" },
    { key: "notes", label: "Payment / receipt note", full: true },
  ];
  const useFields: Field[] = [
    { key: "item_id", label: "Item", type: "select", options: itemOpts, full: true },
    { key: "qty", label: "Amount", type: "number" },
    { key: "dir", label: "Type", type: "select", options: [{ value: "use", label: "Used" }, { value: "waste", label: "Wasted / damaged" }, { value: "add", label: "Correction: add" }] },
    { key: "reason", label: "Reason (e.g. topped up tank, nursery tray)", full: true },
  ];

  async function markChecked() {
    const { error } = await supabase.from("maintenance_logs").insert({ kind: "inventory" });
    if (error) { toast.error(error.message); return; }
    toast.success("Inventory check recorded");
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        sub="Nutrients, seeds, sponges, chemicals and spares."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDlg({ kind: "buy" })} disabled={!items.length}><ShoppingCart className="mr-1 h-4 w-4" />Purchase stock</Button>
            <Button variant="outline" onClick={() => setDlg({ kind: "use" })} disabled={!items.length}><Minus className="mr-1 h-4 w-4" />Log usage</Button>
            <Button variant="outline" onClick={() => setDlg({ kind: "new" })}><Plus className="mr-1 h-4 w-4" />New item</Button>
            <Button variant="ghost" onClick={markChecked}>Mark weekly check done</Button>
          </div>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {[["Items", items.length, ""], ["Low stock", low, low ? "text-warning" : ""], ["Out of stock", out, out ? "text-destructive" : ""]].map(([l, v, c]) => (
          <div key={l as string} className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className={`font-display text-2xl font-bold ${c}`}>{v}</div>
          </div>
        ))}
      </div>

      <Section title="Stock">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Tabs value={cat} onValueChange={setCat}>
            <TabsList className="flex-wrap h-auto">{cats.map((c) => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}</TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>In stock</TableHead><TableHead>Reorder at</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {shown.map((i) => {
                const st = status(i);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.category}</TableCell>
                    <TableCell>{Number(i.quantity)} {i.unit}</TableCell>
                    <TableCell>{Number(i.reorder_level)} {i.unit}</TableCell>
                    <TableCell><Badge variant={st.v}>{st.label}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "use", item: i })}>Use</Button>
                      <Button size="sm" variant="ghost" onClick={() => setDlg({ kind: "buy", item: i })}>Buy</Button>
                      <EditButton onClick={() => setDlg({ kind: "edit", item: i })} />
                      <DeleteButton what={i.name} disabled={!me?.isOwner} onConfirm={async () => { const e = await deleteRow("inventory_items", i.id); refresh(); return e; }} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {!shown.length && <p className="py-4 text-sm text-muted-foreground">{items.length ? "No items match." : "No items yet — add your first item."}</p>}
      </Section>

      <Section title="Recent movements">
        <ul className="space-y-1 text-sm">
          {moves.map((m) => (
            <li key={m.id} className="flex justify-between gap-2 border-b py-1">
              <span>{m.inventory_items?.name} · {m.reason}</span>
              <span className={`whitespace-nowrap ${Number(m.change) < 0 ? "text-destructive" : "text-success"}`}>{Number(m.change) > 0 ? "+" : ""}{Number(m.change)} {m.inventory_items?.unit} · {new Date(m.created_at).toLocaleDateString()}</span>
            </li>
          ))}
          {!moves.length && <li className="text-muted-foreground">Nothing yet.</li>}
        </ul>
      </Section>

      <FieldsDialog
        open={dlg?.kind === "new" || dlg?.kind === "edit"} onOpenChange={(o) => !o && setDlg(null)}
        title={dlg?.kind === "edit" ? `Edit ${dlg.item?.name}` : "New item"} fields={itemFields}
        initial={dlg?.item ? toVals(dlg.item, itemFields) : { name: "", category: "Nutrients", unit: "kg", quantity: "0", reorder_level: "0" }}
        onSave={async (v) => {
          const p = fromVals(v, itemFields);
          if (!p["name"]) return "Item name required";
          const row = { name: String(p["name"]).slice(0, 100), category: (p["category"] as string) || "Other", unit: (p["unit"] as string) || "units", quantity: (p["quantity"] as number) ?? 0, reorder_level: (p["reorder_level"] as number) ?? 0 };
          if (dlg?.kind === "edit" && dlg.item) { const e = await updateRow("inventory_items", dlg.item.id, row); if (e) return e; }
          else { const { error } = await supabase.from("inventory_items").insert(row); if (error) return error.message; }
          toast.success("Item saved"); refresh(); return null;
        }}
      />
      <FieldsDialog
        open={dlg?.kind === "buy"} onOpenChange={(o) => !o && setDlg(null)} title="Purchase stock" fields={buyFields}
        initial={{ item_id: dlg?.item?.id ?? "", qty: "", cost: "", vendor: "", date: toDateKey(new Date()), notes: "" }}
        extra={<p className="text-xs text-muted-foreground">Adds to stock and records the cost as an expense in Income & expenses.</p>}
        onSave={async (v) => {
          const p = fromVals(v, buyFields);
          if (!p["item_id"]) return "Choose an item";
          if (!p["qty"] || (p["qty"] as number) <= 0) return "Enter the quantity bought";
          if (p["cost"] === null || (p["cost"] as number) < 0) return "Enter the total cost";
          const { error } = await supabase.rpc("record_purchase", {
            _item_id: p["item_id"] as string, _qty: p["qty"] as number, _cost: p["cost"] as number,
            _vendor: (p["vendor"] as string) ?? "", _date: (p["date"] as string) ?? toDateKey(new Date()), _notes: (p["notes"] as string) ?? "",
          });
          if (error) return error.message;
          toast.success("Purchase saved to stock and expenses"); refresh(); return null;
        }}
      />
      <FieldsDialog
        open={dlg?.kind === "use"} onOpenChange={(o) => !o && setDlg(null)} title="Log usage" fields={useFields}
        initial={{ item_id: dlg?.item?.id ?? "", qty: "", dir: "use", reason: "" }}
        onSave={async (v) => {
          const p = fromVals(v, useFields);
          const n = p["qty"] as number;
          if (!p["item_id"]) return "Choose an item";
          if (!n || n <= 0) return "Enter an amount";
          const label = p["dir"] === "add" ? "Correction" : p["dir"] === "waste" ? "Wasted" : "Used";
          const { error } = await supabase.from("inventory_movements").insert({
            item_id: p["item_id"] as string, change: p["dir"] === "add" ? n : -n, reason: `${label}${p["reason"] ? ` — ${String(p["reason"]).slice(0, 150)}` : ""}`,
          });
          if (error) return error.message;
          toast.success("Stock updated"); refresh(); return null;
        }}
      />
    </div>
  );
}
