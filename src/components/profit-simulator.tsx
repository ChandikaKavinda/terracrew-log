import { useState } from "react";
import { simulateUnitCost, type SimInput } from "@/lib/agronomy";
import { LKR } from "@/lib/use-me";
import { Section } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

const DEFAULTS: SimInput = { plants: 500, cycleDays: 35, mortalityPct: 5, headWeightG: 200, dailyCost: 1000, inputCostPerPlant: 20, packagingPerHead: 10, pricePerHead: 150 };
const FIELDS: { k: keyof SimInput; label: string; min: number; max: number; step: number; slider?: boolean }[] = [
  { k: "cycleDays", label: "Harvest cycle (days)", min: 20, max: 70, step: 1, slider: true },
  { k: "mortalityPct", label: "Mortality rate (%)", min: 0, max: 50, step: 0.5, slider: true },
  { k: "packagingPerHead", label: "Packaging cost per head (Rs)", min: 0, max: 60, step: 0.5, slider: true },
  { k: "pricePerHead", label: "Selling price per head (Rs)", min: 0, max: 500, step: 5, slider: true },
  { k: "plants", label: "Plants transplanted", min: 1, max: 510, step: 1 },
  { k: "headWeightG", label: "Avg head weight (g)", min: 1, max: 1000, step: 5 },
  { k: "dailyCost", label: "Daily running cost (Rs/day)", min: 0, max: 100000, step: 50 },
  { k: "inputCostPerPlant", label: "Seed, nutrient & media per plant (Rs)", min: 0, max: 500, step: 1 },
];

export function ProfitSimulator() {
  const [v, setV] = useState(DEFAULTS);
  const s = simulateUnitCost(v);
  const set = (k: keyof SimInput, n: number) => setV((x) => ({ ...x, [k]: Number.isFinite(n) ? n : 0 }));
  const stat = (label: string, val: string, tone?: "good" | "bad") => (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold tabular-nums ${tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : ""}`}>{val}</div>
    </div>
  );
  return (
    <Section title="Unit cost & profit simulator" desc="Adjust the levers to see cost per kg and profit for one harvest cycle. Nothing here is saved.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {FIELDS.map((f) => (
            <div key={f.k} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`sim-${f.k}`}>{f.label}</Label>
                <Input id={`sim-${f.k}`} type="number" className="h-8 w-28 text-right" min={f.min} step={f.step} value={v[f.k]} onChange={(e) => set(f.k, Number(e.target.value))} />
              </div>
              {f.slider && <Slider min={f.min} max={f.max} step={f.step} value={[v[f.k]]} onValueChange={([n]) => set(f.k, n ?? 0)} />}
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setV(DEFAULTS)}>Reset</Button>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border-2 border-primary bg-primary/10 p-4">
            <div className="text-sm text-muted-foreground">Final cost per kg</div>
            <div className="text-3xl font-bold tabular-nums">{s.costPerKg != null ? LKR(s.costPerKg) : "—"}</div>
            <div className="text-xs text-muted-foreground">Selling at {s.pricePerKg != null ? LKR(s.pricePerKg) : "—"} per kg</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stat("Sellable heads", String(s.heads))}
            {stat("Yield", `${s.kg} kg`)}
            {stat("Cost per head", s.costPerHead != null ? LKR(s.costPerHead) : "—")}
            {stat("Total cost", LKR(s.totalCost))}
            {stat("Revenue", LKR(s.revenue))}
            {stat("Profit", LKR(s.profit), s.profit >= 0 ? "good" : "bad")}
            {stat("Margin", s.marginPct != null ? `${s.marginPct}%` : "—", (s.marginPct ?? 0) >= 0 ? "good" : "bad")}
            {stat("Profit per day", s.profitPerDay != null ? LKR(s.profitPerDay) : "—")}
          </div>
        </div>
      </div>
    </Section>
  );
}
