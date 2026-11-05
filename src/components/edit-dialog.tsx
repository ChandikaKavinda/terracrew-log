import { useEffect, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export type Field = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "time" | "select" | "bool";
  options?: { value: string; label: string }[];
  full?: boolean;
};

type Vals = Record<string, string | boolean>;

/** Turn a DB row into form strings. */
export function toVals(row: Record<string, unknown>, fields: Field[]): Vals {
  const v: Vals = {};
  for (const f of fields) {
    const x = row[f.key];
    v[f.key] = f.type === "bool" ? !!x : x === null || x === undefined ? "" : String(x);
  }
  return v;
}

/** Turn form strings back into DB values (empty → null, numbers parsed). */
export function fromVals(v: Vals, fields: Field[]): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const f of fields) {
    const x = v[f.key];
    if (f.type === "bool") out[f.key] = !!x;
    else if (x === "" || x === undefined) out[f.key] = null;
    else if (f.type === "number") out[f.key] = Number(x);
    else out[f.key] = String(x);
  }
  return out;
}

export function FieldsDialog({
  open, onOpenChange, title, fields, initial, onSave, extra,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; fields: Field[];
  initial: Vals; onSave: (v: Vals) => Promise<string | null | void>; extra?: ReactNode;
}) {
  const [v, setV] = useState<Vals>(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setV(initial); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const err = await onSave(v);
    setBusy(false);
    if (err) { toast.error(err); return; }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                {f.type === "bool" ? (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <Label>{f.label}</Label>
                    <Switch checked={!!v[f.key]} onCheckedChange={(c) => setV({ ...v, [f.key]: c })} />
                  </div>
                ) : f.type === "select" ? (
                  <>
                    <Label>{f.label}</Label>
                    <Select value={String(v[f.key] ?? "")} onValueChange={(x) => setV({ ...v, [f.key]: x === "__none" ? "" : x })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{f.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <Label>{f.label}</Label>
                    <Input type={f.type ?? "text"} step={f.type === "number" ? "any" : undefined} value={String(v[f.key] ?? "")} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
                  </>
                )}
              </div>
            ))}
          </div>
          {extra}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteButton({ what, onConfirm, disabled }: { what: string; onConfirm: () => Promise<string | null | void>; disabled?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={disabled} title={disabled ? "Only the owner can delete" : "Delete"}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {what}?</AlertDialogTitle>
          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={async () => { const err = await onConfirm(); if (err) toast.error(err); else toast.success("Deleted"); }}
          >Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClick} title="Edit">
      <Pencil className="h-4 w-4" />
    </Button>
  );
}
