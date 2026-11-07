import { FlaskConical, Wind } from "lucide-react";
import { ecDose, effectiveTankLiters, phDose, useFarmSettings, vpd, vpdStatus } from "@/lib/agronomy";
import type { Targets } from "@/lib/crop-profiles";
import { cn } from "@/lib/utils";

const tone = { ok: "border-success/40 bg-success/10", warn: "border-warning/50 bg-warning/10", bad: "border-destructive/50 bg-destructive/10" } as const;

export function DosingPanel({ ec, ph, airTemp, humidity, t, tankLevel, actualLiters }: { ec: number | null; ph: number | null; airTemp: number | null; humidity: number | null; t: Targets; tankLevel: string; actualLiters: number | null }) {
  const { data: s } = useFarmSettings();
  if (!s) return null;
  const liters = effectiveTankLiters(s.tank_liters, tankLevel, actualLiters);
  const scaled = { ...s, tank_liters: liters ?? 0 };
  const doses = liters === null ? [] : [ecDose(ec, t.ec_min, t.ec_max, scaled), phDose(ph, t.ph_min, t.ph_max, scaled)].filter((d) => d !== null);
  const v = airTemp !== null && humidity !== null ? vpd(airTemp, humidity) : null;
  const st = v !== null ? vpdStatus(v, s) : null;
  if (!doses.length && v === null && liters !== null) return null;
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><FlaskConical className="h-4 w-4" /> Dosing assistant · {liters === null ? "Volume required" : `${liters} L in tank`}</div>
        {doses.length ? doses.map((d) => (
          <p key={d.kind} className={cn("mb-1 rounded-md border px-2 py-1.5 text-sm", d.kind === "ok" ? tone.ok : tone.warn)}>{d.text}</p>
        )) : <p className="text-sm text-muted-foreground">{liters === null ? "Enter measured litres for a low or unknown tank level." : "Enter EC and pH to get a dose."}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Estimated correction using your calibration; pH response varies with water buffering. Confirm with small measured additions.</p>
        {doses.some((d) => d.kind !== "ok") && <p className="mt-1 text-xs text-muted-foreground">Add half, circulate 15 min, re-measure, then add the rest if needed.</p>}
      </div>
      <div className={cn("rounded-lg border p-3", st && tone[st.level as keyof typeof tone])}>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold"><Wind className="h-4 w-4" /> VPD</div>
        {v !== null && st ? (
          <>
            <div className="font-display text-2xl font-bold">{v} kPa <span className="text-base font-medium">· {st.label}</span></div>
            <p className="text-sm">{st.advice}</p>
            <p className="mt-1 text-xs text-muted-foreground">Ideal {s.vpd_min}–{s.vpd_max} kPa</p>
          </>
        ) : <p className="text-sm text-muted-foreground">Enter greenhouse temp and humidity.</p>}
      </div>
    </div>
  );
}
