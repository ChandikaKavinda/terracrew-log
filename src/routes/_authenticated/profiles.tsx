import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { useProfiles, DEFAULT_TARGETS, PROFILE_TEMPLATES, defectTagsOf, isBrix, type CropProfile } from "@/lib/crop-profiles";
import { deleteRow, updateRow } from "@/lib/db-actions";
import { PageHeader, Section } from "@/components/page-header";
import { FieldsDialog, DeleteButton, EditButton, toVals, fromVals, type Field } from "@/components/edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/profiles")({
  head: () => ({ meta: [{ title: "Crop profiles — GreenLog" }, { name: "description", content: "Seasonal targets, grading standards and defect tags per crop." }] }),
  component: ProfilesPage,
});

const fields: Field[] = [
  { key: "name", label: "Profile name", full: true },
  { key: "crop", label: "Crop" },
  { key: "season", label: "Season (e.g. Yala, Maha)" },
  { key: "grade_metric", label: "Grade by", type: "select", options: [{ value: "leaves", label: "Weight + leaf count (leafy)" }, { value: "brix", label: "Weight + Brix (fruiting)" }], full: true },
  { key: "ec_min", label: "EC min (mS/cm)", type: "number" }, { key: "ec_max", label: "EC max", type: "number" },
  { key: "ph_min", label: "pH min", type: "number" }, { key: "ph_max", label: "pH max", type: "number" },
  { key: "water_temp_min", label: "Water temp min (°C)", type: "number" }, { key: "water_temp_max", label: "Water temp max", type: "number" },
  { key: "air_temp_min", label: "Greenhouse temp min (°C)", type: "number" }, { key: "air_temp_max", label: "Greenhouse temp max", type: "number" },
  { key: "humidity_min", label: "Humidity min (%)", type: "number" }, { key: "humidity_max", label: "Humidity max", type: "number" },
  { key: "grade_a_min_g", label: "Grade A min weight (g)", type: "number" }, { key: "grade_b_min_g", label: "Grade B min weight (g)", type: "number" },
  { key: "grade_a_min_leaves", label: "Grade A min leaves (leafy)", type: "number" }, { key: "grade_b_min_leaves", label: "Grade B min leaves (leafy)", type: "number" },
  { key: "grade_a_min_brix", label: "Grade A min Brix °(fruiting)", type: "number" }, { key: "grade_b_min_brix", label: "Grade B min Brix ° (fruiting)", type: "number" },
  { key: "notes", label: "Notes", full: true },
];

function ProfilesPage() {
  const { data: profiles = [] } = useProfiles();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<CropProfile> | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tag, setTag] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["crop_profiles"] });

  const open = (p: Partial<CropProfile>) => { setEdit(p); setTags(p.defect_tags?.length ? [...p.defect_tags] : []); setTag(""); };
  const addTag = () => { const v = tag.trim(); if (v && !tags.includes(v)) setTags([...tags, v]); setTag(""); };

  return (
    <div className="space-y-6">
      <PageHeader title="Crop profiles" sub="Seasonal targets, harvest grading standards and crop-specific defect tags. Assign profiles to batches." />

      <Section title="Start from a template">
        <div className="flex flex-wrap gap-2">
          {Object.keys(PROFILE_TEMPLATES).map((k) => (
            <Button key={k} variant="outline" onClick={() => open(PROFILE_TEMPLATES[k]!)}><Plus className="h-4 w-4" /> {k}</Button>
          ))}
          <Button variant="outline" onClick={() => open({ ...DEFAULT_TARGETS, crop: "", grade_metric: "leaves" })}><Plus className="h-4 w-4" /> Blank crop</Button>
        </div>
      </Section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {profiles.map((p) => (
          <div key={p.id} className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.crop}{p.season ? ` · ${p.season}` : ""} · grade by {isBrix(p) ? "weight + Brix" : "weight + leaves"}</div>
              </div>
              <div className="flex">
                <EditButton onClick={() => open(p)} />
                <DeleteButton what={`profile ${p.name}`} disabled={!me?.isOwner} onConfirm={async () => { const e = await deleteRow("crop_profiles", p.id); refresh(); return e; }} />
              </div>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-2 text-xs">
              <dt className="text-muted-foreground">EC</dt><dd>{p.ec_min ?? "?"}–{p.ec_max ?? "?"}</dd>
              <dt className="text-muted-foreground">pH</dt><dd>{p.ph_min ?? "?"}–{p.ph_max ?? "?"}</dd>
              <dt className="text-muted-foreground">Water °C</dt><dd>{p.water_temp_min ?? "?"}–{p.water_temp_max ?? "?"}</dd>
              <dt className="text-muted-foreground">Air °C</dt><dd>{p.air_temp_min ?? "?"}–{p.air_temp_max ?? "?"}</dd>
              <dt className="text-muted-foreground">Humidity</dt><dd>{p.humidity_min ?? "?"}–{p.humidity_max ?? "?"}%</dd>
              <dt className="text-muted-foreground">Grade A</dt><dd>&gt;{p.grade_a_min_g ?? "?"} g{isBrix(p) ? `, ≥${p.grade_a_min_brix ?? "?"}° Brix` : `, ≥${p.grade_a_min_leaves ?? 0} leaves`}</dd>
              <dt className="text-muted-foreground">Grade B</dt><dd>&gt;{p.grade_b_min_g ?? "?"} g{isBrix(p) ? `, ≥${p.grade_b_min_brix ?? "?"}° Brix` : ""}</dd>
            </dl>
            <div className="mt-2 flex flex-wrap gap-1">{defectTagsOf(p).map((t) => <Badge key={t} variant="secondary" className="text-[10px] font-normal">{t}</Badge>)}</div>
          </div>
        ))}
      </div>

      <FieldsDialog
        open={!!edit} onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? "Edit crop profile" : "New crop profile"} fields={fields}
        initial={edit ? toVals(edit as Record<string, unknown>, fields) : {}}
        extra={
          <div>
            <Label>Defect tags for this crop (used in quality counters)</Label>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">{t}<button type="button" onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button></Badge>
              ))}
              {!tags.length && <span className="text-xs text-muted-foreground">None — default defect list will be used.</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <Input value={tag} placeholder="e.g. Tip burn" onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
              <Button type="button" variant="outline" onClick={addTag}>Add</Button>
            </div>
          </div>
        }
        onSave={async (v) => {
          const patch: Record<string, unknown> = { ...fromVals(v, fields), defect_tags: tags };
          if (!patch["name"]) return "Give the profile a name";
          if (!patch["crop"]) return "Enter the crop name";
          if (!patch["grade_metric"]) patch["grade_metric"] = "leaves";
          if (edit?.id) { const e = await updateRow("crop_profiles", edit.id, patch); if (e) return e; }
          else { const { error } = await supabase.from("crop_profiles").insert(patch as never); if (error) return error.message; }
          toast.success("Profile saved"); refresh(); return null;
        }}
      />
    </div>
  );
}
