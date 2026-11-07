ALTER TABLE public.crop_profiles ADD COLUMN stage_targets jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.batches ADD COLUMN sentinel_pot_ids text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.daily_checks ADD COLUMN tank_liters_actual numeric, ADD COLUMN growth_stage text;
ALTER TABLE public.growth_measurements ADD COLUMN pot_id text;
ALTER TABLE public.harvests ADD COLUMN profile_id uuid REFERENCES public.crop_profiles(id);
CREATE TABLE public.batch_losses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE, lost_on date NOT NULL DEFAULT CURRENT_DATE, quantity integer NOT NULL CHECK (quantity > 0), kind text NOT NULL CHECK (kind IN ('cull','mortality')), reason text, created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.batch_losses TO authenticated;
GRANT ALL ON public.batch_losses TO service_role;
ALTER TABLE public.batch_losses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read losses" ON public.batch_losses FOR SELECT TO authenticated USING (true);
CREATE POLICY "members insert losses" ON public.batch_losses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "members update losses" ON public.batch_losses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "owner delete losses" ON public.batch_losses FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.reconcile_batch_population() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE bid uuid; initial_count integer; removed integer; final_day date;
BEGIN
 IF TG_OP='DELETE' THEN bid:=OLD.batch_id; ELSE bid:=NEW.batch_id; END IF;
 SELECT plant_count INTO initial_count FROM public.batches WHERE id=bid FOR UPDATE;
 SELECT COALESCE(sum(plants_harvested),0) INTO removed FROM public.harvests WHERE batch_id=bid;
 removed:=removed+(SELECT COALESCE(sum(quantity),0) FROM public.batch_losses WHERE batch_id=bid);
 IF initial_count IS NOT NULL AND removed>initial_count THEN RAISE EXCEPTION 'Harvests and losses exceed the batch plant count'; END IF;
 SELECT max(d) INTO final_day FROM (SELECT harvested_on d FROM public.harvests WHERE batch_id=bid UNION ALL SELECT lost_on d FROM public.batch_losses WHERE batch_id=bid) dates;
 IF initial_count>0 AND removed=initial_count THEN UPDATE public.batches SET status='harvested',harvested_on=final_day WHERE id=bid;
 ELSIF initial_count>0 AND removed<initial_count THEN UPDATE public.batches SET status='growing',harvested_on=NULL WHERE id=bid AND status='harvested'; END IF;
 IF TG_OP='UPDATE' AND OLD.batch_id IS DISTINCT FROM NEW.batch_id THEN RAISE EXCEPTION 'Keep the original batch when editing; delete and recreate to move records'; END IF;
 RETURN NULL;
END; $$;
CREATE TRIGGER harvest_population AFTER INSERT OR UPDATE OR DELETE ON public.harvests FOR EACH ROW EXECUTE FUNCTION public.reconcile_batch_population();
CREATE TRIGGER loss_population AFTER INSERT OR UPDATE OR DELETE ON public.batch_losses FOR EACH ROW EXECUTE FUNCTION public.reconcile_batch_population();